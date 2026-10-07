"use client";

import { Field, Segmented, TextInput } from "@/components/ui/Field";
import { parsePageRanges, pluralize } from "@/lib/core/utils";
import { groupsByChunk, groupsForEachPage, type SplitGroup } from "@/lib/pdf/split";
import type { ProjectPage } from "@/lib/core/types";

export type SplitMode = "each" | "chunk" | "ranges";

export interface SplitConfig {
  mode: SplitMode;
  chunk: number;
  ranges: string;
}

export const DEFAULT_SPLIT_CONFIG: SplitConfig = { mode: "each", chunk: 5, ranges: "" };

/** Turn the UI config into concrete page groups. */
export function splitGroupsFor(config: SplitConfig, pages: ProjectPage[]): SplitGroup[] {
  if (config.mode === "each") return groupsForEachPage(pages);
  if (config.mode === "chunk") return groupsByChunk(pages, config.chunk);

  // Each comma-separated segment becomes its own file.
  return config.ranges
    .split(",")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment, index) => ({
      label: `part-${index + 1}`,
      indices: parsePageRanges(segment, pages.length),
    }))
    .filter((group) => group.indices.length > 0);
}

export function SplitOptions({
  config,
  onChange,
  pages,
}: {
  config: SplitConfig;
  onChange: (patch: Partial<SplitConfig>) => void;
  pages: ProjectPage[];
}) {
  const groups = splitGroupsFor(config, pages);
  const invalidRanges = config.mode === "ranges" && config.ranges.trim().length > 0 && groups.length === 0;

  return (
    <div className="space-y-4">
      <Field label="Split by">
        <Segmented<SplitMode>
          value={config.mode}
          onValueChange={(mode) => onChange({ mode })}
          options={[
            { value: "each", label: "Each page" },
            { value: "chunk", label: "Every N" },
            { value: "ranges", label: "Ranges" },
          ]}
          size="sm"
        />
      </Field>

      {config.mode === "chunk" ? (
        <Field label="Pages per file">
          <TextInput
            type="number"
            min={1}
            max={Math.max(1, pages.length)}
            value={config.chunk}
            onChange={(event) => onChange({ chunk: Math.max(1, Number(event.target.value) || 1) })}
          />
        </Field>
      ) : null}

      {config.mode === "ranges" ? (
        <Field label="Page ranges" hint="one file per group">
          <TextInput
            value={config.ranges}
            onChange={(event) => onChange({ ranges: event.target.value })}
            placeholder="1-3, 4-6, 7"
            spellCheck={false}
          />
        </Field>
      ) : null}

      <p className={`text-2xs leading-relaxed ${invalidRanges ? "text-danger" : "text-ink-500"}`}>
        {invalidRanges
          ? "Those ranges do not match any pages. Use a format like “1-3, 5, 8-10”."
          : groups.length
            ? `Will produce ${pluralize(groups.length, "file")}${groups.length > 1 ? ", bundled in a .zip" : ""}.`
            : "Enter at least one page range."}
      </p>
    </div>
  );
}
