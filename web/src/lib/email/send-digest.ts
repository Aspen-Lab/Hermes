// Sends a digest email via Resend. Server-only.
//
// Uses lazy init — Resend client is created per-call so missing env vars
// surface as a clear error rather than a module-load crash in dev.

import { Resend } from "resend";
import type { ScoredItem } from "@/lib/scoring/types";
import {
  renderDigestHtml,
  renderDigestPlaintext,
  renderDigestSubject,
} from "@/lib/email/digest-template";

export interface SendDigestInput {
  to: string;
  firstName?: string;
  items: ScoredItem[];
  originUrl: string;
}

export interface SendDigestResult {
  sent: boolean;
  messageId?: string;
  error?: string;
}

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

function fromAddress(): string {
  // Resend allows this sender with zero domain setup — great for demo/
  // pre-launch. Swap to your verified domain once DNS is ready.
  return process.env.DIGEST_FROM_EMAIL || "Hermes <onboarding@resend.dev>";
}

export async function sendDigestEmail(
  input: SendDigestInput,
): Promise<SendDigestResult> {
  const client = getClient();
  if (!client) {
    return { sent: false, error: "RESEND_API_KEY not set" };
  }
  try {
    const subject = renderDigestSubject(input.items);
    const html = renderDigestHtml(input);
    const text = renderDigestPlaintext(input);

    const { data, error } = await client.emails.send({
      from: fromAddress(),
      to: [input.to],
      subject,
      html,
      text,
    });

    if (error) {
      return { sent: false, error: error.message || "unknown error" };
    }
    return { sent: true, messageId: data?.id };
  } catch (err) {
    return {
      sent: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
