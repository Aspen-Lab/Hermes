"use client";

import { useEffect, useState } from "react";
import type { FigureStatus } from "@/lib/figures/extract";

type Variant = "hero" | "compact";

export interface FigureState {
  key: string;
  imageUrl: string | null;
  caption: string | null;
  source: string | null;
  status: FigureStatus | "idle";
  reason: string | null;
  hideFigure: boolean;
  matchedBy: "keyword" | "semantic" | "vision" | "fallback" | null;
}

export interface ResolveFigureArgs {
  itemId: string;
  url?: string;
  doi?: string;
  query?: string;
  paperTitle?: string;
  alt?: string;
  variant?: Variant;
  figureIndex?: number;
  hideOnMiss?: boolean;
}

// Default image box sizing. Compact report figures now get much more height
// and then switch to the real image ratio after load. On mobile we also
// cap the height so square / portrait charts don't dominate the screen.
const frameClassByVariant: Record<Variant, string> = {
  hero: "min-h-[260px] sm:min-h-[360px] lg:min-h-[440px] xl:min-h-[520px] max-h-[360px] sm:max-h-none",
  compact: "min-h-[220px] sm:min-h-[340px] lg:min-h-[420px] xl:min-h-[500px] max-h-[300px] sm:max-h-none",
};

const defaultAspectByVariant: Record<Variant, number> = {
  hero: 4 / 3,
  compact: 1,
};

function initialFigureState(key = ""): FigureState {
  return {
    key,
    imageUrl: null,
    caption: null,
    source: null,
    status: "idle",
    reason: null,
    hideFigure: false,
    matchedBy: null,
  };
}

