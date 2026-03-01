"use client";

import React from "react";

interface StatisticCardProps {
  title: string;
  value: string | number;
  previousValue?: string | number;
  changePercent?: number;
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export default function StatisticCard({
  title,
  value,
  previousValue,
  changePercent,
  icon,
  onClick,
  className = "",
}: StatisticCardProps) {
  const formatValue = (val: string | number): string => {
    if (typeof val === "number") {
      return val.toLocaleString("en-US");
    }
    return val;
  };

  const formatChange = (percent?: number): { text: string; color: string } => {
    if (percent === undefined || percent === null) {
      return { text: "", color: "" };
    }

    const isPositive = percent > 0;
    const sign = isPositive ? "+" : "";
    return {
      text: `${sign}${percent.toFixed(1)}%`,
      color: isPositive ? "text-green-600" : "text-red-600",
    };
  };

  const changeDisplay = formatChange(changePercent);

  return (
    <div
      className={`booking-glass-panel !p-5 ${onClick ? "cursor-pointer" : ""} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">{title}</h3>
          <p className="mt-1 text-3xl font-black text-gray-900">
            {formatValue(value)}
          </p>
          {previousValue !== undefined && (
            <div className="mt-2 space-y-1">
              <p className="text-xs font-medium text-gray-500">
                Last year: <span className="text-gray-700">{formatValue(previousValue)}</span>
              </p>
              {changePercent !== undefined && changePercent !== null && (
                <div className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${changeDisplay.color} ${changeDisplay.color.includes('green') ? 'bg-green-50' : 'bg-red-50'}`}>
                  {changeDisplay.text}
                </div>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className="ml-3 flex-shrink-0 h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-100 shadow-inner text-indigo-500">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

