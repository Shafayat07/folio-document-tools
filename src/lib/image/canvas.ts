import { AppError } from "@/lib/core/errors";
import type { CropRect, Rotation } from "@/lib/core/types";

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
export type AnyImageSource = ImageBitmap | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas | HTMLVideoElement;

export function createCanvas(width: number, height: number): AnyCanvas {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  if (typeof document === "undefined" && typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(w, h);
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

export function context2d(canvas: AnyCanvas): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D {
  const ctx = (canvas as HTMLCanvasElement).getContext("2d", { willReadFrequently: false }) as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) throw new AppError("render-failed", "Rendering failed", "The browser could not create a drawing surface.");
  return ctx;
}

export function sourceSize(source: AnyImageSource): { width: number; height: number } {
  if (source instanceof HTMLVideoElement) return { width: source.videoWidth, height: source.videoHeight };
  if (typeof HTMLImageElement !== "undefined" && source instanceof HTMLImageElement) {
    return { width: source.naturalWidth || source.width, height: source.naturalHeight || source.height };
  }
  return { width: (source as ImageBitmap).width, height: (source as ImageBitmap).height };
}

/** Pixel rect for a normalised crop against a source of the given size. */
export function cropToPixels(crop: CropRect | undefined, width: number, height: number) {
  if (!crop) return { sx: 0, sy: 0, sw: width, sh: height };
  const sx = Math.max(0, Math.round(crop.x * width));
  const sy = Math.max(0, Math.round(crop.y * height));
  const sw = Math.max(1, Math.min(width - sx, Math.round(crop.width * width)));
  const sh = Math.max(1, Math.min(height - sy, Math.round(crop.height * height)));
  return { sx, sy, sw, sh };
}

export interface RasterizeOptions {
  crop?: CropRect;
  rotation?: Rotation;
  /** Longest output edge in pixels; the image is never upscaled. */
  maxEdge?: number;
  /** Fill colour painted behind the image (flattens transparency for JPEG). */
  background?: string | null;
}

/**
 * Draw a source onto a canvas with crop + rotation + downscale applied.
 * Rotation is clockwise, matching the UI's "rotate right".
 */
export function rasterize(source: AnyImageSource, options: RasterizeOptions = {}): AnyCanvas {
  const { rotation = 0, crop, maxEdge, background = null } = options;
  const { width: natW, height: natH } = sourceSize(source);
  if (!natW || !natH) {
    throw new AppError("render-failed", "Image could not be read", "The image has no usable pixel data.");
  }

  const { sx, sy, sw, sh } = cropToPixels(crop, natW, natH);
  const swapped = rotation === 90 || rotation === 270;
  const baseW = swapped ? sh : sw;
  const baseH = swapped ? sw : sh;

  let scale = 1;
  if (maxEdge && Math.max(baseW, baseH) > maxEdge) scale = maxEdge / Math.max(baseW, baseH);

  const outW = Math.max(1, Math.round(baseW * scale));
  const outH = Math.max(1, Math.round(baseH * scale));

  const canvas = createCanvas(outW, outH);
  const ctx = context2d(canvas);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, outW, outH);
  }

  ctx.save();
  // Rotate about the output centre, then draw the cropped region centred.
  ctx.translate(outW / 2, outH / 2);
  if (rotation) ctx.rotate((rotation * Math.PI) / 180);
  const drawW = Math.round(sw * scale);
  const drawH = Math.round(sh * scale);
  ctx.drawImage(source as CanvasImageSource, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();

  return canvas;
}

export async function canvasToBlob(canvas: AnyCanvas, mime = "image/jpeg", quality = 0.85): Promise<Blob> {
  if (typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: mime, quality });
  }
  const element = canvas as HTMLCanvasElement;
  const blob = await new Promise<Blob | null>((resolve) => element.toBlob(resolve, mime, quality));
  if (!blob) throw new AppError("render-failed", "Export failed", "The browser could not encode the rendered page.");
  return blob;
}

export function canvasToDataUrl(canvas: AnyCanvas, mime = "image/jpeg", quality = 0.8): string {
  if (typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas) {
    throw new AppError("render-failed", "Export failed", "Data URLs are not available for offscreen canvases.");
  }
  return (canvas as HTMLCanvasElement).toDataURL(mime, quality);
}

export function getImageData(canvas: AnyCanvas): ImageData {
  const ctx = (canvas as HTMLCanvasElement).getContext("2d", { willReadFrequently: true }) as
    | CanvasRenderingContext2D
    | OffscreenCanvasRenderingContext2D
    | null;
  if (!ctx) throw new AppError("render-failed", "Rendering failed", "The browser could not read the rendered pixels.");
  return ctx.getImageData(0, 0, (canvas as HTMLCanvasElement).width, (canvas as HTMLCanvasElement).height);
}

export function putImageData(data: ImageData): AnyCanvas {
  const canvas = createCanvas(data.width, data.height);
  const ctx = context2d(canvas);
  ctx.putImageData(data, 0, 0);
  return canvas;
}

/**
 * Hint to the GC that a large canvas is finished with. Shrinking the backing
 * store to 0×0 frees the pixel buffer immediately in Chromium and Safari,
 * which matters when looping over 50 full-resolution pages.
 */
export function releaseCanvas(canvas: AnyCanvas | null | undefined): void {
  if (!canvas) return;
  try {
    (canvas as HTMLCanvasElement).width = 0;
    (canvas as HTMLCanvasElement).height = 0;
  } catch {
    /* detached already */
  }
}

/** Release an ImageBitmap if the browser supports explicit disposal. */
export function closeBitmap(bitmap: unknown) {
  if (bitmap && typeof (bitmap as ImageBitmap).close === "function") {
    try {
      (bitmap as ImageBitmap).close();
    } catch {
      /* already closed */
    }
  }
}
