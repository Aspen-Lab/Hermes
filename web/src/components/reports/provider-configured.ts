import type { UserProfile } from "@/types";

type ProviderProfile = Pick<
  UserProfile,
  "feedAiProvider" | "feedAiApiKey"
>;

/**
 * Client-safe provider seam for report UI. The server's provider registry stays
 * behind API routes; a report only needs to know whether this user selected a
 * concrete provider and supplied its key.
 */
export function reportProviderConfigured(profile: ProviderProfile): boolean {
  return (
    profile.feedAiProvider !== "default" &&
    Boolean(profile.feedAiApiKey?.trim())
  );
}
