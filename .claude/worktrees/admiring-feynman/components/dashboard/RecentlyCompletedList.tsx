"use client";

import React from "react";
import type { TouristLocation } from "./TouristsMap";

interface RecentlyCompletedListProps {
  travelers: TouristLocation[];
  className?: string;
}

export default function RecentlyCompletedList({
  travelers,
  className = "",
}: RecentlyCompletedListProps) {
  // Filter: completed + last 7 days
  const recentlyCompleted = travelers.filter((t) => {
    if (t.status !== "completed" || !t.completedAt) return false;
    const completedDate = new Date(t.completedAt);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return completedDate >= oneWeekAgo;
  });

  // Sort by completion date (newest first)
  recentlyCompleted.sort((a, b) => {
    const dateA = new Date(a.completedAt!).getTime();
    const dateB = new Date(b.completedAt!).getTime();
    return dateB - dateA;
  });

  // Format "X days ago"
  const formatDaysAgo = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "today";
    if (diffDays === 1) return "1 day ago";
    return `${diffDays} days ago`;
  };

  if (recentlyCompleted.length === 0) {
    return (
      <div className={`booking-glass-panel !p-6 ${className}`}>
        <h3 className="mb-6 text-xl font-bold text-gray-900 tracking-tight">
          📋 Recently Completed (Follow-up)
        </h3>
        <div className="flex h-32 items-center justify-center text-gray-500">
          No recently completed trips
        </div>
      </div>
    );
  }

  return (
    <div className={`booking-glass-panel !p-6 ${className}`}>
      <h3 className="mb-6 text-xl font-bold text-gray-900 tracking-tight">
        📋 Recently Completed (Follow-up)
      </h3>
      <div className="space-y-3">
        {recentlyCompleted.map((traveler) => (
          <div
            key={traveler.id}
            className="border-l-4 border-orange-500 bg-orange-50 p-4 rounded-r-lg hover:bg-orange-100 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-semibold text-gray-900">
                  {traveler.name}
                  {traveler.destination && (
                    <span className="text-gray-600 font-normal"> - {traveler.destination}</span>
                  )}
                </p>
                <div className="mt-1 flex items-center gap-3 text-sm text-gray-600">
                  <span>✓ Completed: {formatDaysAgo(traveler.completedAt!)}</span>
                  {traveler.orderCode && (
                    <>
                      <span className="text-gray-400">|</span>
                      <span>{traveler.orderCode}</span>
                    </>
                  )}
                </div>
              </div>
              {/* Optional: Follow-up action buttons (can be implemented later) */}
              {/* <div className="ml-4 flex gap-2">
                <button className="text-xs px-3 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200">
                  📞 Follow-up
                </button>
                <button className="text-xs px-3 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200">
                  ✓ Done
                </button>
              </div> */}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
