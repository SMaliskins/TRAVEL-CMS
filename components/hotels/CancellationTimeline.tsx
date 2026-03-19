"use client";

import { useMemo } from "react";
import { Shield, ShieldAlert, ShieldX } from "lucide-react";
import type { CancellationPolicy } from "@/lib/providers/types";

interface CancellationTimelineProps {
  cancellationType: "free" | "partial" | "non_refundable";
  freeCancellationBefore: string | null;
  policies: CancellationPolicy[];
  checkIn: string;
}

export function CancellationTimeline({
  cancellationType,
  freeCancellationBefore,
  policies,
  checkIn,
}: CancellationTimelineProps) {
  const segments = useMemo(() => {
    if (cancellationType === "non_refundable") {
      return [
        {
          color: "bg-red-400",
          label: "Non-refundable",
          icon: ShieldX,
          flex: 1,
          date: null,
          penalty: null,
        },
      ];
    }

    const result: {
      color: string;
      label: string;
      icon: typeof Shield;
      flex: number;
      date: string | null;
      penalty: string | null;
    }[] = [];

    if (freeCancellationBefore) {
      result.push({
        color: "bg-emerald-400",
        label: "Free cancellation",
        icon: Shield,
        flex: 2,
        date: formatShort(freeCancellationBefore),
        penalty: null,
      });
    }

    if (policies.length > 0) {
      for (const p of policies) {
        const penaltyText = p.isPercentage
          ? `${p.amount}%`
          : `${p.currency} ${p.amount}`;
        result.push({
          color: "bg-amber-400",
          label: `Penalty: ${penaltyText}`,
          icon: ShieldAlert,
          flex: 1,
          date: formatShort(p.from),
          penalty: penaltyText,
        });
      }
    }

    result.push({
      color: "bg-red-400",
      label: "Non-refundable",
      icon: ShieldX,
      flex: 1,
      date: formatShort(checkIn),
      penalty: null,
    });

    return result;
  }, [cancellationType, freeCancellationBefore, policies, checkIn]);

  return (
    <div className="space-y-2">
      <div className="flex gap-0.5 h-2 rounded-full overflow-hidden">
        {segments.map((seg, i) => (
          <div
            key={i}
            className={`${seg.color} transition-all`}
            style={{ flex: seg.flex }}
          />
        ))}
      </div>
      <div className="flex gap-3 flex-wrap">
        {segments.map((seg, i) => {
          const Icon = seg.icon;
          return (
            <div key={i} className="flex items-center gap-1.5 text-xs text-slate-600">
              <Icon className="w-3.5 h-3.5" />
              <span>{seg.label}</span>
              {seg.date && (
                <span className="text-slate-400">({seg.date})</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatShort(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}`;
  } catch {
    return dateStr;
  }
}
