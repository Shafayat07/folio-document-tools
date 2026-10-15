/**
 * Tool definitions.
 *
 * Every tool is a thin configuration over the same workspace: an uploader, a
 * page organiser, a settings panel and an export action. Adding "Compress
 * PDF" or "Watermark PDF" later means adding an entry here plus (at most) one
 * export target — no changes to the editor, uploader or previewer.
 */
import type { AcceptMode } from "@/lib/files/import";
import type { PdfSettings } from "@/lib/core/types";

export type ToolCategory = "image" | "pdf" | "convert";

/** What the primary button produces. */
export type ExportTarget = "pdf" | "jpg" | "png" | "split-pdf" | "image-convert";

export interface ToolDefinition {
  slug: string;
  title: string;
  /** Shown under the title in the workspace header. */
  description: string;
  /** Short line used on tool cards. */
  blurb: string;
  category: ToolCategory;
  accept: AcceptMode;
  exportTarget: ExportTarget;
  /** Lucide icon name, resolved in the UI layer. */
  icon: ToolIcon;
  /** Label for the primary action button. */
  primaryLabel: string;
  /** Default settings overrides. */
  defaults?: Partial<PdfSettings>;
  /** Which settings groups are relevant for this tool. */
  showPageSetup: boolean;
  /** Hide from navigation lists (used by the home page tool itself). */
  hidden?: boolean;
  /** Pre-filter the upload hint text. */
  uploadHint: string;
}

export type ToolIcon =
  | "file-plus"
  | "images"
  | "image"
  | "file-image"
  | "file-text"
  | "layers"
  | "scissors"
  | "layout-grid"
  | "rotate-cw"
  | "trash"
  | "file-output"
  | "camera"
  | "repeat"
  | "shrink";

