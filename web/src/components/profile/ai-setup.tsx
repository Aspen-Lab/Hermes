"use client";

// Shared AI-provider setup used by BOTH the feed command bar (`/`) and the
// onboarding wizard (`/welcome`). Keeping the provider list here means adding a
// provider (e.g. DeepSeek) lights it up in both places at once.

import { useState } from "react";
import type { UserAiProvider } from "@/types";
import { SecretInput } from "@/components/ui";

export const FEED_AI_PROVIDER_OPTIONS: { value: UserAiProvider; label: string }[] = [
  { value: "default", label: "Peer default (site setup) — no API key" },
  { value: "openai", label: "OpenAI / ChatGPT" },
  { value: "gemini", label: "Google Gemini API" },
  { value: "anthropic", label: "Anthropic / Claude" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "qwen", label: "Alibaba Qwen / DashScope" },
];

/** Short label for the inline tool pill on the feed command bar. */
export function providerShortLabel(p: UserAiProvider): string {
  switch (p) {
    case "openai":
      return "OpenAI";
    case "gemini":
      return "Gemini";
    case "anthropic":
      return "Claude";
    case "qwen":
      return "Qwen";
    case "deepseek":
      return "DeepSeek";
    default:
      return "AI key";
  }
}

export function providerKeyPlaceholder(p: UserAiProvider): string {
  switch (p) {
    case "openai":
      return "OpenAI API key";
    case "gemini":
      return "Gemini API key";
    case "qwen":
      return "Qwen / DashScope API key";
    case "deepseek":
      return "DeepSeek API key";
    case "anthropic":
      return "Anthropic API key";
    default:
      return "API key";
  }
}

/**
 * The provider <select> + conditional API-key <input>. The one piece of AI
 * setup that must look and behave identically on the feed and in onboarding.
 */
export function AiKeyFields({
  provider,
  apiKey,
  onProviderChange,
  onApiKeyChange,
  idPrefix = "ai",
}: {
  provider: UserAiProvider;
  apiKey: string;
  onProviderChange: (p: UserAiProvider) => void;
  onApiKeyChange: (key: string) => void;
  idPrefix?: string;
}) {
  return (
    <>
      <div className="space-y-1.5">
        <label
          htmlFor={`${idPrefix}-provider`}
          className="block text-micro font-semibold uppercase tracking-[0.14em] text-text-faint"
        >
          AI company
        </label>
        <select
          id={`${idPrefix}-provider`}
          value={provider}
          onChange={(e) => onProviderChange(e.target.value as UserAiProvider)}
          className="w-full rounded-lg bg-bg-secondary/45 px-3 py-2 text-meta text-text focus:outline-none focus:ring-2 focus:ring-accent/20"
        >
          {FEED_AI_PROVIDER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {provider !== "default" && (
        <div className="space-y-1.5">
          <label
            htmlFor={`${idPrefix}-key`}
            className="block text-micro font-semibold uppercase tracking-[0.14em] text-text-faint"
          >
            API key
          </label>
          <SecretInput
            id={`${idPrefix}-key`}
            value={apiKey}
            onChange={onApiKeyChange}
            placeholder={providerKeyPlaceholder(provider)}
          />
        </div>
      )}
    </>
  );
}

/**
 * "What is an API key?" helper for non-technical users. Collapsed by default so
 * the setup page stays calm; the explainer video only mounts (and only starts
 * loading) once expanded, so it never slows first paint.
 */
export function ApiKeyHelp() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl bg-bg-secondary/35 shadow-[inset_0_0_0_1px_rgba(20,20,20,0.05)] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-meta font-medium text-text-muted hover:text-heading transition-colors"
      >
        <span className="inline-flex items-center gap-2">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="12" cy="12" r="10" />
            <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
          New to API keys? How this works
        </span>
        <svg
          width="11"
          height="11"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className={`opacity-60 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
          <p className="text-meta leading-relaxed text-text-muted">
            An API key is like a credit card from an AI company that lets Peer
            use their AI on your behalf — you pay only for what you use, measured
            in &ldquo;tokens&rdquo; (chunks of text). It usually costs a few cents
            for a day of briefings.
          </p>
          <p className="text-meta leading-relaxed text-text-muted">
            Cheap, capable options to start with:{" "}
            <span className="text-heading font-medium">GPT-4o mini</span>,{" "}
            <span className="text-heading font-medium">Gemini 2.5 Flash</span>,{" "}
            <span className="text-heading font-medium">DeepSeek</span>, or{" "}
            <span className="text-heading font-medium">Claude Haiku</span>.
          </p>

          {/* 16:9 responsive embed — privacy-friendly nocookie host, lazy, starts
              at the timestamp the founder picked. Only rendered when expanded. */}
          <div className="relative w-full overflow-hidden rounded-lg bg-black/80" style={{ paddingTop: "56.25%" }}>
            <iframe
              className="absolute inset-0 h-full w-full"
              src="https://www.youtube-nocookie.com/embed/sNn23dPRUS8?start=103"
              title="What is an API key?"
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>

          <p className="text-caption leading-relaxed text-text-faint">
            You can skip this for now and add a key anytime in your profile.
          </p>
        </div>
      )}
    </div>
  );
}
