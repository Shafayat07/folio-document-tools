"use client";

import { useCallback, useRef } from "react";
import { cn, clamp } from "@/lib/core/utils";
import type { CropRect, Point, Quad, Rotation } from "@/lib/core/types";

export type CropMode = "rect" | "corners";

interface CropStageProps {
  imageUrl: string;
  /** Intrinsic aspect ratio of the source (width / height). */
  aspect: number;
  rotation: Rotation;
  mode: CropMode;
  rect: CropRect;
  quad: Quad;
  onRectChange: (rect: CropRect) => void;
  onQuadChange: (quad: Quad) => void;
}

const MIN_SIZE = 0.05;

type RectHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "move";

/**
 * Interactive crop surface. Coordinates are normalised against the *un-rotated*
 * source, while the view is rotated to match the page — so the maths stays
 * simple and the output is exactly what the user drew.
 */
export function CropStage({ imageUrl, aspect, rotation, mode, rect, quad, onRectChange, onQuadChange }: CropStageProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ handle: RectHandle | number; start: Point; rect: CropRect; quad: Quad } | null>(null);

  /** Client point -> normalised point in the un-rotated source frame. */
  const toLocal = useCallback(
    (clientX: number, clientY: number): Point => {
      const inner = innerRef.current;
      if (!inner) return { x: 0, y: 0 };
      const box = inner.getBoundingClientRect();
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const angle = (-rotation * Math.PI) / 180;
      const lx = dx * Math.cos(angle) - dy * Math.sin(angle);
      const ly = dx * Math.sin(angle) + dy * Math.cos(angle);
      return {
        x: clamp(lx / inner.offsetWidth + 0.5, 0, 1),
        y: clamp(ly / inner.offsetHeight + 0.5, 0, 1),
      };
    },
    [rotation],
  );

  const handlePointerDown = useCallback(
    (handle: RectHandle | number) => (event: React.PointerEvent) => {
      event.stopPropagation();
      event.preventDefault();
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
      drag.current = { handle, start: toLocal(event.clientX, event.clientY), rect, quad };
    },
    [quad, rect, toLocal],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      const state = drag.current;
      if (!state) return;
      event.preventDefault();
      const point = toLocal(event.clientX, event.clientY);

      if (typeof state.handle === "number") {
        const next = state.quad.slice() as Quad;
        next[state.handle] = point;
        onQuadChange(next);
        return;
      }

      const base = state.rect;
      if (state.handle === "move") {
        const dx = point.x - state.start.x;
        const dy = point.y - state.start.y;
        onRectChange({
          x: clamp(base.x + dx, 0, 1 - base.width),
          y: clamp(base.y + dy, 0, 1 - base.height),
          width: base.width,
          height: base.height,
        });
        return;
      }

      let left = base.x;
      let top = base.y;
      let right = base.x + base.width;
      let bottom = base.y + base.height;

      if (state.handle.includes("w")) left = clamp(point.x, 0, right - MIN_SIZE);
      if (state.handle.includes("e")) right = clamp(point.x, left + MIN_SIZE, 1);
      if (state.handle.includes("n")) top = clamp(point.y, 0, bottom - MIN_SIZE);
      if (state.handle.includes("s")) bottom = clamp(point.y, top + MIN_SIZE, 1);

      onRectChange({ x: left, y: top, width: right - left, height: bottom - top });
    },
    [onQuadChange, onRectChange, toLocal],
  );

  const endDrag = useCallback(() => {
    drag.current = null;
  }, []);

  const swapped = rotation === 90 || rotation === 270;
  // The rotated image must fit the stage, so lay the inner element out in
  // source orientation and let the rotation decide which stage edge binds.
  const boundingAspect = swapped ? 1 / aspect : aspect;

  return (
    <div
      ref={stageRef}
      className="relative flex h-full w-full items-center justify-center overflow-hidden p-4 sm:p-8"
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
    >
      <div
        className="relative"
        style={{
          aspectRatio: String(boundingAspect),
          maxWidth: "100%",
          maxHeight: "100%",
          width: boundingAspect >= 1 ? "100%" : "auto",
          height: boundingAspect >= 1 ? "auto" : "100%",
        }}
      >
        <div
          ref={innerRef}
          className="absolute left-1/2 top-1/2 touch-none-safe"
          style={{
            width: swapped ? `${(1 / boundingAspect) * 100}%` : "100%",
            height: swapped ? `${boundingAspect * 100}%` : "100%",
            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" draggable={false} className="h-full w-full select-none object-fill" />

          {mode === "rect" ? (
            <RectOverlay rect={rect} onPointerDown={handlePointerDown} />
          ) : (
            <QuadOverlay quad={quad} onPointerDown={handlePointerDown} />
          )}
        </div>
      </div>
    </div>
  );
}

const HANDLE_POSITIONS: Array<{ handle: RectHandle; style: React.CSSProperties; cursor: string }> = [
  { handle: "nw", style: { left: 0, top: 0 }, cursor: "nwse-resize" },
  { handle: "n", style: { left: "50%", top: 0 }, cursor: "ns-resize" },
  { handle: "ne", style: { left: "100%", top: 0 }, cursor: "nesw-resize" },
  { handle: "e", style: { left: "100%", top: "50%" }, cursor: "ew-resize" },
  { handle: "se", style: { left: "100%", top: "100%" }, cursor: "nwse-resize" },
  { handle: "s", style: { left: "50%", top: "100%" }, cursor: "ns-resize" },
  { handle: "sw", style: { left: 0, top: "100%" }, cursor: "nesw-resize" },
  { handle: "w", style: { left: 0, top: "50%" }, cursor: "ew-resize" },
];

function RectOverlay({
  rect,
  onPointerDown,
}: {
  rect: CropRect;
  onPointerDown: (handle: RectHandle | number) => (event: React.PointerEvent) => void;
}) {
  return (
    <>
      {/* Dim everything outside the crop. */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 bg-ink/45" style={{ height: `${rect.y * 100}%` }} />
        <div className="absolute inset-x-0 bottom-0 bg-ink/45" style={{ height: `${(1 - rect.y - rect.height) * 100}%` }} />
        <div
          className="absolute left-0 bg-ink/45"
          style={{ top: `${rect.y * 100}%`, height: `${rect.height * 100}%`, width: `${rect.x * 100}%` }}
        />
        <div
          className="absolute right-0 bg-ink/45"
          style={{
            top: `${rect.y * 100}%`,
            height: `${rect.height * 100}%`,
            width: `${(1 - rect.x - rect.width) * 100}%`,
          }}
        />
      </div>

      <div
        className="absolute cursor-move border border-white shadow-[0_0_0_1px_rgba(22,24,29,0.4)]"
        style={{
          left: `${rect.x * 100}%`,
          top: `${rect.y * 100}%`,
          width: `${rect.width * 100}%`,
          height: `${rect.height * 100}%`,
        }}
        onPointerDown={onPointerDown("move")}
      >
        {/* Thirds guides. */}
        <div className="pointer-events-none absolute inset-0 opacity-50">
          <span className="absolute left-1/3 top-0 h-full w-px bg-white/70" />
          <span className="absolute left-2/3 top-0 h-full w-px bg-white/70" />
          <span className="absolute top-1/3 left-0 h-px w-full bg-white/70" />
          <span className="absolute top-2/3 left-0 h-px w-full bg-white/70" />
        </div>

        {HANDLE_POSITIONS.map(({ handle, style, cursor }) => (
          <span
            key={handle}
            role="slider"
            aria-label={`Resize ${handle}`}
            aria-valuenow={0}
            tabIndex={-1}
            onPointerDown={onPointerDown(handle)}
            style={{ ...style, cursor }}
            className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-ink bg-white sm:h-3 sm:w-3"
          />
        ))}
      </div>
    </>
  );
}

const CORNER_LABELS = ["top-left", "top-right", "bottom-right", "bottom-left"];

function QuadOverlay({
  quad,
  onPointerDown,
}: {
  quad: Quad;
  onPointerDown: (handle: RectHandle | number) => (event: React.PointerEvent) => void;
}) {
  const points = quad.map((point) => `${point.x * 100},${point.y * 100}`).join(" ");

  return (
    <>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full">
        <defs>
          <mask id="quad-mask">
            <rect x="0" y="0" width="100" height="100" fill="white" />
            <polygon points={points} fill="black" />
          </mask>
        </defs>
        <rect x="0" y="0" width="100" height="100" fill="#16181D" opacity="0.45" mask="url(#quad-mask)" />
        <polygon points={points} fill="none" stroke="#ffffff" strokeWidth="0.5" vectorEffect="non-scaling-stroke" />
      </svg>

      {quad.map((point, index) => (
        <span
          key={CORNER_LABELS[index]}
          role="slider"
          aria-label={`Move ${CORNER_LABELS[index]} corner`}
          aria-valuenow={0}
          tabIndex={-1}
          onPointerDown={onPointerDown(index)}
          style={{ left: `${point.x * 100}%`, top: `${point.y * 100}%` }}
          className={cn(
            "absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-ink bg-white",
            "shadow-[0_0_0_2px_rgba(255,255,255,0.7)] active:cursor-grabbing sm:h-5 sm:w-5",
          )}
        />
      ))}
    </>
  );
}
