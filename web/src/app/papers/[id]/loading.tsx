export default function Loading() {
  return (
    <article
      className="mx-auto max-w-[760px] px-4 sm:px-6 py-10 sm:py-14"
      aria-busy="true"
      aria-label="Loading paper"
    >
      <div className="h-3 w-24 rounded-md skeleton-shimmer" />
      <div className="mt-8 h-6 w-[86%] rounded-md skeleton-shimmer" />
      <div className="mt-2.5 h-6 w-[58%] rounded-md skeleton-shimmer" />
      <div className="mt-5 h-3 w-[44%] rounded-md skeleton-shimmer" />
      <div className="mt-10 space-y-2.5">
        <div className="h-3 w-full rounded-md skeleton-shimmer" />
        <div className="h-3 w-[94%] rounded-md skeleton-shimmer" />
        <div className="h-3 w-[72%] rounded-md skeleton-shimmer" />
      </div>
    </article>
  );
}
