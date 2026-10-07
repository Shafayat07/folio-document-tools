/**
 * PDF generation.
 *
 * Two paths per page, chosen automatically:
 *
 *  - **Lossless** — a page that came from a PDF and has no pixel edits is
 *    copied (or embedded as vector content), so text stays selectable and
 *    line art stays sharp.
 *  - **Raster** — images, and PDF pages with crop/perspective/filters, are
 *    rendered at a resolution derived from the quality + compression settings.
 *
 * Everything runs in the browser; no bytes leave the device.
 */
import { PDFDocument, degrees, type PDFEmbeddedPage, type PDFImage, type PDFPage } from "pdf-lib";
import {
  COMPRESSION_FACTORS,
  QUALITY_PRESETS,
  type OutputFile,
  type PdfSettings,
  type ProjectPage,
  type SourceFile,
} from "@/lib/core/types";
import { AppError, outOfMemory, toAppError } from "@/lib/core/errors";
import { clamp, nextFrame, sanitizeFileName } from "@/lib/core/utils";
import { decodeImage } from "@/lib/files/decode";
import {
  canvasToBlob,
  getImageData,
  putImageData,
  rasterize,
  releaseCanvas,
  sourceSize,
  type AnyCanvas,
} from "@/lib/image/canvas";
import { hasPixelWork } from "@/lib/image/filters";
import { isFullQuad, quadOutputSize } from "@/lib/image/perspective";
import { adjustPixels, warpPixels } from "@/lib/workers/processing-client";
import { openPdf } from "./pdfjs";
import { renderPdfPage } from "./render";
import { centreCropForAspect, computeLayout } from "./layout";

export interface GenerateProgress {
  done: number;
  total: number;
  label: string;
}

export interface GenerateOptions {
  pages: ProjectPage[];
  files: Map<string, SourceFile>;
  settings: PdfSettings;
  onProgress?: (progress: GenerateProgress) => void;
  signal?: AbortSignal;
}

export interface RasterBudget {
  maxEdge: number;
  jpegQuality: number;
  pdfScale: number;
}

export function rasterBudget(settings: PdfSettings): RasterBudget {
  const preset = QUALITY_PRESETS[settings.quality];
  const factor = COMPRESSION_FACTORS[settings.compression];
  return {
    maxEdge: Math.round(preset.maxEdge * factor.edge),
    jpegQuality: clamp(preset.jpegQuality * factor.quality, 0.4, 0.97),
    pdfScale: clamp(preset.pdfScale * factor.edge, 0.5, 4),
  };
}

/** True when a page needs pixels (as opposed to vector passthrough). */
function needsRaster(page: ProjectPage): boolean {
  return page.kind === "image" || !!page.crop || (!!page.quad && !isFullQuad(page.quad)) || hasPixelWork(page.adjustments);
}

/**
 * Place a drawable so that, after a clockwise rotation, it exactly fills `box`.
 *
 * pdf-lib rotates counter-clockwise about the anchor, so both the anchor
 * corner and the pre-rotation width/height have to be derived from the target
 * box rather than passed through.
 */
function drawRotated(
  page: PDFPage,
  drawable: { kind: "image"; value: PDFImage } | { kind: "page"; value: PDFEmbeddedPage },
  box: { x: number; y: number; width: number; height: number },
  rotationCw: number,
) {
  const cw = ((Math.round(rotationCw / 90) * 90) % 360 + 360) % 360;
  const swapped = cw === 90 || cw === 270;

  // Pre-rotation size: swapped so the rotated bounding box matches `box`.
  const width = swapped ? box.height : box.width;
  const height = swapped ? box.width : box.height;

  let x = box.x;
  let y = box.y;
  if (cw === 90) {
    y = box.y + box.height;
  } else if (cw === 180) {
    x = box.x + box.width;
    y = box.y + box.height;
  } else if (cw === 270) {
    x = box.x + box.width;
  }

  const options = { x, y, width, height, rotate: degrees((360 - cw) % 360) };
  if (drawable.kind === "image") page.drawImage(drawable.value, options);
  else page.drawPage(drawable.value, options);
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new AppError("generate-failed", "Cancelled", "PDF creation was cancelled.");
}

