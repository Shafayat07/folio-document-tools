import type { Metadata } from "next";
import { ArrowRight, Info, Lightbulb } from "lucide-react";
import { ToolGrid } from "@/components/layout/ToolCard";
import { OFFICE_WORKAROUND, PLANNED_TOOLS, toolsByCategory } from "@/lib/tools/registry";

export const metadata: Metadata = {
  title: "Converters",
  description:
    "Convert images between PNG, JPG and WEBP, turn HEIC photos into JPG, and convert PDFs to images — all in your browser.",
};

const READ_FORMATS = [
  { group: "Images", items: ["JPG / JPEG", "PNG", "WEBP", "GIF", "BMP", "TIFF", "HEIC / HEIF", "AVIF"] },
  { group: "Documents", items: ["PDF"] },
];

const WRITE_FORMATS = [
  { group: "Images", items: ["PNG", "JPG", "WEBP"] },
  { group: "Documents", items: ["PDF"] },
  { group: "Archives", items: ["ZIP (multi-file exports)"] },
];

/** The conversions people ask for most, mapped to the tool that does them. */
const POPULAR = [
  { from: "HEIC", to: "JPG", slug: "heic-to-jpg", note: "iPhone photos" },
  { from: "JPG", to: "PNG", slug: "jpg-to-png", note: "lossless" },
  { from: "PNG", to: "JPG", slug: "png-to-jpg", note: "smaller files" },
  { from: "WEBP", to: "JPG", slug: "webp-to-jpg", note: "wider support" },
  { from: "JPG", to: "WEBP", slug: "image-to-webp", note: "smallest" },
  { from: "PDF", to: "JPG", slug: "pdf-to-jpg", note: "page per image" },
  { from: "PDF", to: "PNG", slug: "pdf-to-png", note: "lossless pages" },
  { from: "Images", to: "PDF", slug: "image-to-pdf", note: "one document" },
];

export default function ConvertersPage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 px-3 py-6 sm:px-5 sm:py-8">
      <header className="border-b border-line pb-4">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">Converters</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-500">
          All conversions run locally using the browser&apos;s own image decoders plus pdf.js and pdf-lib. HEIC and TIFF
          fall back to a bundled decoder when the browser cannot read them natively.
        </p>
      </header>

      {/* Quick launcher for the most-requested conversions. */}
      <section>
        <h2 className="text-[15px] font-semibold text-ink">Popular conversions</h2>
        <p className="mt-0.5 text-[13px] text-ink-500">One click to the right tool.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {POPULAR.map((item) => (
            <a
              key={`${item.from}-${item.to}`}
              href={`/tools/${item.slug}`}
              className="group flex items-center gap-2 rounded border border-line bg-surface px-3 py-2.5 transition-colors hover:border-ink-300 hover:bg-subtle"
            >
              <span className="font-mono text-[13px] font-semibold text-ink">{item.from}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-300 transition-colors group-hover:text-ink-500" />
              <span className="font-mono text-[13px] font-semibold text-ink">{item.to}</span>
              <span className="ml-auto truncate text-2xs text-ink-400">{item.note}</span>
            </a>
          ))}
        </div>
      </section>

      <ToolGrid
        tools={toolsByCategory("convert")}
        title="Image format tools"
        description="Convert and resize images. Files keep their own names; batches download as a .zip."
      />
      <ToolGrid tools={toolsByCategory("pdf")} title="PDF tools" />
      <ToolGrid tools={toolsByCategory("image")} title="Image to PDF" />

      <section className="grid gap-4 sm:grid-cols-2">
        <FormatList title="Formats read" groups={READ_FORMATS} />
        <FormatList title="Formats written" groups={WRITE_FORMATS} />
      </section>

      <section>
        <h2 className="text-[15px] font-semibold text-ink">Office documents are not supported</h2>
        <p className="mt-0.5 max-w-2xl text-[13px] leading-relaxed text-ink-500">
          Listed here rather than shipped as buttons that quietly produce broken output.
        </p>

        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          <ul className="divide-y divide-line overflow-hidden rounded border border-line bg-surface">
            {PLANNED_TOOLS.map((tool) => (
              <li key={tool.title} className="flex items-start gap-3 px-3.5 py-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                <div>
                  <p className="text-[13px] font-medium text-ink">
                    {tool.title}
                    <span className="ml-2 rounded border border-line bg-subtle px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                      Unavailable
                    </span>
                  </p>
                  <p className="mt-0.5 text-2xs leading-relaxed text-ink-500">{tool.blurb}</p>
                  <p className="mt-1 text-2xs leading-relaxed text-ink-400">{tool.reason}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="rounded border border-line bg-subtle p-4">
            <h3 className="flex items-center gap-2 text-[13px] font-semibold text-ink">
              <Lightbulb className="h-4 w-4 text-ink-400" strokeWidth={1.6} />
              {OFFICE_WORKAROUND.title}
            </h3>
            <ol className="mt-2.5 space-y-2">
              {OFFICE_WORKAROUND.steps.map((step, index) => (
                <li key={step} className="flex gap-2.5 text-2xs leading-relaxed text-ink-500">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface font-mono text-[10px] text-ink-500">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
        </div>
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
