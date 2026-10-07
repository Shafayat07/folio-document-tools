"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/core/utils";
import type { ProjectPage, SourceFile } from "@/lib/core/types";
import { usePageRender, useInView } from "./usePageRender";

/**
 * Lazily rendered page image. Thumbnails outside the viewport are never
 * rendered, which keeps a 50-page project responsive.
 */
export function PageThumb({
  page,
  file,
  size = 360,
  className,
  eager = false,
}: {
  page: ProjectPage;
  file: SourceFile | undefined;
  size?: number;
  className?: string;
  eager?: boolean;
}) {
  const { ref, inView } = useInView<HTMLDivElement>();
  const { url, error, loading } = usePageRender(page, file, size, eager || inView);

  return (
    <div ref={ref} className={cn("relative flex h-full w-full items-center justify-center overflow-hidden", className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={page.label}
          draggable={false}
          className="max-h-full max-w-full object-contain"
          style={{ opacity: loading ? 0.6 : 1, transition: "opacity 120ms ease-out" }}
        />
      ) : error ? (
        <div className="flex flex-col items-center gap-1 p-3 text-center">
          <AlertTriangle className="h-4 w-4 text-danger" />
          <span className="text-2xs leading-tight text-ink-500">Preview unavailable</span>
        </div>
      ) : (
        <div className="h-full w-full animate-pulse bg-[#EEF0F2]" />
      )}
    </div>
  );
}
