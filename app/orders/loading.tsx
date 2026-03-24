export default function OrdersLoading() {
  return (
    <div className="theme-page-bg p-3 sm:p-4">
      <div className="mx-auto max-w-[1800px] space-y-2">
        <div className="theme-panel-bg pb-2 -mb-2 pt-3 sm:pt-4 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-20 bg-gray-200 rounded-md animate-pulse" />
          </div>
          <div className="flex gap-2 flex-wrap">
            <div className="h-8 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-28 bg-gray-200 rounded animate-pulse" />
            <div className="h-8 w-20 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
        <div className="rounded-lg theme-card-bg shadow-sm overflow-hidden">
          <div className="h-10 bg-gray-100 border-b border-gray-200" />
          <div className="divide-y divide-gray-200">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-3 py-2">
                <div className="h-4 w-20 bg-gray-200 rounded animate-pulse shrink-0" />
                <div className="h-4 flex-1 max-w-[200px] bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-24 bg-gray-100 rounded animate-pulse shrink-0" />
                <div className="h-4 w-16 bg-gray-200 rounded animate-pulse shrink-0" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
