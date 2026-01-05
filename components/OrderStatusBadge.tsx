"use client";

import { useState, useRef, useEffect } from "react";

type OrderStatus = "Draft" | "Active" | "Cancelled" | "Completed" | "On hold";

interface OrderStatusBadgeProps {
  status: OrderStatus;
  onChange?: (newStatus: OrderStatus) => void;
  readonly?: boolean;
  size?: "sm" | "md";
}

const STATUS_CONFIG: Record<OrderStatus, { 
  color: string; 
  bgColor: string; 
  dotColor: string;
  label: string;
}> = {
  Draft: { 
    color: "text-gray-700", 
    bgColor: "bg-gray-100", 
    dotColor: "bg-gray-400",
    label: "Draft" 
  },
  Active: { 
    color: "text-green-700", 
    bgColor: "bg-green-100", 
    dotColor: "bg-green-500",
    label: "Active" 
  },
  Cancelled: { 
    color: "text-red-700", 
    bgColor: "bg-red-100", 
    dotColor: "bg-red-500",
    label: "Cancelled" 
  },
  Completed: { 
    color: "text-blue-700", 
    bgColor: "bg-blue-100", 
    dotColor: "bg-blue-500",
    label: "Completed" 
  },
  "On hold": { 
    color: "text-yellow-700", 
    bgColor: "bg-yellow-100", 
    dotColor: "bg-yellow-500",
    label: "On hold" 
  },
};

// Statuses that can be manually selected
const SELECTABLE_STATUSES: OrderStatus[] = ["Active", "On hold", "Cancelled"];

export default function OrderStatusBadge({ 
  status, 
  onChange, 
  readonly = false,
  size = "md" 
}: OrderStatusBadgeProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const config = STATUS_CONFIG[status] || STATUS_CONFIG.Active;

  // Close dropdown on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleStatusChange = (newStatus: OrderStatus) => {
    if (onChange) {
      onChange(newStatus);
    }
    setIsOpen(false);
  };

  const sizeClasses = size === "sm" 
    ? "px-2 py-0.5 text-xs" 
    : "px-3 py-1 text-sm";
  
  const dotSize = size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2";

  const badge = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.bgColor} ${config.color} ${sizeClasses} ${!readonly && onChange ? "cursor-pointer hover:opacity-80" : ""}`}
      onClick={!readonly && onChange ? () => setIsOpen(!isOpen) : undefined}
    >
      <span className={`${dotSize} rounded-full ${config.dotColor}`} />
      {config.label}
      {!readonly && onChange && (
        <svg className="h-3 w-3 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      )}
    </span>
  );

  if (readonly || !onChange) {
    return badge;
  }

  return (
    <div ref={containerRef} className="relative inline-block">
      {badge}
      
      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-1 min-w-[120px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
          {SELECTABLE_STATUSES.map((s) => {
            const cfg = STATUS_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${s === status ? "bg-gray-50" : ""}`}
              >
                <span className={`h-2 w-2 rounded-full ${cfg.dotColor}`} />
                <span className={cfg.color}>{cfg.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Determines if an order should be auto-finished based on service dates
 * @param dateTo - The last service date (YYYY-MM-DD format)
 * @returns true if order should be marked as Completed
 */
export function shouldAutoFinish(dateTo: string | null | undefined): boolean {
  if (!dateTo) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const endDate = new Date(dateTo + "T00:00:00");
  return endDate < today;
}

/**
 * Get the effective status considering auto-finish logic
 * @param currentStatus - Current order status
 * @param dateTo - The last service date
 * @returns The effective status to display
 */
export function getEffectiveStatus(
  currentStatus: OrderStatus, 
  dateTo: string | null | undefined
): OrderStatus {
  // Only auto-finish Active orders
  if (currentStatus === "Active" && shouldAutoFinish(dateTo)) {
    return "Completed";
  }
  return currentStatus;
}
