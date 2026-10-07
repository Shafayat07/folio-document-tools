"use client";

import { cn } from "@/lib/core/utils";

export function Progress({
  value,
  label,
  className,
}: {
  /** 0..1, or null for indeterminate. */
  value: number | null;
  label?: string;
  className?: string;
}) {
  const percent = value === null ? null : Math.round(Math.min(1, Math.max(0, value)) * 100);

  return (
    <div className={cn("w-full", className)}>
      {label || percent !== null ? (
        <div className="mb-1.5 flex items-center justify-between gap-3 text-[13px]">
          <span className="truncate text-ink-500">{label}</span>
          {percent !== null ? <span className="shrink-0 font-mono text-2xs text-ink-400">{percent}%</span> : null}
        </div>
      ) : null}
      <div
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-[#E3E5E8]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent ?? undefined}
        aria-label={label ?? "Progress"}
      >
        {percent === null ? (
          <div className="absolute inset-y-0 w-1/4 rounded-full bg-ink animate-indeterminate" />
        ) : (
          <div
            className="h-full rounded-full bg-ink transition-[width] duration-200 ease-out"
            style={{ width: `${percent}%` }}
          />
        )}
      </div>
    </div>
  );
}
