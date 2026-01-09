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
  // Allow display up to 120% for over-achievement
  const displayPercentage = Math.min(percentage, 120);
  const clampedForAngle = Math.min(displayPercentage, 120);

  // Color based on achievement - GREEN ZONE STARTS AT 80%!
  const getGradient = (pct: number): { from: string; to: string; glow: string } => {
    if (pct < 25) return { from: "#ef4444", to: "#dc2626", glow: "#ef4444" }; // red
    if (pct < 50) return { from: "#f97316", to: "#ea580c", glow: "#f97316" }; // orange
    if (pct < 75) return { from: "#eab308", to: "#d97706", glow: "#eab308" }; // yellow
    if (pct < 80) return { from: "#fde047", to: "#facc15", glow: "#fde047" }; // light yellow
    if (pct <= 100) return { from: "#22c55e", to: "#16a34a", glow: "#22c55e" }; // green (80-100%)
    return { from: "#10b981", to: "#059669", glow: "#10b981" }; // emerald for over-achievement (>100%)
  };

  // Angle for speedometer (180 degrees range for 0-120%)
  const startAngle = 0;
  const endAngle = 180;
  const angleRange = endAngle - startAngle;
  const currentAngle = startAngle + (clampedForAngle / 120) * angleRange;

  // Convert angle to radians
  const toRadians = (deg: number) => (deg * Math.PI) / 180;

  // SVG dimensions - 280px
  const size = 280;
  const centerX = size / 2 + 20;
  const centerY = size / 2 + 20;
  const radius = 100;

  // Calculate needle endpoint
  const needleLength = radius * 0.75;
  const needleAngle = startAngle + currentAngle;
  const needleX = centerX + needleLength * Math.cos(toRadians(180 - needleAngle));
  const needleY = centerY - needleLength * Math.sin(toRadians(180 - needleAngle));

  // Generate tick marks
  const tickMarks = [];
  const tickLabels = [0, 25, 50, 80, 100, 120];
  
  for (let i = 0; i <= 12; i++) {
    const tickPct = (i / 12) * 120;
    const tickAngle = startAngle + (tickPct / 120) * angleRange;
    const tickInnerRadius = radius - 5;
    const tickOuterRadius = radius + 5;
    const x1 = centerX + tickInnerRadius * Math.cos(toRadians(180 - tickAngle));
    const y1 = centerY - tickInnerRadius * Math.sin(toRadians(180 - tickAngle));
    const x2 = centerX + tickOuterRadius * Math.cos(toRadians(180 - tickAngle));
    const y2 = centerY - tickOuterRadius * Math.sin(toRadians(180 - tickAngle));

    const isMajor = tickPct === 0 || tickPct === 50 || tickPct === 80 || tickPct === 100 || tickPct === 120;
    
    tickMarks.push(
      <line
        key={`tick-${i}`}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={tickPct === 80 ? "#22c55e" : "#9ca3af"}
        strokeWidth={isMajor ? "2" : "1"}
      />
    );
  }

  // Add labels for key percentages
  tickLabels.forEach((pct) => {
    const tickAngle = startAngle + (pct / 120) * angleRange;
    const labelRadius = radius + 20;
    const labelX = centerX + labelRadius * Math.cos(toRadians(180 - tickAngle));
    const labelY = centerY - labelRadius * Math.sin(toRadians(180 - tickAngle));
    
    tickMarks.push(
      <text
        key={`label-${pct}`}
        x={labelX}
        y={labelY}
        textAnchor="middle"
        className={`text-xs ${pct === 80 ? "fill-green-600 font-semibold" : "fill-gray-500"}`}
        dominantBaseline="middle"
      >
        {pct}%
      </text>
    );
  });

  // Create colored arc segments
  const createArcPath = (startPct: number, endPct: number) => {
    const startA = startAngle + (startPct / 120) * angleRange;
    const endA = startAngle + (endPct / 120) * angleRange;
    const x1 = centerX + radius * Math.cos(toRadians(180 - startA));
    const y1 = centerY - radius * Math.sin(toRadians(180 - startA));
    const x2 = centerX + radius * Math.cos(toRadians(180 - endA));
    const y2 = centerY - radius * Math.sin(toRadians(180 - endA));
    const largeArc = (endPct - startPct) / 120 > 0.5 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  const gradient = getGradient(percentage);

  // Over-achievement message
  const getMotivationalMessage = () => {
    if (percentage >= 100) {
      const overPct = Math.round(percentage - 100);
      return `🎉 +${overPct}% over target!`;
    }
    return message;
  };

  return (
    <div className={`rounded-lg bg-white p-6 shadow-sm ${className}`}>
      <h3 className="mb-4 text-lg font-semibold text-gray-900">Target</h3>
      <div className="flex flex-col items-center">
        <div className="relative" style={{ width: size + 40, height: size * 0.65 + 20 }}>
          <svg width={size + 40} height={size * 0.65 + 20} style={{ filter: `drop-shadow(0 0 8px ${gradient.glow}20)` }}>
            <defs>
              <linearGradient id="speedometerGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={gradient.from} />
                <stop offset="100%" stopColor={gradient.to} />
              </linearGradient>
              <filter id="needleGlow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Background colored zones */}
            <path d={createArcPath(0, 25)} fill="none" stroke="#fecaca" strokeWidth="16" strokeLinecap="butt" />
            <path d={createArcPath(25, 50)} fill="none" stroke="#fed7aa" strokeWidth="16" strokeLinecap="butt" />
            <path d={createArcPath(50, 80)} fill="none" stroke="#fef08a" strokeWidth="16" strokeLinecap="butt" />
            <path d={createArcPath(80, 100)} fill="none" stroke="#bbf7d0" strokeWidth="16" strokeLinecap="butt" />
            <path d={createArcPath(100, 120)} fill="none" stroke="#a7f3d0" strokeWidth="16" strokeLinecap="round" />

            {/* Progress arc */}
            <path
              d={`M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 ${clampedForAngle > 60 ? 1 : 0} 1 ${
                centerX + radius * Math.cos(toRadians(180 - currentAngle))
              } ${centerY - radius * Math.sin(toRadians(180 - currentAngle))}`}
              fill="none"
              stroke="url(#speedometerGradient)"
              strokeWidth="16"
              strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 6px ${gradient.glow}40)` }}
            />

            {/* Special marker at 80% */}
            {(() => {
              const targetAngle = startAngle + (80 / 120) * angleRange;
              const markerRadius = radius + 12;
              const mx = centerX + markerRadius * Math.cos(toRadians(180 - targetAngle));
              const my = centerY - markerRadius * Math.sin(toRadians(180 - targetAngle));
              return <circle cx={mx} cy={my} r="4" fill="#22c55e" stroke="#16a34a" strokeWidth="1" />;
            })()}

            {tickMarks}

            {/* Needle */}
            <line x1={centerX} y1={centerY} x2={needleX} y2={needleY} stroke={gradient.from} strokeWidth="4" strokeLinecap="round" filter="url(#needleGlow)" />
            <circle cx={centerX} cy={centerY} r="8" fill={gradient.from} filter="url(#needleGlow)" />

            {/* Center percentage */}
            <text x={centerX} y={centerY + 35} textAnchor="middle" className={`text-2xl font-bold ${percentage >= 80 ? "fill-green-600" : "fill-gray-900"}`}>
              {percentage.toFixed(0)}%
            </text>
          </svg>
        </div>

        <div className="mt-2 text-center">
          <p className="text-sm text-gray-600">€{current.toLocaleString()} / €{target.toLocaleString()}</p>
          <div className="mt-3 flex items-center justify-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <svg key={star} xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${star <= rating ? "fill-yellow-400 text-yellow-400" : "fill-gray-300 text-gray-300"}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            ))}
          </div>
          <p className={`mt-2 text-sm ${percentage >= 100 ? "text-emerald-600 font-semibold" : "text-gray-600"}`}>{getMotivationalMessage()}</p>
        </div>
      </div>
    </div>
  );
}
