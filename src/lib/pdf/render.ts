import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { AppError } from "@/lib/core/errors";
import { nextFrame } from "@/lib/core/utils";
import { createCanvas, context2d, type AnyCanvas } from "@/lib/image/canvas";
import { openPdf } from "./pdfjs";

/**
 * By default pdf.js schedules each chunk of a display render with
 * `requestAnimationFrame`, which never fires in a background tab — a render
 * started before the user switches away would stall forever. Taking over
 * `onContinue` keeps rendering driven by a timer-backed yield instead.
 */
export function keepRenderAlive(task: RenderTask): RenderTask {
  task.onContinue = (cont: () => void) => {
    void nextFrame().then(cont);
  };
  return task;
}

export interface PdfPageInfo {
  index: number;
  /** Size in points, with the page's own /Rotate already applied. */
  width: number;
  height: number;
}

/** Read page count and per-page dimensions without rasterising anything. */
export async function readPdfStructure(fileId: string, blob: Blob, name: string) {
  const doc = await openPdf(fileId, blob, name);
  const pages: PdfPageInfo[] = [];
  for (let i = 1; i <= doc.numPages; i += 1) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    pages.push({ index: i - 1, width: viewport.width, height: viewport.height });
    page.cleanup();
  }
  return { pageCount: doc.numPages, pages };
}

interface RenderOptions {
  /** Render so the longest edge is about this many pixels. */
  maxEdge?: number;
  /** Explicit scale factor; overrides maxEdge. */
  scale?: number;
  /** Extra clockwise rotation on top of the page's own. */
  rotation?: number;
  background?: string;
}

/** Rasterise one PDF page to a canvas. */
export async function renderPdfPage(
  doc: PDFDocumentProxy,
  pageIndex: number,
  options: RenderOptions = {},
): Promise<AnyCanvas> {
  const { maxEdge = 1200, scale, rotation = 0, background = "#ffffff" } = options;
  const page = await doc.getPage(pageIndex + 1);

  try {
    const base = page.getViewport({ scale: 1, rotation });
    const effectiveScale = scale ?? Math.min(maxEdge / Math.max(base.width, base.height), 8);
    const viewport = page.getViewport({ scale: Math.max(effectiveScale, 0.05), rotation });

    const canvas = createCanvas(viewport.width, viewport.height);
    const ctx = context2d(canvas);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, (canvas as HTMLCanvasElement).width, (canvas as HTMLCanvasElement).height);

    await keepRenderAlive(
      page.render({
        canvasContext: ctx as CanvasRenderingContext2D,
        viewport,
      }),
    ).promise;

    return canvas;
  } catch (error) {
    throw new AppError(
      "render-failed",
      "Page could not be rendered",
      `Page ${pageIndex + 1} of this PDF could not be displayed.`,
      error instanceof Error ? undefined : "The page may use unsupported features.",
    );
  } finally {
    page.cleanup();
  }
}

/** Convenience wrapper that opens the document first. */
export async function renderPdfPageFromFile(
  fileId: string,
  blob: Blob,
  name: string,
  pageIndex: number,
  options: RenderOptions = {},
): Promise<AnyCanvas> {
  const doc = await openPdf(fileId, blob, name);
  return renderPdfPage(doc, pageIndex, options);
}
