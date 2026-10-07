"use client";

import { CheckCircle2, Download, Eye, FileText, PenLine, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatBytes, pluralize } from "@/lib/core/utils";
import type { OutputFile } from "@/lib/core/types";

export interface ResultPanelProps {
  outputs: OutputFile[];
  onDownload: (output: OutputFile) => void;
  onDownloadAll: () => void;
  onPreview: (output: OutputFile) => void;
  onEditPages: () => void;
  onStartOver: () => void;
}

export function ResultPanel({ outputs, onDownload, onDownloadAll, onPreview, onEditPages, onStartOver }: ResultPanelProps) {
  const primary = outputs[0];
  const multiple = outputs.length > 1;
  const totalBytes = outputs.reduce((sum, output) => sum + output.blob.size, 0);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-lg border border-line bg-surface p-5 shadow-card sm:p-7">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#CBE9D8] bg-success-soft">
            <CheckCircle2 className="h-5 w-5 text-success" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-ink">
              {multiple ? `${outputs.length} files created` : "File created successfully"}
            </h2>
            <p className="mt-0.5 text-[13px] text-ink-500">
              Ready to download. Nothing was uploaded — the file was built on your device.
            </p>
          </div>
        </div>

        <ul className="mt-5 divide-y divide-line overflow-hidden rounded border border-line">
          {outputs.map((output) => (
            <li key={output.name} className="flex items-center gap-3 bg-subtle px-3 py-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-line bg-surface">
                <FileText className="h-4 w-4 text-ink-500" strokeWidth={1.6} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-ink" title={output.name}>
                  {output.name}
                </p>
                <p className="mt-0.5 text-2xs text-ink-400">
                  {output.countLabel
                    ? `${output.countLabel} · `
                    : output.pageCount
                      ? `${pluralize(output.pageCount, "page")} · `
                      : ""}
                  {formatBytes(output.blob.size)}
                </p>
              </div>
              {output.blob.type === "application/pdf" ? (
                <Button variant="ghost" size="sm" onClick={() => onPreview(output)} title="Preview">
                  <Eye className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Preview</span>
                </Button>
              ) : null}
              <Button variant="secondary" size="sm" onClick={() => onDownload(output)}>
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button variant="primary" size="lg" onClick={onDownloadAll} className="sm:flex-1">
            <Download className="h-4 w-4" />
            {multiple ? `Download all (${formatBytes(totalBytes)})` : `Download ${primary ? formatBytes(primary.blob.size) : ""}`}
          </Button>
          <Button variant="secondary" size="lg" onClick={onEditPages}>
            <PenLine className="h-4 w-4" />
            Edit pages
          </Button>
          <Button variant="ghost" size="lg" onClick={onStartOver}>
            <Plus className="h-4 w-4" />
            Create another
          </Button>
        </div>
      </div>
    </div>
  );
}
