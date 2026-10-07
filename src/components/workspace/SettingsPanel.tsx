"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { Field, Segmented, Select, TextInput } from "@/components/ui/Field";
import { formatBytes } from "@/lib/core/utils";
import { estimateOutputSize } from "@/lib/pdf/generate";
import type {
  CompressionId,
  FitId,
  MarginId,
  OrientationId,
  PageSizeId,
  PdfSettings,
  ProjectPage,
  QualityId,
  SourceFile,
} from "@/lib/core/types";
import type { ToolDefinition } from "@/lib/tools/registry";

const PAGE_SIZE_OPTIONS: Array<{ value: PageSizeId; label: string }> = [
  { value: "a4", label: "A4 — 210 × 297 mm" },
  { value: "a3", label: "A3 — 297 × 420 mm" },
  { value: "letter", label: "Letter — 8.5 × 11 in" },
  { value: "legal", label: "Legal — 8.5 × 14 in" },
  { value: "original", label: "Original image size" },
];

const QUALITY_OPTIONS: Array<{ value: QualityId; label: string }> = [
  { value: "standard", label: "Standard — smaller file" },
  { value: "high", label: "High — recommended" },
  { value: "maximum", label: "Maximum — largest file" },
];

const COMPRESSION_OPTIONS: Array<{ value: CompressionId; label: string }> = [
  { value: "none", label: "None" },
  { value: "balanced", label: "Balanced" },
  { value: "high", label: "High compression" },
];

export interface SettingsPanelProps {
  tool: ToolDefinition;
  settings: PdfSettings;
  onChange: (patch: Partial<PdfSettings>) => void;
  pages: ProjectPage[];
  files: Map<string, SourceFile>;
  /** Hide the estimate while a job is running. */
  busy?: boolean;
}

export function SettingsPanel({ tool, settings, onChange, pages, files, busy }: SettingsPanelProps) {
  const estimate = useEstimatedSize(settings, pages, files, !busy);
  const exportsImages = tool.exportTarget === "jpg" || tool.exportTarget === "png";

  return (
    <div className="space-y-5">
      <Field label="File name" hint={exportsImages ? "used for each image" : ".pdf"}>
        <TextInput
          value={settings.fileName}
          onChange={(event) => onChange({ fileName: event.target.value })}
          placeholder="document"
          maxLength={80}
          spellCheck={false}
        />
      </Field>

      {tool.showPageSetup ? (
        <>
          <Field label="Page size">
            <Select<PageSizeId>
              value={settings.pageSize}
              onValueChange={(pageSize) => onChange({ pageSize })}
              options={PAGE_SIZE_OPTIONS}
            />
          </Field>

          <Field label="Orientation">
            <Segmented<OrientationId>
              value={settings.orientation}
              onValueChange={(orientation) => onChange({ orientation })}
              options={[
                { value: "auto", label: "Auto", title: "Match each page" },
                { value: "portrait", label: "Portrait" },
                { value: "landscape", label: "Landscape" },
              ]}
              size="sm"
            />
          </Field>

          <Field label="Image fit" hint={settings.fit === "cover" ? "edges may be cropped" : undefined}>
            <Segmented<FitId>
              value={settings.fit}
              onValueChange={(fit) => onChange({ fit })}
              options={[
                { value: "contain", label: "Contain", title: "Fit the whole page inside the sheet" },
                { value: "cover", label: "Cover", title: "Fill the sheet, cropping the overflow" },
                { value: "fill", label: "Fill", title: "Stretch to the sheet (may distort)" },
              ]}
              size="sm"
            />
          </Field>

          <Field label="Margin">
            <Segmented<MarginId>
              value={settings.margin}
              onValueChange={(margin) => onChange({ margin })}
              options={[
                { value: "none", label: "None" },
                { value: "small", label: "S" },
                { value: "medium", label: "M" },
                { value: "large", label: "L" },
              ]}
              size="sm"
            />
          </Field>
        </>
      ) : null}

      <Field label="Image quality">
        <Select<QualityId> value={settings.quality} onValueChange={(quality) => onChange({ quality })} options={QUALITY_OPTIONS} />
      </Field>

      <Field label="Compression">
        <Select<CompressionId>
          value={settings.compression}
          onValueChange={(compression) => onChange({ compression })}
          options={COMPRESSION_OPTIONS}
        />
      </Field>

      <div className="rounded border border-line bg-subtle p-3">
        <p className="flex items-start gap-2 text-2xs leading-relaxed text-ink-500">
          <Info className="mt-px h-3.5 w-3.5 shrink-0 text-ink-400" />
          {estimate.state === "ready" && estimate.bytes !== null ? (
            <span>
              Estimated output <strong className="font-semibold text-ink">~{formatBytes(estimate.bytes)}</strong> for{" "}
              {pages.length} {pages.length === 1 ? "page" : "pages"}. The real size depends on page content.
            </span>
          ) : estimate.state === "working" ? (
            <span>Estimating output size…</span>
          ) : (
            <span>Pages are rendered on your device — nothing is uploaded.</span>
          )}
        </p>
      </div>
    </div>
  );
}

type EstimateState = { state: "idle" | "working" | "ready"; bytes: number | null };

/**
 * Samples a few pages at the current settings to estimate the output size.
 * Debounced, and cancelled whenever the settings change again.
 */
function useEstimatedSize(settings: PdfSettings, pages: ProjectPage[], files: Map<string, SourceFile>, enabled: boolean) {
  const [estimate, setEstimate] = useState<EstimateState>({ state: "idle", bytes: null });
  const controller = useRef<AbortController | null>(null);

  const key = `${pages.length}:${settings.pageSize}:${settings.orientation}:${settings.fit}:${settings.margin}:${settings.quality}:${settings.compression}`;

  useEffect(() => {
    controller.current?.abort();
    if (!enabled || !pages.length) {
      setEstimate({ state: "idle", bytes: null });
      return;
    }

    const next = new AbortController();
    controller.current = next;
    setEstimate({ state: "working", bytes: null });

    const timer = window.setTimeout(() => {
      estimateOutputSize({ pages, files, settings, signal: next.signal })
        .then((bytes) => {
          if (next.signal.aborted) return;
          setEstimate({ state: "ready", bytes });
        })
        .catch(() => {
          if (!next.signal.aborted) setEstimate({ state: "idle", bytes: null });
        });
    }, 600);

    return () => {
      window.clearTimeout(timer);
      next.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  return estimate;
}
