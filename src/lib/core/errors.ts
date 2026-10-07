/**
 * User-facing errors. Every failure path in the app should surface one of
 * these — never a raw exception string.
 */

export type AppErrorCode =
  | "unsupported-type"
  | "corrupt-file"
  | "encrypted-pdf"
  | "file-too-large"
  | "too-many-pages"
  | "out-of-memory"
  | "camera-denied"
  | "camera-unavailable"
  | "camera-insecure"
  | "render-failed"
  | "generate-failed"
  | "empty-project"
  | "download-failed"
  | "unknown";

export class AppError extends Error {
  code: AppErrorCode;
  /** Short title for toasts/dialogs. */
  title: string;
  /** What the user can do about it. */
  hint?: string;

  constructor(code: AppErrorCode, title: string, message: string, hint?: string) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.title = title;
    this.hint = hint;
  }
}

export const MAX_FILE_BYTES = 300 * 1024 * 1024; // 300 MB
export const MAX_PDF_PAGES = 1000;

export function unsupportedType(name: string, ext: string) {
  return new AppError(
    "unsupported-type",
    "Unsupported file",
    `“${name}” is not a supported file type${ext ? ` (.${ext})` : ""}.`,
    "Supported: JPG, PNG, WEBP, GIF, BMP, TIFF, HEIC and PDF.",
  );
}

export function corruptFile(name: string) {
  return new AppError(
    "corrupt-file",
    "File could not be read",
    `“${name}” appears to be damaged or incomplete, so it was skipped.`,
    "Try re-exporting or re-downloading the original file.",
  );
}

export function encryptedPdf(name: string) {
  return new AppError(
    "encrypted-pdf",
    "Password-protected PDF",
    `“${name}” is password protected and cannot be opened here.`,
    "Remove the password in your PDF reader, then try again.",
  );
}

export function fileTooLarge(name: string, size: number) {
  const mb = Math.round(size / (1024 * 1024));
  return new AppError(
    "file-too-large",
    "File is too large",
    `“${name}” is ${mb} MB, which is above the ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB limit for in-browser processing.`,
    "Split the file or reduce its resolution first.",
  );
}

export function outOfMemory() {
  return new AppError(
    "out-of-memory",
    "Ran out of memory",
    "The browser ran out of memory while processing these pages.",
    "Try a lower image quality or higher compression, or work in smaller batches.",
  );
}

/** Map a DOMException from getUserMedia onto a clear message. */
export function cameraError(error: unknown): AppError {
  const name = typeof error === "object" && error && "name" in error ? String((error as DOMException).name) : "";

  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return new AppError(
        "camera-denied",
        "Camera permission denied",
        "Camera permission was denied. Please allow camera access in your browser settings or choose an image from your device.",
        "Look for the camera icon in the address bar to change the permission.",
      );
    case "NotFoundError":
    case "DevicesNotFoundError":
      return new AppError(
        "camera-unavailable",
        "No camera found",
        "No camera was detected on this device.",
        "Connect a camera, or add pages from your files instead.",
      );
    case "NotReadableError":
    case "TrackStartError":
      return new AppError(
        "camera-unavailable",
        "Camera is busy",
        "The camera is already in use by another application or tab.",
        "Close other apps using the camera and try again.",
      );
    case "OverconstrainedError":
      return new AppError(
        "camera-unavailable",
        "Camera not compatible",
        "This camera does not support the requested capture settings.",
        "Try switching cameras, or add pages from your files.",
      );
    case "SecurityError":
      return new AppError(
        "camera-insecure",
        "Camera blocked",
        "Camera access requires a secure connection (HTTPS or localhost).",
        "Open this page over HTTPS to use the camera.",
      );
    default:
      return new AppError(
        "camera-unavailable",
        "Camera unavailable",
        "The camera could not be started on this device.",
        "You can still add pages from your files.",
      );
  }
}

export function toAppError(error: unknown, fallback: AppError): AppError {
  if (error instanceof AppError) return error;
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/out of memory|allocation failed|Array buffer allocation/i.test(message)) return outOfMemory();
  if (/password|encrypt/i.test(message)) {
    return new AppError("encrypted-pdf", "Password-protected PDF", "This PDF is password protected and cannot be opened here.");
  }
  if (message) {
    return new AppError(fallback.code, fallback.title, fallback.message, fallback.hint);
  }
  return fallback;
}
