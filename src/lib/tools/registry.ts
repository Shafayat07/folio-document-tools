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
export type ExportTarget = "pdf" | "jpg" | "png" | "split-pdf";

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
  | "camera";

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
    title: "Compress PDF",
    blurb: "Reduce file size by re-encoding images.",
    reason: "Available today through the Quality and Compression settings when creating a PDF.",
  },
  {
    title: "Word / Excel / PowerPoint to PDF",
    blurb: "Convert Office documents to PDF.",
    reason: "Needs a document rendering engine that cannot run reliably in the browser yet.",
  },
  {
    title: "PDF to Word",
    blurb: "Convert PDF text back into an editable document.",
    reason: "Not implemented — layout reconstruction requires server-side processing.",
  },
];
