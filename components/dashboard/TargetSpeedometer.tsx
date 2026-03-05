"use client";

import React from "react";

interface TargetSpeedometerProps {
  current: number;
  target: number;
  rating?: number; // 1-5
  message?: string;
  className?: string;
}

export default function TargetSpeedometer({
  current,
  target,
  rating = 3,
  message = "Keep pushing forward!",
  className = "",
}: TargetSpeedometerProps) {
  // Calculate percentage
  const percentage = target > 0 ? (current / target) * 100 : 0;
  const displayPercentage = Math.min(percentage, 100); // For the bar width

  // Determine color based on progress
  const getColor = (pct: number) => {
    if (pct < 25) return "from-red-500 to-red-600";
    if (pct < 50) return "from-orange-500 to-orange-600";
    if (pct < 75) return "from-yellow-400 to-amber-500";
    if (pct < 100) return "from-blue-400 to-blue-600";
    return "from-emerald-400 to-emerald-600";
  };

  const getMotivationalMessage = () => {
    if (percentage >= 100) {
      const overPct = Math.round(percentage - 100);
      return `🎉 +${overPct}% over target!`;
    }
    return message;
  };

  const barColor = getColor(percentage);

  return (
    <div className={`booking-glass-panel p-5 flex flex-col justify-between h-full ${className}`}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Monthly Target</h3>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <svg key={star} xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "fill-gray-200 text-gray-200"}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          ))}
        </div>
      </div>

      <div className="mt-1 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-gray-900">€{current.toLocaleString()}</span>
        <span className="text-xs font-medium text-gray-500">/ €{target.toLocaleString()}</span>
      </div>

      <div className="mt-4 w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
        <div
          className={`h-2.5 rounded-full bg-gradient-to-r ${barColor} shadow-inner transition-all duration-1000 ease-out`}
          style={{ width: `${displayPercentage}%` }}
        />
      </div>

      <div className="mt-3 flex justify-between items-center text-xs">
        <span className="font-semibold text-gray-700">{Math.round(percentage)}% achieved</span>
        <span className={`font-medium ${percentage >= 100 ? "text-emerald-600" : "text-gray-500"}`}>
          {getMotivationalMessage()}
        </span>
      </div>
    </div>
  );
}