/** Encode a rendered canvas for embedding. */
async function encodeForPdf(canvas: AnyCanvas, page: ProjectPage, budget: RasterBudget) {
  // Bilevel scans compress far better (and stay crisper) as PNG.
  const usePng = page.adjustments.mode === "bw";
  const blob = await canvasToBlob(canvas, usePng ? "image/png" : "image/jpeg", budget.jpegQuality);
  return { bytes: new Uint8Array(await blob.arrayBuffer()), png: usePng, byteLength: blob.size };
}

export interface RasterResult {
  canvas: AnyCanvas;
  /** Canvas pixel size (un-rotated). */
  width: number;
  height: number;
  /**
   * Content size in the source's own units — pixels for images, points for
   * PDF pages — after cropping but before rotation and downscaling. Used so
   * the "Original size" paper option does not drift with the quality setting.
   */
  naturalWidth: number;
  naturalHeight: number;
}

/**
 * Render one page's pixels at export resolution, with all edits baked in.
 * Shared with the image-export tools.
 */
export async function rasterForPage(
  page: ProjectPage,
  file: SourceFile,
  budget: RasterBudget,
): Promise<RasterResult> {
  const useQuad = !!page.quad && !isFullQuad(page.quad);

  if (page.kind === "pdf") {
    const doc = await openPdf(file.id, file.blob, file.name);
    const rendered = await renderPdfPage(doc, page.sourceIndex, { scale: budget.pdfScale });
    const renderedSize = sourceSize(rendered);
    // Points per rendered pixel, so natural sizes stay in PDF units.
    const pointsPerPixel = 1 / budget.pdfScale;

    let canvas: AnyCanvas = rendered;

    if (useQuad) {
      const data = getImageData(canvas);
      const target = quadOutputSize(page.quad!, data.width, data.height);
      const scale = Math.min(1, budget.maxEdge / Math.max(target.width, target.height));
      const warped = await warpPixels(
        data,
        page.quad!,
        Math.max(16, Math.round(target.width * scale)),
        Math.max(16, Math.round(target.height * scale)),
        hasPixelWork(page.adjustments) ? page.adjustments : undefined,
      );
      releaseCanvas(canvas);
      canvas = putImageData(warped);
      const size = sourceSize(canvas);
      return {
        canvas,
        width: size.width,
        height: size.height,
        naturalWidth: target.width * pointsPerPixel,
        naturalHeight: target.height * pointsPerPixel,
      };
    }

    const cropped = rasterize(canvas, { crop: page.crop, maxEdge: budget.maxEdge, background: "#ffffff" });
    if (cropped !== canvas) releaseCanvas(canvas);
    canvas = cropped;
    if (hasPixelWork(page.adjustments)) {
      const adjusted = await adjustPixels(getImageData(canvas), page.adjustments);
      releaseCanvas(canvas);
      canvas = putImageData(adjusted);
    }

    const size = sourceSize(canvas);
    const cropW = page.crop ? page.crop.width : 1;
    const cropH = page.crop ? page.crop.height : 1;
    return {
      canvas,
      width: size.width,
      height: size.height,
      naturalWidth: renderedSize.width * cropW * pointsPerPixel,
      naturalHeight: renderedSize.height * cropH * pointsPerPixel,
    };
  }

  const decoded = await decodeImage(file.displayBlob ?? file.blob, file.name, file.ext);
  try {
    if (useQuad) {
      const flat = rasterize(decoded.bitmap, { maxEdge: Math.max(budget.maxEdge, 1600), background: "#ffffff" });
      const data = getImageData(flat);
      releaseCanvas(flat);
      const target = quadOutputSize(page.quad!, data.width, data.height);
      const scale = Math.min(1, budget.maxEdge / Math.max(target.width, target.height));
      const warped = await warpPixels(
        data,
        page.quad!,
        Math.max(16, Math.round(target.width * scale)),
        Math.max(16, Math.round(target.height * scale)),
        hasPixelWork(page.adjustments) ? page.adjustments : undefined,
      );
      const canvas = putImageData(warped);
      const size = sourceSize(canvas);
      // Scale the detected quad back up to original-image pixels.
      const ratio = decoded.width / Math.max(1, data.width);
      return {
        canvas,
        width: size.width,
        height: size.height,
        naturalWidth: target.width * ratio,
        naturalHeight: target.height * ratio,
      };
    }

    let canvas = rasterize(decoded.bitmap, {
      crop: page.crop,
      maxEdge: budget.maxEdge,
      background: "#ffffff",
    });
    if (hasPixelWork(page.adjustments)) {
      const adjusted = await adjustPixels(getImageData(canvas), page.adjustments);
      releaseCanvas(canvas);
      canvas = putImageData(adjusted);
    }

    const size = sourceSize(canvas);
    const cropW = page.crop ? page.crop.width : 1;
    const cropH = page.crop ? page.crop.height : 1;
    return {
      canvas,
      width: size.width,
      height: size.height,
      naturalWidth: decoded.width * cropW,
      naturalHeight: decoded.height * cropH,
    };
  } finally {
    decoded.release();
  }
}

