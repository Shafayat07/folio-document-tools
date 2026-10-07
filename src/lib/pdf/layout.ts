/**
 * Page geometry: how a source page of a given aspect ratio is placed on the
 * chosen paper size. Pure maths, shared by the generator and the size
 * estimator.
 */
import {
  MARGIN_POINTS,
  PAGE_SIZES,
  type FitId,
  type MarginId,
  type OrientationId,
  type PageSizeId,
  type PdfSettings,
} from "@/lib/core/types";

/** Largest dimension a PDF user-space page may have (14400 pt = 200 in). */
const MAX_PAGE_POINTS = 14400;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageLayout {
  /** Final paper size in points. */
  pageWidth: number;
  pageHeight: number;
  /** Where the content is drawn, in PDF coordinates (origin bottom-left). */
  content: Box;
  /**
   * Aspect ratio the raster should be cropped to before drawing. Only set for
   * `cover`, where we centre-crop instead of letting content spill.
   */
  coverAspect?: number;
  /** True when the content is stretched (fit = fill). */
  stretched: boolean;
}

function paperFor(pageSize: PageSizeId, orientation: OrientationId, contentW: number, contentH: number) {
  if (pageSize === "original") {
    // 1 image pixel = 1 PDF point, capped so the page stays within spec.
    let width = contentW;
    let height = contentH;
    const longest = Math.max(width, height);
    if (longest > MAX_PAGE_POINTS) {
      const scale = MAX_PAGE_POINTS / longest;
      width *= scale;
      height *= scale;
    }
    if (orientation === "portrait" && width > height) return { width: height, height: width };
    if (orientation === "landscape" && height > width) return { width: height, height: width };
    return { width, height };
  }

  const base = PAGE_SIZES[pageSize];
  const landscapeWanted =
    orientation === "landscape" || (orientation === "auto" && contentW > contentH);
  return landscapeWanted ? { width: base.height, height: base.width } : { width: base.width, height: base.height };
}

export function computeLayout(
  contentWidth: number,
  contentHeight: number,
  settings: Pick<PdfSettings, "pageSize" | "orientation" | "fit" | "margin">,
): PageLayout {
  const safeW = Math.max(1, contentWidth);
  const safeH = Math.max(1, contentHeight);
  const paper = paperFor(settings.pageSize, settings.orientation, safeW, safeH);

  const margin = marginFor(settings.margin, paper.width, paper.height);
  const boxW = Math.max(1, paper.width - margin * 2);
  const boxH = Math.max(1, paper.height - margin * 2);

  const result: PageLayout = {
    pageWidth: paper.width,
    pageHeight: paper.height,
    content: { x: margin, y: margin, width: boxW, height: boxH },
    stretched: settings.fit === "fill",
  };

  if (settings.fit === "fill") return result;

  if (settings.fit === "cover") {
    result.coverAspect = boxW / boxH;
    return result;
  }

  // contain: scale down to fit, then centre inside the margin box.
  const scale = Math.min(boxW / safeW, boxH / safeH);
  const drawW = safeW * scale;
  const drawH = safeH * scale;
  result.content = {
    x: margin + (boxW - drawW) / 2,
    y: margin + (boxH - drawH) / 2,
    width: drawW,
    height: drawH,
  };
  return result;
}

/** Margins never eat more than 30% of the shorter edge. */
function marginFor(margin: MarginId, pageWidth: number, pageHeight: number): number {
  const requested = MARGIN_POINTS[margin];
  const limit = Math.min(pageWidth, pageHeight) * 0.3;
  return Math.min(requested, limit);
}

/** Centre-crop rectangle (normalised) that makes `w/h` match `aspect`. */
export function centreCropForAspect(width: number, height: number, aspect: number) {
  const current = width / height;
  if (Math.abs(current - aspect) < 0.001) return null;
  if (current > aspect) {
    const cropW = height * aspect;
    return { x: (width - cropW) / 2 / width, y: 0, width: cropW / width, height: 1 };
  }
  const cropH = width / aspect;
  return { x: 0, y: (height - cropH) / 2 / height, width: 1, height: cropH / height };
}

export function fitLabel(fit: FitId): string {
  if (fit === "contain") return "Fit inside page";
  if (fit === "cover") return "Fill page (crop edges)";
  return "Stretch to page";
}
