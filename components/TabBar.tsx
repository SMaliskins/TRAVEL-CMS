"use client";

import React, { useState } from "react";
import { useTabs, Tab } from "@/contexts/TabsContext";

// Color scheme for different tab types
const TAB_COLORS = {
  order: {
    active: "bg-blue-50 text-blue-700 border-blue-500",
    inactive: "text-blue-600 hover:bg-blue-50",
    icon: "text-blue-500",
  },
  directory: {
    active: "bg-emerald-50 text-emerald-700 border-emerald-500",
    inactive: "text-emerald-600 hover:bg-emerald-50",
    icon: "text-emerald-500",
  },
  settings: {
    active: "bg-purple-50 text-purple-700 border-purple-500",
    inactive: "text-purple-600 hover:bg-purple-50",
    icon: "text-purple-500",
  },
  page: {
    active: "bg-gray-100 text-gray-800 border-gray-500",
    inactive: "text-gray-600 hover:bg-gray-100",
    icon: "text-gray-500",
  },
};

// Icon for different tab types
function TabIcon({ type, isActive }: { type: Tab["type"]; isActive: boolean }) {
  const colors = TAB_COLORS[type] || TAB_COLORS.page;
  const colorClass = isActive ? "" : colors.icon;
  
  switch (type) {
    case "order":
      return (
        <svg className={`h-3.5 w-3.5 flex-shrink-0 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case "directory":
      return (
        <svg className={`h-3.5 w-3.5 flex-shrink-0 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case "settings":
      return (
        <svg className={`h-3.5 w-3.5 flex-shrink-0 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    default:
      return (
        <svg className={`h-3.5 w-3.5 flex-shrink-0 ${colorClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
  }
}

export default function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useTabs();
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);

  // Don't render if no tabs
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-0.5 border-b border-gray-200 bg-white px-2 py-1 overflow-x-auto">
      {tabs.map((tab, index) => {
        const isActive = tab.id === activeTabId;
        const isHovered = hoveredTabId === tab.id;
        const colors = TAB_COLORS[tab.type] || TAB_COLORS.page;
        
        return (
          <div
            key={tab.id}
            className="relative"
            onMouseEnter={() => setHoveredTabId(tab.id)}
            onMouseLeave={() => setHoveredTabId(null)}
          >
            <div
              className={`
                group flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium
                cursor-pointer select-none transition-all duration-150
                border
                ${isActive
                  ? `${colors.active} border-current shadow-sm`
                  : `${colors.inactive} border-transparent`
                }
              `}
              onClick={() => setActiveTab(tab.id)}
            >
              <TabIcon type={tab.type} isActive={isActive} />
              <span className="truncate max-w-[100px]">{tab.title}</span>
              
              {/* Close button */}
              <button
                className={`
                  ml-0.5 rounded p-0.5 transition-all flex-shrink-0
                  ${isActive
                    ? "opacity-60 hover:opacity-100 hover:bg-black/10"
                    : "opacity-0 group-hover:opacity-60 hover:opacity-100 hover:bg-black/10"
                  }
                `}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                title="Close tab"
              >
                <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Tooltip on hover - always show for orders */}
            {isHovered && tab.type === "order" && (
              <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-50 whitespace-nowrap rounded-lg bg-gray-900 px-3 py-2 text-xs text-white shadow-xl">
                <div className="font-semibold text-blue-300">{tab.title}</div>
                {tab.subtitle && (
                  <div className="mt-1 text-gray-200">{tab.subtitle}</div>
                )}
                {tab.dates && (
                  <div className="mt-0.5 text-gray-400">{tab.dates}</div>
                )}
                {!tab.subtitle && !tab.dates && (
                  <div className="mt-1 text-gray-400">Order details</div>
                )}
                {/* Arrow */}
                <div className="absolute left-1/2 -translate-x-1/2 -top-1 w-2 h-2 bg-gray-900 rotate-45" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
