import { AppError } from "@/lib/core/errors";

/**
 * Saving a generated file.
 *
 * Desktop browsers take the `<a download>` route. iOS Safari does not: a
 * `blob:` URL with a PDF type is opened in the inline viewer rather than
 * downloaded, so the file never reaches the Files app and the chosen name is
 * lost. There, the Web Share API is the supported path — it hands the real
 * file to the native share sheet, which is where "Save to Files" lives.
 */

/** Wrap a blob as a File so it carries a name and type through the share sheet. */
function asFile(blob: Blob, fileName: string): File {
  return new File([blob], fileName, { type: blob.type || "application/octet-stream" });
}

/** True when this browser can share this specific file. */
export function canShareFile(blob: Blob, fileName: string): boolean {
  if (typeof navigator === "undefined" || !navigator.share || !navigator.canShare) return false;
  try {
    return navigator.canShare({ files: [asFile(blob, fileName)] });
  } catch {
    return false;
  }
}

/**
 * True on platforms where `<a download>` is unreliable and sharing should be
 * offered as the primary way to keep a file — currently iOS/iPadOS Safari.
 */
export function prefersShareToSave(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return iOS;
}

export type SaveOutcome = "shared" | "downloaded" | "cancelled";

/**
 * Open the native share sheet. Must be called directly from a user gesture —
 * do not `await` anything before it, or iOS will reject the call.
 */
export async function shareBlob(blob: Blob, fileName: string): Promise<SaveOutcome> {
  try {
    await navigator.share({ files: [asFile(blob, fileName)], title: fileName });
    return "shared";
  } catch (error) {
    // Dismissing the sheet is a normal outcome, not a failure.
    if ((error as DOMException)?.name === "AbortError") return "cancelled";
    throw error;
  }
}

/** Trigger a classic browser download. */
export function downloadBlob(blob: Blob, fileName: string): void {
  try {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    // Give the browser time to start the download before releasing the blob.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch {
    throw new AppError(
      "download-failed",
      "Download failed",
      "The browser blocked the download.",
      "Check your download settings or pop-up blocker, then try again.",
    );
  }
}

/**
 * Save a file using whichever mechanism actually works on this device.
 * Falls back to a download if sharing is unavailable or fails.
 */
export async function saveBlob(blob: Blob, fileName: string): Promise<SaveOutcome> {
  if (prefersShareToSave() && canShareFile(blob, fileName)) {
    try {
      return await shareBlob(blob, fileName);
    } catch {
      // Sharing failed for a reason other than cancellation — fall through.
    }
  }
  downloadBlob(blob, fileName);
  return "downloaded";
}
