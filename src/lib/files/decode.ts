import { AppError, corruptFile, toAppError } from "@/lib/core/errors";
import { closeBitmap, createCanvas, context2d } from "@/lib/image/canvas";
import { needsFallbackDecode, sniffSignature } from "@/lib/files/formats";

export interface DecodedImage {
  bitmap: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  /**
   * Present when the original bytes are not browser-renderable (HEIC, TIFF)
   * and had to be transcoded. Used for display and export.
   */
  transcoded?: Blob;
  release(): void;
}

/** `createImageBitmap` with EXIF orientation applied where supported. */
async function bitmapFromBlob(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob, { imageOrientation: "from-image" });
  } catch {
    // Older Safari rejects the options bag entirely.
    return createImageBitmap(blob);
  }
}

/** Last-resort decode path for browsers without createImageBitmap for a format. */
function elementFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.decoding = "sync";
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image element decode failed"));
    };
    img.src = url;
  });
}

async function transcodeHeic(blob: Blob): Promise<Blob> {
  const { default: heic2any } = await import("heic2any");
  const result = (await heic2any({ blob, toType: "image/jpeg", quality: 0.92 })) as Blob | Blob[];
  const out = Array.isArray(result) ? result[0] : result;
  if (!out) throw new Error("heic conversion produced no output");
  return out;
}

async function transcodeTiff(blob: Blob): Promise<Blob> {
  const UTIF = (await import("utif")) as unknown as typeof import("utif");
  const buffer = await blob.arrayBuffer();
  const pages = UTIF.decode(buffer);
  if (!pages.length) throw new Error("tiff has no pages");
  const page = pages[0];
  UTIF.decodeImage(buffer, page);
  const rgba = UTIF.toRGBA8(page);
  const width = page.width;
  const height = page.height;
  if (!width || !height) throw new Error("tiff has no dimensions");

  const canvas = createCanvas(width, height);
  const ctx = context2d(canvas);
  ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), width, height), 0, 0);

  if (typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: "image/png" });
  }
  const png = await new Promise<Blob | null>((resolve) => (canvas as HTMLCanvasElement).toBlob(resolve, "image/png"));
  if (!png) throw new Error("tiff -> png encode failed");
  return png;
}

/**
 * Decode any supported image blob into something drawable.
 *
 * Order of attempts:
 *  1. native `createImageBitmap` (fast path, handles HEIC on Safari)
 *  2. format-specific transcode (HEIC via heic2any, TIFF via UTIF)
 *  3. `<img>` element
 */
export async function decodeImage(blob: Blob, name: string, ext: string): Promise<DecodedImage> {
  const attempts: Array<() => Promise<DecodedImage>> = [];

  const fromBitmap = (bitmap: ImageBitmap, transcoded?: Blob): DecodedImage => ({
    bitmap,
    width: bitmap.width,
    height: bitmap.height,
    transcoded,
    release: () => closeBitmap(bitmap),
  });

  if (typeof createImageBitmap === "function" && !needsFallbackDecode(ext)) {
    attempts.push(async () => fromBitmap(await bitmapFromBlob(blob)));
  }

  if (ext === "heic" || ext === "heif") {
    // Safari can decode HEIC natively; try that before the heavy polyfill.
    if (typeof createImageBitmap === "function") {
      attempts.push(async () => fromBitmap(await bitmapFromBlob(blob)));
    }
    attempts.push(async () => {
      const jpeg = await transcodeHeic(blob);
      return fromBitmap(await bitmapFromBlob(jpeg), jpeg);
    });
  }

  if (ext === "tif" || ext === "tiff") {
    attempts.push(async () => {
      const png = await transcodeTiff(blob);
      return fromBitmap(await bitmapFromBlob(png), png);
    });
  }

  attempts.push(async () => {
    const element = await elementFromBlob(blob);
    return {
      bitmap: element,
      width: element.naturalWidth,
      height: element.naturalHeight,
      release: () => {
        if (element.src.startsWith("blob:")) URL.revokeObjectURL(element.src);
      },
    };
  });

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const decoded = await attempt();
      if (decoded.width > 0 && decoded.height > 0) return decoded;
      decoded.release();
      lastError = new Error("decoded image has zero size");
    } catch (error) {
      lastError = error;
    }
  }

  // Give a precise reason when the bytes do not match any known format.
  const signature = await sniffSignature(blob).catch(() => "unknown" as const);
  if (signature === "unknown") {
    throw new AppError(
      "unsupported-type",
      "Unsupported image",
      `“${name}” could not be decoded by this browser.`,
      "Convert it to JPG or PNG and try again.",
    );
  }
  throw toAppError(lastError, corruptFile(name));
}
