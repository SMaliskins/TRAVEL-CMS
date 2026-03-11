"use client";

import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Calendar } from "lucide-react";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { t } from "@/lib/i18n";

export type CardPeriodType = "inherit" | "currentMonth" | "lastMonth" | "last3Months" | "last6Months" | "lastYear" | "allTime";

const CARD_PERIODS: CardPeriodType[] = [
  "inherit", "currentMonth", "lastMonth", "last3Months", "last6Months", "lastYear", "allTime"
];

interface StatisticCardProps {
  title: string;
  value: string | number;
  previousValue?: string | number;
  changePercent?: number;
  icon?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  cardPeriod?: CardPeriodType;
  onCardPeriodChange?: (period: CardPeriodType) => void;
}

export default function StatisticCard({
  title,
  value,
  previousValue,
  changePercent,
  icon,
  onClick,
  className = "",
  cardPeriod,
  onCardPeriodChange,
}: StatisticCardProps) {
  const { prefs } = useUserPreferences();
  const lang = prefs.language;
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const getPeriodLabel = (p: CardPeriodType): string => {
    if (p === "inherit") return t(lang, "dashboard.sameAsDashboard");
    if (p === "allTime") return t(lang, "period.allTime");
    return t(lang, `period.${p}`);
  };

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
      className={`booking-glass-panel !p-5 !overflow-visible ${onClick ? "cursor-pointer" : ""} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">{title}</h3>
          </div>
          {onCardPeriodChange && (
            <div className="relative mt-0.5" ref={dropdownRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-blue-500 transition-colors"
              >
                <Calendar size={9} />
                <span className={cardPeriod && cardPeriod !== "inherit" ? "text-blue-500 font-medium" : ""}>
                  {getPeriodLabel(cardPeriod || "inherit")}
                </span>
                <ChevronDown size={8} />
              </button>
              {isOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-50 min-w-[160px]">
                  {CARD_PERIODS.map(p => (
                    <button
                      key={p}
                      onClick={(e) => {
                        e.stopPropagation();
                        onCardPeriodChange(p);
                        setIsOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 transition-colors ${
                        (cardPeriod || "inherit") === p ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-700"
                      }`}
                    >
                      {getPeriodLabel(p)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
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
