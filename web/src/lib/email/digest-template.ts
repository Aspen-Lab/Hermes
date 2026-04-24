// Digest email template. Server-only — emits HTML + plaintext for Resend.
//
// Kept table-based, inline-styled, 600px max width. Email clients (Gmail
// especially) strip <style> and modern CSS; tables + inline styles are
// the boring path that renders everywhere.

import type { ScoredItem } from "@/lib/scoring/types";

// Brand palette — mirrors the web app.
const BRAND = {
  bg: "#F5EDD7",
  surface: "#FFFFFF",
  ink: "#1C1A16",
  muted: "#6B6358",
  faint: "#9A9286",
  accent: "#F58414",
  border: "#E3D9BF",
};

function esc(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(s: string | undefined | null, n: number): string {
  if (!s) return "";
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function itemHref(id: string, originUrl: string): string {
  // Each source has a prefixed id like `arxiv:2401.12345`. The briefing
  // detail page handles decoding.
  return `${originUrl}/papers/${encodeURIComponent(id)}`;
}

export interface DigestTemplateInput {
  firstName?: string;
  items: ScoredItem[];
  originUrl: string; // e.g. https://hermes-flax-six.vercel.app
}

export function renderDigestSubject(items: ScoredItem[]): string {
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  if (items.length === 0) return `Your Hermes briefing · ${dateStr}`;
  const lead = truncate(items[0].title, 50);
  return `${lead} · Hermes briefing ${dateStr}`;
}

export function renderDigestPlaintext(input: DigestTemplateInput): string {
  const { firstName, items, originUrl } = input;
  const greet = firstName ? `Hi ${firstName},` : "Hi,";
  const today = formatDate(new Date());
  const lines: string[] = [
    `HERMES BRIEFING — ${today}`,
    "",
    greet,
    "",
    `Here are ${items.length} items worth your attention today.`,
    "",
  ];
  items.forEach((item, idx) => {
    lines.push(`${idx + 1}. ${item.title}`);
    if (item.authors && item.authors.length > 0) {
      lines.push(`   ${item.authors.slice(0, 3).join(", ")}${item.authors.length > 3 ? " et al." : ""}`);
    }
    if (item.venue) lines.push(`   ${item.venue}`);
    if (item.relevanceReason) lines.push(`   Why: ${truncate(item.relevanceReason, 180)}`);
    lines.push(`   ${itemHref(item.id, originUrl)}`);
    lines.push("");
  });
  lines.push("—");
  lines.push(`Read in browser: ${originUrl}`);
  lines.push(`Adjust or turn off this digest: ${originUrl}/profile`);
  return lines.join("\n");
}

function renderItemRow(item: ScoredItem, originUrl: string): string {
  const href = itemHref(item.id, originUrl);
  const authors =
    item.authors && item.authors.length > 0
      ? esc(
          item.authors.slice(0, 3).join(", ") +
            (item.authors.length > 3 ? " et al." : ""),
        )
      : "";
  const venue = esc(item.venue || "");
  const reason = esc(truncate(item.relevanceReason, 200));
  const matchPct =
    typeof item.score === "number" ? Math.round(item.score * 100) : null;

  return `
<tr>
  <td style="padding: 18px 24px; border-bottom: 1px solid ${BRAND.border};">
    <a href="${esc(href)}" style="color: ${BRAND.ink}; text-decoration: none; display: block;">
      <div style="font-family: Georgia, 'Source Serif 4', serif; font-size: 17px; line-height: 1.35; font-weight: 600; color: ${BRAND.ink}; margin-bottom: 6px;">
        ${esc(truncate(item.title, 140))}
      </div>
    </a>
    ${
      authors || venue
        ? `<div style="font-family: -apple-system, 'Segoe UI', sans-serif; font-size: 12px; color: ${BRAND.muted}; margin-bottom: 8px;">
        ${authors}${authors && venue ? ' <span style="color: ' + BRAND.faint + ';">·</span> ' : ""}<span style="color: ${BRAND.faint};">${venue}</span>
      </div>`
        : ""
    }
    ${
      reason
        ? `<div style="font-family: -apple-system, 'Segoe UI', sans-serif; font-size: 13px; line-height: 1.5; color: ${BRAND.muted};">
        ${reason}
      </div>`
        : ""
    }
    <div style="margin-top: 10px; font-family: -apple-system, 'Segoe UI', sans-serif; font-size: 11px; color: ${BRAND.faint}; letter-spacing: 0.04em; text-transform: uppercase;">
      <a href="${esc(href)}" style="color: ${BRAND.accent}; text-decoration: none; font-weight: 600;">Read briefing →</a>
      ${matchPct !== null ? `<span style="color: ${BRAND.faint}; margin-left: 12px;">${matchPct}% match</span>` : ""}
    </div>
  </td>
</tr>`;
}

export function renderDigestHtml(input: DigestTemplateInput): string {
  const { firstName, items, originUrl } = input;
  const greet = firstName ? `Hi ${esc(firstName)},` : "Hi,";
  const today = formatDate(new Date());

  const rows = items.map((i) => renderItemRow(i, originUrl)).join("");

  const empty =
    items.length === 0
      ? `<tr><td style="padding: 30px 24px; text-align: center; font-family: -apple-system, sans-serif; color: ${BRAND.muted}; font-size: 14px;">No items matched your topics today. Try adjusting your <a href="${originUrl}/profile" style="color: ${BRAND.accent};">signals</a>.</td></tr>`
      : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Hermes briefing</title>
</head>
<body style="margin: 0; padding: 0; background: ${BRAND.bg};">
<!-- Preheader (hidden, shown in inbox preview) -->
<div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">
${esc(items[0]?.title ?? "Your daily Hermes briefing")} — ${items.length} items picked for you
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: ${BRAND.bg};">
  <tr>
    <td align="center" style="padding: 40px 16px;">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background: ${BRAND.surface}; border-radius: 16px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">

        <!-- Header -->
        <tr>
          <td style="padding: 28px 24px 20px;">
            <div style="font-family: -apple-system, 'Segoe UI', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.2em; color: ${BRAND.accent}; text-transform: uppercase; margin-bottom: 8px;">
              HERMES · ${esc(today.toUpperCase())}
            </div>
            <div style="font-family: Georgia, 'Instrument Serif', serif; font-size: 28px; line-height: 1.15; color: ${BRAND.ink}; font-weight: 600; letter-spacing: -0.01em;">
              ${greet} <span style="font-style: italic; color: ${BRAND.muted};">here's what you missed</span>.
            </div>
            <div style="font-family: -apple-system, sans-serif; font-size: 13px; color: ${BRAND.muted}; margin-top: 10px;">
              ${items.length} items, picked from your sources and ranked against your topics.
            </div>
          </td>
        </tr>

        <!-- Divider -->
        <tr><td style="border-top: 1px solid ${BRAND.border}; font-size: 0; line-height: 0;">&nbsp;</td></tr>

        <!-- Items -->
        ${rows}
        ${empty}

        <!-- Footer -->
        <tr>
          <td style="padding: 24px; background: ${BRAND.bg};">
            <div style="font-family: -apple-system, sans-serif; font-size: 12px; color: ${BRAND.muted}; line-height: 1.6;">
              <a href="${originUrl}" style="color: ${BRAND.ink}; text-decoration: underline;">Open in browser</a>
              &nbsp;·&nbsp;
              <a href="${originUrl}/profile" style="color: ${BRAND.ink}; text-decoration: underline;">Edit signals or pause digest</a>
            </div>
            <div style="font-family: -apple-system, sans-serif; font-size: 11px; color: ${BRAND.faint}; margin-top: 12px; line-height: 1.5;">
              You're receiving this because you enabled daily digests in Hermes. Change preferences or unsubscribe at <a href="${originUrl}/profile" style="color: ${BRAND.faint};">${originUrl}/profile</a>.
            </div>
          </td>
        </tr>

      </table>

    </td>
  </tr>
</table>
</body>
</html>`;
}
