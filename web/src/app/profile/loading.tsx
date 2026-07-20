export default function Loading() {
  return (
    <article
      className="mx-auto max-w-[740px] lg:max-w-[820px] px-6 py-16 lg:py-20"
      aria-busy="true"
      aria-label="Loading profile"
    >
      <div className="h-3 w-24 rounded-md skeleton-shimmer" />
      <div className="mt-6 h-7 w-[40%] rounded-md skeleton-shimmer" />
      <div className="mt-10 rounded-2xl bg-surface shadow-card p-6">
        <div className="h-3 w-32 rounded-md skeleton-shimmer" />
        <div className="mt-4 space-y-2.5">
          <div className="h-3 w-full rounded-md skeleton-shimmer" />
          <div className="h-3 w-[80%] rounded-md skeleton-shimmer" />
        </div>
      </div>
    </article>
  );
}
