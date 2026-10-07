import { cn } from "@/lib/core/utils";

/**
 * Wordmark. The mark is a folded sheet — drawn inline so there is no image
 * request and no decorative illustration dependency.
 */
export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <svg viewBox="0 0 24 24" className="h-[22px] w-[22px] shrink-0" aria-hidden>
        <path d="M4 2.5h10.5L20 8v13.5H4z" fill="#C2342A" />
        <path d="M14.5 2.5 20 8h-5.5z" fill="#8E211A" />
        <rect x="7" y="11" width="10" height="1.6" fill="#fff" opacity="0.92" />
        <rect x="7" y="14.4" width="10" height="1.6" fill="#fff" opacity="0.92" />
        <rect x="7" y="17.8" width="6.4" height="1.6" fill="#fff" opacity="0.92" />
      </svg>
      {showWordmark ? (
        <span className="text-[15px] font-semibold tracking-tight text-ink">
          Folio
          <span className="ml-1 hidden font-normal text-ink-400 sm:inline">Document Tools</span>
        </span>
      ) : null}
    </span>
  );
}
