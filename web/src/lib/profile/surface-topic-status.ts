import type { SurfaceTopics } from "@/types";

export interface SurfaceTopicStatus {
  differs: boolean;
  activeSummary: string;
  pendingSummary: string;
}

function sameTopics(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((topic, index) => topic === right[index])
  );
}

function summarize(topics: SurfaceTopics): string {
  const values = [
    ...topics.required,
    ...topics.explore.map((topic) => `${topic} (Explore)`),
  ];
  return values.length > 0 ? values.join(" · ") : "None";
}

export function surfaceTopicStatus(
  active: SurfaceTopics,
  pending: SurfaceTopics,
): SurfaceTopicStatus {
  return {
    differs:
      !sameTopics(active.required, pending.required) ||
      !sameTopics(active.explore, pending.explore),
    activeSummary: summarize(active),
    pendingSummary: summarize(pending),
  };
}
