"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTabs, Tab } from "@/contexts/TabsContext";
import { supabase } from "@/lib/supabaseClient";
import { slugToOrderCode } from "@/lib/orders/orderCode";

interface OrderPreviewData {
  client: string;
  dates: string;
  status: string;
  amount: number;
  services: number;
  destinations: string;
}

// Cache for order previews
const previewCache = new Map<string, OrderPreviewData>();

// Fetch order preview data (accepts slug, converts to order_code for API)
async function fetchOrderPreview(orderSlug: string): Promise<OrderPreviewData | null> {
  // Check cache first
  if (previewCache.has(orderSlug)) {
    return previewCache.get(orderSlug)!;
  }
  
  // Convert slug to order_code format for API (0008-26-sm -> 0008/26-SM)
  const orderCode = slugToOrderCode(orderSlug);
  
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}`, {
      headers: session?.access_token 
        ? { Authorization: `Bearer ${session.access_token}` }
        : {},
      credentials: "include",
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const order = data.order;
    
    if (!order) return null;
    
    const preview: OrderPreviewData = {
      client: order.client_display_name || order.clientDisplayName || "—",
      dates: order.date_from && order.date_to 
        ? `${formatDate(order.date_from)} - ${formatDate(order.date_to)}`
        : "—",
      status: order.status || "Draft",
      amount: order.amount_total || 0,
      services: data.services?.length || 0,
      destinations: order.countries_cities || "—",
    };
    
    // Cache it by slug
    previewCache.set(orderSlug, preview);
    
    return preview;
  } catch (e) {
    console.error("Failed to fetch order preview:", e);
    return null;
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getFullYear()}`;
}

function formatCurrency(amount: number): string {
  return `€${amount.toLocaleString()}`;
}

// Status badge colors
function getStatusColor(status: string): string {
  switch (status) {
    case "Active": return "bg-green-100 text-green-700";
    case "Completed": return "bg-blue-100 text-blue-700";
    case "Cancelled": return "bg-red-100 text-red-700";
    case "On hold": return "bg-yellow-100 text-yellow-700";
    default: return "bg-gray-100 text-gray-700";
  }
}

// Order Preview Tooltip
function OrderPreview({ orderSlug, anchorRect }: { orderSlug: string; anchorRect: DOMRect | null }) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OrderPreviewData | null>(null);
  
  // Convert slug to display format
  const displayCode = slugToOrderCode(orderSlug);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  useEffect(() => {
    if (!mounted) return;
    
    // Delay fetch to avoid unnecessary requests on quick hover
    const timer = setTimeout(async () => {
      const preview = await fetchOrderPreview(orderSlug);
      setData(preview);
      setLoading(false);
    }, 200);
    
    return () => clearTimeout(timer);
  }, [mounted, orderSlug]);
  
  if (!mounted || !anchorRect) return null;
  
  const content = (
    <div 
      className="fixed z-[99999] w-72 rounded-xl bg-white border border-gray-200 shadow-2xl pointer-events-none overflow-hidden"
      style={{
        left: Math.min(anchorRect.left, window.innerWidth - 300),
        top: anchorRect.bottom + 8,
      }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-4 py-3">
        <div className="text-white font-semibold">{displayCode}</div>
      </div>
      
      {/* Content */}
      <div className="p-4">
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : data ? (
          <div className="space-y-3">
            {/* Client */}
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-sm text-gray-800 font-medium">{data.client}</span>
            </div>
            
            {/* Dates */}
            <div className="flex items-start gap-2">
              <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span className="text-sm text-gray-600">{data.dates}</span>
            </div>
            
            {/* Destinations */}
            {data.destinations !== "—" && (
              <div className="flex items-start gap-2">
                <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-sm text-gray-600 line-clamp-2">{data.destinations}</span>
              </div>
            )}
            
            {/* Footer row */}
            <div className="flex items-center justify-between pt-2 border-t border-gray-100">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${getStatusColor(data.status)}`}>
                {data.status}
              </span>
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-500">{data.services} services</span>
                <span className="font-semibold text-gray-900">{formatCurrency(data.amount)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500 text-sm">
            Unable to load preview
          </div>
        )}
      </div>
      
      {/* Arrow */}
      <div 
        className="absolute w-3 h-3 bg-white border-l border-t border-gray-200 rotate-45"
        style={{ left: 24, top: -6 }}
      />
    </div>
  );
  
  return createPortal(content, document.body);
}

interface TabItemProps {
  tab: Tab;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
}

function TabItem({ tab, isActive, onSelect, onClose }: TabItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const tabRef = useRef<HTMLDivElement>(null);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const handleMouseEnter = () => {
    setIsHovered(true);
    if (tabRef.current) {
      setAnchorRect(tabRef.current.getBoundingClientRect());
    }
    
    // Show preview after delay
    if (tab.type === "order") {
      hoverTimerRef.current = setTimeout(() => {
        setShowPreview(true);
      }, 400);
    }
  };
  
  const handleMouseLeave = () => {
    setIsHovered(false);
    setShowPreview(false);
    setAnchorRect(null);
    
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
    }
  };

  // Extract slug from path for API (e.g., "/orders/0008-26-sm" -> "0008-26-sm")
  const orderSlug = tab.type === "order" 
    ? tab.path.replace("/orders/", "")
    : "";

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
          group flex items-center gap-2 px-3 py-2 text-[13px]
          cursor-pointer select-none transition-all duration-200 ease-out rounded-t-lg
          ${isActive
            ? "bg-white text-gray-900 relative z-10 border-t border-l border-r border-gray-200 pb-[9px] -mb-[1px]"
            : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50 mb-0"
          }
        `}
        onClick={onSelect}
      >
        {/* Color indicator dot */}
        <span className={`w-2 h-2 rounded-full ${dotColor} ${isActive ? "" : "opacity-50"}`} />
        
        {/* Title */}
        <span className={`truncate max-w-[120px] ${isActive ? "font-medium" : ""}`}>
          {tab.title}
        </span>
        
        {/* Close button */}
        <button
          className={`
            rounded p-0.5 transition-all duration-150 ml-1
            ${isActive
              ? "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              : "opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 hover:bg-gray-200"
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
      
      {/* Order Preview on hover - only for inactive tabs */}
      {showPreview && !isActive && tab.type === "order" && orderSlug && (
        <OrderPreview orderSlug={orderSlug} anchorRect={anchorRect} />
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
    <div className="sticky top-14 z-40 flex items-end gap-0.5 bg-gray-100 px-3 pt-2 border-b border-gray-200 overflow-x-auto">
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
