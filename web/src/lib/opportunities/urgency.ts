export type UrgencyBucket = {
  text: string;
  bg: string;
  dot: string;
  label: string;
};

export function eventUrgency(days: number): UrgencyBucket {
  if (days < 0) {
    return {
      text: "text-text-faint",
      bg: "bg-surface/80",
      dot: "bg-text-faint/50",
      label: "Closed",
    };
  }
  if (days <= 14) {
    return {
      text: "text-red",
      bg: "bg-red/[0.06]",
      dot: "bg-red",
      label: "Soon",
    };
  }
  if (days <= 60) {
    return {
      text: "text-accent",
      bg: "bg-accent-dim",
      dot: "bg-accent",
      label: "Coming up",
    };
  }
  return {
    text: "text-text-muted",
    bg: "bg-surface",
    dot: "bg-text-muted",
    label: "Upcoming",
  };
}

export function jobUrgency(ageInDays: number): UrgencyBucket {
  if (ageInDays <= 7) {
    return {
      text: "text-accent",
      bg: "bg-accent-dim",
      dot: "bg-accent",
      label: "Fresh",
    };
  }
  if (ageInDays <= 30) {
    return {
      text: "text-text-muted",
      bg: "bg-surface",
      dot: "bg-text-muted",
      label: "Recent",
    };
  }
  return {
    text: "text-text-faint",
    bg: "bg-surface/80",
    dot: "bg-text-faint/50",
    label: "Stale",
  };
}
