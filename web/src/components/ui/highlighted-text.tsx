import { cn } from "@/lib/cn";
import { highlightSegments } from "@/lib/jobs/summarize";

export function HighlightedText({
  text,
  terms,
  className,
}: {
  text: string;
  terms: string[];
  className?: string;
}) {
  const segments = highlightSegments(text, terms);

  return (
    <span className={className}>
      {segments.map((segment, index) => (
        <span
          key={`${segment.matched ? "match" : "text"}-${index}`}
          className={cn(
            segment.matched && "box-decoration-clone rounded-sm bg-accent-dim px-0.5 text-text",
          )}
        >
          {segment.text}
        </span>
      ))}
    </span>
  );
}
