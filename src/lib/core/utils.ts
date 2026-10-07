import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

let counter = 0;
/** Stable, collision-free id without pulling in a uuid dependency. */
export function uid(prefix = "id"): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : decimals)} ${units[i]}`;
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Strip path, extension and unsafe characters so it is usable as a download name. */
export function sanitizeFileName(name: string, fallback = "document"): string {
  const base = name
    .replace(/\\/g, "/")
    .split("/")
    .pop()!
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w\-. ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return base.length ? base.slice(0, 80) : fallback;
}

export function extensionOf(name: string): string {
  const match = /\.([^.]+)$/.exec(name);
  return match ? match[1].toLowerCase() : "";
}

/** Run async work over a list with bounded concurrency, reporting progress. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let done = 0;

  const runners = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index], index);
      done += 1;
      onProgress?.(done, items.length);
    }
  });

  await Promise.all(runners);
  return results;
}

/**
 * Yield to the browser so progress UI can paint during long loops.
 *
 * A timer always races the frame callback: background tabs never fire
 * `requestAnimationFrame`, so relying on it alone would stall an export the
 * moment the user switches tabs.
 */
export function nextFrame(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(done);
    setTimeout(done, 24);
  });
}

export function move<T>(list: T[], from: number, to: number): T[] {
  const copy = list.slice();
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

/** Parse "1-3, 5, 8-" into zero-based indices within [0, total). */
export function parsePageRanges(input: string, total: number): number[] {
  const out = new Set<number>();
  for (const chunk of input.split(/[,\s]+/)) {
    if (!chunk) continue;
    const range = /^(\d+)?\s*-\s*(\d+)?$/.exec(chunk);
    if (range) {
      const start = range[1] ? parseInt(range[1], 10) : 1;
      const end = range[2] ? parseInt(range[2], 10) : total;
      for (let i = start; i <= end; i += 1) {
        if (i >= 1 && i <= total) out.add(i - 1);
      }
      continue;
    }
    const single = parseInt(chunk, 10);
    if (Number.isFinite(single) && single >= 1 && single <= total) out.add(single - 1);
  }
  return [...out].sort((a, b) => a - b);
}

export const isBrowser = typeof window !== "undefined";
