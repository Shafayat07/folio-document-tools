import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { TOOLS } from "@/lib/tools/registry";

export function SiteFooter() {
  const imageTools = TOOLS.filter((tool) => tool.category === "image").slice(0, 5);
  const pdfTools = TOOLS.filter((tool) => tool.category === "pdf").slice(0, 6);

  return (
    <footer className="mt-auto border-t border-line bg-surface">
      <div className="mx-auto grid max-w-[1400px] gap-8 px-4 py-9 sm:px-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-[13px] font-semibold text-ink">Folio Document Tools</p>
          <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-ink-500">
            Convert, organise and export documents without uploading them anywhere.
          </p>
          <p className="mt-3 inline-flex items-center gap-1.5 rounded border border-line bg-subtle px-2 py-1 text-2xs text-ink-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            Files processed in your browser
          </p>
        </div>

        <nav aria-label="Image tools">
          <p className="text-2xs font-semibold uppercase tracking-wide text-ink-400">Image tools</p>
          <ul className="mt-3 space-y-1.5">
            {imageTools.map((tool) => (
              <li key={tool.slug}>
                <Link href={`/tools/${tool.slug}`} className="text-[13px] text-ink-500 hover:text-ink hover:underline">
                  {tool.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="PDF tools">
          <p className="text-2xs font-semibold uppercase tracking-wide text-ink-400">PDF tools</p>
          <ul className="mt-3 space-y-1.5">
            {pdfTools.map((tool) => (
              <li key={tool.slug}>
                <Link href={`/tools/${tool.slug}`} className="text-[13px] text-ink-500 hover:text-ink hover:underline">
                  {tool.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="More">
          <p className="text-2xs font-semibold uppercase tracking-wide text-ink-400">More</p>
          <ul className="mt-3 space-y-1.5">
            <li>
              <Link href="/pdf-tools" className="text-[13px] text-ink-500 hover:text-ink hover:underline">
                All PDF tools
              </Link>
            </li>
            <li>
              <Link href="/converters" className="text-[13px] text-ink-500 hover:text-ink hover:underline">
                Converters
              </Link>
            </li>
            <li>
              <Link href="/about" className="text-[13px] text-ink-500 hover:text-ink hover:underline">
                About &amp; privacy
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-line px-4 py-4 sm:px-5">
        <p className="mx-auto max-w-[1400px] text-2xs text-ink-400">
          Folio runs entirely in your browser. No account, no uploads, no file retention.
        </p>
      </div>
    </footer>
  );
}
