/**
 * File import: validate, decode once, and turn files into ordered project
 * pages. Selection order is preserved exactly — five selected JPGs become
 * pages 1–5 in that order.
 */
import { AppError, MAX_FILE_BYTES, MAX_PDF_PAGES, fileTooLarge, toAppError, unsupportedType } from "@/lib/core/errors";
import { DEFAULT_ADJUSTMENTS, type ProjectPage, type SourceFile } from "@/lib/core/types";
import { extensionOf, mapWithConcurrency, uid } from "@/lib/core/utils";
import { detectType, sniffSignature } from "@/lib/files/formats";
import { decodeImage } from "@/lib/files/decode";
import { canvasToBlob, rasterize } from "@/lib/image/canvas";
import { seedBasePreview, sourceKey } from "@/lib/image/preview-cache";
import { readPdfStructure } from "@/lib/pdf/render";

export type AcceptMode = "all" | "image" | "pdf";

export interface ImportOutcome {
  files: SourceFile[];
  pages: ProjectPage[];
  errors: AppError[];
}

export interface ImportOptions {
  accept?: AcceptMode;
  onProgress?: (done: number, total: number, label: string) => void;
  signal?: AbortSignal;
}

const BASE_EDGE = 1100;

function labelFor(name: string, pageIndex: number, pageCount: number) {
  return pageCount > 1 ? `${name} · p${pageIndex + 1}` : name;
}

async function importImage(file: File, ext: string, mime: string): Promise<{ source: SourceFile; pages: ProjectPage[] }> {
  const decoded = await decodeImage(file, file.name, ext);
  const fileId = uid("file");

  try {
    // One decode serves validation, dimensions and the first preview.
    const canvas = rasterize(decoded.bitmap, { maxEdge: BASE_EDGE, background: "#ffffff" });
    const preview = await canvasToBlob(canvas, "image/jpeg", 0.85);
    seedBasePreview(`${fileId}#0`, preview);

    const source: SourceFile = {
      id: fileId,
      name: file.name,
      mime,
      ext,
      size: file.size,
      kind: "image",
      blob: file,
      displayBlob: decoded.transcoded,
      pageCount: 1,
      addedAt: Date.now(),
    };

    const page: ProjectPage = {
      id: uid("page"),
      fileId,
      kind: "image",
      sourceIndex: 0,
      sourceWidth: decoded.width,
      sourceHeight: decoded.height,
      rotation: 0,
      adjustments: { ...DEFAULT_ADJUSTMENTS },
      label: file.name,
    };

    return { source, pages: [page] };
  } finally {
    decoded.release();
  }
}

async function importPdf(file: File): Promise<{ source: SourceFile; pages: ProjectPage[] }> {
  const fileId = uid("file");
  const structure = await readPdfStructure(fileId, file, file.name);

  if (structure.pageCount > MAX_PDF_PAGES) {
    throw new AppError(
      "too-many-pages",
      "PDF has too many pages",
      `“${file.name}” has ${structure.pageCount} pages, above the ${MAX_PDF_PAGES}-page limit for in-browser editing.`,
      "Split the PDF first, then work on one part at a time.",
    );
  }

  const source: SourceFile = {
    id: fileId,
    name: file.name,
    mime: "application/pdf",
    ext: "pdf",
    size: file.size,
    kind: "pdf",
    blob: file,
    pageCount: structure.pageCount,
    addedAt: Date.now(),
  };

  const pages: ProjectPage[] = structure.pages.map((info) => ({
    id: uid("page"),
    fileId,
    kind: "pdf" as const,
    sourceIndex: info.index,
    sourceWidth: info.width,
    sourceHeight: info.height,
    rotation: 0 as const,
    adjustments: { ...DEFAULT_ADJUSTMENTS },
    label: labelFor(file.name, info.index, structure.pageCount),
  }));

  return { source, pages };
}

export async function importFiles(input: File[] | FileList, options: ImportOptions = {}): Promise<ImportOutcome> {
  const { accept = "all", onProgress, signal } = options;
  const incoming = Array.from(input);
  const errors: AppError[] = [];

  if (!incoming.length) return { files: [], pages: [], errors };

  type Slot = { source: SourceFile; pages: ProjectPage[] } | null;

  const results = await mapWithConcurrency<File, Slot>(
    incoming,
    2,
    async (file) => {
      if (signal?.aborted) return null;

      const detected = detectType(file);
      let kind = detected.kind;
      let ext = detected.ext;

      // Trust the bytes when the extension is missing or wrong.
      if (kind === "unsupported" || !ext) {
        const signature = await sniffSignature(file).catch(() => "unknown" as const);
        if (signature === "pdf") {
          kind = "pdf";
          ext = "pdf";
        } else if (signature !== "unknown") {
          kind = "image";
          ext = signature === "heic" ? "heic" : signature === "jpeg" ? "jpg" : signature;
        }
      }

      if (kind === "unsupported") {
        errors.push(unsupportedType(file.name, extensionOf(file.name)));
        return null;
      }
      if (accept === "image" && kind !== "image") {
        errors.push(
          new AppError("unsupported-type", "Images only", `“${file.name}” was skipped — this tool accepts image files.`),
        );
        return null;
      }
      if (accept === "pdf" && kind !== "pdf") {
        errors.push(
          new AppError("unsupported-type", "PDFs only", `“${file.name}” was skipped — this tool accepts PDF files.`),
        );
        return null;
      }
      if (file.size > MAX_FILE_BYTES) {
        errors.push(fileTooLarge(file.name, file.size));
        return null;
      }
      if (file.size === 0) {
        errors.push(
          new AppError("corrupt-file", "Empty file", `“${file.name}” is empty and was skipped.`),
        );
        return null;
      }

      try {
        return kind === "pdf" ? await importPdf(file) : await importImage(file, ext, detected.mime);
      } catch (error) {
        errors.push(
          toAppError(
            error,
            new AppError("corrupt-file", "File could not be read", `“${file.name}” could not be imported.`),
          ),
        );
        return null;
      }
    },
    (done, total) => onProgress?.(done, total, total > 1 ? `Reading file ${done} of ${total}` : "Reading file"),
  );

  const files: SourceFile[] = [];
  const pages: ProjectPage[] = [];
  for (const slot of results) {
    if (!slot) continue;
    files.push(slot.source);
    pages.push(...slot.pages);
  }

  return { files, pages, errors };
}

/** Wrap a captured image blob as a File so it goes through the same pipeline. */
export function blobToFile(blob: Blob, name: string): File {
  return new File([blob], name, { type: blob.type || "image/jpeg", lastModified: Date.now() });
}

/** Re-key a page's cached preview after the underlying file id is known. */
export function previewKeyFor(page: ProjectPage): string {
  return sourceKey(page);
}
