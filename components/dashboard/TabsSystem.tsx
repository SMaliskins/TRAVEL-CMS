"use client";

import React, { useState } from "react";

interface Tab {
  id: string;
  label: string;
  content: React.ReactNode;
  closable?: boolean;
}

interface TabsSystemProps {
  tabs: Tab[];
  onTabClose?: (tabId: string) => void;
  className?: string;
}

export default function TabsSystem({
  tabs,
  onTabClose,
  className = "",
}: TabsSystemProps) {
  const [activeTab, setActiveTab] = useState<string>(
    tabs.length > 0 ? tabs[0].id : ""
  );

  const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-white">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
            }`}
          >
            <span>{tab.label}</span>
            {tab.closable && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onTabClose) {
                    onTabClose(tab.id);
                    // Switch to another tab if closing active tab
                    if (activeTab === tab.id) {
                      const remainingTabs = tabs.filter((t) => t.id !== tab.id);
                      if (remainingTabs.length > 0) {
                        setActiveTab(remainingTabs[0].id);
                      }
                    }
                  }
                }}
                className="ml-1 rounded p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                ×
              </button>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 bg-white p-4">{activeTabContent}</div>
    </div>
  );
}

