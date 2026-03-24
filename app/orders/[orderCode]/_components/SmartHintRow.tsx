"use client";

import React from "react";
import { SmartHint, getHintIcon, getHintColorClass } from "@/lib/itinerary/smartHints";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { t } from "@/lib/i18n";

const NO_INSURANCE_MSG_EN = "No travel insurance! This is recommended for custom travel packages.";
const ADD_INSURANCE_LABEL_EN = "Add Insurance";

interface SmartHintRowProps {
  hint: SmartHint;
  onAction?: (hint: SmartHint) => void;
  onDismiss?: (hintId: string) => void;
  /** Match services table column count so the hint spans the full width */
  tableColSpan?: number;
}

export default function SmartHintRow({ hint, onAction, onDismiss, tableColSpan = 10 }: SmartHintRowProps) {
  const { prefs } = useUserPreferences();
  const lang = prefs.language;
  const colorClass = getHintColorClass(hint.type);
  const icon = getHintIcon(hint.type);
  const message = hint.message === NO_INSURANCE_MSG_EN ? t(lang, "order.noTravelInsurance") : hint.message;
  const actionLabel = hint.action?.label === ADD_INSURANCE_LABEL_EN ? t(lang, "order.addInsurance") : hint.action?.label;

  return (
    <tr>
      <td colSpan={tableColSpan} className="px-0 py-0">
        <div className={`mx-2 my-1 px-3 py-2 rounded-lg border flex items-center justify-between ${colorClass}`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{icon}</span>
            <span className="text-sm font-medium">{message}</span>
          </div>
          
          <div className="flex items-center gap-2">
            {hint.action && onAction && actionLabel && (
              <button
                onClick={() => onAction(hint)}
                className="px-3 py-1 text-xs font-medium rounded bg-white border border-current hover:bg-opacity-80 transition-colors"
              >
                {actionLabel}
              </button>
            )}
            {onDismiss && (
              <button
                onClick={() => onDismiss(hint.id)}
                className="p-1 text-current opacity-60 hover:opacity-100 transition-opacity"
                title="Dismiss"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </td>
    </tr>
  );
}
