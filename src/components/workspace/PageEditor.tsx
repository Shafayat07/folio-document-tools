"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Crop, RefreshCcw, Replace, RotateCcw, RotateCw, ScanSearch, Trash2 } from "lucide-react";
import { Button, ButtonGroup } from "@/components/ui/Button";
import { Checkbox, Field, Segmented, Slider } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { DEFAULT_ADJUSTMENTS, type CropRect, type EnhanceMode, type PageAdjustments, type ProjectPage, type Quad, type Rotation, type SourceFile } from "@/lib/core/types";
import { decodeImage } from "@/lib/files/decode";
import { getImageData, rasterize, releaseCanvas } from "@/lib/image/canvas";
import { FULL_QUAD, isFullQuad } from "@/lib/image/perspective";
import { getBasePreview } from "@/lib/image/preview-cache";
import { detectQuad } from "@/lib/workers/processing-client";
import { useFileTrigger } from "./DropZone";
import { CropStage, type CropMode } from "./CropStage";
import { PageThumb } from "./PageThumb";
import { useBasePreviewUrl } from "./usePageRender";

const FULL_RECT: CropRect = { x: 0, y: 0, width: 1, height: 1 };

function isFullRect(rect: CropRect) {
  return rect.x < 0.004 && rect.y < 0.004 && rect.width > 0.996 && rect.height > 0.996;
}

export interface PageEditorProps {
  open: boolean;
  page: ProjectPage | null;
  file: SourceFile | undefined;
  index: number;
  total: number;
  onClose: () => void;
  onApply: (changes: { rotation: Rotation; crop?: CropRect; quad?: Quad; adjustments: PageAdjustments }) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onReplace: (files: File[]) => void;
  onNavigate: (delta: 1 | -1) => void;
}

