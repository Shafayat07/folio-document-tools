"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/core/utils";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  // One solid, high-contrast primary. No gradients.
  primary: "bg-ink text-white border border-ink hover:bg-ink-700 hover:border-ink-700 active:bg-ink disabled:bg-ink-300 disabled:border-ink-300",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-subtle active:bg-[#F1F2F4]",
  ghost: "bg-transparent text-ink-500 border border-transparent hover:bg-[#ECEEF0] hover:text-ink",
  danger: "bg-surface text-danger border border-[#F3C6C2] hover:bg-danger-soft",
  subtle: "bg-[#EDEEF0] text-ink border border-transparent hover:bg-[#E3E5E8]",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  lg: "h-11 px-5 text-[15px] gap-2",
};

const ICON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
  lg: "h-11 w-11",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  /** Square button with no padding, for toolbar icons. */
  iconOnly?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", loading = false, iconOnly = false, block = false, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap rounded font-medium no-tap-highlight",
        "transition-colors duration-120 disabled:cursor-not-allowed disabled:opacity-60",
        iconOnly ? ICON_SIZES[size] : SIZES[size],
        VARIANTS[variant],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
});

/** A toolbar group with hairline dividers between buttons. */
export function ButtonGroup({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "inline-flex items-center overflow-hidden rounded border border-line-strong bg-surface",
        "[&>button]:rounded-none [&>button]:border-0 [&>button+button]:border-l [&>button+button]:border-line",
        className,
      )}
    >
      {children}
    </div>
  );
}
