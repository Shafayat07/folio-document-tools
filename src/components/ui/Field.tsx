"use client";

import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/core/utils";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        {hint ? <span className="text-2xs text-ink-400">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

export interface SelectProps<T extends string> extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value"> {
  value: T;
  onValueChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}

export function Select<T extends string>({ value, onValueChange, options, className, ...rest }: SelectProps<T>) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(event) => onValueChange(event.target.value as T)}
        className={cn(
          "h-9 w-full appearance-none rounded border border-line-strong bg-surface pl-2.5 pr-8 text-sm text-ink",
          "transition-colors hover:border-ink-300 focus:border-ink",
          className,
        )}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-400" />
    </div>
  );
}

export interface SegmentedProps<T extends string> {
  value: T;
  onValueChange: (value: T) => void;
  options: Array<{ value: T; label: string; title?: string }>;
  size?: "sm" | "md";
  className?: string;
}

export function Segmented<T extends string>({ value, onValueChange, options, size = "md", className }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      className={cn("inline-flex w-full rounded border border-line-strong bg-[#EDEEF0] p-0.5", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={option.title}
            onClick={() => onValueChange(option.value)}
            className={cn(
              "flex-1 rounded-[3px] font-medium transition-colors duration-120",
              size === "sm" ? "h-7 px-2 text-[12px]" : "h-8 px-2.5 text-[13px]",
              active ? "bg-surface text-ink shadow-card" : "text-ink-500 hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onValueChange,
  onReset,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onValueChange: (value: number) => void;
  onReset?: () => void;
  format?: (value: number) => string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        <span className="flex items-center gap-2">
          <span className="font-mono text-2xs text-ink-500">{format ? format(value) : value}</span>
          {onReset && value !== 0 ? (
            <button type="button" onClick={onReset} className="text-2xs text-ink-400 underline hover:text-ink">
              reset
            </button>
          ) : null}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onValueChange(Number(event.target.value))}
        className="h-5 w-full cursor-pointer accent-ink"
        aria-label={label}
      />
    </div>
  );
}

export function Checkbox({
  label,
  checked,
  onCheckedChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded-[3px] border-line-strong text-ink accent-ink"
      />
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-ink">{label}</span>
        {hint ? <span className="block text-2xs text-ink-400">{hint}</span> : null}
      </span>
    </label>
  );
}

export function TextInput({ className, ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...rest}
      className={cn(
        "h-9 w-full rounded border border-line-strong bg-surface px-2.5 text-sm text-ink placeholder:text-ink-300",
        "transition-colors hover:border-ink-300 focus:border-ink",
        className,
      )}
    />
  );
}
