"use client";

// Lazy figure loader for a paper card. Renders a 16:9 frame, starts in a
// gentle skeleton state, fetches `/api/figure?id=&url=`, and fades in the
// image once available. Renders nothing if the resolver returns null.

import { useEffect, useState } from "react";

type Variant = "hero" | "compact";

interface PaperFigureProps {
  itemId: string;
  url?: string;
  alt?: string;
  variant?: Variant;
  /** Disable the placeholder skeleton when no figure is found. */
  hideOnMiss?: boolean;
}

const heightByVariant: Record<Variant, string> = {
  hero: "aspect-[16/8] lg:aspect-[16/7]",
  compact: "aspect-[16/9]",
};

export function PaperFigure({
  itemId,
  url,
  alt,
  variant = "hero",
  hideOnMiss = true,
}: PaperFigureProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loaded" | "miss" | "error">(
    "idle",
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const params = new URLSearchParams({ id: itemId, v: "2" });
        if (url) params.set("url", url);
        const res = await fetch(`/api/figure?${params.toString()}`, {
          // Browser cache mirror of the route's CDN cache.
          cache: "force-cache",
        });
        if (!res.ok) {
          if (!cancelled) setState("error");
          return;
        }
        const data = (await res.json()) as { imageUrl: string | null };
        if (cancelled) return;
        if (data.imageUrl) {
          setImageUrl(data.imageUrl);
          setState("loaded");
        } else {
          setState("miss");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [itemId, url]);

  if (hideOnMiss && (state === "miss" || state === "error")) return null;

  return (
    <div
      className={`relative w-full ${heightByVariant[variant]} rounded-2xl overflow-hidden bg-bg-secondary/50 mt-5`}
    >
      {state === "idle" && (
        <div className="absolute inset-0 bg-gradient-to-br from-bg-secondary/40 via-bg-secondary/70 to-bg-secondary/40 animate-pulse" />
      )}
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={alt ?? ""}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-out opacity-100"
          onError={() => setState("error")}
        />
      )}
      {/* subtle inner shadow so light figures don't blow out */}
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5" />
    </div>
  );
}