export const TOOLS: ToolDefinition[] = [
  {
    slug: "create-pdf",
    title: "Create PDF",
    description: "Convert images and documents into a single PDF.",
    blurb: "Images, photos and PDFs into one document.",
    category: "image",
    accept: "all",
    exportTarget: "pdf",
    icon: "file-plus",
    primaryLabel: "Create PDF",
    showPageSetup: true,
    uploadHint: "JPG, PNG, WEBP, GIF, BMP, TIFF, HEIC and PDF",
  },
  {
    slug: "image-to-pdf",
    title: "Images to PDF",
    description: "Combine photos and scans into one ordered PDF.",
    blurb: "Any supported image format into one PDF.",
    category: "image",
    accept: "image",
    exportTarget: "pdf",
    icon: "images",
    primaryLabel: "Create PDF",
    showPageSetup: true,
    uploadHint: "JPG, PNG, WEBP, GIF, BMP, TIFF, HEIC",
  },
  {
    slug: "jpg-to-pdf",
    title: "JPG to PDF",
    description: "Turn JPG photos into a PDF, in the order you choose.",
    blurb: "JPG and JPEG photos into a PDF.",
    category: "image",
    accept: "image",
    exportTarget: "pdf",
    icon: "image",
    primaryLabel: "Create PDF",
    showPageSetup: true,
    uploadHint: "JPG and JPEG files",
  },
  {
    slug: "png-to-pdf",
    title: "PNG to PDF",
    description: "Convert PNG images into a PDF with a white background.",
    blurb: "PNG images into a PDF.",
    category: "image",
    accept: "image",
    exportTarget: "pdf",
    icon: "image",
    primaryLabel: "Create PDF",
    showPageSetup: true,
    uploadHint: "PNG files",
  },
  {
    slug: "webp-to-pdf",
    title: "WEBP to PDF",
    description: "Convert WEBP images into a standard PDF.",
    blurb: "WEBP images into a PDF.",
    category: "image",
    accept: "image",
    exportTarget: "pdf",
    icon: "image",
    primaryLabel: "Create PDF",
    showPageSetup: true,
    uploadHint: "WEBP files",
  },
  {
    slug: "scan-to-pdf",
    title: "Scan to PDF",
    description: "Photograph pages with your camera and save them as a PDF.",
    blurb: "Use your camera to capture multi-page documents.",
    category: "image",
    accept: "image",
    exportTarget: "pdf",
    icon: "camera",
    primaryLabel: "Create PDF",
    showPageSetup: true,
    defaults: { pageSize: "a4", margin: "none", fit: "contain" },
    uploadHint: "Capture with your camera, or add existing photos",
  },

  {
    slug: "pdf-to-jpg",
    title: "PDF to JPG",
    description: "Export every PDF page as a JPG image.",
    blurb: "Each PDF page becomes a JPG.",
    category: "pdf",
    accept: "pdf",
    exportTarget: "jpg",
    icon: "file-image",
    primaryLabel: "Convert to JPG",
    showPageSetup: false,
    uploadHint: "PDF files",
  },
  {
    slug: "pdf-to-png",
    title: "PDF to PNG",
    description: "Export every PDF page as a lossless PNG image.",
    blurb: "Each PDF page becomes a PNG.",
    category: "pdf",
    accept: "pdf",
    exportTarget: "png",
    icon: "file-image",
    primaryLabel: "Convert to PNG",
    showPageSetup: false,
    uploadHint: "PDF files",
  },
  {
    slug: "merge-pdf",
    title: "Merge PDF",
    description: "Combine PDFs — and images — into one document.",
    blurb: "Join several files into a single PDF.",
    category: "pdf",
    accept: "all",
    exportTarget: "pdf",
    icon: "layers",
    primaryLabel: "Merge PDF",
    showPageSetup: true,
    defaults: { pageSize: "original", margin: "none" },
    uploadHint: "PDFs and images",
  },
  {
    slug: "split-pdf",
    title: "Split PDF",
    description: "Split a PDF into separate files by range or page count.",
    blurb: "Break one PDF into several files.",
    category: "pdf",
    accept: "pdf",
    exportTarget: "split-pdf",
    icon: "scissors",
    primaryLabel: "Split PDF",
    showPageSetup: false,
    defaults: { pageSize: "original", margin: "none" },
    uploadHint: "PDF files",
  },
  {
    slug: "organize-pdf",
    title: "Organize PDF",
    description: "Reorder, duplicate and remove pages, then save a new PDF.",
    blurb: "Rearrange pages visually.",
    category: "pdf",
    accept: "all",
    exportTarget: "pdf",
    icon: "layout-grid",
    primaryLabel: "Save PDF",
    showPageSetup: true,
    defaults: { pageSize: "original", margin: "none" },
    uploadHint: "PDFs and images",
  },
  {
    slug: "rotate-pdf",
    title: "Rotate PDF",
    description: "Rotate individual pages or the whole document.",
    blurb: "Fix sideways and upside-down pages.",
    category: "pdf",
    accept: "all",
    exportTarget: "pdf",
    icon: "rotate-cw",
    primaryLabel: "Save PDF",
    showPageSetup: true,
    defaults: { pageSize: "original", margin: "none" },
    uploadHint: "PDFs and images",
  },
  {
    slug: "delete-pages",
    title: "Delete PDF pages",
    description: "Remove the pages you do not need and save the rest.",
    blurb: "Drop unwanted pages from a PDF.",
    category: "pdf",
    accept: "pdf",
    exportTarget: "pdf",
    icon: "trash",
    primaryLabel: "Save PDF",
    showPageSetup: true,
    defaults: { pageSize: "original", margin: "none" },
    uploadHint: "PDF files",
  },
  {
    slug: "extract-pages",
    title: "Extract PDF pages",
    description: "Keep only the pages you select and export them as a new PDF.",
    blurb: "Pull selected pages into a new PDF.",
    category: "pdf",
    accept: "pdf",
    exportTarget: "pdf",
    icon: "file-output",
    primaryLabel: "Extract pages",
    showPageSetup: true,
    defaults: { pageSize: "original", margin: "none" },
    uploadHint: "PDF files",
  },

  /* ---------------- Image format conversion ---------------- */
  {
    slug: "image-converter",
    title: "Image converter",
    description: "Convert images between PNG, JPG and WEBP, and resize them.",
    blurb: "Any supported image into PNG, JPG or WEBP.",
    category: "convert",
    accept: "image",
    exportTarget: "image-convert",
    icon: "repeat",
    primaryLabel: "Convert images",
    showPageSetup: false,
    defaults: { imageFormat: "png", imageSize: "original" },
    uploadHint: "JPG, PNG, WEBP, GIF, BMP, TIFF, HEIC, AVIF",
  },
  {
    slug: "jpg-to-png",
    title: "JPG to PNG",
    description: "Convert JPG photos into lossless PNG images.",
    blurb: "JPG files into PNG.",
    category: "convert",
    accept: "image",
    exportTarget: "image-convert",
    icon: "repeat",
    primaryLabel: "Convert to PNG",
    showPageSetup: false,
    defaults: { imageFormat: "png", imageSize: "original" },
    uploadHint: "JPG and JPEG files",
  },
  {
    slug: "png-to-jpg",
    title: "PNG to JPG",
    description: "Convert PNG images into smaller JPG files on a white background.",
    blurb: "PNG files into JPG.",
    category: "convert",
    accept: "image",
    exportTarget: "image-convert",
    icon: "repeat",
    primaryLabel: "Convert to JPG",
    showPageSetup: false,
    defaults: { imageFormat: "jpeg", imageSize: "original" },
    uploadHint: "PNG files",
  },
  {
    slug: "heic-to-jpg",
    title: "HEIC to JPG",
    description: "Convert iPhone HEIC photos into JPG files any app can open.",
    blurb: "iPhone HEIC photos into JPG.",
    category: "convert",
    accept: "image",
    exportTarget: "image-convert",
    icon: "repeat",
    primaryLabel: "Convert to JPG",
    showPageSetup: false,
    defaults: { imageFormat: "jpeg", imageSize: "original" },
    uploadHint: "HEIC and HEIF files from an iPhone or iPad",
  },
  {
    slug: "webp-to-jpg",
    title: "WEBP to JPG",
    description: "Convert WEBP images into widely supported JPG files.",
    blurb: "WEBP files into JPG.",
    category: "convert",
    accept: "image",
    exportTarget: "image-convert",
    icon: "repeat",
    primaryLabel: "Convert to JPG",
    showPageSetup: false,
    defaults: { imageFormat: "jpeg", imageSize: "original" },
    uploadHint: "WEBP files",
  },
  {
    slug: "image-to-webp",
    title: "Convert to WEBP",
    description: "Convert images to WEBP, which is usually much smaller than JPG.",
    blurb: "Shrink images by converting to WEBP.",
    category: "convert",
    accept: "image",
    exportTarget: "image-convert",
    icon: "shrink",
    primaryLabel: "Convert to WEBP",
    showPageSetup: false,
    defaults: { imageFormat: "webp", imageSize: "original" },
    uploadHint: "JPG, PNG, HEIC and other images",
  },
  {
    slug: "compress-image",
    title: "Compress images",
    description: "Reduce image file size by resizing and re-encoding.",
    blurb: "Make images smaller for email or upload.",
    category: "convert",
    accept: "image",
    exportTarget: "image-convert",
    icon: "shrink",
    primaryLabel: "Compress images",
    showPageSetup: false,
    defaults: { imageFormat: "jpeg", imageSize: "large", quality: "standard", compression: "high" },
    uploadHint: "Any supported image",
  },
];

