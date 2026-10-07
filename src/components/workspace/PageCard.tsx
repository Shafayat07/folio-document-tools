"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, Maximize2, RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/core/utils";
import type { ProjectPage, SourceFile } from "@/lib/core/types";
import { PageThumb } from "./PageThumb";

export type CardVariant = "grid" | "rail";

export interface PageCardActions {
  onOpen: (id: string) => void;
  onRotate: (id: string, delta: 90 | -90) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onSelect: (id: string, event: React.MouseEvent) => void;
}

interface PageCardProps extends PageCardActions {
  page: ProjectPage;
  file: SourceFile | undefined;
  index: number;
  total: number;
  selected: boolean;
  active: boolean;
  variant: CardVariant;
}

/** The visual body of a page card, shared by the sortable item and the drag overlay. */
function CardBody({
  page,
  file,
  index,
  selected,
  active,
  variant,
  dragging,
  children,
}: {
  page: ProjectPage;
  file: SourceFile | undefined;
  index: number;
  selected: boolean;
  active: boolean;
  variant: CardVariant;
  dragging?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded border bg-surface transition-colors duration-120",
        selected ? "border-accent ring-1 ring-accent" : active ? "border-ink-300" : "border-line",
        !selected && !active && "hover:border-ink-300",
        dragging && "shadow-pop",
      )}
    >
      <div
        className={cn(
          "relative flex items-center justify-center bg-[#F7F8F9]",
          variant === "grid" ? "aspect-[3/4]" : "aspect-[3/4]",
        )}
      >
        <PageThumb page={page} file={file} size={variant === "grid" ? 380 : 220} className="p-1.5" />

        {page.rotation !== 0 ? (
          <span className="absolute right-1 top-1 rounded bg-ink/80 px-1 py-0.5 text-[10px] font-medium text-white">
            {page.rotation}°
          </span>
        ) : null}
        {page.crop || page.quad ? (
          <span className="absolute left-1 top-1 rounded bg-ink/80 px-1 py-0.5 text-[10px] font-medium text-white">
            Cropped
          </span>
        ) : null}
        {children}
      </div>

      <div className="flex items-center gap-1.5 border-t border-line px-2 py-1.5">
        <span className="shrink-0 font-mono text-2xs text-ink-400">{index + 1}</span>
        <span className="truncate text-2xs text-ink-500" title={page.label}>
          {page.label}
        </span>
      </div>
    </div>
  );
}

export function PageCard({
  page,
  file,
  index,
  total,
  selected,
  active,
  variant,
  onOpen,
  onRotate,
  onDelete,
  onDuplicate,
  onSelect,
}: PageCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  const stop = (event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative touch-none-safe"
      aria-label={`Page ${index + 1} of ${total}`}
      {...attributes}
      {...listeners}
      onClick={(event) => onSelect(page.id, event)}
      onDoubleClick={(event) => {
        stop(event);
        onOpen(page.id);
      }}
    >
      <CardBody page={page} file={file} index={index} selected={selected} active={active} variant={variant}>
        {/* Hover/touch actions. Always visible on touch devices. */}
        <div
          className={cn(
            "absolute inset-x-1 bottom-1 flex items-center justify-center gap-0.5 rounded border border-line bg-surface/95 p-0.5 shadow-card",
            "transition-opacity duration-120 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100",
          )}
        >
          <IconAction
            label="Rotate left"
            onClick={(event) => {
              stop(event);
              onRotate(page.id, -90);
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </IconAction>
          <IconAction
            label="Rotate right"
            onClick={(event) => {
              stop(event);
              onRotate(page.id, 90);
            }}
          >
            <RotateCw className="h-3.5 w-3.5" />
          </IconAction>
          <IconAction
            label="Edit page"
            onClick={(event) => {
              stop(event);
              onOpen(page.id);
            }}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </IconAction>
          {variant === "grid" ? (
            <IconAction
              label="Duplicate page"
              onClick={(event) => {
                stop(event);
                onDuplicate(page.id);
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </IconAction>
          ) : null}
          <IconAction
            label="Delete page"
            danger
            onClick={(event) => {
              stop(event);
              onDelete(page.id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </IconAction>
        </div>

        {variant === "grid" ? (
          <span className="absolute left-1 bottom-1 hidden text-ink-300 sm:group-hover:hidden" aria-hidden>
            <GripVertical className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </CardBody>
    </div>
  );
}

function IconAction({
  label,
  onClick,
  danger,
  children,
}: {
  label: string;
  onClick: (event: React.MouseEvent) => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded text-ink-500 transition-colors",
        danger ? "hover:bg-danger-soft hover:text-danger" : "hover:bg-[#ECEEF0] hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/** Rendered inside <DragOverlay> while a page is being dragged. */
export function PageCardPreview({
  page,
  file,
  index,
  count,
  variant,
}: {
  page: ProjectPage;
  file: SourceFile | undefined;
  index: number;
  count: number;
  variant: CardVariant;
}) {
  return (
    <div className="relative w-full cursor-grabbing">
      <CardBody page={page} file={file} index={index} selected active variant={variant} dragging />
      {count > 1 ? (
        <span className="absolute -right-2 -top-2 inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-surface bg-accent px-1.5 text-2xs font-semibold text-white">
          {count}
        </span>
      ) : null}
    </div>
  );
}
