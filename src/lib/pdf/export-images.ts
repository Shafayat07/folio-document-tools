/**
 * Export project pages as images.
 *
 * Serves both "PDF → JPG/PNG" and the image-format converters (JPG → PNG,
 * HEIC → JPG, …). Reuses the PDF raster pipeline so page edits — rotation,
 * crop, perspective, readability modes — are honoured either way.
 */
import { AppError, toAppError } from "@/lib/core/errors";
import { nextFrame, sanitizeFileName } from "@/lib/core/utils";
import {
  IMAGE_FORMAT_META,
  type CompressionId,
  type ImageFormatId,
  type OutputFile,
  type PdfSettings,
  type ProjectPage,
  type QualityId,
  type SourceFile,
} from "@/lib/core/types";
import { canEncode, canvasToBlob, rasterize, releaseCanvas, type AnyCanvas } from "@/lib/image/canvas";
import { createZip, uniqueNames } from "@/lib/export/zip";
import { rasterBudget, rasterForPage } from "./generate";

export type ImageFormat = ImageFormatId;

/** How output files are named. */
export type ImageNaming = "sequence" | "source";

export interface ImageExportOptions {
  pages: ProjectPage[];
  files: Map<string, SourceFile>;
  format: ImageFormat;
  quality: QualityId;
  compression: CompressionId;
  baseName: string;
  naming?: ImageNaming;
  /**
   * Longest output edge. `null` keeps the source resolution, which is what a
   * format conversion should do by default.
   */
  maxEdge?: number | null;
  /** Bundle more than one image into a single .zip download. */
  zip?: boolean;
  onProgress?: (progress: { done: number; total: number; label: string }) => void;
  signal?: AbortSignal;
}

/** Derive an output name from the page's own source file name. */
function sourceName(page: ProjectPage, extension: string): string {
  // Labels look like "scan.jpg" or "report.pdf · p3".
  const [base, part] = page.label.split(" · ");
  const stem = sanitizeFileName(base, "image");
  return part ? `${stem}-${part}.${extension}` : `${stem}.${extension}`;
}

export async function exportPagesAsImages(options: ImageExportOptions): Promise<OutputFile[]> {
  const {
    pages,
    files,
    format,
    quality,
    compression,
    baseName,
    naming = "sequence",
    maxEdge = null,
    zip = true,
    onProgress,
    signal,
  } = options;

  if (!pages.length) {
    throw new AppError("empty-project", "Nothing to export", "Add at least one page before exporting images.");
  }

  const meta = IMAGE_FORMAT_META[format];

  // Canvas silently substitutes PNG for formats it cannot encode, so check
  // first rather than handing back a mislabelled file.
  if (!(await canEncode(meta.mime))) {
    throw new AppError(
      "unsupported-type",
      `${meta.label} is not supported here`,
      `This browser cannot save ${meta.label} images.`,
      "Choose PNG or JPG instead, or try a different browser.",
    );
  }

  const budget = rasterBudget({ quality, compression } as PdfSettings);
  // A format conversion should not quietly shrink the image.
  const effectiveBudget = { ...budget, maxEdge: maxEdge ?? Number.MAX_SAFE_INTEGER };

  const safeBase = sanitizeFileName(baseName, "image");
  const outputs: OutputFile[] = [];
  const failures: string[] = [];
  const pad = pages.length >= 100 ? 3 : 2;

  try {
    for (let index = 0; index < pages.length; index += 1) {
      if (signal?.aborted) throw new AppError("generate-failed", "Cancelled", "Export was cancelled.");
      const page = pages[index];
      const file = files.get(page.fileId);
      if (!file) continue;

      onProgress?.({ done: index, total: pages.length, label: `Converting ${index + 1} of ${pages.length}` });
      if (index % 2 === 0) await nextFrame();

      let canvas: AnyCanvas | null = null;
      try {
        const raster = await rasterForPage(page, file, effectiveBudget);
        canvas = raster.canvas;
        // Image exports have no page box, so rotation must be baked in.
        if (page.rotation !== 0) {
          const rotated = rasterize(canvas, { rotation: page.rotation, background: "#ffffff" });
          releaseCanvas(canvas);
          canvas = rotated;
        }
        // Transparency is already flattened onto white by the raster stage,
        // which is what JPEG (no alpha channel) requires and what a document
        // tool should produce for the other formats too.
        const blob = await canvasToBlob(canvas, meta.mime, budget.jpegQuality);
        outputs.push({
          name:
            naming === "source"
              ? sourceName(page, meta.ext)
              : `${safeBase}-${String(index + 1).padStart(pad, "0")}.${meta.ext}`,
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
        failures.length ? "None of the pages could be converted." : "No pages were exported.",
        "Try a lower image quality, or remove the pages that fail.",
      );
    }

    onProgress?.({ done: pages.length, total: pages.length, label: "Packaging files" });

    if (zip && outputs.length > 1) {
      const names = uniqueNames(outputs.map((o) => o.name));
      const archive = await createZip(outputs.map((o, i) => ({ name: names[i], blob: o.blob })));
      return [
        {
          name: `${safeBase}-${meta.ext}.zip`,
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
