"use client";

import React from "react";
import { SmartHint, getHintIcon, getHintColorClass } from "@/lib/itinerary/smartHints";

interface SmartHintRowProps {
  hint: SmartHint;
  onAction?: (hint: SmartHint) => void;
  onDismiss?: (hintId: string) => void;
}

export default function SmartHintRow({ hint, onAction, onDismiss }: SmartHintRowProps) {
  const colorClass = getHintColorClass(hint.type);
  const icon = getHintIcon(hint.type);

  return (
    <tr>
      <td colSpan={10} className="px-0 py-0">
        <div className={`mx-2 my-1 px-3 py-2 rounded-lg border flex items-center justify-between ${colorClass}`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{icon}</span>
            <span className="text-sm font-medium">{hint.message}</span>
          </div>
          
          <div className="flex items-center gap-2">
            {hint.action && onAction && (
              <button
                onClick={() => onAction(hint)}
                className="px-3 py-1 text-xs font-medium rounded bg-white border border-current hover:bg-opacity-80 transition-colors"
              >
                {hint.action.label}
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
