"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTabs, Tab } from "@/contexts/TabsContext";

// Tooltip rendered via portal
function TabTooltip({ tab, anchorRect }: { tab: Tab; anchorRect: DOMRect | null }) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted || !anchorRect) return null;
  
  const tooltipContent = (
    <div 
      className="fixed z-[99999] rounded-xl bg-white/95 backdrop-blur-sm border border-gray-200 px-3 py-2.5 text-xs shadow-xl pointer-events-none"
      style={{
        left: anchorRect.left + anchorRect.width / 2,
        top: anchorRect.bottom + 8,
        transform: "translateX(-50%)",
      }}
    >
      {/* Order number */}
      <div className="font-semibold text-gray-900">{tab.title}</div>
      
      {/* Client name */}
      {tab.subtitle && (
        <div className="mt-1.5 flex items-center gap-1.5 text-gray-600">
          <svg className="h-3 w-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          {tab.subtitle}
        </div>
      )}
      
      {/* Dates */}
      {tab.dates && (
        <div className="mt-1 flex items-center gap-1.5 text-gray-500">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {tab.dates}
        </div>
      )}
      
      {/* Arrow */}
      <div 
        className="absolute w-2.5 h-2.5 bg-white border-l border-t border-gray-200 rotate-45"
        style={{ left: "50%", top: -5, transform: "translateX(-50%)" }}
      />
    </div>
  );
  
  return createPortal(tooltipContent, document.body);
}

interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

function TabItem({ tab, isActive, onSelect, onClose }: TabItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const tabRef = useRef<HTMLDivElement>(null);
  
  const handleMouseEnter = () => {
    setIsHovered(true);
    if (tabRef.current) {
      setAnchorRect(tabRef.current.getBoundingClientRect());
    }
  };
  
  const handleMouseLeave = () => {
    setIsHovered(false);
    setAnchorRect(null);
  };

  // Color dot based on type
  const dotColor = {
    order: "bg-blue-500",
    directory: "bg-emerald-500", 
    settings: "bg-purple-500",
    page: "bg-gray-400",
  }[tab.type];
  
  return (
    <div
      ref={tabRef}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className={`
          group flex items-center gap-2 rounded-lg px-3 py-1.5 text-[13px]
          cursor-pointer select-none transition-all duration-200 ease-out
          ${isActive
            ? "bg-white text-gray-900 shadow-sm ring-1 ring-black/5"
            : "text-gray-500 hover:text-gray-700 hover:bg-white/60"
          }
        `}
        onClick={onSelect}
      >
        {/* Color indicator dot */}
        <span className={`w-2 h-2 rounded-full ${dotColor} ${isActive ? "" : "opacity-50"}`} />
        
        {/* Title */}
        <span className={`truncate max-w-[100px] ${isActive ? "font-medium" : ""}`}>
          {tab.title}
        </span>
        
        {/* Close button */}
        <button
          className={`
            rounded-md p-0.5 transition-all duration-150
            ${isActive
              ? "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              : "opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
            }
          `}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          title="Close"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      {/* Tooltip for order tabs */}
      {isHovered && tab.type === "order" && (tab.subtitle || tab.dates) && (
        <TabTooltip tab={tab} anchorRect={anchorRect} />
      )}
    </div>
  );
}

export default function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useTabs();

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="sticky top-14 z-40 flex items-center gap-1 bg-gray-100/80 backdrop-blur-sm px-3 py-2 border-b border-gray-200/50 overflow-x-auto">
      {tabs.map((tab) => (
        <TabItem
          key={tab.id}
          tab={tab}
          isActive={tab.id === activeTabId}
          onSelect={() => setActiveTab(tab.id)}
          onClose={() => closeTab(tab.id)}
        />
      ))}
    </div>
  );
}
