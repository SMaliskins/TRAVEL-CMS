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
  const clampedPercentage = Math.min(percentage, 100); // Cap at 100% for display

  // Color based on achievement with gradient
  const getGradient = (pct: number): { from: string; to: string; glow: string } => {
    if (pct < 50) return { from: "#ef4444", to: "#dc2626", glow: "#ef4444" }; // red gradient
    if (pct < 75) return { from: "#f97316", to: "#ea580c", glow: "#f97316" }; // orange gradient
    if (pct < 100) return { from: "#eab308", to: "#ca8a04", glow: "#eab308" }; // yellow gradient
    return { from: "#10b981", to: "#059669", glow: "#10b981" }; // green gradient
  };

  // Angle for speedometer (180 degrees range, starting from 0 degrees on the left)
  const startAngle = 0;
  const endAngle = 180;
  const angleRange = endAngle - startAngle;
  const currentAngle = startAngle + (clampedPercentage / 100) * angleRange;

  // Convert angle to radians
  const toRadians = (deg: number) => (deg * Math.PI) / 180;

  // SVG dimensions - INCREASED to 280px
  const size = 280;
  const centerX = size / 2 + 20; // Offset for labels
  const centerY = size / 2 + 20; // Slightly offset down
  const radius = 100;

  // Calculate needle endpoint
  const needleLength = radius * 0.75;
  const needleAngle = startAngle + currentAngle;
  const needleX = centerX + needleLength * Math.cos(toRadians(180 - needleAngle));
  const needleY = centerY - needleLength * Math.sin(toRadians(180 - needleAngle));

  // Generate tick marks (11 ticks: 0%, 10%, 20%, ..., 100%)
  const tickMarks = [];
  for (let i = 0; i <= 10; i++) {
    const tickAngle = startAngle + (i / 10) * angleRange;
    const tickInnerRadius = radius - 5;
    const tickOuterRadius = radius + 5;
    const x1 = centerX + tickInnerRadius * Math.cos(toRadians(180 - tickAngle));
    const y1 = centerY - tickInnerRadius * Math.sin(toRadians(180 - tickAngle));
    const x2 = centerX + tickOuterRadius * Math.cos(toRadians(180 - tickAngle));
    const y2 = centerY - tickOuterRadius * Math.sin(toRadians(180 - tickAngle));

    tickMarks.push(
      <line
        key={`tick-${i}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="#9ca3af"
        strokeWidth={i % 5 === 0 ? "2" : "1"}
      />
    );

    // Add percentage labels for major ticks (0%, 50%, 100%)
    if (i % 5 === 0) {
      const labelRadius = radius + 20;
      const labelX = centerX + labelRadius * Math.cos(toRadians(180 - tickAngle));
      const labelY = centerY - labelRadius * Math.sin(toRadians(180 - tickAngle));
      tickMarks.push(
        <text
          key={`label-${i}`}
          x={labelX}
          y={labelY}
          textAnchor="middle"
          className="text-xs fill-gray-500"
          dominantBaseline="middle"
        >
          {i * 10}%
        </text>
      );
    }
  }

  const gradient = getGradient(percentage);

  return (
    <div className={`rounded-lg bg-white p-6 shadow-sm ${className}`}>
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Target</h3>
      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: size + 40, height: size * 0.65 + 20 }}>
          <svg width={size + 40} height={size * 0.65 + 20} style={{ filter: `drop-shadow(0 0 8px ${gradient.glow}20)` }}>
            <defs>
              {/* Gradient for speedometer arc */}
              <linearGradient id="speedometerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={gradient.from} />
                <stop offset="100%" stopColor={gradient.to} />
              </linearGradient>
              {/* Glow filter for needle */}
              <filter id="needleGlow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Background arc (gray) */}
            <path
              d={`M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="16"
              strokeLinecap="round"
            />

            {/* Progress arc (gradient with glow) */}
            <path
              d={`M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 ${clampedPercentage > 50 ? 1 : 0} 1 ${
                centerX + radius * Math.cos(toRadians(180 - currentAngle))
              } ${centerY - radius * Math.sin(toRadians(180 - currentAngle))}`}
              fill="none"
              stroke="url(#speedometerGradient)"
              strokeWidth="16"
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 6px ${gradient.glow}40)` }}
            />

            {/* Tick marks */}
            {tickMarks}

            {/* Needle with glow */}
            <line
              x1={centerX}
              y1={centerY}
              x2={needleX}
              y2={needleY}
              stroke={gradient.from}
              strokeWidth="4"
              strokeLinecap="round"
              filter="url(#needleGlow)"
            />
            <circle cx={centerX} cy={centerY} r="8" fill={gradient.from} filter="url(#needleGlow)" />

            {/* Center percentage text */}
            <text
              x={centerX}
              y={centerY + 35}
              textAnchor="middle"
              className="text-2xl font-bold fill-gray-900"
            >
              {percentage.toFixed(0)}%
            </text>
          </svg>
        </div>

        <div className="mt-2 text-center">
          <p className="text-sm text-gray-600">
            €{current.toLocaleString()} / €{target.toLocaleString()}
          </p>
          <div className="mt-3 flex items-center justify-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <svg
                key={star}
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "fill-gray-300 text-gray-300"}`}
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                />
              </svg>
            ))}
          </div>
          <p className="mt-2 text-sm text-gray-600">{message}</p>
        </div>
      </div>
    </div>
  );
}