/** Apply `cover` by centre-cropping the raster to the target aspect ratio. */
function applyCoverCrop(canvas: AnyCanvas, aspect: number): AnyCanvas {
  const { width, height } = sourceSize(canvas);
  const crop = centreCropForAspect(width, height, aspect);
  if (!crop) return canvas;
  return rasterize(canvas, { crop, background: "#ffffff" });
}

/** A PDF page can be copied verbatim only when nothing about it changes. */
function canCopyVerbatim(page: ProjectPage, settings: PdfSettings): boolean {
  return (
    !needsRaster(page) &&
    settings.pageSize === "original" &&
    settings.margin === "none" &&
    settings.orientation === "auto"
  );
}

/** Draw a vector page; returns false when the source could not be embedded. */
async function addVectorPage(
  out: PDFDocument,
  srcDoc: PDFDocument,
  page: ProjectPage,
  settings: PdfSettings,
): Promise<boolean> {
  const srcPage = srcDoc.getPage(page.sourceIndex);
  const intrinsic = ((srcPage.getRotation().angle % 360) + 360) % 360;
  const totalRotation = (intrinsic + page.rotation) % 360;

  if (canCopyVerbatim(page, settings)) {
    const [copied] = await out.copyPages(srcDoc, [page.sourceIndex]);
    copied.setRotation(degrees(totalRotation));
    out.addPage(copied);
    return true;
  }

  const embedded = await out.embedPage(srcPage);
  const swapped = totalRotation === 90 || totalRotation === 270;
  const displayW = swapped ? embedded.height : embedded.width;
  const displayH = swapped ? embedded.width : embedded.height;

  const layout = computeLayout(displayW, displayH, settings);
  const target = out.addPage([layout.pageWidth, layout.pageHeight]);

  let box = layout.content;
  if (layout.coverAspect) {
    // Vector content cannot be centre-cropped, so scale to cover and let the
    // page boundary clip the overflow.
    const { width: boxW, height: boxH } = layout.content;
    const scale = Math.max(boxW / displayW, boxH / displayH);
    const drawW = displayW * scale;
    const drawH = displayH * scale;
    box = {
      x: layout.content.x + (boxW - drawW) / 2,
      y: layout.content.y + (boxH - drawH) / 2,
      width: drawW,
      height: drawH,
    };
  }

  drawRotated(target, { kind: "page", value: embedded }, box, totalRotation);
  return true;
}

