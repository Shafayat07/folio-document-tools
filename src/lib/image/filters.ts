/**
 * Pixel operations. Pure functions over ImageData so they can run on the main
 * thread or inside a worker without any DOM dependency.
 */
import type { PageAdjustments } from "@/lib/core/types";

export function hasPixelWork(adjustments: PageAdjustments): boolean {
  return (
    adjustments.mode !== "original" ||
    adjustments.brightness !== 0 ||
    adjustments.contrast !== 0 ||
    adjustments.sharpen
  );
}

/** Build a 256-entry LUT for brightness + contrast in one pass. */
function toneCurve(brightness: number, contrast: number): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256);
  const b = (brightness / 100) * 96; // ±96 levels
  const c = contrast / 100;
  // Standard S-curve factor; 1 at c=0, steeper above, flatter below.
  const factor = c >= 0 ? 1 + c * 1.6 : 1 + c * 0.9;
  for (let i = 0; i < 256; i += 1) {
    lut[i] = (i - 128) * factor + 128 + b;
  }
  return lut;
}

export function applyToneCurve(data: ImageData, brightness: number, contrast: number): void {
  if (brightness === 0 && contrast === 0) return;
  const lut = toneCurve(brightness, contrast);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    px[i] = lut[px[i]];
    px[i + 1] = lut[px[i + 1]];
    px[i + 2] = lut[px[i + 2]];
  }
}

export function applyGrayscale(data: ImageData): void {
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    // Rec. 601 luma — matches how scanners weight channels.
    const y = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    px[i] = px[i + 1] = px[i + 2] = y;
  }
}

/** Grey-world auto levels: stretch the 1st–99th percentile to full range. */
export function applyAutoLevels(data: ImageData, lowPercent = 0.01, highPercent = 0.99): void {
  const px = data.data;
  const histogram = new Uint32Array(256);
  for (let i = 0; i < px.length; i += 4) {
    const y = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    histogram[y | 0] += 1;
  }

  const total = px.length / 4;
  const lowTarget = total * lowPercent;
  const highTarget = total * highPercent;

  let acc = 0;
  let low = 0;
  let high = 255;
  for (let i = 0; i < 256; i += 1) {
    acc += histogram[i];
    if (acc >= lowTarget) {
      low = i;
      break;
    }
  }
  acc = 0;
  for (let i = 255; i >= 0; i -= 1) {
    acc += histogram[i];
    if (acc >= total - highTarget) {
      high = i;
      break;
    }
  }

  if (high - low < 12) return; // flat image; stretching would only add noise
  const scale = 255 / (high - low);
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i += 1) lut[i] = (i - low) * scale;
  for (let i = 0; i < px.length; i += 4) {
    px[i] = lut[px[i]];
    px[i + 1] = lut[px[i + 1]];
    px[i + 2] = lut[px[i + 2]];
  }
}

/**
 * Adaptive threshold (integral-image mean, Bradley–Roth). Handles uneven
 * lighting far better than a global threshold, which matters for photos of
 * paper taken by hand.
 */
export function applyAdaptiveThreshold(data: ImageData, windowDivisor = 10, tolerance = 0.86): void {
  const { width, height } = data;
  const px = data.data;
  const gray = new Uint8Array(width * height);

  for (let i = 0, p = 0; i < px.length; i += 4, p += 1) {
    gray[p] = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
  }

  // Integral image in Float64 to avoid overflow on large pages.
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let rowSum = 0;
    for (let x = 0; x < width; x += 1) {
      rowSum += gray[y * width + x];
      integral[(y + 1) * (width + 1) + (x + 1)] = integral[y * (width + 1) + (x + 1)] + rowSum;
    }
  }

  const radius = Math.max(8, Math.floor(Math.min(width, height) / windowDivisor / 2));
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height - 1, y + radius);
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width - 1, x + radius);
      const count = (y1 - y0 + 1) * (x1 - x0 + 1);
      const sum =
        integral[(y1 + 1) * (width + 1) + (x1 + 1)] -
        integral[y0 * (width + 1) + (x1 + 1)] -
        integral[(y1 + 1) * (width + 1) + x0] +
        integral[y0 * (width + 1) + x0];
      const mean = sum / count;
      const p = y * width + x;
      const value = gray[p] < mean * tolerance ? 0 : 255;
      const i = p * 4;
      px[i] = px[i + 1] = px[i + 2] = value;
    }
  }
}

/** Unsharp-style 3×3 sharpen. */
export function applySharpen(data: ImageData, amount = 0.6): void {
  const { width, height } = data;
  const px = data.data;
  const copy = new Uint8ClampedArray(px);
  const center = 1 + 4 * amount;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = (y * width + x) * 4;
      for (let c = 0; c < 3; c += 1) {
        const value =
          copy[i + c] * center -
          amount *
            (copy[i - 4 + c] + copy[i + 4 + c] + copy[i - width * 4 + c] + copy[i + width * 4 + c]);
        px[i + c] = value;
      }
    }
  }
}

/** Apply the full adjustment stack in a sensible order. */
export function applyAdjustments(data: ImageData, adjustments: PageAdjustments): ImageData {
  const { mode, brightness, contrast, sharpen } = adjustments;

  if (mode === "grayscale") {
    applyGrayscale(data);
    applyToneCurve(data, brightness, contrast);
  } else if (mode === "document") {
    applyGrayscale(data);
    applyAutoLevels(data, 0.02, 0.96);
    applyToneCurve(data, brightness, contrast + 18);
  } else if (mode === "bw") {
    applyToneCurve(data, brightness, contrast);
    applyAdaptiveThreshold(data);
  } else {
    applyToneCurve(data, brightness, contrast);
  }

  if (sharpen && mode !== "bw") applySharpen(data, 0.55);
  return data;
}
