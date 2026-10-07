"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Check, FolderOpen, RefreshCw, RotateCcw, SwitchCamera, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AppError, cameraError } from "@/lib/core/errors";
import { blobToFile } from "@/lib/files/import";
import { canvasToBlob, createCanvas, context2d } from "@/lib/image/canvas";
import { cn, pluralize } from "@/lib/core/utils";

interface Shot {
  id: string;
  blob: Blob;
  url: string;
}

export interface CameraCaptureProps {
  open: boolean;
  mode: "single" | "multi";
  onClose: () => void;
  /** Called with the captured pages, in capture order. */
  onCapture: (files: File[]) => void;
  /** Lets the user fall back to the OS camera app if getUserMedia fails. */
  onFallbackPicker?: () => void;
}

export function CameraCapture({ open, mode, onClose, onCapture, onFallbackPicker }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const shotsRef = useRef<Shot[]>([]);

  const [shots, setShots] = useState<Shot[]>([]);
  const [status, setStatus] = useState<"idle" | "starting" | "live" | "error">("idle");
  const [error, setError] = useState<AppError | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);
  const [review, setReview] = useState<Shot | null>(null);
  const [reviewEach, setReviewEach] = useState(mode === "single");
  const [flash, setFlash] = useState(false);

  shotsRef.current = shots;

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const start = useCallback(
    async (preferred: "environment" | "user") => {
      setStatus("starting");
      setError(null);

      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setError(
          new AppError(
            "camera-unavailable",
            "Camera not supported",
            "This browser does not support in-page camera capture.",
            "Use “Import from camera app” or add photos from your device instead.",
          ),
        );
        return;
      }
      if (typeof window !== "undefined" && !window.isSecureContext) {
        setStatus("error");
        setError(
          new AppError(
            "camera-insecure",
            "Camera blocked",
            "Camera access requires a secure connection (HTTPS or localhost).",
            "Open this page over HTTPS to use the camera.",
          ),
        );
        return;
      }

      stopStream();

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: preferred },
            width: { ideal: 3840 },
            height: { ideal: 2160 },
          },
          audio: false,
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setStatus("live");

        // Device labels are only readable once permission has been granted.
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        setHasMultipleCameras(devices.filter((device) => device.kind === "videoinput").length > 1);
      } catch (cause) {
        setStatus("error");
        setError(cameraError(cause));
      }
    },
    [stopStream],
  );

  useEffect(() => {
    if (!open) return;
    setReviewEach(mode === "single");
    void start(facing);
    return () => stopStream();
    // Restarting on `facing` change is handled by switchCamera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Release object URLs when the sheet closes.
  useEffect(() => {
    if (open) return;
    shotsRef.current.forEach((shot) => URL.revokeObjectURL(shot.url));
    setShots([]);
    setReview(null);
    setStatus("idle");
    setError(null);
  }, [open]);

  const switchCamera = useCallback(() => {
    const next = facing === "environment" ? "user" : "environment";
    setFacing(next);
    void start(next);
  }, [facing, start]);

  const capture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    try {
      const canvas = createCanvas(video.videoWidth, video.videoHeight);
      const ctx = context2d(canvas);
      ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
      const blob = await canvasToBlob(canvas, "image/jpeg", 0.92);
      const shot: Shot = { id: `shot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, blob, url: URL.createObjectURL(blob) };

      setFlash(true);
      window.setTimeout(() => setFlash(false), 110);

      if (reviewEach) {
        setReview(shot);
      } else {
        setShots((current) => [...current, shot]);
      }
    } catch {
      setError(
        new AppError("render-failed", "Capture failed", "The frame could not be saved.", "Try again, or add a photo from your device."),
      );
    }
  }, [reviewEach]);

  const finish = useCallback(
    (list?: Shot[]) => {
      const source = list ?? shotsRef.current;
      if (!source.length) {
        onClose();
        return;
      }
      const stamp = new Date();
      const pad = (value: number) => String(value).padStart(2, "0");
      const prefix = `scan-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}`;
      const files = source.map((shot, index) => blobToFile(shot.blob, `${prefix}-${pad(index + 1)}.jpg`));
      stopStream();
      onCapture(files);
    },
    [onCapture, onClose, stopStream],
  );

  const acceptReview = useCallback(() => {
    if (!review) return;
    // `shotsRef` still holds the pre-capture list, so this is "previous + new".
    const next = [...shotsRef.current, review];
    setShots(next);
    setReview(null);
    if (mode === "single") finish(next);
  }, [review, mode, finish]);

  const retakeReview = useCallback(() => {
    if (review) URL.revokeObjectURL(review.url);
    setReview(null);
  }, [review]);

  const removeShot = useCallback((id: string) => {
    setShots((current) => {
      const target = current.find((shot) => shot.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((shot) => shot.id !== id);
    });
  }, []);

  // Keyboard: space/enter captures, Esc closes.
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        stopStream();
        onClose();
        return;
      }
      if ((event.key === " " || event.key === "Enter") && status === "live" && !review) {
        const target = event.target as HTMLElement | null;
        if (target && ["BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
        event.preventDefault();
        void capture();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, status, review, capture, onClose, stopStream]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] flex flex-col bg-[#101114]" role="dialog" aria-modal="true" aria-label="Camera">
      {/* Top bar */}
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-white/10 px-3 sm:px-4">
        <span className="inline-flex items-center gap-2 text-sm font-semibold text-white">
          <Camera className="h-4 w-4" strokeWidth={1.8} />
          Camera
        </span>
        {shots.length ? (
          <span className="rounded border border-white/15 bg-white/10 px-2 py-0.5 text-2xs font-medium text-white/90">
            {pluralize(shots.length, "page")} captured
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          {mode === "multi" ? (
            <label className="hidden cursor-pointer select-none items-center gap-2 text-2xs text-white/70 sm:flex">
              <input
                type="checkbox"
                checked={reviewEach}
                onChange={(event) => setReviewEach(event.target.checked)}
                className="h-3.5 w-3.5 accent-white"
              />
              Review each page
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => {
              stopStream();
              onClose();
            }}
            aria-label="Close camera"
            className="inline-flex h-9 w-9 items-center justify-center rounded text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Viewfinder */}
      <div className="relative min-h-0 flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className={cn(
            "h-full w-full object-contain",
            facing === "user" && "scale-x-[-1]",
            (status !== "live" || review) && "invisible",
          )}
        />

        {/* Framing guides — purely functional, no decoration. */}
        {status === "live" && !review ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="relative h-full w-full max-w-3xl">
              {(
                [
                  "left-0 top-0 border-l-2 border-t-2",
                  "right-0 top-0 border-r-2 border-t-2",
                  "left-0 bottom-0 border-l-2 border-b-2",
                  "right-0 bottom-0 border-r-2 border-b-2",
                ] as const
              ).map((position) => (
                <span key={position} className={cn("absolute h-7 w-7 border-white/45", position)} />
              ))}
            </div>
          </div>
        ) : null}

        {flash ? <div className="absolute inset-0 bg-white/80" /> : null}

        {/* Review overlay */}
        {review ? (
          <div className="absolute inset-0 flex flex-col">
            <div className="flex min-h-0 flex-1 items-center justify-center p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={review.url} alt="Captured page" className="max-h-full max-w-full object-contain" />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 bg-[#16181D] px-4 py-3">
              <Button variant="secondary" size="lg" onClick={retakeReview}>
                <RotateCcw className="h-4 w-4" />
                Retake
              </Button>
              <Button variant="primary" size="lg" onClick={acceptReview} className="border-white bg-white text-ink hover:bg-white/90">
                <Check className="h-4 w-4" />
                Use photo
              </Button>
            </div>
          </div>
        ) : null}

        {/* Starting / error states */}
        {status === "starting" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/70">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <p className="text-sm">Starting camera…</p>
          </div>
        ) : null}

        {status === "error" && error ? (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="w-full max-w-md rounded-lg border border-white/10 bg-[#1C1E23] p-5 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                <CameraOff className="h-5 w-5 text-white/80" />
              </div>
              <p className="text-sm font-semibold text-white">{error.title}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/70">{error.message}</p>
              {error.hint ? <p className="mt-2 text-2xs text-white/50">{error.hint}</p> : null}
              <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button variant="secondary" onClick={() => void start(facing)}>
                  <RefreshCw className="h-4 w-4" />
                  Try again
                </Button>
                {onFallbackPicker ? (
                  <Button
                    variant="primary"
                    className="border-white bg-white text-ink hover:bg-white/90"
                    onClick={() => {
                      stopStream();
                      onFallbackPicker();
                    }}
                  >
                    <FolderOpen className="h-4 w-4" />
                    Add photos instead
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Captured strip */}
      {shots.length ? (
        <div className="shrink-0 border-t border-white/10 bg-[#16181D] px-3 py-2">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-slim pb-1">
            {shots.map((shot, index) => (
              <div key={shot.id} className="relative shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={shot.url}
                  alt={`Page ${index + 1}`}
                  className="h-16 w-12 rounded border border-white/15 object-cover"
                />
                <span className="absolute bottom-0 left-0 rounded-br rounded-tl bg-black/70 px-1 text-[10px] font-medium text-white">
                  {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeShot(shot.id)}
                  aria-label={`Remove page ${index + 1}`}
                  className="absolute -right-1.5 -top-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-[#1C1E23] text-white/80 hover:bg-danger hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Bottom controls */}
      <div className="shrink-0 border-t border-white/10 bg-[#16181D] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div className="flex w-20 justify-start sm:w-32">
            {hasMultipleCameras ? (
              <Button
                variant="ghost"
                size="md"
                onClick={switchCamera}
                className="text-white/80 hover:bg-white/10 hover:text-white"
                title="Switch camera"
              >
                <SwitchCamera className="h-4 w-4" />
                <span className="hidden sm:inline">Switch</span>
              </Button>
            ) : null}
          </div>

          <div className="flex flex-1 flex-col items-center gap-1">
            <button
              type="button"
              onClick={() => void capture()}
              disabled={status !== "live" || !!review}
              aria-label={shots.length ? `Capture page ${shots.length + 1}` : "Capture page"}
              className={cn(
                "inline-flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/80 transition-transform",
                "active:scale-95 disabled:cursor-not-allowed disabled:opacity-40",
                "bg-white/95 hover:bg-white",
              )}
            >
              <span className="h-12 w-12 rounded-full bg-accent" />
            </button>
            <span className="text-2xs text-white/50">
              {mode === "multi" ? `Capture page ${shots.length + 1}` : "Capture"}
            </span>
          </div>

          <div className="flex w-20 justify-end sm:w-32">
            <Button
              variant="primary"
              size="md"
              onClick={() => finish()}
              disabled={!shots.length}
              className="border-white bg-white text-ink hover:bg-white/90 disabled:border-white/20 disabled:bg-white/20 disabled:text-white/50"
            >
              <Check className="h-4 w-4" />
              {mode === "multi" ? "Finish" : "Done"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
