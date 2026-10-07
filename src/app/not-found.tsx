import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-start px-4 py-20">
      <p className="font-mono text-2xs text-ink-400">404</p>
      <h1 className="mt-1 text-[20px] font-semibold tracking-tight text-ink">That page does not exist</h1>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
        The tool you were looking for may have been renamed. All available tools are listed on the PDF tools page.
      </p>
      <div className="mt-5 flex gap-2">
        <Link
          href="/"
          className="inline-flex h-9 items-center rounded border border-ink bg-ink px-3.5 text-sm font-medium text-white transition-colors hover:bg-ink-700"
        >
          Create PDF
        </Link>
        <Link
          href="/pdf-tools"
          className="inline-flex h-9 items-center rounded border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink transition-colors hover:bg-subtle"
        >
          All tools
        </Link>
      </div>
    </div>
  );
}
