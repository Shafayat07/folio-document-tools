"use client";

import { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/core/utils";
import type { ProjectPage, SourceFile } from "@/lib/core/types";
import { PageCard, PageCardPreview, type CardVariant, type PageCardActions } from "./PageCard";

export interface PageGridProps extends PageCardActions {
  pages: ProjectPage[];
  files: Record<string, SourceFile>;
  selection: string[];
  activeId: string | null;
  variant: CardVariant;
  /** Reorder a single page. */
  onReorder: (from: number, to: number) => void;
  /** Reorder every selected page as a block. */
  onReorderMany: (ids: string[], to: number) => void;
  className?: string;
}

export function PageGrid({
  pages,
  files,
  selection,
  activeId,
  variant,
  onReorder,
  onReorderMany,
  className,
  ...actions
}: PageGridProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const sensors = useSensors(
    // A small distance threshold keeps plain clicks working as selection.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Long-press on touch so the page list can still be scrolled with a swipe.
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const ids = useMemo(() => pages.map((page) => page.id), [pages]);
  const selectionSet = useMemo(() => new Set(selection), [selection]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggingId(String(event.active.id));
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setDraggingId(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const from = ids.indexOf(String(active.id));
      const to = ids.indexOf(String(over.id));
      if (from === -1 || to === -1) return;

      // Dragging a page that is part of a multi-selection moves the whole set.
      if (selectionSet.has(String(active.id)) && selection.length > 1) {
        onReorderMany(selection, to);
        return;
      }
      onReorder(from, to);
    },
    [ids, onReorder, onReorderMany, selection, selectionSet],
  );

  const draggingIndex = draggingId ? ids.indexOf(draggingId) : -1;
  const draggingPage = draggingIndex >= 0 ? pages[draggingIndex] : null;
  const dragCount = draggingId && selectionSet.has(draggingId) ? Math.max(1, selection.length) : 1;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingId(null)}
      modifiers={variant === "rail" ? [restrictToParentElement] : undefined}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up page ${ids.indexOf(String(active.id)) + 1}.`,
          onDragOver: ({ over }) => (over ? `Moving to position ${ids.indexOf(String(over.id)) + 1}.` : undefined),
          onDragEnd: ({ over }) => (over ? `Dropped at position ${ids.indexOf(String(over.id)) + 1}.` : "Drop cancelled."),
          onDragCancel: () => "Reordering cancelled.",
        },
      }}
    >
      <SortableContext items={ids} strategy={variant === "rail" ? verticalListSortingStrategy : rectSortingStrategy}>
        <div
          className={cn(
            "grid gap-2.5",
            variant === "grid"
              ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
              : // Horizontal strip on small screens, vertical rail on desktop.
                "grid-flow-col auto-cols-[84px] lg:grid-flow-row lg:auto-cols-auto lg:grid-cols-1",
            className,
          )}
        >
          {pages.map((page, index) => (
            <PageCard
              key={page.id}
              page={page}
              file={files[page.fileId]}
              index={index}
              total={pages.length}
              selected={selectionSet.has(page.id)}
              active={activeId === page.id}
              variant={variant}
              {...actions}
            />
          ))}
        </div>
      </SortableContext>

      <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
        {draggingPage ? (
          <div className={variant === "grid" ? "w-[clamp(120px,22vw,220px)]" : "w-[150px]"}>
            <PageCardPreview
              page={draggingPage}
              file={files[draggingPage.fileId]}
              index={draggingIndex}
              count={dragCount}
              variant={variant}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
