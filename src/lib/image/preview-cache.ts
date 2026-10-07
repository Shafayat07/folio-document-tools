/**
 * Two-level render cache.
 *
 *  1. "base preview" — one moderate-resolution JPEG per source page, with no
 *     edits applied. Decoding a 12 MP photo costs ~100 ms, so we pay it once.
 *  2. "rendered thumb" — object URLs with crop/rotation/quad/adjustments
 *     applied, keyed by the full edit state so a slider drag reuses nothing
 *     stale but also never re-decodes the original.
 *
 * Full-resolution decoding happens only during export, and is released
 * immediately afterwards. This keeps 50-page projects well inside the memory
 * a browser tab can hold.
 */
import { Lru } from "@/lib/core/lru";
import { decodeImage } from "@/lib/files/decode";
import { canvasToBlob, getImageData, putImageData, rasterize } from "@/lib/image/canvas";
import { hasPixelWork } from "@/lib/image/filters";
import { isFullQuad, quadOutputSize } from "@/lib/image/perspective";
import { renderPdfPageFromFile } from "@/lib/pdf/render";
import { adjustPixels, warpPixels } from "@/lib/workers/processing-client";
import type { ProjectPage, SourceFile } from "@/lib/core/types";

const BASE_EDGE = 1100;
const BASE_CAPACITY = 80;
const THUMB_CAPACITY = 220;

const basePreviews = new Lru<string, Blob>(BASE_CAPACITY);
const basePromises = new Map<string, Promise<Blob>>();

const thumbs = new Lru<string, string>(THUMB_CAPACITY, (_key, url) => URL.revokeObjectURL(url));
const thumbPromises = new Map<string, Promise<string>>();

export function sourceKey(page: Pick<ProjectPage, "fileId" | "sourceIndex">): string {
  return `${page.fileId}#${page.sourceIndex}`;
}

/**
 * Identity of a page *render*: changes whenever anything that affects pixels
 * changes. React hooks use it as a dependency so a slider drag re-renders the
 * thumbnail but a reorder does not.
 */
export function pageSignature(page: ProjectPage, size: number): string {
  return editKey(page, size);
}

function editKey(page: ProjectPage, size: number): string {
  const { rotation, crop, quad, adjustments } = page;
  const c = crop ? `${crop.x.toFixed(4)},${crop.y.toFixed(4)},${crop.width.toFixed(4)},${crop.height.toFixed(4)}` : "-";
  const q = quad ? quad.map((p) => `${p.x.toFixed(3)},${p.y.toFixed(3)}`).join("|") : "-";
  const a = `${adjustments.mode},${adjustments.brightness},${adjustments.contrast},${adjustments.sharpen ? 1 : 0}`;
  return `${sourceKey(page)}@${size}:${rotation}:${c}:${q}:${a}`;
}

/** Decode (or rasterise) the source once and keep a compact JPEG of it. */
export function getBasePreview(page: Pick<ProjectPage, "fileId" | "sourceIndex" | "kind" | "label">, file: SourceFile): Promise<Blob> {
  const key = sourceKey(page);
  const cached = basePreviews.get(key);
  if (cached) return Promise.resolve(cached);

  const inFlight = basePromises.get(key);
  if (inFlight) return inFlight;

  const promise = (async () => {
    let blob: Blob;
    if (page.kind === "pdf") {
      const canvas = await renderPdfPageFromFile(file.id, file.blob, file.name, page.sourceIndex, {
        maxEdge: BASE_EDGE,
      });
      blob = await canvasToBlob(canvas, "image/jpeg", 0.85);
    } else {
      const decoded = await decodeImage(file.displayBlob ?? file.blob, file.name, file.ext);
      try {
        const canvas = rasterize(decoded.bitmap, { maxEdge: BASE_EDGE, background: "#ffffff" });
        blob = await canvasToBlob(canvas, "image/jpeg", 0.85);
      } finally {
        decoded.release();
      }
    }
    basePreviews.set(key, blob);
    return blob;
  })();

  promise.catch(() => undefined).finally(() => basePromises.delete(key));
  basePromises.set(key, promise);
  return promise;
}

/**
 * Render a page with all of its edits applied, at `size` px on the long edge.
 * Returns an object URL owned by the cache — do not revoke it.
 */
export function getRenderedPage(page: ProjectPage, file: SourceFile, size = 360): Promise<string> {
  const key = editKey(page, size);
  const cached = thumbs.get(key);
  if (cached) return Promise.resolve(cached);

  const inFlight = thumbPromises.get(key);
  if (inFlight) return inFlight;

  const promise = (async () => {
    const base = await getBasePreview(page, file);
    const decoded = await decodeImage(base, file.name, "jpg");

    let canvas;
    try {
      const useQuad = page.quad && !isFullQuad(page.quad);
      if (useQuad) {
        // Warp first (in source orientation), then rotate the result.
        const flat = rasterize(decoded.bitmap, { background: "#ffffff" });
        const data = getImageData(flat);
        const target = quadOutputSize(page.quad!, data.width, data.height);
        const scale = Math.min(1, size / Math.max(target.width, target.height));
        const warped = await warpPixels(
          data,
          page.quad!,
          Math.max(16, Math.round(target.width * scale)),
          Math.max(16, Math.round(target.height * scale)),
          hasPixelWork(page.adjustments) ? page.adjustments : undefined,
        );
        canvas = rasterize(putImageData(warped), { rotation: page.rotation, maxEdge: size, background: "#ffffff" });
      } else {
        canvas = rasterize(decoded.bitmap, {
          crop: page.crop,
          rotation: page.rotation,
          maxEdge: size,
          background: "#ffffff",
        });
        if (hasPixelWork(page.adjustments)) {
          const adjusted = await adjustPixels(getImageData(canvas), page.adjustments);
          canvas = putImageData(adjusted);
        }
      }
    } finally {
      decoded.release();
    }

    const blob = await canvasToBlob(canvas, "image/jpeg", 0.86);
    const url = URL.createObjectURL(blob);
    thumbs.set(key, url);
    return url;
  })();

  promise.catch(() => undefined).finally(() => thumbPromises.delete(key));
  thumbPromises.set(key, promise);
  return promise;
}

/**
 * Seed the base-preview cache from the decode that already happened during
 * import, so the first thumbnail paint does not decode the original again.
 */
export function seedBasePreview(key: string, blob: Blob): void {
  if (!basePreviews.has(key)) basePreviews.set(key, blob);
}

/** Drop every cached render for a source file (called when a file is removed). */
export function evictFile(fileId: string): void {
  basePreviews.deleteWhere((key) => key.startsWith(`${fileId}#`));
  thumbs.deleteWhere((key) => key.startsWith(`${fileId}#`));
}

export function evictAll(): void {
  basePreviews.clear();
  thumbs.clear();
}
