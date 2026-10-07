import { extensionOf } from "@/lib/core/utils";

/** Formats we can decode in the browser and turn into PDF pages. */
export const IMAGE_FORMATS = [
  { ext: "jpg", mime: "image/jpeg", label: "JPG" },
  { ext: "jpeg", mime: "image/jpeg", label: "JPEG" },
  { ext: "png", mime: "image/png", label: "PNG" },
  { ext: "webp", mime: "image/webp", label: "WEBP" },
  { ext: "gif", mime: "image/gif", label: "GIF" },
  { ext: "bmp", mime: "image/bmp", label: "BMP" },
  { ext: "tif", mime: "image/tiff", label: "TIFF" },
  { ext: "tiff", mime: "image/tiff", label: "TIFF" },
  { ext: "heic", mime: "image/heic", label: "HEIC" },
  { ext: "heif", mime: "image/heif", label: "HEIF" },
  { ext: "avif", mime: "image/avif", label: "AVIF" },
] as const;

export const IMAGE_EXTENSIONS = IMAGE_FORMATS.map((f) => f.ext);

/** The `accept` attribute for file inputs. */
export const ACCEPT_IMAGES = [...new Set(IMAGE_FORMATS.map((f) => f.mime)), ...IMAGE_EXTENSIONS.map((e) => `.${e}`)].join(",");
export const ACCEPT_PDF = "application/pdf,.pdf";
export const ACCEPT_ALL = `${ACCEPT_IMAGES},${ACCEPT_PDF}`;

export type DetectedKind = "image" | "pdf" | "unsupported";

export interface DetectedType {
  kind: DetectedKind;
  mime: string;
  ext: string;
}

/**
 * Browsers are inconsistent about File.type (empty for HEIC on some Androids,
 * "image/tif" vs "image/tiff", etc.), so extension wins when it is known.
 */
export function detectType(file: File | { name: string; type?: string }): DetectedType {
  const ext = extensionOf(file.name);
  const type = (file.type || "").toLowerCase();

  if (ext === "pdf" || type === "application/pdf") {
    return { kind: "pdf", mime: "application/pdf", ext: "pdf" };
  }

  const byExt = IMAGE_FORMATS.find((f) => f.ext === ext);
  if (byExt) return { kind: "image", mime: byExt.mime, ext: byExt.ext };

  if (type.startsWith("image/")) {
    const guessed = type.replace("image/", "");
    return { kind: "image", mime: type, ext: ext || guessed };
  }

  return { kind: "unsupported", mime: type || "application/octet-stream", ext };
}

/** Formats that need a decoding fallback because `createImageBitmap` may refuse them. */
export function needsFallbackDecode(ext: string): boolean {
  return ext === "heic" || ext === "heif" || ext === "tif" || ext === "tiff";
}

/** Sniff magic bytes — catches files with a wrong or missing extension. */
export async function sniffSignature(blob: Blob): Promise<"pdf" | "jpeg" | "png" | "gif" | "webp" | "bmp" | "tiff" | "heic" | "unknown"> {
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const match = (...bytes: number[]) => bytes.every((b, i) => head[i] === b);

  if (match(0x25, 0x50, 0x44, 0x46)) return "pdf";
  if (match(0xff, 0xd8, 0xff)) return "jpeg";
  if (match(0x89, 0x50, 0x4e, 0x47)) return "png";
  if (match(0x47, 0x49, 0x46, 0x38)) return "gif";
  if (match(0x42, 0x4d)) return "bmp";
  if (match(0x49, 0x49, 0x2a, 0x00) || match(0x4d, 0x4d, 0x00, 0x2a)) return "tiff";
  if (head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50) return "webp";
  // ISO-BMFF: "ftyp" at offset 4, brand heic/heix/hevc/mif1
  if (head[4] === 0x66 && head[5] === 0x74 && head[6] === 0x79 && head[7] === 0x70) {
    const brand = String.fromCharCode(head[8], head[9], head[10], head[11]);
    if (/heic|heix|hevc|hevx|mif1|msf1/.test(brand)) return "heic";
  }
  return "unknown";
}
