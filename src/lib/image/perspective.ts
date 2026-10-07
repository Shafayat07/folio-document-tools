/**
 * Document edge detection + perspective correction.
 *
 * This is deliberately conservative: the detector looks for the dominant
 * bright quadrilateral and returns `null` when it is not confident, in which
 * case the UI falls back to manual corner adjustment. No magic claims.
 */
import type { Point, Quad } from "@/lib/core/types";

export const FULL_QUAD: Quad = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
];

export function isFullQuad(quad: Quad | undefined): boolean {
  if (!quad) return true;
  return quad.every((p, i) => Math.abs(p.x - FULL_QUAD[i].x) < 0.004 && Math.abs(p.y - FULL_QUAD[i].y) < 0.004);
}

/** Grayscale + Sobel magnitude at a reduced working size. */
function edgeMap(data: ImageData): { mag: Float32Array; width: number; height: number } {
  const { width, height } = data;
  const px = data.data;
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < px.length; i += 4, p += 1) {
    gray[p] = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
  }

  const mag = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const p = y * width + x;
      const tl = gray[p - width - 1];
      const t = gray[p - width];
      const tr = gray[p - width + 1];
      const l = gray[p - 1];
      const r = gray[p + 1];
      const bl = gray[p + width - 1];
      const b = gray[p + width];
      const br = gray[p + width + 1];
      const gx = tl + 2 * l + bl - (tr + 2 * r + br);
      const gy = tl + 2 * t + tr - (bl + 2 * b + br);
      mag[p] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return { mag, width, height };
}

/**
 * Find the strongest edge line scanning inward from each border.
 * Returns the fractional position (0..1) of the detected border.
 */
function strongestBorder(
  mag: Float32Array,
  width: number,
  height: number,
  axis: "row" | "col",
  from: "start" | "end",
): { position: number; strength: number } {
  const outer = axis === "row" ? height : width;
  const inner = axis === "row" ? width : height;
  const limit = Math.floor(outer * 0.42); // never cut past 42% of the image
  const sums = new Float32Array(limit);

  for (let step = 0; step < limit; step += 1) {
    const index = from === "start" ? step : outer - 1 - step;
    let sum = 0;
    for (let k = 0; k < inner; k += 1) {
      sum += axis === "row" ? mag[index * width + k] : mag[k * width + index];
    }
    sums[step] = sum / inner;
  }

  // Mean of the search band gives us a reference for "notably strong".
  let mean = 0;
  for (let i = 0; i < limit; i += 1) mean += sums[i];
  mean /= Math.max(1, limit);

  let best = 0;
  let bestValue = -1;
  for (let i = 0; i < limit; i += 1) {
    if (sums[i] > bestValue) {
      bestValue = sums[i];
      best = i;
    }
  }

  const strength = mean > 0.0001 ? bestValue / mean : 0;
  const index = from === "start" ? best : outer - 1 - best;
  return { position: index / (outer - 1), strength };
}

/**
 * Attempt to detect a document rectangle. Returns null when detection is not
 * confident enough to be useful.
 */
export function detectDocumentQuad(data: ImageData): Quad | null {
  const { mag, width, height } = edgeMap(data);
  if (width < 32 || height < 32) return null;

  const top = strongestBorder(mag, width, height, "row", "start");
  const bottom = strongestBorder(mag, width, height, "row", "end");
  const left = strongestBorder(mag, width, height, "col", "start");
  const right = strongestBorder(mag, width, height, "col", "end");

  const edges = [top, bottom, left, right];
  // Require every border to stand out from its neighbourhood.
  const confident = edges.every((e) => e.strength > 1.9);
  if (!confident) return null;

  const x0 = Math.min(left.position, right.position);
  const x1 = Math.max(left.position, right.position);
  const y0 = Math.min(top.position, bottom.position);
  const y1 = Math.max(top.position, bottom.position);

  // Reject degenerate or near-full detections (nothing gained).
  if (x1 - x0 < 0.25 || y1 - y0 < 0.25) return null;
  if (x1 - x0 > 0.985 && y1 - y0 > 0.985) return null;

  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

/* ------------------------------------------------------------------ *
 * Homography
 * ------------------------------------------------------------------ */

type Matrix3 = [number, number, number, number, number, number, number, number, number];

/** Solve an 8×8 linear system by Gaussian elimination with partial pivoting. */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-10) return null;
    if (pivot !== col) {
      [a[col], a[pivot]] = [a[pivot], a[col]];
      [b[col], b[pivot]] = [b[pivot], b[col]];
    }
    for (let row = col + 1; row < n; row += 1) {
      const factor = a[row][col] / a[col][col];
      if (!factor) continue;
      for (let k = col; k < n; k += 1) a[row][k] -= factor * a[col][k];
      b[row] -= factor * b[col];
    }
  }

  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row -= 1) {
    let sum = b[row];
    for (let k = row + 1; k < n; k += 1) sum -= a[row][k] * x[k];
    x[row] = sum / a[row][row];
  }
  return x;
}

