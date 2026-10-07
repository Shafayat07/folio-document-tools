import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ToolGrid } from "@/components/layout/ToolCard";
import { toolsByCategory } from "@/lib/tools/registry";

export const metadata: Metadata = {
  title: "PDF tools",
  description: "Convert PDF pages to images, merge, split, organise, rotate, delete and extract pages — all in your browser.",
};

export default function PdfToolsPage() {
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-8 px-3 py-6 sm:px-5 sm:py-8">
      <header className="border-b border-line pb-4">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">PDF tools</h1>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-500">
          Every tool opens the same workspace: import files, arrange the pages visually, then export. Pages from PDFs are
          copied without re-compression wherever no edits are applied, so text stays selectable.
        </p>
      </header>

      <ToolGrid tools={toolsByCategory("pdf")} />
      <ToolGrid tools={toolsByCategory("image")} title="Image tools" />

      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink hover:underline"
      >
        Start with Create PDF
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
