"use client";

// Colored dot-matrix (halftone) rendering of an image — the aspenlab.io
// hero treatment, but in full color: each grid cell samples the source
// image's own pixel color; dot radius follows classic halftone rules
// (darker → larger, lighter → finer). Transparent cells draw nothing, so
// the artwork keeps its silhouette on any theme background.
//
// Purely decorative: aria-hidden, pointer-events-none, one-shot entrance
// reveal (skipped under prefers-reduced-motion), then a static canvas.

import { useEffect, useRef } from "react";
import { cn } from "@/lib/cn";

interface DotMatrixImageProps {
  src: string;
  /** Intrinsic aspect ratio of the source, e.g. 1254 / 356. Reserves layout. */
  aspectRatio: number;
  className?: string;
  /** Grid pitch in CSS px between dot centers. */
  pitch?: number;
  /** Alpha (0–255) below which a cell is treated as empty. */
  alphaThreshold?: number;
}

interface Dot {
  x: number;
  y: number;
  r: number;
  color: string;
}

function buildDots(
  img: HTMLImageElement,
  cssWidth: number,
  pitch: number,
  alphaThreshold: number,
): { dots: Dot[]; cssHeight: number } {
  const cssHeight = Math.round(cssWidth * (img.naturalHeight / img.naturalWidth));
  const cols = Math.floor(cssWidth / pitch);
  const rows = Math.floor(cssHeight / pitch);

  const sample = document.createElement("canvas");
  sample.width = cols;
  sample.height = rows;
  const sctx = sample.getContext("2d", { willReadFrequently: true });
  if (!sctx) return { dots: [], cssHeight };
  sctx.drawImage(img, 0, 0, cols, rows);
  const data = sctx.getImageData(0, 0, cols, rows).data;

  const maxR = pitch * 0.42;
  const dots: Dot[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const i = (row * cols + col) * 4;
      const a = data[i + 3];
      if (a < alphaThreshold) continue;
      const r8 = data[i];
      const g8 = data[i + 1];
      const b8 = data[i + 2];
      // Halftone sizing: darker ink → bigger dot; alpha shrinks edge dots.
      const lum = (0.2126 * r8 + 0.7152 * g8 + 0.0722 * b8) / 255;
      const radius = maxR * (0.3 + 0.7 * (1 - lum)) * (a / 255);
      if (radius < 0.4) continue;
      dots.push({
        x: col * pitch + pitch / 2,
        y: row * pitch + pitch / 2,
        r: radius,
        color: `rgb(${r8} ${g8} ${b8})`,
      });
    }
  }
  return { dots, cssHeight };
}

export function DotMatrixImage({
  src,
  aspectRatio,
  className,
  pitch = 4,
  alphaThreshold = 24,
}: DotMatrixImageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let raf = 0;

    const img = new Image();
    img.decoding = "async";
    img.src = src;
    img.onload = () => {
      if (cancelled) return;
      const cssWidth = canvas.clientWidth || 300;
      const { dots, cssHeight } = buildDots(img, cssWidth, pitch, alphaThreshold);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);

      const drawUpTo = (progress: number) => {
        ctx.clearRect(0, 0, cssWidth, cssHeight);
        // Reveal sweeps left→right with a soft 20%-wide edge; each dot pops
        // from 0 to full radius as the sweep passes it.
        for (const dot of dots) {
          const local = (progress * 1.2 - dot.x / cssWidth) / 0.2;
          const t = Math.max(0, Math.min(1, local));
          if (t === 0) continue;
          const ease = 1 - (1 - t) * (1 - t); // ease-out — snappy pop
          ctx.beginPath();
          ctx.arc(dot.x, dot.y, dot.r * ease, 0, Math.PI * 2);
          ctx.fillStyle = dot.color;
          ctx.fill();
        }
      };

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (reduceMotion) {
        drawUpTo(1);
        return;
      }

      const DURATION = 520;
      const start = performance.now();
      const tick = (now: number) => {
        if (cancelled) return;
        const progress = Math.min(1, (now - start) / DURATION);
        drawUpTo(progress);
        if (progress < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [src, pitch, alphaThreshold]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      // Template-literal concatenation left a trailing space when no className
      // was passed. The server trims it in the emitted attribute and the client
      // keeps it, which React reports as a hydration mismatch on every load.
      className={cn("pointer-events-none select-none", className)}
      style={{ aspectRatio: String(aspectRatio), width: "100%", height: "auto" }}
    />
  );
}
