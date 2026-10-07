import type { Metadata } from "next";
import { Info } from "lucide-react";
import { ToolGrid } from "@/components/layout/ToolCard";
import { PLANNED_TOOLS, TOOLS } from "@/lib/tools/registry";

export const metadata: Metadata = {
  title: "Converters",
  description: "Supported conversions, the formats Folio reads, and what is not available yet.",
};

const READ_FORMATS = [
  { group: "Images", items: ["JPG / JPEG", "PNG", "WEBP", "GIF", "BMP", "TIFF", "HEIC / HEIF", "AVIF"] },
  { group: "Documents", items: ["PDF"] },
];

const WRITE_FORMATS = [
  { group: "Documents", items: ["PDF"] },
  { group: "Images", items: ["JPG", "PNG"] },
  { group: "Archives", items: ["ZIP (multi-file exports)"] },
];

export default function ConvertersPage() {
  const converters = TOOLS.filter((tool) => tool.slug !== "create-pdf");

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 px-3 py-6 sm:px-5 sm:py-8">
      <header className="border-b border-line pb-4">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Converters</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-500">
          All conversions run locally using the browser&apos;s own image decoders plus pdf.js and pdf-lib. HEIC and TIFF
          fall back to a bundled decoder when the browser cannot read them natively.
        </p>
      </header>

      <ToolGrid tools={converters} title="Available now" />

      <section className="grid gap-4 sm:grid-cols-2">
        <FormatList title="Formats read" groups={READ_FORMATS} />
        <FormatList title="Formats written" groups={WRITE_FORMATS} />
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-ink">Not available yet</h2>
        <p className="mt-0.5 text-[13px] text-ink-500">
          These are listed for transparency rather than shipped as buttons that do nothing.
        </p>
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded border border-line bg-surface">
          {PLANNED_TOOLS.map((tool) => (
            <li key={tool.title} className="flex items-start gap-3 px-3.5 py-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
              <div>
                <p className="text-[13px] font-medium text-ink">
                  {tool.title}
                  <span className="ml-2 rounded border border-line bg-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                    Not implemented
                  </span>
                </p>
                <p className="mt-0.5 text-2xs leading-relaxed text-ink-500">{tool.blurb}</p>
                <p className="mt-1 text-2xs leading-relaxed text-ink-400">{tool.reason}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function FormatList({ title, groups }: { title: string; groups: Array<{ group: string; items: string[] }> }) {
  return (
    <div className="rounded border border-line bg-surface p-4">
      <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
      <div className="mt-3 space-y-3">
        {groups.map((group) => (
          <div key={group.group}>
            <p className="text-2xs font-semibold uppercase tracking-wide text-ink-400">{group.group}</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {group.items.map((item) => (
                <li key={item} className="rounded border border-line bg-subtle px-2 py-0.5 text-2xs text-ink-500">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
