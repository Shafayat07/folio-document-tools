/**
 * pdf.js access layer.
 *
 * The worker and the cmap/standard-font assets are served from /public (copied
 * by scripts/copy-pdf-worker.mjs) so this works identically under Turbopack,
 * webpack and a static export.
 */
import type { PDFDocumentProxy } from "pdfjs-dist";
import { AppError, corruptFile, encryptedPdf } from "@/lib/core/errors";

type PdfJsModule = typeof import("pdfjs-dist");

let modulePromise: Promise<PdfJsModule> | null = null;

export function loadPdfJs(): Promise<PdfJsModule> {
  if (!modulePromise) {
    modulePromise = import("pdfjs-dist").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      return mod;
    });
  }
  return modulePromise;
}

const documents = new Map<string, Promise<PDFDocumentProxy>>();

/** Open (and cache) a PDF document for a source file. */
export function openPdf(fileId: string, blob: Blob, name: string): Promise<PDFDocumentProxy> {
  const existing = documents.get(fileId);
  if (existing) return existing;

  const promise = (async () => {
    const pdfjs = await loadPdfJs();
    const bytes = new Uint8Array(await blob.arrayBuffer());
    try {
      return await pdfjs.getDocument({
        data: bytes,
        cMapUrl: "/pdfjs/cmaps/",
        cMapPacked: true,
        standardFontDataUrl: "/pdfjs/standard_fonts/",
        isEvalSupported: false,
      }).promise;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/password/i.test(message) || (error as { name?: string })?.name === "PasswordException") {
        throw encryptedPdf(name);
      }
      if (/Invalid PDF structure|stream must have data|InvalidPDF/i.test(message)) {
        throw corruptFile(name);
      }
      throw new AppError("corrupt-file", "PDF could not be opened", `“${name}” could not be read as a PDF.`);
    }
  })();

  // Do not cache failures.
  promise.catch(() => documents.delete(fileId));
  documents.set(fileId, promise);
  return promise;
}

export async function closePdf(fileId: string): Promise<void> {
  const promise = documents.get(fileId);
  if (!promise) return;
  documents.delete(fileId);
  try {
    const doc = await promise;
    await doc.destroy();
  } catch {
    /* nothing to release */
  }
}

export function closeAllPdfs(): void {
  [...documents.keys()].forEach((id) => void closePdf(id));
}
