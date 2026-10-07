"use client";

import { useEffect, useRef, useState } from "react";
import { AppError, toAppError } from "@/lib/core/errors";
import { getBasePreview, getRenderedPage, pageSignature, sourceKey } from "@/lib/image/preview-cache";
import type { ProjectPage, SourceFile } from "@/lib/core/types";

/**
 * Render a page to an object URL, lazily and with the previous frame kept on
 * screen while the next one is produced (no flicker while dragging a slider).
 */
export function usePageRender(page: ProjectPage, file: SourceFile | undefined, size: number, enabled = true) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [loading, setLoading] = useState(false);
  const signature = file ? pageSignature(page, size) : "";
  const latest = useRef(signature);

  useEffect(() => {
    latest.current = signature;
    if (!enabled || !file) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getRenderedPage(page, file, size)
      .then((next) => {
        if (cancelled || latest.current !== signature) return;
        setUrl(next);
      })
      .catch((cause) => {
        if (cancelled) return;
        setError(
          toAppError(
            cause,
            new AppError("render-failed", "Preview unavailable", "This page could not be rendered for preview."),
          ),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // `signature` captures every pixel-affecting property of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, enabled, file?.id]);

  return { url, error, loading };
}

/**
 * Object URL for the page's un-edited source preview. Used by the crop tool,
 * where edits must not be baked into what the user is drawing on.
 */
export function useBasePreviewUrl(page: ProjectPage, file: SourceFile | undefined, enabled = true) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const key = file ? sourceKey(page) : "";

  useEffect(() => {
    if (!enabled || !file) return;
    let cancelled = false;
    let created: string | null = null;
    setError(null);

    getBasePreview(page, file)
      .then((blob) => {
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        setUrl(created);
      })
      .catch((cause) => {
        if (cancelled) return;
        setError(
          toAppError(cause, new AppError("render-failed", "Preview unavailable", "This page could not be opened for editing.")),
        );
      });

    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, file?.id]);

  return { url, error };
}

/** Track an element's content-box size. */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (typeof ResizeObserver === "undefined") {
      setSize({ width: element.clientWidth, height: element.clientHeight });
      return;
    }
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    setSize({ width: element.clientWidth, height: element.clientHeight });
    return () => observer.disconnect();
  }, []);

  return { ref, size };
}

/**
 * True once the element has been within `margin` px of the viewport.
 *
 * Uses an IntersectionObserver for scrolling, plus a direct geometry check on
 * mount and whenever the tab becomes visible. The direct check matters because
 * browsers suspend IntersectionObserver callbacks in hidden tabs — without it,
 * a workspace restored from a background tab would sit on skeletons.
 */
export function useInView<T extends HTMLElement>(margin = 600) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let done = false;
    const markVisible = () => {
      if (done) return;
      done = true;
      setInView(true);
    };

    const checkGeometry = () => {
      if (done) return;
      const rect = element.getBoundingClientRect();
      // A zero-sized rect means the element is not laid out yet; retry later.
      if (rect.width === 0 && rect.height === 0) return;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      if (
        rect.bottom >= -margin &&
        rect.top <= viewportHeight + margin &&
        rect.right >= -margin &&
        rect.left <= viewportWidth + margin
      ) {
        markVisible();
      }
    };

    checkGeometry();
    if (done) return;

    const onVisibility = () => {
      if (!document.hidden) checkGeometry();
    };
    document.addEventListener("visibilitychange", onVisibility);

    if (typeof IntersectionObserver === "undefined") {
      markVisible();
      document.removeEventListener("visibilitychange", onVisibility);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          markVisible();
          observer.disconnect();
        }
      },
      { rootMargin: `${margin}px` },
    );
    observer.observe(element);

    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [margin]);

  return { ref, inView };
}
