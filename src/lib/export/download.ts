import { AppError } from "@/lib/core/errors";

/** Trigger a browser download for a blob. */
export function saveBlob(blob: Blob, fileName: string): void {
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
