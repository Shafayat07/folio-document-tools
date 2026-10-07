"use client";

import { FileText, Image as ImageIcon, X } from "lucide-react";
import { formatBytes, pluralize } from "@/lib/core/utils";
import type { FileSummary } from "@/lib/store/project-reducer";

export function FileList({ summaries, onRemove }: { summaries: FileSummary[]; onRemove: (fileId: string) => void }) {
  if (!summaries.length) return null;

  return (
    <ul className="divide-y divide-line overflow-hidden rounded border border-line bg-surface">
      {summaries.map(({ file, pageCount }) => (
        <li key={file.id} className="flex items-center gap-3 px-3 py-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-line bg-subtle">
            {file.kind === "pdf" ? (
              <FileText className="h-4 w-4 text-ink-500" strokeWidth={1.6} />
            ) : (
              <ImageIcon className="h-4 w-4 text-ink-500" strokeWidth={1.6} />
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-ink" title={file.name}>
              {file.name}
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-2xs text-ink-400">
              <span className="uppercase">{file.ext || file.kind}</span>
              <span aria-hidden>·</span>
              <span>{formatBytes(file.size)}</span>
              <span aria-hidden>·</span>
              <span>{pluralize(pageCount, "page")}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => onRemove(file.id)}
            className="shrink-0 rounded px-2 py-1 text-2xs font-medium text-ink-500 transition-colors hover:bg-danger-soft hover:text-danger"
            aria-label={`Remove ${file.name}`}
          >
            <span className="hidden sm:inline">Remove</span>
            <X className="h-3.5 w-3.5 sm:hidden" />
          </button>
        </li>
      ))}
    </ul>
  );
}