export const TOOL_MAP = new Map(TOOLS.map((tool) => [tool.slug, tool]));

export function getTool(slug: string): ToolDefinition | undefined {
  return TOOL_MAP.get(slug);
}

export const HOME_TOOL = TOOL_MAP.get("create-pdf")!;

export function toolsByCategory(category: ToolCategory): ToolDefinition[] {
  return TOOLS.filter((tool) => tool.category === category && !tool.hidden);
}

export const CATEGORY_LABELS: Record<ToolCategory, string> = {
  image: "Image tools",
  pdf: "PDF tools",
  convert: "File conversion",
};

/**
 * Converters that are planned but not built yet. Listed explicitly so the UI
 * can mark them as unavailable instead of shipping dead buttons.
 */
export interface PlannedTool {
  title: string;
  blurb: string;
  reason: string;
}

export const PLANNED_TOOLS: PlannedTool[] = [
  {
    title: "PowerPoint (PPTX) to PDF",
    blurb: "Convert slide decks to PDF.",
    reason:
      "Faithful slide rendering needs a full layout and font engine (LibreOffice-class). Browser-side attempts break fonts, charts and positioning, so this would need a conversion server — which would also mean uploading your files.",
  },
  {
    title: "Word (DOCX) / Excel (XLSX) to PDF",
    blurb: "Convert Office documents to PDF.",
    reason:
      "Same limitation as PPTX: pagination, styles and embedded fonts cannot be reproduced accurately in the browser.",
  },
  {
    title: "PDF to Word / PowerPoint",
    blurb: "Convert a PDF back into an editable document.",
    reason:
      "Requires reconstructing structure from positioned text runs — a server-side job, and unreliable even then.",
  },
  {
    title: "Compress PDF",
    blurb: "Reduce PDF file size by re-encoding images.",
    reason:
      "Already available: open any PDF in Create PDF and use the Image quality and Compression settings before exporting.",
  },
];

/** Shown next to the unavailable list so the page is useful, not just a refusal. */
export const OFFICE_WORKAROUND = {
  title: "Converting a PowerPoint or Word file today",
  steps: [
    "In PowerPoint, Word or Excel choose File → Export → Create PDF/XPS (or File → Save as → PDF).",
    "On a Mac or in Google Slides/Docs, use File → Download → PDF Document.",
    "Bring that PDF back here to merge, split, reorder, rotate or convert it to images.",
  ],
};
