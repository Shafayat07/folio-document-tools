"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  ArrowDownUp,
  Camera,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Grid2x2,
  Image as ImageIcon,
  Loader2,
  PanelRightClose,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  ShieldCheck,
  SlidersHorizontal,
  Square,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { Button, ButtonGroup } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Progress } from "@/components/ui/Progress";
import { useToast } from "@/components/ui/Toast";
import { AppError } from "@/lib/core/errors";
import { DEFAULT_PDF_SETTINGS, type OutputFile, type ProjectPage } from "@/lib/core/types";
import { cn, pluralize, sanitizeFileName } from "@/lib/core/utils";
import { saveBlob } from "@/lib/export/download";
import { importFiles } from "@/lib/files/import";
import { evictAll, evictFile } from "@/lib/image/preview-cache";
import { closeAllPdfs, closePdf } from "@/lib/pdf/pdfjs";
import { exportPagesAsImages } from "@/lib/pdf/export-images";
import { generatePdf } from "@/lib/pdf/generate";
import { splitProject } from "@/lib/pdf/split";
import {
  fileSummaries,
  filesAsMap,
  initialProjectState,
  projectReducer,
  selectedPages,
} from "@/lib/store/project-reducer";
import type { ToolDefinition } from "@/lib/tools/registry";
import { CameraCapture } from "./CameraCapture";
import { DropZone, useFileTrigger } from "./DropZone";
import { FileList } from "./FileList";
import { PageEditor } from "./PageEditor";
import { PageGrid } from "./PageGrid";
import { PageThumb } from "./PageThumb";
import { PdfPreview } from "./PdfPreview";
import { ResultPanel } from "./ResultPanel";
import { SettingsPanel } from "./SettingsPanel";
import { DEFAULT_SPLIT_CONFIG, SplitOptions, splitGroupsFor, type SplitConfig } from "./SplitOptions";

type Phase = "idle" | "ready" | "working" | "done";
type View = "grid" | "page";

