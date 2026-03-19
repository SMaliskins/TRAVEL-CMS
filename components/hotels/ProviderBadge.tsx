"use client";

import type { ProviderName } from "@/lib/providers/types";

const PROVIDER_CONFIG: Record<
  ProviderName,
  { label: string; bg: string; text: string }
> = {
  ratehawk: { label: "RateHawk", bg: "bg-blue-500/15", text: "text-blue-600" },
  goglobal: {
    label: "GoGlobal",
    bg: "bg-emerald-500/15",
    text: "text-emerald-600",
  },
  booking: {
    label: "Booking",
    bg: "bg-[#1e3a5f]/15",
    text: "text-[#1e3a5f]",
  },
};

interface ProviderBadgeProps {
  provider: ProviderName;
  size?: "sm" | "md";
}

export function ProviderBadge({ provider, size = "sm" }: ProviderBadgeProps) {
  const config = PROVIDER_CONFIG[provider] ?? {
    label: provider,
    bg: "bg-gray-100",
    text: "text-gray-600",
  };

  const sizeClasses =
    size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1";

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${config.bg} ${config.text} ${sizeClasses}`}
    >
      {config.label}
    </span>
  );
}
