"use client";

import { useEffect, useRef, useCallback, useState } from "react";

interface RadialMenuItem {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}

interface RadialContextMenuProps {
  items: [RadialMenuItem, RadialMenuItem, RadialMenuItem, RadialMenuItem];
}

const RADIUS = 72;
const INNER = 28;
const GAP = 1.5;
const SIZE = RADIUS * 2 + 16;
const CENTER = SIZE / 2;

function describeArc(
  cx: number, cy: number, outerR: number, innerR: number,
  startAngle: number, endAngle: number
): string {
  const toRad = (a: number) => ((a - 90) * Math.PI) / 180;
  const x1o = cx + outerR * Math.cos(toRad(startAngle));
  const y1o = cy + outerR * Math.sin(toRad(startAngle));
  const x2o = cx + outerR * Math.cos(toRad(endAngle));
  const y2o = cy + outerR * Math.sin(toRad(endAngle));
  const x1i = cx + innerR * Math.cos(toRad(endAngle));
  const y1i = cy + innerR * Math.sin(toRad(endAngle));
  const x2i = cx + innerR * Math.cos(toRad(startAngle));
  const y2i = cy + innerR * Math.sin(toRad(startAngle));
  return [
    `M ${x1o} ${y1o}`,
    `A ${outerR} ${outerR} 0 0 1 ${x2o} ${y2o}`,
    `L ${x1i} ${y1i}`,
    `A ${innerR} ${innerR} 0 0 0 ${x2i} ${y2i}`,
    "Z",
  ].join(" ");
}

const SEGMENTS: [number, number][] = [
  [270, 360],
  [0, 90],
  [90, 180],
  [180, 270],
];

export default function RadialContextMenu({ items }: RadialContextMenuProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setAnimating(false);
    setTimeout(() => setPos(null), 150);
  }, []);

  useEffect(() => {
    const onContext = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      setPos({ x: e.clientX, y: e.clientY });
      setHovered(null);
      requestAnimationFrame(() => setAnimating(true));
    };
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };

    document.addEventListener("contextmenu", onContext);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("contextmenu", onContext);
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [close]);

  if (!pos) return null;

  const clampedX = Math.min(Math.max(pos.x, SIZE / 2 + 4), window.innerWidth - SIZE / 2 - 4);
  const clampedY = Math.min(Math.max(pos.y, SIZE / 2 + 4), window.innerHeight - SIZE / 2 - 4);

  return (
    <div
      ref={menuRef}
      className="fixed z-[99999] pointer-events-none"
      style={{ left: clampedX - SIZE / 2, top: clampedY - SIZE / 2, width: SIZE, height: SIZE }}
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
        className="pointer-events-auto"
        style={{
          filter: "drop-shadow(0 6px 24px rgba(0,0,0,0.1))",
          transform: animating ? "scale(1)" : "scale(0.3)",
          opacity: animating ? 1 : 0,
          transition: "transform 150ms cubic-bezier(.34,1.56,.64,1), opacity 100ms ease-out",
        }}
      >
        <defs>
          <linearGradient id="radial-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#EC4899" />
          </linearGradient>
        </defs>

        <circle cx={CENTER} cy={CENTER} r={RADIUS + 1} fill="#ffffff" stroke="#E5E7EB" strokeWidth={1.5} />
        <circle cx={CENTER} cy={CENTER} r={INNER} fill="#F9FAFB" stroke="#E5E7EB" strokeWidth={0.5} />

        {items.map((item, i) => {
          const [start, end] = SEGMENTS[i];
          const path = describeArc(CENTER, CENTER, RADIUS - GAP, INNER + GAP, start + 1, end - 1);
          const mid = (start + end) / 2;
          const midRad = ((mid - 90) * Math.PI) / 180;
          const labelR = (RADIUS + INNER) / 2;
          const lx = CENTER + labelR * Math.cos(midRad);
          const ly = CENTER + labelR * Math.sin(midRad);
          const isHov = hovered === i;

          return (
            <g
              key={i}
              className="cursor-pointer"
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => { item.onClick(); close(); }}
            >
              <path
                d={path}
                fill={isHov ? "url(#radial-grad)" : "#ffffff"}
                stroke="#E5E7EB"
                strokeWidth={0.5}
                style={{ transition: "fill 120ms ease" }}
              />
              <g transform={`translate(${lx}, ${ly})`}>
                <g
                  transform="translate(-9, -15)"
                  style={{ transition: "color 120ms ease" }}
                >
                  <g style={{ color: isHov ? "#ffffff" : "#6B7280" }}>
                    {item.icon}
                  </g>
                </g>
                <text
                  textAnchor="middle"
                  y={9}
                  className="select-none"
                  style={{
                    fontSize: 8,
                    fontWeight: 600,
                    fill: isHov ? "#ffffff" : "#374151",
                    transition: "fill 120ms ease",
                    letterSpacing: "0.02em",
                  }}
                >
                  {item.label}
                </text>
              </g>
            </g>
          );
        })}

        {[0, 90, 180, 270].map((angle) => {
          const rad = ((angle - 90) * Math.PI) / 180;
          return (
            <line
              key={angle}
              x1={CENTER + (INNER + GAP) * Math.cos(rad)}
              y1={CENTER + (INNER + GAP) * Math.sin(rad)}
              x2={CENTER + (RADIUS - GAP) * Math.cos(rad)}
              y2={CENTER + (RADIUS - GAP) * Math.sin(rad)}
              stroke="#D1D5DB"
              strokeWidth={0.5}
              className="pointer-events-none"
            />
          );
        })}
      </svg>
    </div>
  );
}
