"use client";

import { useCallback, useId, useRef, useState } from "react";
import { Camera, FolderOpen, Layers, ScanLine, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ACCEPT_ALL, ACCEPT_IMAGES, ACCEPT_PDF } from "@/lib/files/formats";
import { cn } from "@/lib/core/utils";
import type { AcceptMode } from "@/lib/files/import";

function acceptAttribute(mode: AcceptMode): string {
  if (mode === "image") return ACCEPT_IMAGES;
  if (mode === "pdf") return ACCEPT_PDF;
  return ACCEPT_ALL;
}

export interface DropZoneProps {
  accept: AcceptMode;
  hint: string;
  onFiles: (files: File[]) => void;
  onOpenCamera: (mode: "single" | "multi") => void;
  busy?: boolean;
  /** Camera options are hidden for PDF-only tools. */
  allowCamera?: boolean;
}

export function DropZone({ accept, hint, onFiles, onOpenCamera, busy = false, allowCamera = true }: DropZoneProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      depth.current = 0;
      setDragging(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length) onFiles(files);
    },
    [onFiles],
  );

  return (
    <div
      onDragEnter={(event) => {
        event.preventDefault();
        depth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => {
        event.preventDefault();
        depth.current -= 1;
        if (depth.current <= 0) {
          depth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={handleDrop}
      className={cn(
        "rounded-lg border-2 border-dashed bg-surface transition-colors duration-120",
        dragging ? "border-ink bg-[#F3F4F6]" : "border-line-strong",
      )}
    >
      <div className="flex flex-col items-center px-4 py-10 text-center sm:px-8 sm:py-14">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg border border-line bg-subtle">
          <Upload className="h-5 w-5 text-ink-500" strokeWidth={1.6} />
        </div>

        <p className="text-[15px] font-semibold text-ink">{dragging ? "Drop to add pages" : "Drop files here"}</p>
        <p className="mt-1 max-w-sm text-[13px] text-ink-500">{hint}</p>

        <div className="mt-5 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            variant="primary"
            size="lg"
            onClick={() => inputRef.current?.click()}
            loading={busy}
            className="sm:min-w-[160px]"
          >
            {!busy ? <FolderOpen className="h-4 w-4" /> : null}
            Select files
          </Button>
          {allowCamera ? (
            <Button variant="secondary" size="lg" onClick={() => onOpenCamera("multi")} className="sm:min-w-[160px]">
              <Camera className="h-4 w-4" />
              Use camera
            </Button>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[13px]">
          <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1.5 text-ink-500 hover:text-ink hover:underline">
            <FolderOpen className="h-3.5 w-3.5" />
            Choose from device
          </button>
          {allowCamera ? (
            <>
              <button type="button" onClick={() => onOpenCamera("single")} className="inline-flex items-center gap-1.5 text-ink-500 hover:text-ink hover:underline">
                <Camera className="h-3.5 w-3.5" />
                Take photo
              </button>
              <button type="button" onClick={() => onOpenCamera("multi")} className="inline-flex items-center gap-1.5 text-ink-500 hover:text-ink hover:underline">
                <Layers className="h-3.5 w-3.5" />
                Take multiple photos
              </button>
              <button type="button" onClick={() => captureRef.current?.click()} className="inline-flex items-center gap-1.5 text-ink-500 hover:text-ink hover:underline">
                <ScanLine className="h-3.5 w-3.5" />
                Import from camera app
              </button>
            </>
          ) : null}
          <span className="text-ink-300">or drag &amp; drop</span>
        </div>
      </div>

      <input
        id={inputId}
        ref={inputRef}
        type="file"
        multiple
        accept={acceptAttribute(accept)}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length) onFiles(files);
          event.target.value = "";
        }}
      />
      {allowCamera ? (
        <input
          ref={captureRef}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length) onFiles(files);
            event.target.value = "";
          }}
        />
      ) : null}
    </div>
  );
}

/** Hidden file input you can trigger from anywhere (toolbars, "Add pages"). */
export function useFileTrigger(accept: AcceptMode, onFiles: (files: File[]) => void, multiple = true) {
  const ref = useRef<HTMLInputElement>(null);

  const input = (
    <input
      ref={ref}
      type="file"
      multiple={multiple}
      accept={acceptAttribute(accept)}
      onChange={(event) => {
        const files = Array.from(event.target.files ?? []);
        if (files.length) onFiles(files);
        event.target.value = "";
      }}
    />
  );

  return { open: () => ref.current?.click(), input };
}
