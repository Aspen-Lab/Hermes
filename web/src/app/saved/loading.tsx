export default function Loading() {
  return (
    <article
      className="mx-auto max-w-[740px] lg:max-w-[920px] px-6 py-16 lg:py-20"
      aria-busy="true"
      aria-label="Loading saved items"
    >
      <div className="h-3 w-24 rounded-md skeleton-shimmer" />
      <div className="mt-6 h-7 w-[32%] rounded-md skeleton-shimmer" />
      <div className="mt-10 space-y-3.5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-2xl bg-surface shadow-card p-6">
            <div className="h-4 w-[70%] rounded-md skeleton-shimmer" />
            <div className="mt-3 h-3 w-[45%] rounded-md skeleton-shimmer" />
          </div>
        ))}
      </div>
    </article>
  );
}
