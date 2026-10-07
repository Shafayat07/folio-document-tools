/**
 * Export project pages as images (PDF → JPG / PNG, and image passthrough).
 * Reuses the same raster pipeline as PDF generation so edits are honoured.
 */
import { AppError, toAppError } from "@/lib/core/errors";
import { nextFrame, sanitizeFileName } from "@/lib/core/utils";
import type { CompressionId, OutputFile, PdfSettings, ProjectPage, QualityId, SourceFile } from "@/lib/core/types";
import { canvasToBlob, rasterize, releaseCanvas, type AnyCanvas } from "@/lib/image/canvas";
import { createZip, uniqueNames } from "@/lib/export/zip";
import { rasterBudget, rasterForPage } from "./generate";

export type ImageFormat = "jpeg" | "png";

export interface ImageExportOptions {
  pages: ProjectPage[];
  files: Map<string, SourceFile>;
  format: ImageFormat;
  quality: QualityId;
  compression: CompressionId;
  baseName: string;
  /** Bundle more than one image into a single .zip download. */
  zip?: boolean;
  onProgress?: (progress: { done: number; total: number; label: string }) => void;
  signal?: AbortSignal;
}

export async function exportPagesAsImages(options: ImageExportOptions): Promise<OutputFile[]> {
  const { pages, files, format, quality, compression, baseName, zip = true, onProgress, signal } = options;

  if (!pages.length) {
    throw new AppError("empty-project", "Nothing to export", "Add at least one page before exporting images.");
  }

  const budget = rasterBudget({ quality, compression } as PdfSettings);
  const extension = format === "png" ? "png" : "jpg";
  const safeBase = sanitizeFileName(baseName, "page");
  const outputs: OutputFile[] = [];
  const failures: string[] = [];

  try {
    for (let index = 0; index < pages.length; index += 1) {
      if (signal?.aborted) throw new AppError("generate-failed", "Cancelled", "Export was cancelled.");
      const page = pages[index];
      const file = files.get(page.fileId);
      if (!file) continue;

      onProgress?.({ done: index, total: pages.length, label: `Rendering page ${index + 1} of ${pages.length}` });
      if (index % 2 === 0) await nextFrame();

      let canvas: AnyCanvas | null = null;
      try {
        const raster = await rasterForPage(page, file, budget);
        canvas = raster.canvas;
        // Image exports have no page box, so rotation must be baked in.
        if (page.rotation !== 0) {
          const rotated = rasterize(canvas, { rotation: page.rotation, background: "#ffffff" });
          releaseCanvas(canvas);
          canvas = rotated;
        }
        const blob = await canvasToBlob(canvas, format === "png" ? "image/png" : "image/jpeg", budget.jpegQuality);
        outputs.push({
          name: `${safeBase}-${String(index + 1).padStart(pages.length >= 100 ? 3 : 2, "0")}.${extension}`,
          blob,
        });
      } catch (error) {
        if (error instanceof AppError && error.code === "out-of-memory") throw error;
        failures.push(page.label);
      } finally {
        releaseCanvas(canvas);
      }
    }

    if (!outputs.length) {
      throw new AppError(
        "generate-failed",
        "Export failed",
        failures.length ? "None of the pages could be rendered." : "No pages were exported.",
        "Try a lower image quality, or remove the pages that fail.",
      );
    }

    onProgress?.({ done: pages.length, total: pages.length, label: "Packaging files" });

    if (zip && outputs.length > 1) {
      const names = uniqueNames(outputs.map((o) => o.name));
      const archive = await createZip(outputs.map((o, i) => ({ name: names[i], blob: o.blob })));
      return [
        {
          name: `${safeBase}-${extension}.zip`,
          blob: archive,
          countLabel: `${outputs.length} ${outputs.length === 1 ? "image" : "images"}`,
        },
      ];
    }

    return outputs;
  } catch (error) {
    throw toAppError(
      error,
      new AppError("generate-failed", "Export failed", "The images could not be exported.", "Try again with fewer pages."),
    );
  }
}
