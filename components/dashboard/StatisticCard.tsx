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
      className={`rounded-lg bg-white p-6 shadow-sm ${onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-500">{title}</h3>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {formatValue(value)}
          </p>
          {previousValue !== undefined && (
            <div className="mt-2 space-y-1">
              <p className="text-xs text-gray-500">
                Last year: {formatValue(previousValue)}
              </p>
              {changePercent !== undefined && changePercent !== null && (
                <p className={`text-xs font-medium ${changeDisplay.color}`}>
                  {changeDisplay.text}
                </p>
              )}
            </div>
          )}
        </div>
        {icon && (
          <div className="ml-4 flex-shrink-0 text-gray-400">{icon}</div>
        )}
      </div>
    </div>
  );
}

