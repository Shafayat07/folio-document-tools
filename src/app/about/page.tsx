import type { Metadata } from "next";
import Link from "next/link";
import { Cpu, FileCheck2, Gauge, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "About & privacy",
  description: "How Folio processes your files, what runs where, and the limits of in-browser document processing.",
};

const POINTS = [
  {
    icon: ShieldCheck,
    title: "Your files stay on your device",
    body: "There is no upload step and no server-side processing. Images are decoded, pages are rendered and PDFs are written entirely inside this browser tab. Closing the tab discards everything.",
  },
  {
    icon: FileCheck2,
    title: "PDF pages are preserved, not re-photographed",
    body: "When you reorder, rotate or merge PDF pages without editing their pixels, the original page is copied into the new document. Text stays selectable and vector graphics stay sharp. Pages are only rasterised when you crop, straighten or apply a readability mode.",
  },
  {
    icon: Gauge,
    title: "Built for large batches",
    body: "Thumbnails render lazily and at a reduced resolution, each source is decoded once and cached, and full-resolution work happens only during export. Filters and perspective correction run in a Web Worker so the interface stays responsive.",
  },
  {
    icon: Cpu,
    title: "Honest about limits",
    body: "Edge detection for scanned pages is a conventional gradient analysis, not a learned model — when it is not confident it says so and hands you a manual crop tool. Office-document conversion is not available because it cannot be done reliably in a browser.",
  },
];

const STACK = [
  { name: "pdf-lib", role: "Writing and manipulating PDF files" },
  { name: "pdf.js", role: "Rendering PDF pages to canvas" },
  { name: "dnd-kit", role: "Pointer, touch and keyboard drag-and-drop" },
  { name: "Canvas 2D + Web Workers", role: "Image decoding, filters, perspective correction" },
  { name: "heic2any / UTIF", role: "HEIC and TIFF fallback decoding" },
];

export default function AboutPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-3 py-6 sm:px-5 sm:py-10">
      <header className="border-b border-line pb-4">
        <h1 className="text-[22px] font-semibold tracking-tight text-ink">About Folio</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
          A practical document utility for turning photos and files into organised PDFs — and for cleaning up PDFs you
          already have.
        </p>
      </header>

      <div className="mt-6 space-y-4">
        {POINTS.map((point) => (
          <section key={point.title} className="flex items-start gap-3.5 rounded border border-line bg-surface p-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-line bg-subtle">
              <point.icon className="h-4 w-4 text-ink-500" strokeWidth={1.6} />
            </span>
            <div>
              <h2 className="text-[14px] font-semibold text-ink">{point.title}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-ink-500">{point.body}</p>
            </div>
          </section>
        ))}
      </div>

      <section className="mt-8">
        <h2 className="text-[15px] font-semibold text-ink">What it is built on</h2>
        <ul className="mt-3 divide-y divide-line overflow-hidden rounded border border-line bg-surface">
          {STACK.map((item) => (
            <li key={item.name} className="flex flex-wrap items-baseline gap-x-3 px-3.5 py-2.5">
              <span className="text-[13px] font-medium text-ink">{item.name}</span>
              <span className="text-2xs text-ink-500">{item.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded border border-line bg-subtle p-4">
        <h2 className="text-[14px] font-semibold text-ink">Camera access</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-500">
          The camera is requested through the browser&apos;s standard permission prompt and the video stream is never
          recorded or transmitted — individual frames are captured to a canvas when you press the shutter. Camera access
          requires HTTPS, or localhost during development. If permission is denied, every feature remains usable by
          adding files from your device.
        </p>
      </section>

      <div className="mt-8">
        <Link
          href="/"
          className="inline-flex h-10 items-center rounded border border-ink bg-ink px-4 text-sm font-medium text-white transition-colors hover:bg-ink-700"
        >
          Create a PDF
        </Link>
      </div>
    </div>
  );
}
