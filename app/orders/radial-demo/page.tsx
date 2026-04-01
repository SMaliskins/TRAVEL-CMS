"use client";

import { useState } from "react";

const ITEMS = [
  { label: "+Service", icon: "plus-circle" },
  { label: "+Payment", icon: "credit-card" },
  { label: "Documents", icon: "file-text" },
  { label: "Finance", icon: "dollar" },
] as const;

function Icon({ name, size = 18, color = "currentColor" }: { name: string; size?: number; color?: string }) {
  const p = { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (name) {
    case "plus-circle": return <svg {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>;
    case "credit-card": return <svg {...p}><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>;
    case "file-text": return <svg {...p}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
    case "dollar": return <svg {...p}><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>;
    default: return null;
  }
}

function describeArc(cx: number, cy: number, outerR: number, innerR: number, startAngle: number, endAngle: number): string {
  const toRad = (a: number) => ((a - 90) * Math.PI) / 180;
  const x1o = cx + outerR * Math.cos(toRad(startAngle));
  const y1o = cy + outerR * Math.sin(toRad(startAngle));
  const x2o = cx + outerR * Math.cos(toRad(endAngle));
  const y2o = cy + outerR * Math.sin(toRad(endAngle));
  const x1i = cx + innerR * Math.cos(toRad(endAngle));
  const y1i = cy + innerR * Math.sin(toRad(endAngle));
  const x2i = cx + innerR * Math.cos(toRad(startAngle));
  const y2i = cy + innerR * Math.sin(toRad(startAngle));
  return `M ${x1o} ${y1o} A ${outerR} ${outerR} 0 0 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${innerR} ${innerR} 0 0 0 ${x2i} ${y2i} Z`;
}

const SEGMENTS: [number, number][] = [[270, 360], [0, 90], [90, 180], [180, 270]];

interface Theme {
  name: string;
  bg: string;
  hoverBg: string;
  stroke: string;
  divider: string;
  text: string;
  hoverText: string;
  iconColor: string;
  hoverIcon: string;
  centerFill: string;
  outerRadius: number;
  innerRadius: number;
  gap: number;
  shadow: string;
  borderRadius?: string;
  centerIcon?: boolean;
  gradient?: boolean;
}

const THEMES: Theme[] = [
  {
    name: "V1 — Glassmorphism",
    bg: "rgba(255,255,255,0.7)",
    hoverBg: "#3B82F6",
    stroke: "rgba(255,255,255,0.4)",
    divider: "rgba(200,200,220,0.4)",
    text: "#475569",
    hoverText: "#ffffff",
    iconColor: "#64748B",
    hoverIcon: "#ffffff",
    centerFill: "rgba(255,255,255,0.9)",
    outerRadius: 76,
    innerRadius: 26,
    gap: 2,
    shadow: "drop-shadow(0 8px 32px rgba(0,0,0,0.12)) drop-shadow(0 2px 8px rgba(0,0,0,0.08))",
    centerIcon: true,
  },
  {
    name: "V2 — Dark Mode",
    bg: "#1E293B",
    hoverBg: "#6366F1",
    stroke: "#334155",
    divider: "#334155",
    text: "#94A3B8",
    hoverText: "#ffffff",
    iconColor: "#64748B",
    hoverIcon: "#E0E7FF",
    centerFill: "#0F172A",
    outerRadius: 74,
    innerRadius: 24,
    gap: 2.5,
    shadow: "drop-shadow(0 8px 32px rgba(0,0,0,0.4))",
    centerIcon: true,
  },
  {
    name: "V3 — Soft Pastel",
    bg: "#F8FAFC",
    hoverBg: "#E0F2FE",
    stroke: "#E2E8F0",
    divider: "#E2E8F0",
    text: "#475569",
    hoverText: "#0369A1",
    iconColor: "#94A3B8",
    hoverIcon: "#0284C7",
    centerFill: "#ffffff",
    outerRadius: 78,
    innerRadius: 30,
    gap: 3,
    shadow: "drop-shadow(0 4px 16px rgba(0,0,0,0.06))",
  },
  {
    name: "V4 — Gradient Ring",
    bg: "#ffffff",
    hoverBg: "url(#grad4)",
    stroke: "#E5E7EB",
    divider: "#D1D5DB",
    text: "#374151",
    hoverText: "#ffffff",
    iconColor: "#6B7280",
    hoverIcon: "#ffffff",
    centerFill: "#F9FAFB",
    outerRadius: 72,
    innerRadius: 28,
    gap: 1.5,
    shadow: "drop-shadow(0 6px 24px rgba(0,0,0,0.1))",
    gradient: true,
  },
  {
    name: "V5 — Outlined Minimal",
    bg: "transparent",
    hoverBg: "#F1F5F9",
    stroke: "#CBD5E1",
    divider: "#CBD5E1",
    text: "#334155",
    hoverText: "#0F172A",
    iconColor: "#64748B",
    hoverIcon: "#1E40AF",
    centerFill: "#ffffff",
    outerRadius: 70,
    innerRadius: 22,
    gap: 0,
    shadow: "drop-shadow(0 2px 8px rgba(0,0,0,0.06))",
  },
  {
    name: "V6 — Neon Glow",
    bg: "#0F172A",
    hoverBg: "#7C3AED",
    stroke: "#1E293B",
    divider: "rgba(124,58,237,0.3)",
    text: "#A78BFA",
    hoverText: "#F5F3FF",
    iconColor: "#7C3AED",
    hoverIcon: "#F5F3FF",
    centerFill: "#020617",
    outerRadius: 74,
    innerRadius: 26,
    gap: 2,
    shadow: "drop-shadow(0 0 20px rgba(124,58,237,0.3)) drop-shadow(0 4px 16px rgba(0,0,0,0.4))",
    centerIcon: true,
  },
  {
    name: "V7 — Apple-style",
    bg: "rgba(255,255,255,0.92)",
    hoverBg: "rgba(0,122,255,0.12)",
    stroke: "rgba(0,0,0,0.06)",
    divider: "rgba(0,0,0,0.08)",
    text: "#1D1D1F",
    hoverText: "#007AFF",
    iconColor: "#86868B",
    hoverIcon: "#007AFF",
    centerFill: "rgba(255,255,255,0.96)",
    outerRadius: 80,
    innerRadius: 32,
    gap: 1,
    shadow: "drop-shadow(0 10px 40px rgba(0,0,0,0.12)) drop-shadow(0 2px 4px rgba(0,0,0,0.04))",
  },
  {
    name: "V8 — Warm Sunset",
    bg: "#FFF7ED",
    hoverBg: "#F97316",
    stroke: "#FED7AA",
    divider: "#FDBA74",
    text: "#9A3412",
    hoverText: "#ffffff",
    iconColor: "#EA580C",
    hoverIcon: "#ffffff",
    centerFill: "#FFFBEB",
    outerRadius: 76,
    innerRadius: 28,
    gap: 2,
    shadow: "drop-shadow(0 8px 24px rgba(249,115,22,0.15)) drop-shadow(0 2px 8px rgba(0,0,0,0.06))",
    centerIcon: true,
  },
];

function RadialVariant({ theme, hovered, setHovered }: { theme: Theme; hovered: number | null; setHovered: (i: number | null) => void }) {
  const { outerRadius: R, innerRadius: INNER, gap } = theme;
  const SIZE = R * 2 + 16;
  const C = SIZE / 2;

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} style={{ filter: theme.shadow }}>
      {theme.gradient && (
        <defs>
          <linearGradient id="grad4" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
        </defs>
      )}
      <circle cx={C} cy={C} r={R + 1} fill={theme.bg === "transparent" ? "white" : theme.bg} stroke={theme.stroke} strokeWidth={1.5} />
      <circle cx={C} cy={C} r={INNER} fill={theme.centerFill} stroke={theme.stroke} strokeWidth={0.5} />

      {ITEMS.map((item, i) => {
        const [start, end] = SEGMENTS[i];
        const path = describeArc(C, C, R - gap, INNER + gap, start + (gap ? 1 : 0), end - (gap ? 1 : 0));
        const mid = (start + end) / 2;
        const midRad = ((mid - 90) * Math.PI) / 180;
        const labelR = (R + INNER) / 2;
        const lx = C + labelR * Math.cos(midRad);
        const ly = C + labelR * Math.sin(midRad);
        const isHov = hovered === i;

        return (
          <g key={i} className="cursor-pointer" onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}>
            <path
              d={path}
              fill={isHov ? (theme.gradient ? "url(#grad4)" : theme.hoverBg) : (theme.bg === "transparent" ? "transparent" : theme.bg)}
              stroke={theme.stroke}
              strokeWidth={0.5}
              style={{ transition: "fill 120ms ease" }}
            />
            <g transform={`translate(${lx}, ${ly})`}>
              <g transform="translate(-9, -15)" style={{ transition: "color 120ms ease" }}>
                <Icon name={item.icon} size={18} color={isHov ? theme.hoverIcon : theme.iconColor} />
              </g>
              <text textAnchor="middle" y={10} className="select-none" style={{ fontSize: 8, fontWeight: 600, fill: isHov ? theme.hoverText : theme.text, transition: "fill 120ms ease", letterSpacing: "0.02em" }}>
                {item.label}
              </text>
            </g>
          </g>
        );
      })}

      {[0, 90, 180, 270].map((angle) => {
        const rad = ((angle - 90) * Math.PI) / 180;
        return (
          <line key={angle} x1={C + (INNER + gap) * Math.cos(rad)} y1={C + (INNER + gap) * Math.sin(rad)} x2={C + (R - gap) * Math.cos(rad)} y2={C + (R - gap) * Math.sin(rad)} stroke={theme.divider} strokeWidth={0.5} className="pointer-events-none" />
        );
      })}

      {theme.centerIcon && (
        <g transform={`translate(${C}, ${C})`}>
          <circle r={6} fill="none" stroke={theme.iconColor} strokeWidth={1} opacity={0.3} />
          <line x1="-3" y1="0" x2="3" y2="0" stroke={theme.iconColor} strokeWidth={1.2} opacity={0.4} />
          <line x1="0" y1="-3" x2="0" y2="3" stroke={theme.iconColor} strokeWidth={1.2} opacity={0.4} />
        </g>
      )}
    </svg>
  );
}

export default function RadialDemoPage() {
  const [hovers, setHovers] = useState<Record<number, number | null>>({});

  return (
    <div className="min-h-screen bg-gray-100 py-10 px-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-2 text-center">Radial Context Menu — Pick a Variant</h1>
      <p className="text-sm text-gray-500 mb-8 text-center">Hover over segments to see the highlight effect. Right-click menu on the order page will use the chosen style.</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
        {THEMES.map((theme, idx) => (
          <div key={idx} className="flex flex-col items-center gap-3">
            <div className={`rounded-2xl p-6 flex items-center justify-center ${theme.bg === "#0F172A" || theme.bg === "#1E293B" ? "bg-slate-900" : "bg-white"} shadow-sm border border-gray-200`} style={{ minHeight: 220 }}>
              <RadialVariant theme={theme} hovered={hovers[idx] ?? null} setHovered={(v) => setHovers(prev => ({ ...prev, [idx]: v }))} />
            </div>
            <span className="text-sm font-semibold text-gray-700">{theme.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
