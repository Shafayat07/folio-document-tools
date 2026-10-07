# Folio — Document Tools

A browser-based document utility for turning photos and files into organised PDFs, and for
cleaning up PDFs you already have. Every conversion runs on the device — there is no upload
step, no account and no server-side processing.

Built with Next.js 16 (App Router), React 19, TypeScript and Tailwind CSS. The production
build is fully static (20 prerendered routes), so it can be hosted on any static host.

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # static production build
npm run typecheck
```

`predev`/`prebuild` copy the pdf.js worker and its cmap/standard-font assets into `public/`,
so the worker loads from a stable URL regardless of bundler.

## What it does

**Image → PDF** is the core flow: add images (or photograph pages with the camera), arrange
them visually, then export. Selection order is preserved exactly — five chosen JPGs become
pages 1–5 in that order.

- Import JPG, PNG, WEBP, GIF, BMP, TIFF, HEIC/HEIF, AVIF and PDF
- Capture many pages in one camera session without reopening the camera
- Drag-and-drop page reordering with pointer, touch and keyboard
- Multi-select, rotate, duplicate, delete, replace, and per-page editing
- Rectangular crop and four-corner perspective correction, with optional edge detection
- Readability modes: colour, greyscale, document, and bilevel black & white
- Page size, orientation, fit, margin, quality and compression, with a sampled size estimate
- Preview the generated PDF page by page before downloading
- Undo/redo, including recovery after removing every page

## Architecture

Every tool is a configuration over one workspace. Adding a tool means adding an entry to
`src/lib/tools/registry.ts` and, at most, one export target — the uploader, organiser,
editor, previewer and processing pipeline are shared.

```
src/
  app/                        routes; /tools/[slug] is generated from the registry
  components/
    ui/                       Button, Modal, Field/Select/Segmented/Slider, Progress, Toast
    layout/                   header, footer, logo, tool cards
    workspace/                Workspace (orchestrator) + DropZone, PageGrid, PageCard,
                              PageEditor, CropStage, CameraCapture, SettingsPanel,
                              PdfPreview, ResultPanel, SplitOptions, FileList
  lib/
    core/                     types, errors, utils, LRU
    files/                    format detection, decoding, import
    image/                    canvas ops, filters, perspective, render cache
    pdf/                      pdf.js access, render, layout, generate, split, export-images
    export/                   download, ZIP writer
    store/                    project reducer
    tools/                    tool registry
    workers/                  processing worker + client with main-thread fallback
```

### Notable implementation decisions

**PDF pages are preserved, not re-photographed.** A page that came from a PDF and has no
pixel edits is copied verbatim (`copyPages`) or embedded as vector content (`embedPage`), so
text stays selectable. Rasterisation happens only when a page is cropped, straightened or
filtered. `src/lib/pdf/generate.ts` picks the path per page.

**Rotation geometry.** pdf-lib rotates counter-clockwise about the anchor point, so
`drawRotated` derives both the anchor corner and the pre-rotation width/height from the
target box. This is verified end-to-end: a landscape image with a top-left marker, rotated
90° clockwise, produces a portrait page with the marker at top-right.

**Two-level render cache** (`src/lib/image/preview-cache.ts`). Each source page is decoded
once into a moderate-resolution JPEG; thumbnails are then derived from that, keyed by the
full edit state. Full-resolution decoding happens only during export and is released
immediately, which keeps 50-page projects inside a tab's memory budget.

**Background tabs.** Browsers suspend `requestAnimationFrame` in hidden tabs, which would
otherwise stall an export mid-way and leave lazy thumbnails as skeletons. `nextFrame()`
races a timer against the frame callback, pdf.js renders are driven through
`keepRenderAlive` (taking over its `onContinue` hook), and lazy loading does a direct
geometry check alongside its IntersectionObserver.

**Worker with a fallback.** Filters, perspective warps and edge detection run in a Web
Worker over transferred buffers. If the worker cannot be created, every call transparently
falls back to the same pure functions on the main thread — features never disappear.

**Dependency-free ZIP.** Multi-file exports are packaged by a small store-method ZIP writer
(`src/lib/export/zip.ts`); JPEG/PNG/PDF payloads are already compressed, so deflating again
buys almost nothing.

**Edge detection is honest.** `detectDocumentQuad` is a Sobel-gradient border search, not a
learned model. When it is not confident it returns `null`, and the UI says so and hands over
a manual four-corner tool.

## Limits

- Files are capped at 300 MB and PDFs at 1000 pages for in-browser processing.
- Password-protected PDFs are reported rather than opened.
- Office-document conversion (Word/Excel/PowerPoint) and PDF→Word are **not implemented**;
  they are listed on `/converters` as unavailable rather than shipped as dead buttons.
- Camera capture needs HTTPS or localhost. If permission is denied the tool explains how to
  restore it and offers the file picker instead.