export async function generatePdf(options: GenerateOptions): Promise<OutputFile> {
  const { pages, files, settings, onProgress, signal } = options;

  if (!pages.length) {
    throw new AppError("empty-project", "Nothing to export", "Add at least one page before creating a PDF.");
  }

  const budget = rasterBudget(settings);
  const out = await PDFDocument.create();
  out.setProducer("Folio — browser document tools");
  out.setCreator("Folio");
  out.setTitle(sanitizeFileName(settings.fileName, "document"));
  out.setCreationDate(new Date());

  // pdf-lib documents for the lossless path, loaded at most once per file.
  const sourceDocs = new Map<string, PDFDocument | null>();
  const loadSourceDoc = async (file: SourceFile): Promise<PDFDocument | null> => {
    if (sourceDocs.has(file.id)) return sourceDocs.get(file.id)!;
    try {
      const bytes = new Uint8Array(await file.blob.arrayBuffer());
      const doc = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
      sourceDocs.set(file.id, doc);
      return doc;
    } catch {
      // Unreadable by pdf-lib (unusual encryption, damaged xref). pdf.js can
      // often still render it, so fall back to the raster path.
      sourceDocs.set(file.id, null);
      return null;
    }
  };

  const total = pages.length;
  const failed: string[] = [];

  try {
    for (let index = 0; index < pages.length; index += 1) {
      throwIfAborted(signal);
      const page = pages[index];
      const file = files.get(page.fileId);
      if (!file) continue;

      onProgress?.({ done: index, total, label: `Processing page ${index + 1} of ${total}` });
      if (index % 2 === 0) await nextFrame();

      // Vector path first when possible.
      if (!needsRaster(page)) {
        const srcDoc = await loadSourceDoc(file);
        if (srcDoc) {
          try {
            await addVectorPage(out, srcDoc, page, settings);
            continue;
          } catch {
            // Fall through to raster.
          }
        }
      }

      let raster: RasterResult;
      try {
        raster = await rasterForPage(page, file, budget);
      } catch (error) {
        if (error instanceof AppError && error.code === "out-of-memory") throw error;
        failed.push(page.label);
        continue;
      }

      let canvas = raster.canvas;
      let { width, height } = raster;
      const swapped = page.rotation === 90 || page.rotation === 270;

      const layout = computeLayout(
        settings.pageSize === "original"
          ? swapped
            ? raster.naturalHeight
            : raster.naturalWidth
          : swapped
            ? height
            : width,
        settings.pageSize === "original"
          ? swapped
            ? raster.naturalWidth
            : raster.naturalHeight
          : swapped
            ? width
            : height,
        settings,
      );

      if (layout.coverAspect) {
        // The canvas is un-rotated, so invert the aspect for rotated pages.
        const aspect = swapped ? 1 / layout.coverAspect : layout.coverAspect;
        const cropped = applyCoverCrop(canvas, aspect);
        if (cropped !== canvas) {
          releaseCanvas(canvas);
          canvas = cropped;
        }
        const size = sourceSize(canvas);
        width = size.width;
        height = size.height;
      }

      const encoded = await encodeForPdf(canvas, page, budget);
      const image = encoded.png ? await out.embedPng(encoded.bytes) : await out.embedJpg(encoded.bytes);
      const target = out.addPage([layout.pageWidth, layout.pageHeight]);
      drawRotated(target, { kind: "image", value: image }, layout.content, page.rotation);
      releaseCanvas(canvas);
    }

    throwIfAborted(signal);

    if (!out.getPageCount()) {
      throw new AppError(
        "generate-failed",
        "No pages could be processed",
        failed.length
          ? `None of the pages could be read (${failed.slice(0, 3).join(", ")}${failed.length > 3 ? "…" : ""}).`
          : "None of the pages could be read.",
        "Try re-adding the files, or remove the pages that fail.",
      );
    }

    onProgress?.({ done: total, total, label: "Writing PDF" });
    await nextFrame();

    const bytes = await out.save({ useObjectStreams: true, addDefaultPage: false });
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });

    return {
      name: `${sanitizeFileName(settings.fileName, "document")}.pdf`,
      blob,
      pageCount: out.getPageCount(),
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    if (/memory|allocation/i.test(message)) throw outOfMemory();
    throw toAppError(
      error,
      new AppError(
        "generate-failed",
        "PDF could not be created",
        "Something went wrong while building the PDF.",
        "Try removing the page that failed, or lowering the image quality.",
      ),
    );
  } finally {
    sourceDocs.clear();
  }
}

/**
 * Estimate the output size by fully processing a small sample of pages and
 * extrapolating. Always presented to the user as an estimate.
 */
export async function estimateOutputSize(options: Omit<GenerateOptions, "onProgress">): Promise<number | null> {
  const { pages, files, settings, signal } = options;
  if (!pages.length) return null;

  const budget = rasterBudget(settings);
  const sampleIndices =
    pages.length <= 3 ? pages.map((_, i) => i) : [0, Math.floor(pages.length / 2), pages.length - 1];

  let sampled = 0;
  let bytes = 0;

  for (const index of sampleIndices) {
    if (signal?.aborted) return null;
    const page = pages[index];
    const file = files.get(page.fileId);
    if (!file) continue;

    try {
      if (!needsRaster(page)) {
        // Vector pages: use the source file's average page weight.
        bytes += file.size / Math.max(1, file.pageCount);
        sampled += 1;
        continue;
      }
      const raster = await rasterForPage(page, file, budget);
      const encoded = await encodeForPdf(raster.canvas, page, budget);
      releaseCanvas(raster.canvas);
      bytes += encoded.byteLength;
      sampled += 1;
    } catch {
      /* skip unreadable sample */
    }
  }

  if (!sampled) return null;
  return Math.round((bytes / sampled) * pages.length + 2048);
}
