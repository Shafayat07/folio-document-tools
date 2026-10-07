/**
 * Split a project into several PDFs. Built on top of `generatePdf`, so every
 * page edit and output setting applies to each part.
 */
import { AppError } from "@/lib/core/errors";
import { sanitizeFileName } from "@/lib/core/utils";
import type { OutputFile, PdfSettings, ProjectPage, SourceFile } from "@/lib/core/types";
import { createZip, uniqueNames } from "@/lib/export/zip";
import { generatePdf } from "./generate";

export interface SplitGroup {
  label: string;
  /** Indices into the project's page list. */
  indices: number[];
}

export interface SplitOptions {
  pages: ProjectPage[];
  files: Map<string, SourceFile>;
  settings: PdfSettings;
  groups: SplitGroup[];
  zip?: boolean;
  onProgress?: (progress: { done: number; total: number; label: string }) => void;
  signal?: AbortSignal;
}

/** Every page becomes its own file. */
export function groupsForEachPage(pages: ProjectPage[]): SplitGroup[] {
  return pages.map((_, index) => ({ label: `page-${index + 1}`, indices: [index] }));
}

/** Fixed-size chunks, e.g. every 5 pages. */
export function groupsByChunk(pages: ProjectPage[], chunk: number): SplitGroup[] {
  const size = Math.max(1, Math.floor(chunk));
  const groups: SplitGroup[] = [];
  for (let start = 0; start < pages.length; start += size) {
    const indices = [];
    for (let i = start; i < Math.min(start + size, pages.length); i += 1) indices.push(i);
    groups.push({ label: `part-${groups.length + 1}`, indices });
  }
  return groups;
}

export async function splitProject(options: SplitOptions): Promise<OutputFile[]> {
  const { pages, files, settings, groups, zip = true, onProgress, signal } = options;

  const usable = groups.filter((group) => group.indices.length > 0);
  if (!usable.length) {
    throw new AppError(
      "empty-project",
      "Nothing to split",
      "Enter at least one valid page range.",
      "Ranges look like “1-3, 5, 8-10”.",
    );
  }

  const base = sanitizeFileName(settings.fileName, "document");
  const parts: OutputFile[] = [];

  for (let index = 0; index < usable.length; index += 1) {
    if (signal?.aborted) throw new AppError("generate-failed", "Cancelled", "Split was cancelled.");
    const group = usable[index];
    onProgress?.({ done: index, total: usable.length, label: `Building ${index + 1} of ${usable.length}` });

    const subset = group.indices.map((i) => pages[i]).filter(Boolean);
    if (!subset.length) continue;

    const output = await generatePdf({
      pages: subset,
      files,
      settings: { ...settings, fileName: `${base}-${group.label}` },
      signal,
    });
    parts.push(output);
  }

  if (!parts.length) {
    throw new AppError("generate-failed", "Split failed", "No parts could be created from those ranges.");
  }

  if (zip && parts.length > 1) {
    onProgress?.({ done: usable.length, total: usable.length, label: "Packaging files" });
    const names = uniqueNames(parts.map((p) => p.name));
    const archive = await createZip(parts.map((part, i) => ({ name: names[i], blob: part.blob })));
    return [
      {
        name: `${base}-split.zip`,
        blob: archive,
        countLabel: `${parts.length} ${parts.length === 1 ? "file" : "files"}`,
      },
    ];
  }

  return parts;
}
