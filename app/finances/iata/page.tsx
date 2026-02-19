"use client";

export default function IATAPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">IATA</h1>
        <p className="text-sm text-gray-600 mt-1">IATA BSP settlements</p>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <div className="text-4xl mb-4">✈️</div>
        <h2 className="text-lg font-semibold text-gray-700 mb-2">Coming Soon</h2>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          IATA BSP settlement reports and reconciliation will be available here.
          This section will allow you to track airline ticket sales, settlements,
          and commission reports.
        </p>
      </div>
    </div>
  );
}
