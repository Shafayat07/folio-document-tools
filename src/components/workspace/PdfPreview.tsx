"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Maximize,
  Minimize,
  Minus,
  Plus,
  ZoomIn,
} from "lucide-react";
import { Button, ButtonGroup } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { AppError, toAppError } from "@/lib/core/errors";
import { clamp, formatBytes, uid } from "@/lib/core/utils";
import { closePdf, openPdf } from "@/lib/pdf/pdfjs";
import { keepRenderAlive } from "@/lib/pdf/render";

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];

export interface PdfPreviewProps {
  open: boolean;
  blob: Blob | null;
  name: string;
  onClose: () => void;
  onDownload: () => void;
}

/** Page-by-page viewer for a generated PDF, so the user can check before saving. */
export function PdfPreview({ open, blob, name, onClose, onDownload }: PdfPreviewProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [zoomMode, setZoomMode] = useState<"fit" | number>("fit");
  const [error, setError] = useState<AppError | null>(null);
  const [rendering, setRendering] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const taskRef = useRef<RenderTask | null>(null);
  const docIdRef = useRef<string | null>(null);

  // Open the document.
  useEffect(() => {
    if (!open || !blob) return;
    let cancelled = false;
    const id = uid("preview");
    docIdRef.current = id;
    setError(null);
    setPageIndex(0);

    openPdf(id, blob, name)
      .then((loaded) => {
        if (cancelled) {
          void closePdf(id);
          return;
        }
        setDoc(loaded);
      })
      .catch((cause) => {
        if (!cancelled) {
          setError(toAppError(cause, new AppError("render-failed", "Preview unavailable", "The PDF could not be opened for preview.")));
        }
      });

    return () => {
      cancelled = true;
      setDoc(null);
      void closePdf(id);
    };
  }, [open, blob, name]);

  // Render the current page.
  const render = useCallback(async () => {
    const canvas = canvasRef.current;
    const container = viewportRef.current;
    if (!doc || !canvas || !container) return;

    taskRef.current?.cancel();
    setRendering(true);

    try {
      const page = await doc.getPage(pageIndex + 1);
      const unscaled = page.getViewport({ scale: 1 });

      const available = {
        width: Math.max(120, container.clientWidth - 32),
        height: Math.max(120, container.clientHeight - 32),
      };
      const fitScale = Math.min(available.width / unscaled.width, available.height / unscaled.height);
      const scale = zoomMode === "fit" ? fitScale : fitScale * zoomMode;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: scale * dpr });

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const task = keepRenderAlive(page.render({ canvasContext: ctx, viewport }));
      taskRef.current = task;
      await task.promise;
      page.cleanup();
    } catch (cause) {
      const name = (cause as { name?: string })?.name;
      if (name !== "RenderingCancelledException") {
        setError(toAppError(cause, new AppError("render-failed", "Page could not be shown", "This page could not be rendered.")));
      }
    } finally {
      setRendering(false);
    }
  }, [doc, pageIndex, zoomMode]);

  useEffect(() => {
    void render();
  }, [render]);

  // Re-render on container resize (fit mode depends on it).
  useEffect(() => {
    if (!open || typeof ResizeObserver === "undefined") return;
    const container = viewportRef.current;
    if (!container) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => void render());
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [open, render]);

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const total = doc?.numPages ?? 0;

  const go = useCallback(
    (delta: number) => {
      setPageIndex((current) => clamp(current + delta, 0, Math.max(0, total - 1)));
    },
    [total],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        go(1);
      } else if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        go(-1);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, go]);

  const zoomBy = useCallback(
    (direction: 1 | -1) => {
      setZoomMode((current) => {
        const value = current === "fit" ? 1 : current;
        const index = ZOOM_STEPS.findIndex((step) => step >= value - 0.001);
        const nextIndex = clamp((index === -1 ? 2 : index) + direction, 0, ZOOM_STEPS.length - 1);
        return ZOOM_STEPS[nextIndex];
      });
    },
    [],
  );

  const toggleFullscreen = useCallback(async () => {
    const element = shellRef.current;
    if (!element) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await element.requestFullscreen();
    } catch {
      // Fullscreen can be blocked by permissions policy; the modal is already large.
      setFullscreen(false);
    }
  }, []);

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="full"
      title={name}
      description={blob ? `${formatBytes(blob.size)}${total ? ` · ${total} ${total === 1 ? "page" : "pages"}` : ""}` : undefined}
      bodyClassName="p-0 sm:p-0"
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <ButtonGroup>
            <Button size="md" iconOnly onClick={() => go(-1)} disabled={pageIndex <= 0} title="Previous page" aria-label="Previous page">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="md"
              iconOnly
              onClick={() => go(1)}
              disabled={pageIndex >= total - 1}
              title="Next page"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </ButtonGroup>

          <span className="font-mono text-2xs text-ink-500">
            Page {total ? pageIndex + 1 : 0} of {total}
          </span>

          <ButtonGroup className="ml-auto">
            <Button size="md" iconOnly onClick={() => zoomBy(-1)} title="Zoom out" aria-label="Zoom out">
              <Minus className="h-4 w-4" />
            </Button>
            <Button size="md" onClick={() => setZoomMode("fit")} title="Fit page">
              {zoomMode === "fit" ? "Fit" : `${Math.round(zoomMode * 100)}%`}
            </Button>
            <Button size="md" iconOnly onClick={() => zoomBy(1)} title="Zoom in" aria-label="Zoom in">
              <Plus className="h-4 w-4" />
            </Button>
          </ButtonGroup>

          <Button size="md" iconOnly onClick={toggleFullscreen} title="Toggle fullscreen" aria-label="Toggle fullscreen">
            {fullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>

          <Button variant="primary" size="md" onClick={onDownload}>
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>
      }
    >
      <div ref={shellRef} className="flex h-full min-h-[50vh] flex-col bg-[#3A3D43]">
        <div ref={viewportRef} className="relative flex min-h-[50vh] flex-1 items-center justify-center overflow-auto p-4">
          {error ? (
            <div className="max-w-sm text-center">
              <p className="text-sm font-semibold text-white">{error.title}</p>
              <p className="mt-1 text-[13px] text-white/70">{error.message}</p>
            </div>
          ) : (
            <canvas ref={canvasRef} className="bg-white shadow-pop" />
          )}

          {rendering && !error ? (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded bg-black/50 px-2 py-1 text-2xs text-white">
              <Loader2 className="h-3 w-3 animate-spin" />
              Rendering
            </span>
          ) : null}

          {!doc && !error ? (
            <span className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white/70">
              <ZoomIn className="h-4 w-4" />
              Opening preview…
            </span>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