/**
 * Homography mapping destination (unit rectangle, scaled to out size) back to
 * source pixels — i.e. the inverse map used for sampling.
 */
function inverseHomography(src: Quad, outW: number, outH: number): Matrix3 | null {
  const dst: Point[] = [
    { x: 0, y: 0 },
    { x: outW, y: 0 },
    { x: outW, y: outH },
    { x: 0, y: outH },
  ];

  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const { x: X, y: Y } = dst[i];
    const { x, y } = src[i];
    a.push([X, Y, 1, 0, 0, 0, -X * x, -Y * x]);
    b.push(x);
    a.push([0, 0, 0, X, Y, 1, -X * y, -Y * y]);
    b.push(y);
  }

  const h = solve(a, b);
  if (!h) return null;
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/** Suggested output size for a quad: average of opposite side lengths. */
export function quadOutputSize(quad: Quad, srcW: number, srcH: number) {
  const px = quad.map((p) => ({ x: p.x * srcW, y: p.y * srcH }));
  const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const width = (dist(px[0], px[1]) + dist(px[3], px[2])) / 2;
  const height = (dist(px[0], px[3]) + dist(px[1], px[2])) / 2;
  return { width: Math.max(16, Math.round(width)), height: Math.max(16, Math.round(height)) };
}

/**
 * Perspective-correct `data` using a normalised quad, with bilinear sampling.
 * Quad order is top-left, top-right, bottom-right, bottom-left.
 */
export function warpPerspective(data: ImageData, quad: Quad, outW: number, outH: number): ImageData {
  const srcW = data.width;
  const srcH = data.height;
  const pixelQuad = quad.map((p) => ({ x: p.x * srcW, y: p.y * srcH })) as Quad;
  const h = inverseHomography(pixelQuad, outW, outH);

  const out = new ImageData(outW, outH);
  if (!h) {
    out.data.fill(255);
    return out;
  }

  const src = data.data;
  const dst = out.data;
  const [h0, h1, h2, h3, h4, h5, h6, h7, h8] = h;

  for (let y = 0; y < outH; y += 1) {
    for (let x = 0; x < outW; x += 1) {
      const w = h6 * x + h7 * y + h8;
      const sx = (h0 * x + h1 * y + h2) / w;
      const sy = (h3 * x + h4 * y + h5) / w;
      const di = (y * outW + x) * 4;

      if (sx < 0 || sy < 0 || sx > srcW - 1 || sy > srcH - 1) {
        dst[di] = dst[di + 1] = dst[di + 2] = 255;
        dst[di + 3] = 255;
        continue;
      }

      const x0 = sx | 0;
      const y0 = sy | 0;
      const x1 = Math.min(x0 + 1, srcW - 1);
      const y1 = Math.min(y0 + 1, srcH - 1);
      const fx = sx - x0;
      const fy = sy - y0;

      const i00 = (y0 * srcW + x0) * 4;
      const i10 = (y0 * srcW + x1) * 4;
      const i01 = (y1 * srcW + x0) * 4;
      const i11 = (y1 * srcW + x1) * 4;

      for (let c = 0; c < 4; c += 1) {
        const top = src[i00 + c] * (1 - fx) + src[i10 + c] * fx;
        const bottom = src[i01 + c] * (1 - fx) + src[i11 + c] * fx;
        dst[di + c] = top * (1 - fy) + bottom * fy;
      }
    }
  }

  return out;
}
