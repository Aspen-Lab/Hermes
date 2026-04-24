// GitHub star counter — server component, cached for 1h via revalidate.
// Placed fixed top-right on desktop as a social-proof affordance.

const REPO = "Aspen-Lab/Hermes";
const URL = `https://github.com/${REPO}`;

async function fetchStars(): Promise<number | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}`, {
      next: { revalidate: 3600 },
      headers: { Accept: "application/vnd.github.v3+json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { stargazers_count?: unknown };
    return typeof data.stargazers_count === "number"
      ? data.stargazers_count
      : null;
  } catch {
    return null;
  }
}

function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return Math.round(n / 1000) + "k";
}

export async function GithubStars() {
  const count = await fetchStars();

  return (
    <a
      href={URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={
        count !== null ? `Star Hermes on GitHub — ${count} stars` : "View Hermes on GitHub"
      }
      title={count !== null ? `${count} GitHub stars — click to star` : "View on GitHub"}
      className="group inline-flex items-center gap-1.5 h-8 lg:h-9 pl-2 pr-3 rounded-full bg-surface/95 backdrop-blur shadow-card hover:shadow-card-hover hover:-translate-y-[1px] transition-[transform,box-shadow,background-color] duration-200 ease-out active:scale-95"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      <span className="inline-flex items-center justify-center w-5 h-5 text-heading shrink-0 transition-transform duration-200 ease-out group-hover:rotate-[-6deg]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 .5C5.73.5.75 5.48.75 11.75a11.25 11.25 0 0 0 7.69 10.69c.56.1.76-.24.76-.54v-2.1c-3.13.68-3.79-1.34-3.79-1.34-.51-1.31-1.26-1.66-1.26-1.66-1.03-.7.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.01 1.74 2.66 1.23 3.31.94.1-.73.4-1.23.72-1.51-2.5-.29-5.13-1.25-5.13-5.56 0-1.23.44-2.24 1.16-3.03-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.12 1.16a10.75 10.75 0 0 1 5.68 0c2.17-1.46 3.12-1.16 3.12-1.16.61 1.55.23 2.7.11 2.98.73.79 1.16 1.8 1.16 3.03 0 4.33-2.63 5.26-5.14 5.55.41.35.78 1.04.78 2.1v3.11c0 .3.2.65.77.54A11.26 11.26 0 0 0 23.25 11.75C23.25 5.48 18.27.5 12 .5z" />
        </svg>
      </span>
      <span className="hidden sm:inline text-[11.5px] font-medium text-text-muted group-hover:text-heading transition-colors">
        Star
      </span>
      <span className="inline-flex items-center gap-0.5 text-[12px] tabular-nums text-accent font-semibold">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />
        </svg>
        {count !== null ? formatCount(count) : "—"}
      </span>
    </a>
  );
}
