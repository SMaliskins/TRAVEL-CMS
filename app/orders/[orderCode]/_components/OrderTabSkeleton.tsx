"use client";

/**
 * Placeholder while lazy tab chunks load (ORDER_PAGE_PERF_SPEC Step 1).
 */
export default function OrderTabSkeleton() {
  return (
    <div
      className="rounded-lg bg-white p-4 sm:p-6 shadow-sm animate-pulse"
      aria-busy="true"
      aria-label="Loading tab"
    >
      <div className="h-6 w-48 max-w-[60%] bg-gray-200 rounded mb-4" />
      <div className="space-y-3">
        <div className="h-4 bg-gray-100 rounded w-full" />
        <div className="h-4 bg-gray-100 rounded w-[92%]" />
        <div className="h-4 bg-gray-100 rounded w-[80%]" />
      </div>
      <div className="mt-8 h-40 bg-gray-50 rounded-lg border border-gray-100" />
    </div>
  );
}