export function useResolvedFigure({
  itemId,
  url,
  doi,
  query,
  paperTitle,
  figureIndex = 0,
}: ResolveFigureArgs): FigureState {
  const requestKey = [
    itemId,
    url ?? "",
    doi ?? "",
    query ?? "",
    paperTitle ?? "",
    String(figureIndex),
  ].join("\u001f");

  const [figure, setFigure] = useState<FigureState>(initialFigureState());
  const activeFigure = figure.key === requestKey ? figure : initialFigureState(requestKey);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const params = new URLSearchParams({ id: itemId, v: "11" });
        if (url) params.set("url", url);
        if (doi) params.set("doi", doi);
        if (query?.trim()) params.set("query", query.trim());
        if (paperTitle?.trim()) params.set("paperTitle", paperTitle.trim());
        if (figureIndex > 0) params.set("idx", String(figureIndex));

        const res = await fetch(`/api/figure?${params.toString()}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (!cancelled) {
            setFigure({
              key: requestKey,
              imageUrl: null,
              caption: null,
              source: null,
              status: "source_unavailable",
              reason: "Hermes could not load the figure service response.",
              hideFigure: false,
              matchedBy: null,
            });
          }
          return;
        }

        const data = (await res.json()) as Omit<FigureState, "key"> & {
          imageUrl: string | null;
          caption?: string | null;
          source?: string | null;
          reason?: string | null;
          hideFigure?: boolean;
          matchedBy?: "keyword" | "semantic" | "vision" | "fallback" | null;
          status: FigureStatus;
        };
        if (cancelled) return;

        setFigure({
          key: requestKey,
          imageUrl: data.imageUrl,
          caption: data.caption ?? null,
          source: data.source ?? null,
          status: data.status,
          reason: data.reason ?? null,
          hideFigure: Boolean(data.hideFigure),
          matchedBy: data.matchedBy ?? null,
        });
      } catch {
        if (!cancelled) {
          setFigure({
            key: requestKey,
            imageUrl: null,
            caption: null,
            source: null,
            status: "source_unavailable",
            reason: "Hermes could not reach a usable figure source.",
            hideFigure: false,
            matchedBy: null,
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [itemId, url, doi, query, paperTitle, figureIndex, requestKey]);

  return activeFigure;
}

export function PaperFigureFrame({
  figure,
  alt,
  variant = "hero",
  hideOnMiss = true,
}: {
  figure: FigureState;
  alt?: string;
  variant?: Variant;
  hideOnMiss?: boolean;
}) {
  const [loadedImage, setLoadedImage] = useState<{
    url: string;
    aspect: number;
  } | null>(null);

  const activeAspect =
    loadedImage && loadedImage.url === figure.imageUrl
      ? loadedImage.aspect
      : null;

  // Whenever we have nothing usable to show, emit the `.figure-hidden`
  // marker. The parent uses `has-[.figure-hidden]:hidden` so the entire
  // figure column collapses (removing both the placeholder AND the flex
  // gap). Returning `null` here leaves an empty flex item that still
  // reserves space, so we always render the marker instead.
  if (!figure.imageUrl && figure.hideFigure) {
    return <div className="figure-hidden" aria-hidden />;
  }

  if (
    hideOnMiss &&
    figure.status !== "idle" &&
    !figure.imageUrl &&
    figure.status !== "found"
  ) {
    return <div className="figure-hidden" aria-hidden />;
  }
  return (
    <figure className="mt-5 w-full">
      {/* Image area — caption no longer overlaps. */}
      <div
        className={`relative w-full overflow-hidden rounded-2xl bg-bg-secondary/50 ${frameClassByVariant[variant]}`}
        style={{
          aspectRatio: activeAspect ?? defaultAspectByVariant[variant],
        }}
      >
        {figure.status === "idle" && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-bg-secondary/40 via-bg-secondary/70 to-bg-secondary/40" />
        )}
        {figure.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={figure.imageUrl}
            alt={alt ?? ""}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={(event) => {
              const next = event.currentTarget;
              if (next.naturalWidth > 0 && next.naturalHeight > 0) {
                setLoadedImage({
                  url: next.currentSrc || next.src,
                  aspect: next.naturalWidth / next.naturalHeight,
                });
              }
            }}
            className="absolute inset-0 h-full w-full bg-white object-contain p-1.5 sm:p-2 lg:p-2.5 opacity-100 transition-opacity duration-500 ease-out"
          />
        )}
        {!figure.imageUrl && figure.status !== "idle" && !figure.hideFigure && (
          <MissingFigureNotice figure={figure} />
        )}
        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5" />
      </div>
      {/* Caption block — separate row below the image so it never covers it. */}
      {figure.imageUrl && figure.caption && (
        <figcaption
          className="mt-2 rounded-xl bg-bg-secondary/40 px-3.5 py-2.5 text-[14px] leading-relaxed text-text-muted"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          <span className="font-semibold text-heading">
            {sourceLabel(figure.source)}:
          </span>{" "}
          {figure.caption}
        </figcaption>
      )}
    </figure>
  );
}

export function PaperFigure(props: ResolveFigureArgs) {
  const figure = useResolvedFigure(props);
  return (
    <PaperFigureFrame
      figure={figure}
      alt={props.alt}
      variant={props.variant}
      hideOnMiss={props.hideOnMiss}
    />
  );
}

function MissingFigureNotice({ figure }: { figure: FigureState }) {
  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface px-5 text-center"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-text-faint">
        {noticeTitle(figure.status)}
      </p>
      <p className="max-w-[260px] text-[12px] leading-relaxed text-text-muted">
        {figure.reason ?? defaultReason(figure.status)}
      </p>
    </div>
  );
}

function noticeTitle(status: FigureState["status"]): string {
  if (status === "caption_mismatch") return "Caption match not confident";
  if (status === "no_figures") return "No extractable figures found";
  if (status === "paywalled") return "Figure source unavailable";
  if (status === "source_unavailable") return "Figure source unavailable";
  return "No verified paper figure found";
}

function defaultReason(status: FigureState["status"]): string {
  if (status === "caption_mismatch") {
    return "Hermes reached a real figure source, but it could not confidently match a figure to this report section.";
  }
  if (status === "no_figures") {
    return "Hermes reached the source page, but it did not expose extractable figures.";
  }
  if (status === "paywalled") {
    return "Hermes reached the source, but figure access appears restricted.";
  }
  return "Hermes could not reach a usable figure source.";
}

function sourceLabel(source: string | null): string {
  if (source === "semantic-scholar") return "Semantic Scholar figure";
  if (source === "ar5iv") return "arXiv figure";
  if (source === "publisher") return "Publisher figure";
  if (source === "open-access") return "Open-access figure";
  return "Paper figure";
}