export function Workspace({ tool }: { tool: ToolDefinition }) {
  const { notify, notifyError, notifyErrors } = useToast();

  const [state, dispatch] = useReducer(projectReducer, undefined, () => ({
    ...initialProjectState,
    settings: { ...DEFAULT_PDF_SETTINGS, ...tool.defaults },
  }));

  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<{ label: string; value: number | null }>({ label: "", value: null });
  const [outputs, setOutputs] = useState<OutputFile[]>([]);
  const [view, setView] = useState<View>("grid");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editorId, setEditorId] = useState<string | null>(null);
  const [camera, setCamera] = useState<{ open: boolean; mode: "single" | "multi" }>({ open: false, mode: "multi" });
  const [mobileSettings, setMobileSettings] = useState(false);
  const [previewOutput, setPreviewOutput] = useState<OutputFile | null>(null);
  const [splitConfig, setSplitConfig] = useState<SplitConfig>(DEFAULT_SPLIT_CONFIG);
  const [windowDrag, setWindowDrag] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const importingRef = useRef(false);
  const [importing, setImporting] = useState(false);

  const { pages, selection, settings, files } = state;
  const fileMap = useMemo(() => filesAsMap(state), [state]);
  const summaries = useMemo(() => fileSummaries(state), [state]);
  const allowCamera = tool.accept !== "pdf";

  /* ---------------------------------------------------------------- *
   * Import
   * ---------------------------------------------------------------- */

  const handleFiles = useCallback(
    async (incoming: File[]) => {
      if (!incoming.length || importingRef.current) return;
      importingRef.current = true;
      setImporting(true);
      setProgress({ label: "Reading files", value: incoming.length > 1 ? 0 : null });

      try {
        const outcome = await importFiles(incoming, {
          accept: tool.accept,
          onProgress: (done, total, label) => setProgress({ label, value: total > 1 ? done / total : null }),
        });

        if (outcome.pages.length) {
          dispatch({ type: "import", files: outcome.files, pages: outcome.pages });
          // Name the output after the first file the user brought in.
          if (settings.fileName === DEFAULT_PDF_SETTINGS.fileName && outcome.files[0]) {
            dispatch({ type: "set-settings", settings: { fileName: sanitizeFileName(outcome.files[0].name) } });
          }
          setPhase("ready");
          setOutputs([]);
          notify({
            tone: "success",
            title: `${pluralize(outcome.pages.length, "page")} added`,
            message: outcome.files.length > 1 ? `From ${pluralize(outcome.files.length, "file")}.` : undefined,
          });
        }

        notifyErrors(outcome.errors);
        if (!outcome.pages.length && !outcome.errors.length) {
          notify({ tone: "info", title: "Nothing to add", message: "No supported files were found in that selection." });
        }
      } catch (error) {
        notifyError(error, "Import failed");
      } finally {
        importingRef.current = false;
        setImporting(false);
        setProgress({ label: "", value: null });
      }
    },
    [notify, notifyError, notifyErrors, settings.fileName, tool.accept],
  );

  const addPicker = useFileTrigger(tool.accept, handleFiles);

  /* ---------------------------------------------------------------- *
   * Window-level drag & drop
   * ---------------------------------------------------------------- */

  useEffect(() => {
    let depth = 0;
    const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes("Files");

    const onEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth += 1;
      setWindowDrag(true);
    };
    const onLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setWindowDrag(false);
    };
    const onOver = (event: DragEvent) => {
      if (hasFiles(event)) event.preventDefault();
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setWindowDrag(false);
      const dropped = Array.from(event.dataTransfer?.files ?? []);
      if (dropped.length) void handleFiles(dropped);
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [handleFiles]);

  /* ---------------------------------------------------------------- *
   * Active page bookkeeping
   * ---------------------------------------------------------------- */

  useEffect(() => {
    if (!pages.length) {
      setActiveId(null);
      if (phase !== "working") setPhase((current) => (current === "done" ? current : "idle"));
      return;
    }
    setActiveId((current) => (current && pages.some((page) => page.id === current) ? current : pages[0].id));
  }, [pages, phase]);

  // Release render caches and pdf.js documents on unmount.
  useEffect(
    () => () => {
      evictAll();
      closeAllPdfs();
    },
    [],
  );

  const activeIndex = activeId ? pages.findIndex((page) => page.id === activeId) : -1;
  const activePage: ProjectPage | null = activeIndex >= 0 ? pages[activeIndex] : null;
  const editorIndex = editorId ? pages.findIndex((page) => page.id === editorId) : -1;
  const editorPage: ProjectPage | null = editorIndex >= 0 ? pages[editorIndex] : null;

  /* ---------------------------------------------------------------- *
   * Page actions
   * ---------------------------------------------------------------- */

  const targetIds = useCallback(
    (id?: string) => {
      if (id && selection.includes(id) && selection.length > 1) return selection;
      if (id) return [id];
      return selection;
    },
    [selection],
  );

  const handleSelect = useCallback((id: string, event: React.MouseEvent) => {
    setActiveId(id);
    if (event.shiftKey) {
      dispatch({ type: "select", ids: [id], mode: "range" });
    } else if (event.metaKey || event.ctrlKey) {
      dispatch({ type: "select", ids: [id], mode: "toggle" });
    } else {
      dispatch({ type: "select", ids: selection.length === 1 && selection[0] === id ? [] : [id] });
    }
  }, [selection]);

  const handleRotate = useCallback(
    (id: string, delta: 90 | -90) => dispatch({ type: "rotate", ids: targetIds(id), delta }),
    [targetIds],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const ids = targetIds(id);
      dispatch({ type: "remove-pages", ids });
      notify({
        tone: "info",
        title: `${pluralize(ids.length, "page")} removed`,
        hint: "Use Undo (Ctrl+Z) to bring them back.",
      });
    },
    [notify, targetIds],
  );

  const handleRemoveFile = useCallback(
    (fileId: string) => {
      dispatch({ type: "remove-file", fileId });
      evictFile(fileId);
      void closePdf(fileId);
    },
    [],
  );

  const handleReplace = useCallback(
    async (incoming: File[]) => {
      if (!editorId || !incoming.length) return;
      try {
        const outcome = await importFiles(incoming.slice(0, 1), { accept: tool.accept });
        notifyErrors(outcome.errors);
        const [page] = outcome.pages;
        const [file] = outcome.files;
        if (page && file) {
          dispatch({ type: "replace-page", id: editorId, file, page });
          notify({ tone: "success", title: "Page replaced", message: file.name });
        }
      } catch (error) {
        notifyError(error, "Replace failed");
      }
    },
    [editorId, notify, notifyError, notifyErrors, tool.accept],
  );

  /* ---------------------------------------------------------------- *
   * Keyboard shortcuts
   * ---------------------------------------------------------------- */

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (editorId || camera.open || previewOutput || mobileSettings) return;
      const target = event.target as HTMLElement | null;
      if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;

      const meta = event.metaKey || event.ctrlKey;

      // Undo/redo stay available with an empty page list — that is exactly
      // when someone needs to take back a "delete all".
      if (meta && event.key.toLowerCase() === "z") {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? "redo" : "undo" });
        return;
      }
      if (meta && event.key.toLowerCase() === "y") {
        event.preventDefault();
        dispatch({ type: "redo" });
        return;
      }

      if (!pages.length) return;

      if (meta && event.key.toLowerCase() === "a") {
        event.preventDefault();
        dispatch({ type: "select-all" });
      } else if (event.key === "Delete" || event.key === "Backspace") {
        if (!selection.length) return;
        event.preventDefault();
        handleDelete(selection[0]);
      } else if (event.key === "Escape") {
        dispatch({ type: "clear-selection" });
      } else if (event.key === "[") {
        event.preventDefault();
        dispatch({ type: "rotate", ids: selection.length ? selection : activeId ? [activeId] : [], delta: -90 });
      } else if (event.key === "]") {
        event.preventDefault();
        dispatch({ type: "rotate", ids: selection.length ? selection : activeId ? [activeId] : [], delta: 90 });
      } else if (event.key === "ArrowRight" && view === "page") {
        setActiveId(pages[Math.min(pages.length - 1, activeIndex + 1)]?.id ?? activeId);
      } else if (event.key === "ArrowLeft" && view === "page") {
        setActiveId(pages[Math.max(0, activeIndex - 1)]?.id ?? activeId);
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [activeId, activeIndex, camera.open, editorId, handleDelete, mobileSettings, pages, previewOutput, selection, view]);

  /* ---------------------------------------------------------------- *
   * Export
   * ---------------------------------------------------------------- */

  const exportPages = useMemo(() => {
    if (tool.slug === "extract-pages" && selection.length) return selectedPages(state);
    return pages;
  }, [pages, selection.length, state, tool.slug]);

  const splitGroups = useMemo(
    () => (tool.exportTarget === "split-pdf" ? splitGroupsFor(splitConfig, exportPages) : []),
    [exportPages, splitConfig, tool.exportTarget],
  );

  const canExport =
    exportPages.length > 0 && phase !== "working" && (tool.exportTarget !== "split-pdf" || splitGroups.length > 0);

  const runExport = useCallback(async () => {
    if (!exportPages.length) {
      notifyError(new AppError("empty-project", "Nothing to export", "Add at least one page first."));
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setPhase("working");
    setProgress({ label: "Preparing", value: 0 });

    const onProgress = ({ done, total, label }: { done: number; total: number; label: string }) =>
      setProgress({ label, value: total ? done / total : null });

    try {
      let produced: OutputFile[];

      if (tool.exportTarget === "jpg" || tool.exportTarget === "png") {
        produced = await exportPagesAsImages({
          pages: exportPages,
          files: fileMap,
          format: tool.exportTarget === "png" ? "png" : "jpeg",
          quality: settings.quality,
          compression: settings.compression,
          baseName: settings.fileName,
          onProgress,
          signal: controller.signal,
        });
      } else if (tool.exportTarget === "split-pdf") {
        produced = await splitProject({
          pages: exportPages,
          files: fileMap,
          settings,
          groups: splitGroups,
          onProgress,
          signal: controller.signal,
        });
      } else {
        produced = [
          await generatePdf({
            pages: exportPages,
            files: fileMap,
            settings,
            onProgress,
            signal: controller.signal,
          }),
        ];
      }

      setOutputs(produced);
      setPhase("done");
      notify({
        tone: "success",
        title: produced.length > 1 ? `${produced.length} files ready` : "File ready",
        message: produced[0]?.name,
      });
    } catch (error) {
      if (controller.signal.aborted) {
        setPhase("ready");
        notify({ tone: "info", title: "Cancelled", message: "The export was stopped." });
      } else {
        notifyError(error, "Export failed");
        setPhase("ready");
      }
    } finally {
      abortRef.current = null;
      setProgress({ label: "", value: null });
    }
  }, [exportPages, fileMap, notify, notifyError, settings, splitGroups, tool.exportTarget]);

  const download = useCallback(
    (output: OutputFile) => {
      try {
        saveBlob(output.blob, output.name);
      } catch (error) {
        notifyError(error, "Download failed");
      }
    },
    [notifyError],
  );

  const startOver = useCallback(() => {
    dispatch({ type: "reset" });
    evictAll();
    closeAllPdfs();
    setOutputs([]);
    setPhase("idle");
    setActiveId(null);
    setView("grid");
  }, []);

  /* ---------------------------------------------------------------- *
   * Render
   * ---------------------------------------------------------------- */

  const showResult = phase === "done" && outputs.length > 0;
  const hasPages = pages.length > 0;

  const primaryAction = (
    <Button variant="primary" size="lg" onClick={runExport} disabled={!canExport} loading={phase === "working"} block>
      {tool.primaryLabel}
    </Button>
  );

  const settingsContent = (
    <div className="space-y-5">
      {tool.exportTarget === "split-pdf" ? (
        <SplitOptions config={splitConfig} onChange={(patch) => setSplitConfig((current) => ({ ...current, ...patch }))} pages={exportPages} />
      ) : null}
      <SettingsPanel
        tool={tool}
        settings={settings}
        onChange={(patch) => dispatch({ type: "set-settings", settings: patch })}
        pages={exportPages}
        files={fileMap}
        busy={phase === "working" || importing}
      />
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1400px] px-3 pb-28 pt-4 sm:px-5 sm:pb-8">
      {/* Tool header */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight text-ink sm:text-[22px]">{tool.title}</h1>
          <p className="mt-0.5 text-[13px] text-ink-500">{tool.description}</p>
        </div>
        <p className="inline-flex items-center gap-1.5 text-2xs text-ink-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          Processed locally in your browser
        </p>
      </div>

      {showResult ? (
        <ResultPanel
          outputs={outputs}
          onDownload={download}
          onDownloadAll={() => outputs.forEach(download)}
          onPreview={setPreviewOutput}
          onEditPages={() => {
            setPhase("ready");
            setOutputs([]);
          }}
          onStartOver={startOver}
        />
      ) : !hasPages ? (
        <div className="mx-auto max-w-3xl">
          {/* Recovery path: removing the last page would otherwise hide the
              toolbar that holds Undo. */}
          {state.past.length ? (
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded border border-line bg-surface px-3 py-2.5">
              <p className="text-[13px] text-ink-500">All pages were removed from this project.</p>
              <Button variant="secondary" size="sm" className="ml-auto" onClick={() => dispatch({ type: "undo" })}>
                <Undo2 className="h-3.5 w-3.5" />
                Undo
              </Button>
            </div>
          ) : null}
          <DropZone
            accept={tool.accept}
            hint={tool.uploadHint}
            onFiles={handleFiles}
            onOpenCamera={(mode) => setCamera({ open: true, mode })}
            busy={importing}
            allowCamera={allowCamera}
          />
          {importing ? (
            <div className="mt-4 rounded border border-line bg-surface p-4">
              <Progress value={progress.value} label={progress.label || "Reading files"} />
            </div>
          ) : null}
          <WorkflowHints allowCamera={allowCamera} />
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section className="min-w-0">
            {/* Toolbar */}
            <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-line bg-surface px-2 py-2">
              <ButtonGroup>
                <Button
                  size="sm"
                  onClick={() => setView("grid")}
                  className={cn(view === "grid" && "bg-[#EDEEF0]")}
                  title="Organize pages in a grid"
                >
                  <Grid2x2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Organize</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => setView("page")}
                  className={cn(view === "page" && "bg-[#EDEEF0]")}
                  title="Large single-page preview"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Preview</span>
                </Button>
              </ButtonGroup>

              <span className="hidden h-5 w-px bg-line sm:block" />

              <Button size="sm" variant="ghost" onClick={addPicker.open} title="Add pages from your device">
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Add pages</span>
              </Button>
              {addPicker.input}
              {allowCamera ? (
                <Button size="sm" variant="ghost" onClick={() => setCamera({ open: true, mode: "multi" })} title="Capture pages with the camera">
                  <Camera className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Camera</span>
                </Button>
              ) : null}

              <span className="hidden h-5 w-px bg-line sm:block" />

              <Button
                size="sm"
                variant="ghost"
                onClick={() => dispatch({ type: selection.length === pages.length ? "clear-selection" : "select-all" })}
                title="Select all pages"
              >
                {selection.length === pages.length && pages.length > 0 ? (
                  <CheckSquare className="h-3.5 w-3.5" />
                ) : (
                  <Square className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">{selection.length === pages.length ? "Deselect" : "Select all"}</span>
              </Button>
              <Button size="sm" variant="ghost" onClick={() => dispatch({ type: "sort-by-name" })} title="Sort pages by file name">
                <ArrowDownUp className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Sort by name</span>
              </Button>

              <div className="ml-auto flex items-center gap-1.5">
                <ButtonGroup>
                  <Button
                    size="sm"
                    iconOnly
                    onClick={() => dispatch({ type: "undo" })}
                    disabled={!state.past.length}
                    title="Undo (Ctrl+Z)"
                    aria-label="Undo"
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    iconOnly
                    onClick={() => dispatch({ type: "redo" })}
                    disabled={!state.future.length}
                    title="Redo (Ctrl+Shift+Z)"
                    aria-label="Redo"
                  >
                    <Redo2 className="h-3.5 w-3.5" />
                  </Button>
                </ButtonGroup>
                <Button
                  size="sm"
                  variant="ghost"
                  className="lg:hidden"
                  onClick={() => setMobileSettings(true)}
                  title="Output settings"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Selection bar */}
            {selection.length ? (
              <div className="mb-3 flex flex-wrap items-center gap-2 rounded border border-accent-line bg-accent-soft px-2.5 py-2">
                <span className="text-[13px] font-medium text-ink">{pluralize(selection.length, "page")} selected</span>
                <div className="ml-auto flex flex-wrap items-center gap-1.5">
                  <Button size="sm" variant="secondary" onClick={() => dispatch({ type: "rotate", ids: selection, delta: -90 })}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Left</span>
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => dispatch({ type: "rotate", ids: selection, delta: 90 })}>
                    <RotateCw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Right</span>
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => dispatch({ type: "duplicate", ids: selection })}>
                    <span>Duplicate</span>
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(selection[0])}>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Delete</span>
                  </Button>
                  <Button size="sm" variant="ghost" iconOnly onClick={() => dispatch({ type: "clear-selection" })} aria-label="Clear selection">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : null}

            {tool.slug === "extract-pages" && !selection.length ? (
              <p className="mb-3 rounded border border-line bg-subtle px-3 py-2 text-2xs text-ink-500">
                Select the pages you want to keep. With nothing selected, all {pages.length} pages are exported.
              </p>
            ) : null}

            {/* Main area */}
            {view === "grid" ? (
              <div className="rounded border border-line bg-surface p-2.5">
                <PageGrid
                  pages={pages}
                  files={files}
                  selection={selection}
                  activeId={activeId}
                  variant="grid"
                  onReorder={(from, to) => dispatch({ type: "reorder", from, to })}
                  onReorderMany={(ids, to) => dispatch({ type: "reorder-many", ids, to })}
                  onOpen={setEditorId}
                  onRotate={handleRotate}
                  onDelete={handleDelete}
                  onDuplicate={(id) => dispatch({ type: "duplicate", ids: targetIds(id) })}
                  onSelect={handleSelect}
                />
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-[150px_minmax(0,1fr)]">
                <div className="order-2 overflow-x-auto rounded border border-line bg-surface p-2 scrollbar-slim lg:order-1 lg:max-h-[70vh] lg:overflow-y-auto lg:overflow-x-hidden">
                  <PageGrid
                    pages={pages}
                    files={files}
                    selection={selection}
                    activeId={activeId}
                    variant="rail"
                    onReorder={(from, to) => dispatch({ type: "reorder", from, to })}
                    onReorderMany={(ids, to) => dispatch({ type: "reorder-many", ids, to })}
                    onOpen={setEditorId}
                    onRotate={handleRotate}
                    onDelete={handleDelete}
                    onDuplicate={(id) => dispatch({ type: "duplicate", ids: targetIds(id) })}
                    onSelect={handleSelect}
                  />
                </div>

                <div className="order-1 flex min-h-[46vh] flex-col rounded border border-line bg-surface lg:order-2">
                  <div className="flex items-center gap-2 border-b border-line px-2 py-1.5">
                    <ButtonGroup>
                      <Button
                        size="sm"
                        iconOnly
                        onClick={() => setActiveId(pages[Math.max(0, activeIndex - 1)]?.id ?? activeId)}
                        disabled={activeIndex <= 0}
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        iconOnly
                        onClick={() => setActiveId(pages[Math.min(pages.length - 1, activeIndex + 1)]?.id ?? activeId)}
                        disabled={activeIndex >= pages.length - 1}
                        aria-label="Next page"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </ButtonGroup>
                    <span className="font-mono text-2xs text-ink-400">
                      {activeIndex + 1} / {pages.length}
                    </span>
                    <span className="truncate text-2xs text-ink-500">{activePage?.label}</span>
                    <div className="ml-auto flex items-center gap-1.5">
                      {activePage ? (
                        <>
                          <Button size="sm" iconOnly onClick={() => handleRotate(activePage.id, -90)} aria-label="Rotate left">
                            <RotateCcw className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" iconOnly onClick={() => handleRotate(activePage.id, 90)} aria-label="Rotate right">
                            <RotateCw className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setEditorId(activePage.id)}>
                            Edit
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex min-h-0 flex-1 items-center justify-center bg-[#F0F1F3] p-3 sm:p-6">
                    {activePage ? (
                      <div className="flex max-h-[62vh] items-center justify-center bg-white shadow-raised">
                        <PageThumb page={activePage} file={files[activePage.fileId]} size={1300} eager className="max-h-[62vh]" />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            )}

            {/* Imported files */}
            {summaries.length ? (
              <div className="mt-4">
                <p className="mb-2 text-2xs font-semibold uppercase tracking-wide text-ink-400">
                  {pluralize(summaries.length, "file")} · {pluralize(pages.length, "page")}
                </p>
                <FileList summaries={summaries} onRemove={handleRemoveFile} />
              </div>
            ) : null}
          </section>

          {/* Desktop settings rail */}
          <aside className="hidden lg:block">
            <div className="sticky top-[72px] space-y-4">
              <div className="rounded border border-line bg-surface p-4">
                <p className="mb-4 text-2xs font-semibold uppercase tracking-wide text-ink-400">Output settings</p>
                {settingsContent}
              </div>
              <div className="rounded border border-line bg-surface p-4">
                {primaryAction}
                <p className="mt-2.5 text-center text-2xs text-ink-400">
                  {pluralize(exportPages.length, "page")} will be exported
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Mobile bottom action bar */}
      {hasPages && !showResult ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/97 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-bar backdrop-blur-[2px] lg:hidden">
          <div className="flex items-center gap-2">
            <Button size="lg" variant="secondary" onClick={addPicker.open} aria-label="Add pages">
              <Plus className="h-4 w-4" />
              Add
            </Button>
            {allowCamera ? (
              <Button size="lg" variant="secondary" iconOnly onClick={() => setCamera({ open: true, mode: "multi" })} aria-label="Open camera">
                <Camera className="h-4 w-4" />
              </Button>
            ) : null}
            <Button size="lg" variant="secondary" iconOnly onClick={() => setMobileSettings(true)} aria-label="Output settings">
              <PanelRightClose className="h-4 w-4" />
            </Button>
            <Button
              size="lg"
              variant="primary"
              onClick={runExport}
              disabled={!canExport}
              loading={phase === "working"}
              className="flex-1"
            >
              {tool.primaryLabel}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Progress overlay */}
      {phase === "working" ? (
        <div className="fixed inset-0 z-[45] flex items-center justify-center bg-[#16181D]/35 px-4">
          <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-5 shadow-pop">
            <p className="flex items-center gap-2 text-sm font-semibold text-ink">
              <Loader2 className="h-4 w-4 animate-spin" />
              {tool.exportTarget === "pdf" ? "Creating PDF" : "Exporting"}
            </p>
            <div className="mt-4">
              <Progress value={progress.value} label={progress.label} />
            </div>
            <Button
              variant="ghost"
              size="sm"
              block
              className="mt-4"
              onClick={() => abortRef.current?.abort()}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {/* Window drag overlay */}
      {windowDrag ? (
        <div className="pointer-events-none fixed inset-0 z-[48] flex items-center justify-center bg-[#16181D]/20 p-6">
          <div className="rounded-lg border-2 border-dashed border-ink bg-surface px-6 py-5 text-center shadow-pop">
            <p className="text-sm font-semibold text-ink">Drop files to add pages</p>
            <p className="mt-0.5 text-2xs text-ink-500">{tool.uploadHint}</p>
          </div>
        </div>
      ) : null}

      {/* Mobile settings sheet */}
      <Modal
        open={mobileSettings}
        onClose={() => setMobileSettings(false)}
        title="Output settings"
        description={tool.title}
        footer={
          <Button variant="primary" onClick={() => setMobileSettings(false)} block>
            Done
          </Button>
        }
      >
        {settingsContent}
      </Modal>

      {/* Camera */}
      <CameraCapture
        open={camera.open}
        mode={camera.mode}
        onClose={() => setCamera((current) => ({ ...current, open: false }))}
        onCapture={(captured) => {
          setCamera((current) => ({ ...current, open: false }));
          void handleFiles(captured);
        }}
        onFallbackPicker={() => {
          setCamera((current) => ({ ...current, open: false }));
          addPicker.open();
        }}
      />

      {/* Page editor */}
      <PageEditor
        open={!!editorPage}
        page={editorPage}
        file={editorPage ? files[editorPage.fileId] : undefined}
        index={editorIndex}
        total={pages.length}
        onClose={() => setEditorId(null)}
        onApply={(changes) => {
          if (!editorPage) return;
          dispatch({ type: "set-rotation", ids: [editorPage.id], rotation: changes.rotation });
          if (changes.quad) dispatch({ type: "set-quad", id: editorPage.id, quad: changes.quad });
          else dispatch({ type: "set-crop", id: editorPage.id, crop: changes.crop });
          dispatch({ type: "set-adjustments", ids: [editorPage.id], adjustments: changes.adjustments });
          setEditorId(null);
        }}
        onDelete={() => {
          if (!editorPage) return;
          const next = pages[editorIndex + 1]?.id ?? pages[editorIndex - 1]?.id ?? null;
          dispatch({ type: "remove-pages", ids: [editorPage.id] });
          setEditorId(next);
        }}
        onDuplicate={() => {
          if (!editorPage) return;
          dispatch({ type: "duplicate", ids: [editorPage.id] });
          notify({ tone: "success", title: "Page duplicated" });
        }}
        onReplace={handleReplace}
        onNavigate={(delta) => {
          const next = pages[editorIndex + delta];
          if (next) setEditorId(next.id);
        }}
      />

      {/* Generated PDF preview */}
      <PdfPreview
        open={!!previewOutput}
        blob={previewOutput?.blob ?? null}
        name={previewOutput?.name ?? ""}
        onClose={() => setPreviewOutput(null)}
        onDownload={() => previewOutput && download(previewOutput)}
      />
    </div>
  );
}

/** Short, factual guidance under the empty drop zone. */
function WorkflowHints({ allowCamera }: { allowCamera: boolean }) {
  const steps = [
    { title: "1. Add pages", body: allowCamera ? "Select files, drag them in, or photograph pages with your camera." : "Select PDF files or drag them in." },
    { title: "2. Arrange", body: "Drag thumbnails to reorder. Rotate, crop, duplicate or delete any page." },
    { title: "3. Export", body: "Choose page size and quality, then download. Files never leave your device." },
  ];

  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-3">
      {steps.map((step) => (
        <div key={step.title} className="rounded border border-line bg-surface p-3.5">
          <p className="text-[13px] font-semibold text-ink">{step.title}</p>
          <p className="mt-1 text-2xs leading-relaxed text-ink-500">{step.body}</p>
        </div>
      ))}
    </div>
  );
}