export function PageEditor({
  open,
  page,
  file,
  index,
  total,
  onClose,
  onApply,
  onDelete,
  onDuplicate,
  onReplace,
  onNavigate,
}: PageEditorProps) {
  const { notify, notifyError } = useToast();

  const [rotation, setRotation] = useState<Rotation>(0);
  const [adjustments, setAdjustments] = useState<PageAdjustments>(DEFAULT_ADJUSTMENTS);
  const [cropMode, setCropMode] = useState<CropMode | "off">("off");
  const [rect, setRect] = useState<CropRect>(FULL_RECT);
  const [quad, setQuad] = useState<Quad>(FULL_QUAD);
  const [detecting, setDetecting] = useState(false);

  const replacePicker = useFileTrigger("all", onReplace, false);

  // Seed the draft when a different page is opened. Deliberately keyed on the
  // page *id* only: re-running on every page-object change would discard an
  // in-progress crop if the page were edited from elsewhere in the workspace.
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (!open || !page) {
      if (!open) seededFor.current = null;
      return;
    }
    if (seededFor.current === page.id) return;
    seededFor.current = page.id;
    setRotation(page.rotation);
    setAdjustments(page.adjustments);
    setRect(page.crop ?? FULL_RECT);
    setQuad(page.quad ?? FULL_QUAD);
    setCropMode(page.quad ? "corners" : page.crop ? "rect" : "off");
  }, [open, page]);

  const { url: baseUrl, error: baseError } = useBasePreviewUrl(page ?? ({} as ProjectPage), file, open && !!page);

  const draft = useMemo<ProjectPage | null>(() => {
    if (!page) return null;
    return {
      ...page,
      rotation,
      adjustments,
      crop: cropMode === "rect" && !isFullRect(rect) ? rect : undefined,
      quad: cropMode === "corners" && !isFullQuad(quad) ? quad : undefined,
    };
  }, [page, rotation, adjustments, cropMode, rect, quad]);

  const aspect = page && page.sourceHeight > 0 ? page.sourceWidth / page.sourceHeight : 1;

  const handleDetect = useCallback(async () => {
    if (!page || !file) return;
    setDetecting(true);
    try {
      const blob = await getBasePreview(page, file);
      const decoded = await decodeImage(blob, file.name, "jpg");
      let found: Quad | null = null;
      try {
        const canvas = rasterize(decoded.bitmap, { maxEdge: 700, background: "#ffffff" });
        const data = getImageData(canvas);
        releaseCanvas(canvas);
        found = await detectQuad(data);
      } finally {
        decoded.release();
      }

      if (found) {
        setQuad(found);
        setCropMode("corners");
        notify({ tone: "success", title: "Edges detected", message: "Drag any corner to fine-tune the result." });
      } else {
        setCropMode("corners");
        notify({
          tone: "info",
          title: "No clear page edges found",
          message: "Automatic detection was not confident enough here.",
          hint: "Drag the four corners to mark the page yourself.",
        });
      }
    } catch (error) {
      notifyError(error, "Edge detection failed");
    } finally {
      setDetecting(false);
    }
  }, [file, notify, notifyError, page]);

  const reset = useCallback(() => {
    setRotation(0);
    setAdjustments(DEFAULT_ADJUSTMENTS);
    setRect(FULL_RECT);
    setQuad(FULL_QUAD);
    setCropMode("off");
  }, []);

  const apply = useCallback(() => {
    onApply({
      rotation,
      crop: cropMode === "rect" && !isFullRect(rect) ? rect : undefined,
      quad: cropMode === "corners" && !isFullQuad(quad) ? quad : undefined,
      adjustments,
    });
  }, [adjustments, cropMode, onApply, quad, rect, rotation]);

  if (!open || !page) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      title={`Edit page ${index + 1}`}
      description={page.label}
      bodyClassName="p-0 sm:p-0"
      headerActions={
        <div className="hidden items-center gap-1 sm:flex">
          <Button variant="ghost" size="sm" onClick={() => onNavigate(-1)} disabled={total < 2} title="Previous page">
            Prev
          </Button>
          <span className="px-1 font-mono text-2xs text-ink-400">
            {index + 1}/{total}
          </span>
          <Button variant="ghost" size="sm" onClick={() => onNavigate(1)} disabled={total < 2} title="Next page">
            Next
          </Button>
        </div>
      }
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <Button variant="danger" size="md" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
          <Button variant="secondary" size="md" onClick={onDuplicate}>
            <Copy className="h-4 w-4" />
            Duplicate
          </Button>
          <Button variant="secondary" size="md" onClick={replacePicker.open}>
            <Replace className="h-4 w-4" />
            Replace
          </Button>
          {replacePicker.input}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="md" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" size="md" onClick={apply}>
              Apply changes
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex min-h-[60vh] flex-col lg:h-full lg:flex-row">
        {/* Stage */}
        <div className="relative flex min-h-[42vh] flex-1 items-center justify-center bg-[#2A2D33] lg:min-h-0">
          {baseError ? (
            <p className="max-w-xs p-6 text-center text-[13px] text-white/70">{baseError.message}</p>
          ) : cropMode !== "off" && baseUrl ? (
            <CropStage
              imageUrl={baseUrl}
              aspect={aspect}
              rotation={rotation}
              mode={cropMode}
              rect={rect}
              quad={quad}
              onRectChange={setRect}
              onQuadChange={setQuad}
            />
          ) : draft ? (
            <div className="flex h-full w-full items-center justify-center p-4 sm:p-8">
              <div className="flex max-h-full max-w-full items-center justify-center">
                <PageThumb page={draft} file={file} size={1200} eager className="max-h-[70vh]" />
              </div>
            </div>
          ) : null}

          {cropMode !== "off" ? (
            <p className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded bg-ink/80 px-2 py-1 text-2xs text-white">
              {cropMode === "rect" ? "Drag the edges or corners to crop" : "Drag the four corners onto the page corners"}
            </p>
          ) : null}
        </div>

        {/* Controls */}
        <aside className="shrink-0 space-y-5 border-t border-line bg-surface p-4 lg:w-[300px] lg:overflow-y-auto lg:border-l lg:border-t-0 lg:scrollbar-slim">
          <section>
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-ink-400">Rotate</p>
            <div className="flex items-center gap-2">
              <ButtonGroup>
                <Button
                  size="md"
                  onClick={() => setRotation(((rotation + 270) % 360) as Rotation)}
                  title="Rotate left"
                  aria-label="Rotate left"
                  iconOnly
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
                <Button
                  size="md"
                  onClick={() => setRotation(((rotation + 90) % 360) as Rotation)}
                  title="Rotate right"
                  aria-label="Rotate right"
                  iconOnly
                >
                  <RotateCw className="h-4 w-4" />
                </Button>
              </ButtonGroup>
              <span className="font-mono text-2xs text-ink-400">{rotation}°</span>
            </div>
          </section>

          <section>
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-ink-400">Crop</p>
            <Segmented<CropMode | "off">
              value={cropMode}
              onValueChange={(value) => {
                setCropMode(value);
                if (value === "rect" && isFullRect(rect)) setRect({ x: 0.05, y: 0.05, width: 0.9, height: 0.9 });
              }}
              options={[
                { value: "off", label: "Off" },
                { value: "rect", label: "Rectangle", title: "Straight crop" },
                { value: "corners", label: "Corners", title: "Perspective correction" },
              ]}
              size="sm"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={handleDetect} loading={detecting}>
                {!detecting ? <ScanSearch className="h-3.5 w-3.5" /> : null}
                Detect edges
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRect(FULL_RECT);
                  setQuad(FULL_QUAD);
                  setCropMode("off");
                }}
                disabled={cropMode === "off"}
              >
                <Crop className="h-3.5 w-3.5" />
                Clear crop
              </Button>
            </div>
            <p className="mt-2 text-2xs leading-relaxed text-ink-400">
              Corners mode straightens a photographed page. Detection is automatic where the page edges are clear —
              otherwise drag the corners yourself.
            </p>
          </section>

          <section>
            <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-ink-400">Readability</p>
            <Field label="Mode">
              <Segmented<EnhanceMode>
                value={adjustments.mode}
                onValueChange={(mode) => setAdjustments((current) => ({ ...current, mode }))}
                options={[
                  { value: "original", label: "Colour" },
                  { value: "grayscale", label: "Grey" },
                  { value: "document", label: "Document" },
                  { value: "bw", label: "B&W" },
                ]}
                size="sm"
              />
            </Field>
            <div className="mt-3 space-y-3">
              <Slider
                label="Brightness"
                min={-100}
                max={100}
                value={adjustments.brightness}
                onValueChange={(brightness) => setAdjustments((current) => ({ ...current, brightness }))}
                onReset={() => setAdjustments((current) => ({ ...current, brightness: 0 }))}
              />
              <Slider
                label="Contrast"
                min={-100}
                max={100}
                value={adjustments.contrast}
                onValueChange={(contrast) => setAdjustments((current) => ({ ...current, contrast }))}
                onReset={() => setAdjustments((current) => ({ ...current, contrast: 0 }))}
              />
              <Checkbox
                label="Sharpen"
                hint="Helps small text taken with a phone camera"
                checked={adjustments.sharpen}
                onCheckedChange={(sharpen) => setAdjustments((current) => ({ ...current, sharpen }))}
              />
            </div>
          </section>

          <Button variant="ghost" size="sm" onClick={reset} block>
            <RefreshCcw className="h-3.5 w-3.5" />
            Reset this page
          </Button>
        </aside>
      </div>
    </Modal>
  );
}
