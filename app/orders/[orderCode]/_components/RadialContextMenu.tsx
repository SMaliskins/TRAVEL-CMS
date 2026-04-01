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
const SIZE = RADIUS * 2 + 8;
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

export default function RadialContextMenu({ items }: RadialContextMenuProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [hovered, setHovered] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setAnimating(false);
    setTimeout(() => setPos(null), 120);
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

  const segmentAngles: [number, number][] = [
    [270, 360], // top-right
    [0, 90],    // bottom-right
    [90, 180],  // bottom-left
    [180, 270], // top-left
  ];

  const labelOffsets: { dx: number; dy: number }[] = [
    { dx: 34, dy: -34 },
    { dx: 34, dy: 34 },
    { dx: -34, dy: 34 },
    { dx: -34, dy: -34 },
  ];

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
        className="pointer-events-auto drop-shadow-lg"
        style={{
          transform: animating ? "scale(1)" : "scale(0.3)",
          opacity: animating ? 1 : 0,
          transition: "transform 150ms cubic-bezier(.34,1.56,.64,1), opacity 100ms ease-out",
        }}
      >
        {/* background circle */}
        <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="white" fillOpacity={0.95} />
        <circle cx={CENTER} cy={CENTER} r={INNER} fill="white" />

        {items.map((item, i) => {
          const [start, end] = segmentAngles[i];
          const path = describeArc(CENTER, CENTER, RADIUS, INNER, start, end);
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
                fill={isHov ? "#3B82F6" : "white"}
                fillOpacity={isHov ? 1 : 0.97}
                stroke="#E5E7EB"
                strokeWidth={1}
                style={{ transition: "fill 100ms ease, fill-opacity 100ms ease" }}
              />
              <g transform={`translate(${lx}, ${ly})`}>
                <g
                  transform="translate(-8, -14)"
                  style={{ color: isHov ? "white" : "#4B5563", transition: "color 100ms ease" }}
                >
                  {item.icon}
                </g>
                <text
                  textAnchor="middle"
                  y={8}
                  className="select-none"
                  style={{
                    fontSize: 8.5,
                    fontWeight: 600,
                    fill: isHov ? "white" : "#374151",
                    transition: "fill 100ms ease",
                  }}
                >
                  {item.label}
                </text>
              </g>
            </g>
          );
        })}

        {/* divider lines */}
        {[0, 90, 180, 270].map((angle) => {
          const rad = ((angle - 90) * Math.PI) / 180;
          return (
            <line
              key={angle}
              x1={CENTER + INNER * Math.cos(rad)}
              y1={CENTER + INNER * Math.sin(rad)}
              x2={CENTER + RADIUS * Math.cos(rad)}
              y2={CENTER + RADIUS * Math.sin(rad)}
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
