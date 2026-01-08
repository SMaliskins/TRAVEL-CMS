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
  // Calculate percentage (can exceed 100% for over-performance)
  const percentage = target > 0 ? (current / target) * 100 : 0;
  const clampedPercentage = Math.min(percentage, 200); // Cap at 200% for display

  // Color based on achievement (red -> orange -> yellow -> green)
  const getColor = (pct: number): string => {
    if (pct < 50) return "#ef4444"; // red
    if (pct < 75) return "#f97316"; // orange
    if (pct < 100) return "#eab308"; // yellow
    return "#10b981"; // green
  };

  // Angle for speedometer (160 degrees range, starting from 10 degrees)
  const startAngle = 10;
  const endAngle = 170;
  const angleRange = endAngle - startAngle;
  const currentAngle =
    startAngle + (clampedPercentage / 200) * angleRange; // Scale to 200%

  // Convert angle to radians
  const toRadians = (deg: number) => (deg * Math.PI) / 180;

  // SVG dimensions
  const size = 200;
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = 80;

  // Calculate needle endpoint
  const needleLength = radius * 0.85;
  const needleX = centerX + needleLength * Math.cos(toRadians(180 - currentAngle));
  const needleY = centerY - needleLength * Math.sin(toRadians(180 - currentAngle));

  // Generate arc path for speedometer background
  const generateArc = (
    startDeg: number,
    endDeg: number,
    innerRadius: number,
    outerRadius: number,
    color: string
  ) => {
    const startRad = toRadians(180 - startDeg);
    const endRad = toRadians(180 - endDeg);
    const x1 = centerX + innerRadius * Math.cos(startRad);
    const y1 = centerY - innerRadius * Math.sin(startRad);
    const x2 = centerX + outerRadius * Math.cos(startRad);
    const y2 = centerY - outerRadius * Math.sin(startRad);
    const x3 = centerX + outerRadius * Math.cos(endRad);
    const y3 = centerY - outerRadius * Math.sin(endRad);
    const x4 = centerX + innerRadius * Math.cos(endRad);
    const y4 = centerY - innerRadius * Math.sin(endRad);

    const largeArc = endDeg - startDeg > 180 ? 1 : 0;

    return (
      <path
        d={`M ${x1} ${y1} L ${x2} ${y2} A ${outerRadius} ${outerRadius} 0 ${largeArc} 0 ${x3} ${y3} L ${x4} ${y4} A ${innerRadius} ${innerRadius} 0 ${largeArc} 1 ${x1} ${y1} Z`}
        fill={color}
      />
    );
  };

  const color = getColor(percentage);

  return (
    <div className={`rounded-lg bg-white p-6 shadow-sm ${className}`}>
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Target</h3>
      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size}>
            {/* Speedometer background arcs */}
            {generateArc(10, 50, 70, 80, "#fee2e2")}
            {generateArc(50, 90, 70, 80, "#fed7aa")}
            {generateArc(90, 130, 70, 80, "#fef08a")}
            {generateArc(130, 170, 70, 80, "#d1fae5")}

            {/* Target line at 160 degrees (for 4500 EUR example) */}
            <line
              x1={centerX + 70 * Math.cos(toRadians(180 - 160))}
              y1={centerY - 70 * Math.sin(toRadians(180 - 160))}
              x2={centerX + 85 * Math.cos(toRadians(180 - 160))}
              y2={centerY - 85 * Math.sin(toRadians(180 - 160))}
              stroke="#6b7280"
              strokeWidth="2"
              strokeDasharray="4 2"
            />

            {/* Needle */}
            <line
              x1={centerX}
              y1={centerY}
              x2={needleX}
              y2={needleY}
              stroke={color}
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx={centerX} cy={centerY} r="6" fill={color} />

            {/* Labels */}
            <text
              x={centerX}
              y={centerY + 20}
              textAnchor="middle"
              className="text-lg font-bold fill-gray-900"
            >
              {percentage.toFixed(0)}%
            </text>
          </svg>
        </div>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-600">
            €{current.toLocaleString()} / €{target.toLocaleString()}
          </p>
          <div className="mt-2 flex items-center justify-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={`text-xl ${star <= rating ? "text-yellow-400" : "text-gray-300"}`}
              >
                ★
              </span>
            ))}
          </div>
          <p className="mt-2 text-sm text-gray-600">{message}</p>
        </div>
      </div>
    </div>
  );
}

