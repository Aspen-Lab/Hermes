"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Paper, UserProfile } from "@/types";
import {
  buildPaperBibTeX,
  buildPaperThinkingSurface,
  type SurfaceCell,
  type SurfaceFlowStep,
  type SurfaceKeywordGroup,
} from "@/lib/papers/surface-model";

interface PaperThinkingSurfaceProps {
  paper: Paper;
  profile: UserProfile;
  isSaved: boolean;
  isLiked: boolean;
  onSave: () => void;
  onLike: () => void;
  onDismiss: () => void;
}

export function PaperThinkingSurface({
  paper,
  profile,
  isSaved,
  isLiked,
  onSave,
  onLike,
  onDismiss,
}: PaperThinkingSurfaceProps) {
  const [copied, setCopied] = useState(false);
  const [now] = useState(() => Date.now());
  const model = useMemo(
    () => buildPaperThinkingSurface(paper, profile, now),
    [paper, profile, now],
  );

  const handleCopyCitation = async () => {
    try {
      await navigator.clipboard.writeText(buildPaperBibTeX(paper));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="paper-surface">
      <style>{surfaceCss}</style>

      <div className="surface-wrap">
        <nav className="surface-topline" aria-label="Paper navigation">
          <Link href={`/papers/${encodeURIComponent(paper.id)}`} className="surface-back">
            Back to brief
          </Link>
          <span className="surface-mode">Thinking Surface</span>
        </nav>

        <header className="surface-hero">
          <div className="surface-title-block">
            <div className="surface-kicker">
              <span>{model.badge}</span>
              <span>{model.matchLabel} match</span>
              <span>{model.readTimeLabel}</span>
              <span>{model.publishedLabel}</span>
            </div>
            <h1>{model.title}</h1>
            <p>{model.subtitle}</p>
          </div>

          <div className="surface-actions" aria-label="Paper actions">
            <a href={model.primaryUrl} target="_blank" rel="noopener noreferrer">
              {model.primaryLabel}
            </a>
            <button type="button" onClick={onSave} aria-pressed={isSaved}>
              {isSaved ? "Saved" : "Save"}
            </button>
            <button type="button" onClick={handleCopyCitation}>
              {copied ? "Copied" : "Cite"}
            </button>
            <button type="button" onClick={onLike} aria-pressed={isLiked}>
              {isLiked ? "Liked" : "Like"}
            </button>
            <button type="button" onClick={onDismiss} className="surface-muted-action">
              Not interested
            </button>
          </div>
        </header>

        <section className="surface-grid scan-grid" aria-label="Ten second scan">
          {model.scan.map((cell) => (
            <InfoCell key={cell.label} cell={cell} />
          ))}
        </section>

        <section className="surface-board" aria-label="Article surface">
          <div className="surface-grid surface-main-grid">
            <InfoCell cell={model.proposal} large />
            <InfoCell cell={model.result} large />
            <MethodMap groups={model.methodGroups} />
            <FitMap cells={model.fit} />
          </div>
        </section>

        <section className="surface-section">
          <SectionHeader label="Evidence" title="What the interface can trust" />
          <div className="surface-flow">
            {model.flow.map((step) => (
              <FlowStep key={step.label} step={step} />
            ))}
          </div>
        </section>

        <section className="surface-section">
          <SectionHeader label="Source" title="Paths out of the surface" />
          <div className="surface-grid source-grid">
            {model.sourceFacts.map((cell) => (
              <InfoCell key={cell.label} cell={cell} />
            ))}
          </div>
          <div className="surface-link-row">
            {model.secondaryLinks.map((link) => (
              <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer">
                {link.label}
              </a>
            ))}
          </div>
        </section>

        {model.tags.length > 0 && (
          <section className="surface-section">
            <SectionHeader label="Index" title="Portable tags" />
            <div className="surface-tags">
              {model.tags.map((tag) => (
                <span key={tag}>{tag}</span>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ label, title }: { label: string; title: string }) {
  return (
    <div className="surface-section-head">
      <span>{label}</span>
      <h2>{title}</h2>
    </div>
  );
}

function InfoCell({ cell, large = false }: { cell: SurfaceCell; large?: boolean }) {
  return (
    <div className={`surface-cell ${large ? "surface-cell-large" : ""} ${cell.tone ? `tone-${cell.tone}` : ""}`}>
      <p className="surface-label">{cell.label}</p>
      <h3>{cell.title}</h3>
      {cell.body && <p className="surface-body">{cell.body}</p>}
    </div>
  );
}

function MethodMap({ groups }: { groups: SurfaceKeywordGroup[] }) {
  return (
    <div className="surface-cell surface-cell-large">
      <p className="surface-label">Method map</p>
      <h3>Signals separated from format noise</h3>
      <div className="method-map">
        {groups.map((group) => (
          <div key={group.label} className="method-group">
            <p>{group.label}</p>
            <h4>{group.title}</h4>
            {group.items.length > 0 ? (
              <div className="surface-tags compact">
                {group.items.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            ) : (
              <span className="empty-note">{group.empty}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FitMap({ cells }: { cells: SurfaceCell[] }) {
  return (
    <div className="surface-cell surface-cell-large">
      <p className="surface-label">Fit map</p>
      <h3>Why this surfaced for you</h3>
      <div className="fit-list">
        {cells.map((cell) => (
          <div key={cell.label} className={cell.tone ? `tone-${cell.tone}` : ""}>
            <span>{cell.label}</span>
            <strong>{cell.title}</strong>
            {cell.body && <p>{cell.body}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function FlowStep({ step }: { step: SurfaceFlowStep }) {
  return (
    <div className={`flow-step ${step.state === "thin" ? "flow-thin" : ""}`}>
      <span>{step.label}</span>
      <strong>{step.title}</strong>
      <p>{step.body}</p>
    </div>
  );
}

const surfaceCss = `
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700&family=DM+Mono:wght@400;500&display=swap');

.paper-surface {
  --bg: #08080a;
  --surface: #0e0e11;
  --surface-2: #141417;
  --border: rgba(255,255,255,0.05);
  --border-hover: rgba(255,255,255,0.08);
  --text-0: #fff;
  --text-1: rgba(255,255,255,0.92);
  --text-2: rgba(255,255,255,0.62);
  --text-3: rgba(255,255,255,0.40);
  --accent: #b49dfa;
  --accent-dim: rgba(167,139,250,0.12);
  --mute: rgba(255,255,255,0.03);
  min-height: calc(100vh - 3rem);
  background: var(--bg);
  color: var(--text-1);
  font-family: 'DM Sans', var(--font-geist), -apple-system, BlinkMacSystemFont, sans-serif;
}

.paper-surface * {
  box-sizing: border-box;
}

.surface-wrap {
  max-width: 1200px;
  margin: 0 auto;
  padding: 34px 28px 56px;
}

.surface-topline,
.surface-kicker,
.surface-actions,
.surface-link-row,
.surface-tags {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.surface-topline {
  justify-content: space-between;
  gap: 14px;
  margin-bottom: 34px;
  color: var(--text-3);
  font: 500 10px/1 'DM Mono', var(--font-geist-mono), monospace;
  letter-spacing: 0.7px;
  text-transform: uppercase;
}

.surface-back,
.surface-mode,
.surface-actions a,
.surface-actions button,
.surface-link-row a {
  color: inherit;
  text-decoration: none;
}

.surface-back {
  transition: color 0.18s ease, background 0.18s ease;
}

.surface-back:hover {
  color: var(--text-0);
}

.surface-mode {
  color: var(--accent);
}

.surface-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 360px);
  gap: 32px;
  align-items: end;
  margin-bottom: 28px;
}

.surface-kicker {
  gap: 8px;
  margin-bottom: 14px;
}

.surface-kicker span {
  min-height: 24px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: var(--mute);
  padding: 0 9px;
  color: var(--text-3);
  font: 500 10px/1 'DM Mono', var(--font-geist-mono), monospace;
  letter-spacing: 0.7px;
  text-transform: uppercase;
}

.surface-kicker span:first-child,
.surface-actions a:first-child {
  color: var(--accent);
  background: var(--accent-dim);
}

.surface-title-block h1 {
  max-width: 900px;
  margin: 0;
  color: var(--text-0);
  font-size: clamp(34px, 4vw, 58px);
  line-height: 0.98;
  font-weight: 700;
  letter-spacing: 0;
}

.surface-title-block p {
  max-width: 760px;
  margin: 18px 0 0;
  color: var(--text-2);
  font-size: 13px;
  line-height: 1.55;
}

.surface-actions {
  justify-content: flex-end;
  gap: 8px;
}

.surface-actions a,
.surface-actions button,
.surface-link-row a {
  min-height: 34px;
  border: 0;
  border-radius: 999px;
  background: var(--mute);
  padding: 0 12px;
  color: var(--text-2);
  font: 600 12px/1 'DM Sans', var(--font-geist), sans-serif;
  cursor: pointer;
  transition: background 0.18s ease, color 0.18s ease;
}

.surface-actions a,
.surface-actions button {
  display: inline-flex;
  align-items: center;
}

.surface-actions a:hover,
.surface-actions button:hover,
.surface-link-row a:hover,
.surface-actions button[aria-pressed="true"] {
  background: var(--accent-dim);
  color: var(--text-0);
}

.surface-actions .surface-muted-action:hover {
  background: var(--mute);
  color: var(--text-1);
}

.surface-grid {
  display: grid;
  gap: 1px;
  background: var(--border);
  border-radius: 10px;
  overflow: hidden;
}

.scan-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 28px;
}

.surface-board {
  margin-top: 0;
}

.surface-main-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.source-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.surface-cell {
  min-height: 164px;
  background: var(--surface);
  padding: 22px;
  transition: background 0.18s ease;
}

.surface-cell:hover {
  background: var(--surface-2);
}

.surface-cell.tone-accent,
.fit-list .tone-accent {
  background: color-mix(in srgb, var(--accent-dim) 55%, var(--surface));
}

.surface-cell.tone-muted,
.fit-list .tone-muted {
  color: var(--text-3);
}

.surface-cell-large {
  min-height: 268px;
}

.surface-label,
.method-group p,
.surface-section-head span,
.flow-step span,
.fit-list span {
  margin: 0;
  color: var(--text-3);
  font: 500 10px/1.2 'DM Mono', var(--font-geist-mono), monospace;
  letter-spacing: 0.7px;
  text-transform: uppercase;
}

.surface-cell h3 {
  margin: 10px 0 0;
  color: var(--text-0);
  font-size: 15px;
  line-height: 1.25;
  font-weight: 700;
  letter-spacing: 0;
}

.surface-body {
  max-width: 62ch;
  margin: 12px 0 0;
  color: var(--text-2);
  font-size: 12.5px;
  line-height: 1.6;
}

.surface-section {
  margin-top: 34px;
}

.surface-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 12px;
}

.surface-section-head h2 {
  margin: 0;
  color: var(--text-1);
  font-size: 14px;
  line-height: 1.2;
  font-weight: 600;
}

.method-map {
  display: grid;
  gap: 1px;
  background: var(--border);
  border-radius: 8px;
  overflow: hidden;
  margin-top: 18px;
}

.method-group {
  background: var(--surface-2);
  padding: 16px;
}

.method-group h4 {
  margin: 8px 0 0;
  color: var(--text-1);
  font-size: 13px;
  line-height: 1.35;
  font-weight: 600;
}

.empty-note {
  display: block;
  margin-top: 11px;
  color: var(--text-3);
  font-size: 12px;
  line-height: 1.5;
}

.surface-tags {
  gap: 7px;
}

.surface-tags.compact {
  margin-top: 12px;
}

.surface-tags span {
  min-height: 25px;
  display: inline-flex;
  align-items: center;
  border-radius: 999px;
  background: var(--mute);
  padding: 0 9px;
  color: var(--text-2);
  font-size: 11.5px;
  line-height: 1;
}

.fit-list {
  display: grid;
  gap: 1px;
  background: var(--border);
  border-radius: 8px;
  overflow: hidden;
  margin-top: 18px;
}

.fit-list div {
  background: var(--surface-2);
  padding: 16px;
}

.fit-list strong {
  display: block;
  margin-top: 8px;
  color: var(--text-1);
  font-size: 13px;
  line-height: 1.35;
}

.fit-list p {
  margin: 8px 0 0;
  color: var(--text-2);
  font-size: 12px;
  line-height: 1.55;
}

.surface-flow {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 1px;
  background: var(--border);
  border-radius: 10px;
  overflow: hidden;
}

.flow-step {
  min-height: 136px;
  background: var(--surface);
  padding: 18px;
}

.flow-step strong {
  display: block;
  margin-top: 22px;
  color: var(--text-0);
  font-size: 14px;
  line-height: 1.25;
}

.flow-step p {
  margin: 8px 0 0;
  color: var(--text-2);
  font-size: 12px;
  line-height: 1.45;
}

.flow-thin strong,
.flow-thin p {
  color: var(--text-3);
}

.surface-link-row {
  gap: 8px;
  margin-top: 14px;
}

@media (max-width: 860px) {
  .surface-wrap {
    padding: 24px 20px 42px;
  }

  .surface-hero {
    grid-template-columns: 1fr;
    gap: 18px;
  }

  .surface-actions {
    justify-content: flex-start;
  }

  .scan-grid,
  .surface-main-grid,
  .source-grid,
  .surface-flow {
    grid-template-columns: 1fr;
  }

  .surface-cell,
  .surface-cell-large,
  .flow-step {
    min-height: auto;
  }
}
`;
