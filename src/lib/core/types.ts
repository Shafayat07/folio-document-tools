/**
 * Core domain model.
 *
 * A "project" is an ordered list of pages. Each page points at a source
 * (an imported image file, or one page of an imported PDF) plus non-destructive
 * edits (rotation, crop, filters). Nothing is baked until export.
 */

export type Rotation = 0 | 90 | 180 | 270;

export type SourceKind = "image" | "pdf";

/** A file the user imported. The original bytes are kept for export. */
export interface SourceFile {
  id: string;
  name: string;
  /** Normalised type, e.g. "image/jpeg" or "application/pdf". */
  mime: string;
  /** Lower-case extension without the dot. */
  ext: string;
  size: number;
  kind: SourceKind;
  /** Original bytes (never uploaded anywhere). */
  blob: Blob;
  /** Pages contributed by this file. */
  pageCount: number;
  /**
   * For images that needed decoding (HEIC, TIFF, BMP in old browsers) this
   * holds a browser-renderable PNG/JPEG version used for display and export.
   */
  displayBlob?: Blob;
  addedAt: number;
}

/** Normalised crop rectangle, 0..1 relative to the un-rotated source. */
export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Four corner points (0..1 space) for perspective correction, clockwise from top-left. */
export type Quad = [Point, Point, Point, Point];

export interface Point {
  x: number;
  y: number;
}

export type EnhanceMode = "original" | "grayscale" | "document" | "bw";

export interface PageAdjustments {
  brightness: number; // -100..100
  contrast: number; // -100..100
  sharpen: boolean;
  mode: EnhanceMode;
}

export const DEFAULT_ADJUSTMENTS: PageAdjustments = {
  brightness: 0,
  contrast: 0,
  sharpen: false,
  mode: "original",
};

export interface ProjectPage {
  id: string;
  fileId: string;
  kind: SourceKind;
  /** 0-based page index inside the source PDF; 0 for images. */
  sourceIndex: number;
  /** Intrinsic size of the source in pixels (images) or points (PDF). */
  sourceWidth: number;
  sourceHeight: number;
  /** Rotation baked at the source level (PDF /Rotate), already applied by renderers. */
  rotation: Rotation;
  crop?: CropRect;
  /** Perspective quad captured by the scanner; mutually exclusive with crop. */
  quad?: Quad;
  adjustments: PageAdjustments;
  /** Human label, e.g. "scan-01.jpg" or "report.pdf · p3". */
  label: string;
}

/* ------------------------------------------------------------------ *
 * Export settings
 * ------------------------------------------------------------------ */

export type PageSizeId = "a4" | "a3" | "letter" | "legal" | "original";
export type OrientationId = "auto" | "portrait" | "landscape";
export type FitId = "contain" | "cover" | "fill";
export type MarginId = "none" | "small" | "medium" | "large";
export type QualityId = "standard" | "high" | "maximum";
export type CompressionId = "none" | "balanced" | "high";

export interface PdfSettings {
  pageSize: PageSizeId;
  orientation: OrientationId;
  fit: FitId;
  margin: MarginId;
  quality: QualityId;
  compression: CompressionId;
  fileName: string;
}

export const DEFAULT_PDF_SETTINGS: PdfSettings = {
  pageSize: "a4",
  orientation: "auto",
  fit: "contain",
  margin: "medium",
  quality: "high",
  compression: "balanced",
  fileName: "document",
};

/** Page dimensions in PDF points (72 per inch). */
export const PAGE_SIZES: Record<Exclude<PageSizeId, "original">, { width: number; height: number }> = {
  a4: { width: 595.28, height: 841.89 },
  a3: { width: 841.89, height: 1190.55 },
  letter: { width: 612, height: 792 },
  legal: { width: 612, height: 1008 },
};

export const MARGIN_POINTS: Record<MarginId, number> = {
  none: 0,
  small: 14.17, // 5mm
  medium: 28.35, // 10mm
  large: 56.69, // 20mm
};

/** Target raster resolution + JPEG quality per quality setting. */
export const QUALITY_PRESETS: Record<QualityId, { maxEdge: number; jpegQuality: number; pdfScale: number }> = {
  standard: { maxEdge: 1600, jpegQuality: 0.72, pdfScale: 1.4 },
  high: { maxEdge: 2400, jpegQuality: 0.84, pdfScale: 2 },
  maximum: { maxEdge: 4000, jpegQuality: 0.94, pdfScale: 3 },
};

/** Compression dials the raster budget down further. */
export const COMPRESSION_FACTORS: Record<CompressionId, { edge: number; quality: number }> = {
  none: { edge: 1, quality: 1.06 },
  balanced: { edge: 0.85, quality: 0.95 },
  high: { edge: 0.62, quality: 0.8 },
};

/* ------------------------------------------------------------------ *
 * Results
 * ------------------------------------------------------------------ */

export interface OutputFile {
  name: string;
  blob: Blob;
  /** Pages, for PDFs. */
  pageCount?: number;
  /**
   * Overrides the page count in the result list — archives contain files, not
   * pages, so they describe themselves ("3 files").
   */
  countLabel?: string;
}

export interface ProgressState {
  active: boolean;
  label: string;
  /** 0..1, or null for indeterminate. */
  value: number | null;
}
