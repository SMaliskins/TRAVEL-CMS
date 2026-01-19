"use client";

import React from "react";
import { useTabs, Tab } from "@/contexts/TabsContext";

// Icon for different tab types
function TabIcon({ type }: { type: Tab["type"] }) {
  switch (type) {
    case "order":
      return (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      );
    case "directory":
      return (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      );
    case "settings":
      return (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      );
    default:
      return (
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      );
  }
}

export default function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useTabs();

  // Don't render if no tabs
  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 border-b border-gray-200 bg-white px-2 py-1 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        
        return (
          <div
            key={tab.id}
            className={`
              group flex items-center gap-2 rounded-t-md px-3 py-1.5 text-sm font-medium
              cursor-pointer select-none transition-colors min-w-0 max-w-[200px]
              ${isActive
                ? "bg-blue-50 text-blue-700 border-b-2 border-blue-600"
                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }
            `}
            onClick={() => setActiveTab(tab.id)}
          >
            <TabIcon type={tab.type} />
            <span className="truncate">{tab.title}</span>
            
            {/* Close button */}
            <button
              className={`
                ml-1 rounded p-0.5 transition-colors
                ${isActive
                  ? "hover:bg-blue-200 text-blue-600"
                  : "opacity-0 group-hover:opacity-100 hover:bg-gray-200 text-gray-500"
                }
              `}
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
              title="Close tab"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
