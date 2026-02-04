"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

const PIE_COLORS = ["#3b82f6", "#10b981", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899", "#84cc16"];

interface PieItem {
  name: string;
  value: number;
}

interface ClientsByCitizenshipPieProps {
  data: PieItem[];
  /** Total clients count (active). Percentages are shown relative to this, not to sum of data. */
  totalClients?: number;
}

export function ClientsByCitizenshipPie({ data, totalClients }: ClientsByCitizenshipPieProps) {
  const total = totalClients != null && totalClients > 0 ? totalClients : data.reduce((s, d) => s + d.value, 0);
  const sumWithNationality = data.reduce((s, d) => s + d.value, 0);
  const unknownCount = total > sumWithNationality ? total - sumWithNationality : 0;
  const displayData: PieItem[] =
    unknownCount > 0
      ? [...data, { name: "Unknown", value: unknownCount }]
      : data.length > 0
        ? data
        : [];

  if (displayData.length === 0) return null;

  return (
    <div className="w-full min-h-[280px]">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={displayData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={80}
            paddingAngle={2}
            dataKey="value"
            label={({ name, value }) => {
              const pct = total > 0 ? ((Number(value) / total) * 100).toFixed(0) : "0";
              return `${name} ${pct}%`;
            }}
            labelLine={{ strokeWidth: 1 }}
          >
            {displayData.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => {
              const pct = total > 0 ? ((Number(value) / total) * 100).toFixed(0) : "0";
              return [`${value} (${pct}%)`, "Clients"];
            }}
            contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb" }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
