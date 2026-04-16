"use client";

import React, { useState } from "react";
import { ChevronDown, Users, Building2 } from "lucide-react";

export interface AgentTarget {
  id: string;
  name: string;
  profit: number;
  /** Personal monthly profit target for this agent. 0 = not set → falls back to `target` prop. */
  target?: number;
}

interface TargetSpeedometerProps {
  current: number;
  target: number;
  vat?: number;
  label?: string;
  message?: string;
  className?: string;
  agents?: AgentTarget[];
  showAgentSelector?: boolean;
}

export default function TargetSpeedometer({
  current,
  target,
  vat,
  label = "Target",
  message = "Keep pushing forward!",
  className = "",
  agents,
  showAgentSelector = false,
}: TargetSpeedometerProps) {
  const [view, setView] = useState<"company" | "agents" | string>("company");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isAgentView = view !== "company" && view !== "agents";
  const selectedAgent = isAgentView ? agents?.find((a) => a.id === view) : null;

  const displayCurrent = selectedAgent ? selectedAgent.profit : current;
  // Per-agent target overrides company target when this agent has a personal one set (> 0).
  const effectiveTarget = selectedAgent && selectedAgent.target && selectedAgent.target > 0
    ? selectedAgent.target
    : target;
  const percentage = effectiveTarget > 0 ? (displayCurrent / effectiveTarget) * 100 : 0;
  const displayPercentage = Math.min(percentage, 100);

  const stars = effectiveTarget > 0
    ? Math.min(5, Math.max(0, Math.ceil(percentage / 20)))
    : 0;

  const getColor = (pct: number) => {
    if (pct < 25) return "from-red-500 to-red-600";
    if (pct < 50) return "from-orange-500 to-orange-600";
    if (pct < 75) return "from-yellow-400 to-amber-500";
    if (pct < 100) return "from-blue-400 to-blue-600";
    return "from-emerald-400 to-emerald-600";
  };

  const getMotivationalMessage = () => {
    if (effectiveTarget <= 0) {
      return selectedAgent ? "No personal target set" : "Set target in Settings";
    }
    if (percentage >= 100) {
      return `+${Math.round(percentage - 100)}% over target!`;
    }
    return message;
  };

  const barColor = getColor(percentage);
  const viewLabel = view === "company"
    ? "Company"
    : view === "agents"
      ? "All Agents"
      : selectedAgent?.name || "Agent";

  return (
    <div className={`booking-glass-panel p-5 flex flex-col justify-between h-full ${className}`}>
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{label}</h3>
          {showAgentSelector && agents && agents.length > 0 && (
            <div className="relative mt-0.5">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-blue-500 transition-colors"
              >
                {view === "company" ? <Building2 size={9} /> : <Users size={9} />}
                <span className={view !== "company" ? "text-blue-500 font-medium" : ""}>
                  {viewLabel}
                </span>
                <ChevronDown size={8} />
              </button>
              {dropdownOpen && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl py-1 z-50 min-w-[180px] max-h-[240px] overflow-y-auto">
                  <button
                    onClick={() => { setView("company"); setDropdownOpen(false); }}
                    className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 flex items-center gap-2 ${view === "company" ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-700"}`}
                  >
                    <Building2 size={11} /> Company Total
                  </button>
                  <button
                    onClick={() => { setView("agents"); setDropdownOpen(false); }}
                    className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 flex items-center gap-2 ${view === "agents" ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-700"}`}
                  >
                    <Users size={11} /> All Agents
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  {agents.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => { setView(a.id); setDropdownOpen(false); }}
                      className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 ${view === a.id ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-700"}`}
                    >
                      {a.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {effectiveTarget > 0 && view !== "agents" && (
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <svg key={s} xmlns="http://www.w3.org/2000/svg" className={`h-3 w-3 ${s <= stars ? "fill-yellow-400 text-yellow-400" : "fill-gray-200 text-gray-200"}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            ))}
          </div>
        )}
      </div>

      {view === "agents" ? (
        <div className="flex-1 overflow-y-auto -mx-1 mt-1" style={{ maxHeight: "140px" }}>
          {agents!.map((a) => {
            const agentTarget = a.target && a.target > 0 ? a.target : target;
            const agentPct = agentTarget > 0 ? (a.profit / agentTarget) * 100 : 0;
            const agentBarPct = Math.min(agentPct, 100);
            const agentColor = getColor(agentPct);
            return (
              <button
                key={a.id}
                onClick={() => setView(a.id)}
                className="w-full px-2 py-1 hover:bg-gray-50 rounded text-left"
              >
                <div className="flex justify-between items-baseline text-[11px]">
                  <span className="font-medium text-gray-700 truncate mr-2">{a.name}</span>
                  <span className="text-gray-500 flex-shrink-0">
                    €{a.profit.toLocaleString()} <span className="text-gray-400">({Math.round(agentPct)}%)</span>
                  </span>
                </div>
                <div className="mt-0.5 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full bg-gradient-to-r ${agentColor} transition-all duration-500`}
                    style={{ width: `${agentBarPct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className="mt-1">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">€{displayCurrent.toLocaleString()}</span>
              <span className="text-xs font-medium text-gray-500">/ €{effectiveTarget.toLocaleString()}</span>
            </div>
            {vat !== undefined && vat > 0 && !isAgentView && (
              <div className="mt-0.5 text-xs text-gray-500">
                excl. VAT: €{vat.toLocaleString()}
              </div>
            )}
          </div>

          <div className="mt-4 w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-2.5 rounded-full bg-gradient-to-r ${barColor} shadow-inner transition-all duration-1000 ease-out`}
              style={{ width: `${displayPercentage}%` }}
            />
          </div>

          <div className="mt-3 flex justify-between items-center text-xs">
            <span className="font-semibold text-gray-700">{Math.round(percentage)}% achieved</span>
            <span className={`font-medium ${percentage >= 100 ? "text-emerald-600" : "text-gray-500"}`}>
              {getMotivationalMessage()}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
