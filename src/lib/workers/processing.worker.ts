/// <reference lib="webworker" />
/**
 * Off-main-thread pixel work: filters, perspective warp, edge detection.
 * Buffers are transferred both ways, so nothing is copied.
 */
import { applyAdjustments } from "@/lib/image/filters";
import { detectDocumentQuad, warpPerspective } from "@/lib/image/perspective";
import type { PageAdjustments, Quad } from "@/lib/core/types";

export type WorkerRequest =
  | { id: number; type: "adjust"; buffer: ArrayBuffer; width: number; height: number; adjustments: PageAdjustments }
  | {
      id: number;
      type: "warp";
      buffer: ArrayBuffer;
      width: number;
      height: number;
      quad: Quad;
      outWidth: number;
      outHeight: number;
      adjustments?: PageAdjustments;
    }
  | { id: number; type: "detect"; buffer: ArrayBuffer; width: number; height: number };

export type WorkerResponse =
  | { id: number; ok: true; type: "pixels"; buffer: ArrayBuffer; width: number; height: number }
  | { id: number; ok: true; type: "quad"; quad: Quad | null }
  | { id: number; ok: false; error: string };

function toImageData(buffer: ArrayBuffer, width: number, height: number): ImageData {
  return new ImageData(new Uint8ClampedArray(buffer), width, height);
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === "adjust") {
      const data = toImageData(request.buffer, request.width, request.height);
      applyAdjustments(data, request.adjustments);
      const response: WorkerResponse = {
        id: request.id,
        ok: true,
        type: "pixels",
        buffer: data.data.buffer as ArrayBuffer,
        width: data.width,
        height: data.height,
      };
      (self as unknown as Worker).postMessage(response, [response.buffer]);
      return;
    }

    if (request.type === "warp") {
      const data = toImageData(request.buffer, request.width, request.height);
      const warped = warpPerspective(data, request.quad, request.outWidth, request.outHeight);
      if (request.adjustments) applyAdjustments(warped, request.adjustments);
      const response: WorkerResponse = {
        id: request.id,
        ok: true,
        type: "pixels",
        buffer: warped.data.buffer as ArrayBuffer,
        width: warped.width,
        height: warped.height,
      };
      (self as unknown as Worker).postMessage(response, [response.buffer]);
      return;
    }

    const data = toImageData(request.buffer, request.width, request.height);
    const quad = detectDocumentQuad(data);
    (self as unknown as Worker).postMessage({ id: request.id, ok: true, type: "quad", quad } satisfies WorkerResponse);
  } catch (error) {
    (self as unknown as Worker).postMessage({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    } satisfies WorkerResponse);
  }
};
