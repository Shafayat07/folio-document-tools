/**
 * Thin client for the processing worker.
 *
 * If the worker cannot be created (older browser, bundler quirk, blocked
 * origin) every call transparently falls back to the same pure functions on
 * the main thread, so features never disappear — they just block a bit.
 */
import { applyAdjustments } from "@/lib/image/filters";
import { detectDocumentQuad, warpPerspective } from "@/lib/image/perspective";
import type { PageAdjustments, Quad } from "@/lib/core/types";
import type { WorkerRequest, WorkerResponse } from "./processing.worker";

type Pending = {
  resolve: (value: WorkerResponse) => void;
  reject: (error: Error) => void;
};

let worker: Worker | null = null;
let workerBroken = false;
let sequence = 0;
const pending = new Map<number, Pending>();

function getWorker(): Worker | null {
  if (workerBroken) return null;
  if (worker) return worker;
  if (typeof window === "undefined" || typeof Worker === "undefined") {
    workerBroken = true;
    return null;
  }

  try {
    worker = new Worker(new URL("./processing.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const entry = pending.get(event.data.id);
      if (!entry) return;
      pending.delete(event.data.id);
      entry.resolve(event.data);
    };
    worker.onerror = () => {
      // Fail over to the main thread for this and all future calls.
      workerBroken = true;
      const error = new Error("worker-unavailable");
      pending.forEach((entry) => entry.reject(error));
      pending.clear();
      worker?.terminate();
      worker = null;
    };
    return worker;
  } catch {
    workerBroken = true;
    return null;
  }
}

function post(request: WorkerRequest, transfer: Transferable[]): Promise<WorkerResponse> {
  const instance = getWorker();
  if (!instance) return Promise.reject(new Error("worker-unavailable"));
  return new Promise((resolve, reject) => {
    pending.set(request.id, { resolve, reject });
    try {
      instance.postMessage(request, transfer);
    } catch (error) {
      pending.delete(request.id);
      reject(error instanceof Error ? error : new Error("postMessage failed"));
    }
  });
}

function fromResponse(response: WorkerResponse): ImageData {
  if (!response.ok) throw new Error(response.error);
  if (response.type !== "pixels") throw new Error("unexpected worker response");
  return new ImageData(new Uint8ClampedArray(response.buffer), response.width, response.height);
}

/** Apply brightness/contrast/mode/sharpen. Returns new ImageData. */
export async function adjustPixels(data: ImageData, adjustments: PageAdjustments): Promise<ImageData> {
  const id = (sequence += 1);
  try {
    const response = await post(
      {
        id,
        type: "adjust",
        buffer: data.data.buffer as ArrayBuffer,
        width: data.width,
        height: data.height,
        adjustments,
      },
      [data.data.buffer as ArrayBuffer],
    );
    return fromResponse(response);
  } catch {
    // `data` may have had its buffer detached by the failed transfer; rebuild.
    const safe = data.data.byteLength ? data : new ImageData(data.width, data.height);
    applyAdjustments(safe, adjustments);
    return safe;
  }
}

/** Perspective-correct a quad region, optionally applying adjustments in the same pass. */
export async function warpPixels(
  data: ImageData,
  quad: Quad,
  outWidth: number,
  outHeight: number,
  adjustments?: PageAdjustments,
): Promise<ImageData> {
  const id = (sequence += 1);
  const fallbackCopy = new ImageData(new Uint8ClampedArray(data.data), data.width, data.height);
  try {
    const response = await post(
      {
        id,
        type: "warp",
        buffer: data.data.buffer as ArrayBuffer,
        width: data.width,
        height: data.height,
        quad,
        outWidth,
        outHeight,
        adjustments,
      },
      [data.data.buffer as ArrayBuffer],
    );
    return fromResponse(response);
  } catch {
    const warped = warpPerspective(fallbackCopy, quad, outWidth, outHeight);
    if (adjustments) applyAdjustments(warped, adjustments);
    return warped;
  }
}

/** Best-effort document edge detection; null when not confident. */
export async function detectQuad(data: ImageData): Promise<Quad | null> {
  const id = (sequence += 1);
  const fallbackCopy = new ImageData(new Uint8ClampedArray(data.data), data.width, data.height);
  try {
    const response = await post(
      { id, type: "detect", buffer: data.data.buffer as ArrayBuffer, width: data.width, height: data.height },
      [data.data.buffer as ArrayBuffer],
    );
    if (!response.ok) throw new Error(response.error);
    return response.type === "quad" ? response.quad : null;
  } catch {
    try {
      return detectDocumentQuad(fallbackCopy);
    } catch {
      return null;
    }
  }
}
