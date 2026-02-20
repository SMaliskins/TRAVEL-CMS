"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useSidebar, type SidebarMode } from "@/hooks/useSidebar";
import {
  LayoutDashboard,
  ClipboardList,
  Wallet,
  FileText,
  CreditCard,
  TrendingUp,
  Plane,
  RefreshCcw,
  BarChart3,
  Users,
  Settings,
} from "lucide-react";

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  children?: NavItem[];
}

type NavElement = NavItem;

const ICON_SIZE = 20;
const ICON_STROKE = 1.6;

const navConfig: NavElement[] = [
  { name: "Dashboard", href: "/dashboard", icon: <LayoutDashboard size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  { name: "Orders", href: "/orders", icon: <ClipboardList size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  {
    name: "Finances",
    href: "/finances/invoices",
    icon: <Wallet size={ICON_SIZE} strokeWidth={ICON_STROKE} />,
    children: [
      { name: "Invoices", href: "/finances/invoices", icon: <FileText size={18} strokeWidth={ICON_STROKE} /> },
      { name: "Payments", href: "/finances/payments", icon: <CreditCard size={18} strokeWidth={ICON_STROKE} /> },
      { name: "Cash Flow", href: "/finances/cashflow", icon: <TrendingUp size={18} strokeWidth={ICON_STROKE} /> },
      { name: "IATA", href: "/finances/iata", icon: <Plane size={18} strokeWidth={ICON_STROKE} /> },
      { name: "Reconciliation", href: "/finances/reconciliation", icon: <RefreshCcw size={18} strokeWidth={ICON_STROKE} /> },
    ],
  },
  { name: "Analytics", href: "/analytics/orders", icon: <BarChart3 size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
  { name: "Directory", href: "/directory", icon: <Users size={ICON_SIZE} strokeWidth={ICON_STROKE} /> },
];

const modeLabels: Record<SidebarMode, string> = {
  expanded: "Expanded",
  collapsed: "Collapsed",
  hover: "Expand on hover",
};

export default function Sidebar() {
  const pathname = usePathname();
  const {
    mode,
    setMode,
    isExpanded,
    isCollapsed,
    isHovered,
    setIsHovered,
    overlayEnabled,
    railWidth,
    expandedWidth,
    isMobileMenuOpen,
    setIsMobileMenuOpen,
    isClient,
  } = useSidebar();

  const [isDesktop, setIsDesktop] = useState(true);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [directoryPopoverOpen, setDirectoryPopoverOpen] = useState(false);
  const [directoryPopoverPosition, setDirectoryPopoverPosition] = useState<{ top: number } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const directoryButtonRef = useRef<HTMLButtonElement>(null);
  const directoryPopoverRef = useRef<HTMLDivElement>(null);

  // All useEffect hooks must be declared before any early returns
  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    
    checkScreenSize();
    window.addEventListener("resize", checkScreenSize);
    return () => window.removeEventListener("resize", checkScreenSize);
  }, []);

  // Close popover on click outside or Escape
  useEffect(() => {
    if (!isPopoverOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        buttonRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsPopoverOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPopoverOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isPopoverOpen]);

  // Close Directory popover on click outside or Escape
  useEffect(() => {
    if (!directoryPopoverOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (
        directoryPopoverRef.current &&
        directoryButtonRef.current &&
        !directoryPopoverRef.current.contains(event.target as Node) &&
        !directoryButtonRef.current.contains(event.target as Node)
      ) {
        setDirectoryPopoverOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDirectoryPopoverOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [directoryPopoverOpen]);

  // Close Directory popover when sidebar expands
  useEffect(() => {
    if (!isCollapsed && directoryPopoverOpen) {
      setDirectoryPopoverOpen(false);
    }
  }, [isCollapsed, directoryPopoverOpen]);

  // Helper function to check if item with children should be active
  const isParentActive = (item: NavItem): boolean => {
    if (item.children) {
      return item.children.some(
        child => pathname === child.href || pathname?.startsWith(child.href + "/")
      );
    }
    return pathname === item.href || pathname?.startsWith(item.href + "/");
  };

  // Helper function to render navigation items
  const renderNavItems = (options: { showTooltip?: boolean; onItemClick?: () => void }) => {
    const { showTooltip = false, onItemClick } = options;
    return navConfig.map((item, idx) => {
      const hasChildren = item.children && item.children.length > 0;
      const isActive = hasChildren
        ? isParentActive(item)
        : pathname === item.href || pathname?.startsWith(item.href + "/");

      // Render item with children
      if (hasChildren && item.children) {
        if (showTooltip) {
          // Collapsed mode: show only icon, navigate to parent page on click
          return (
            <li key={item.href} className="relative">
              <Link
                href={item.href}
                onClick={onItemClick}
                className={`flex h-10 w-10 items-center justify-center rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-gray-900/10 text-gray-900"
                    : "text-gray-700 hover:bg-gray-900/5"
                }`}
                onMouseEnter={() => setHoveredItem(item.href)}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <span className="flex-shrink-0">{item.icon}</span>
              </Link>
              {/* Tooltip */}
              {hoveredItem === item.href && (
                <div className="absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white whitespace-nowrap shadow-lg">
                  {item.name}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                </div>
              )}
            </li>
          );
        } else {
          // Expanded mode: show Directory with children list
          return (
            <React.Fragment key={item.href}>
              <li className="relative">
                <Link
                  href={item.href}
                  onClick={onItemClick}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? "bg-gray-900/10 text-gray-900"
                      : "text-gray-700 hover:bg-gray-900/5"
                  }`}
                >
                  <span className="flex-shrink-0">{item.icon}</span>
                  <span>{item.name}</span>
                </Link>
              </li>
              {/* Children items (expanded mode) */}
              {item.children.map((child) => {
                const childActive =
                  pathname === child.href ||
                  pathname?.startsWith(child.href + "/");
                return (
                  <li key={child.href} className="relative">
                    <Link
                      href={child.href}
                      onClick={onItemClick}
                      className={`flex items-center gap-3 rounded-lg px-3 py-1.5 pl-8 text-sm font-medium transition-colors whitespace-nowrap ${
                        childActive
                          ? "bg-gray-900/10 text-gray-900"
                          : "text-gray-700 hover:bg-gray-900/5"
                      }`}
                    >
                      <span className="flex-shrink-0">{child.icon}</span>
                      <span>{child.name}</span>
                    </Link>
                  </li>
                );
              })}
            </React.Fragment>
          );
        }
      } else {
        // Regular item without children
        return (
          <li key={item.href} className="relative">
            <Link
              href={item.href}
              onClick={onItemClick}
              className={`flex rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                showTooltip
                  ? "h-10 w-10 items-center justify-center"
                  : "items-center gap-3 px-3 py-2"
              } ${
                isActive
                  ? "bg-gray-900/10 text-gray-900"
                  : "text-gray-700 hover:bg-gray-900/5"
              }`}
              onMouseEnter={() => showTooltip && setHoveredItem(item.href)}
              onMouseLeave={() => setHoveredItem(null)}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              {!showTooltip && <span>{item.name}</span>}
            </Link>
            {/* Tooltip for collapsed/hover mode */}
            {showTooltip && hoveredItem === item.href && (
              <div className="absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 rounded-md bg-gray-900 px-2 py-1 text-xs font-medium text-white whitespace-nowrap shadow-lg">
                {item.name}
                <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
              </div>
            )}
          </li>
        );
      }
    });
  };

  // Early return after all hooks
  if (!isClient) {
    return null;
  }

  // Calculate derived values after hooks but before render
  const baseSidebarWidth = mode === "expanded" ? expandedWidth : railWidth;
  const showTooltip = (mode === "collapsed" || mode === "hover") && isCollapsed;

  // Mobile: overlay sidebar
  if (!isDesktop) {
    return (
      <>
        {/* Hamburger button */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className="fixed left-4 top-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white shadow-sm lg:hidden"
          aria-label="Open menu"
        >
          <span className="text-xl">☰</span>
        </button>

        {/* Mobile overlay sidebar */}
        {isMobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
            <aside className="fixed left-0 top-0 z-50 h-screen w-64 border-r border-gray-200 bg-white lg:hidden">
              <div className="flex h-full flex-col">
                <div className="flex h-14 items-center justify-between border-b border-gray-200 px-4">
                  <div className="font-semibold text-gray-900">Travel CMS</div>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex h-8 w-8 items-center justify-center rounded text-gray-600 hover:bg-gray-100"
                    aria-label="Close menu"
                  >
                    ✕
                  </button>
                </div>
                <nav className="flex-1 overflow-y-auto px-2 py-1">
                  <ul className="space-y-0.5">
                    {renderNavItems({ 
                      showTooltip: false, 
                      onItemClick: () => setIsMobileMenuOpen(false) 
                    })}
                  </ul>
                </nav>
                {/* Version display */}
                <div className="border-t border-gray-200 px-4 py-2">
                  <span className="text-xs text-gray-400">
                    v{process.env.NEXT_PUBLIC_APP_VERSION || "dev"}
                  </span>
                </div>
              </div>
            </aside>
          </>
        )}
      </>
    );
  }

  // Desktop: sidebar with 3 modes
  return (
    <>
      {/* Base sidebar - always fixed, below TopBar */}
      <aside
        className="fixed left-0 top-16 h-[calc(100vh-4rem)] border-r border-gray-200 bg-white transition-all duration-200 ease-in-out"
        style={{ width: `${baseSidebarWidth}px` }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex h-full flex-col">
          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto px-2 py-1">
            <ul className="space-y-0.5">
              {renderNavItems({ showTooltip })}
            </ul>
          </nav>

          {/* Version display */}
          <div className={`px-3 py-1 ${isCollapsed ? "text-center" : ""}`}>
            <span className="text-xs text-gray-400">
              {isExpanded ? `v${process.env.NEXT_PUBLIC_APP_VERSION || "dev"}` : `v${(process.env.NEXT_PUBLIC_APP_VERSION || "dev").split(".")[0]}`}
            </span>
          </div>

          {/* Sidebar Control - bottom */}
          <div className="border-t border-gray-200 p-2">
            <div className="relative">
              <button
                ref={buttonRef}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsPopoverOpen(!isPopoverOpen);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isCollapsed ? "justify-center" : "justify-between"
                } text-gray-700 hover:bg-gray-900/5`}
                title={isCollapsed ? "Sidebar settings" : undefined}
              >
                <Settings size={18} strokeWidth={1.6} />
                {isExpanded && (
                  <>
                    <span className="flex-1 text-left">{modeLabels[mode]}</span>
                    <span className={`text-xs transition-transform ${isPopoverOpen ? "rotate-180" : ""}`}>▼</span>
                  </>
                )}
              </button>

              {/* Popover - show in all modes (expanded, collapsed, hover overlay) */}
              {isPopoverOpen && (
                <div
                  ref={popoverRef}
                  className="absolute bottom-full left-0 mb-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg"
                  style={{ zIndex: 60 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-1">
                    {(["expanded", "collapsed", "hover"] as SidebarMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          
                          // Immediately apply layout styles before React state update
                          const mainWrapper = document.getElementById("main-content-wrapper");
                          if (mainWrapper) {
                            if (m === "expanded") {
                              mainWrapper.style.marginLeft = "260px";
                              mainWrapper.style.paddingLeft = "0";
                            } else {
                              mainWrapper.style.marginLeft = "0";
                              mainWrapper.style.paddingLeft = "72px";
                            }
                            mainWrapper.style.transition = "margin-left 200ms ease-in-out, padding-left 200ms ease-in-out";
                          }
                          
                          setMode(m);
                          setIsPopoverOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors text-left ${
                          mode === m
                            ? "bg-gray-900/10 text-gray-900"
                            : "text-gray-700 hover:bg-gray-900/5"
                        }`}
                      >
                        <div className="flex h-4 w-4 items-center justify-center">
                          {mode === m ? (
                            <span className="h-2 w-2 rounded-full bg-gray-900"></span>
                          ) : (
                            <span className="h-2 w-2 rounded-full border-2 border-gray-300"></span>
                          )}
                        </div>
                        <span>{modeLabels[m]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Expanded overlay for hover mode */}
      {overlayEnabled && (
        <aside
          className="fixed left-0 top-16 z-50 h-[calc(100vh-4rem)] border-r border-gray-200 bg-white shadow-xl transition-all duration-200 ease-in-out"
          style={{ width: `${expandedWidth}px` }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <div className="flex h-full flex-col">
            {/* Navigation - expanded view */}
            <nav className="flex-1 overflow-y-auto px-2 py-1">
              <ul className="space-y-0.5">
                {renderNavItems({ showTooltip: false })}
              </ul>
            </nav>

            {/* Version display */}
            <div className="px-3 py-1">
              <span className="text-xs text-gray-400">
                v{process.env.NEXT_PUBLIC_APP_VERSION || "dev"}
              </span>
            </div>

            {/* Sidebar Control - bottom (in overlay) */}
            <div className="border-t border-gray-200 p-2">
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsPopoverOpen(!isPopoverOpen);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-gray-700 hover:bg-gray-900/5"
                >
                  <Settings size={18} strokeWidth={1.6} />
                  <span className="flex-1 text-left">{modeLabels[mode]}</span>
                  <span className={`text-xs transition-transform ${isPopoverOpen ? "rotate-180" : ""}`}>▼</span>
                </button>

                {/* Popover */}
                {isPopoverOpen && (
                  <div
                    ref={popoverRef}
                    className="absolute bottom-full left-0 mb-2 w-48 rounded-lg border border-gray-200 bg-white shadow-lg"
                    style={{ zIndex: 60 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="p-1">
                      {(["expanded", "collapsed", "hover"] as SidebarMode[]).map((m) => (
                        <button
                          key={m}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            // Immediately apply layout styles before React state update
                            const mainWrapper = document.getElementById("main-content-wrapper");
                            if (mainWrapper) {
                              if (m === "expanded") {
                                mainWrapper.style.marginLeft = "260px";
                                mainWrapper.style.paddingLeft = "0";
                              } else {
                                mainWrapper.style.marginLeft = "0";
                                mainWrapper.style.paddingLeft = "72px";
                              }
                              mainWrapper.style.transition = "margin-left 200ms ease-in-out, padding-left 200ms ease-in-out";
                            }
                            
                            setMode(m);
                            setIsPopoverOpen(false);
                          }}
                          className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors text-left ${
                            mode === m
                              ? "bg-gray-900/10 text-gray-900"
                              : "text-gray-700 hover:bg-gray-900/5"
                          }`}
                        >
                          <div className="flex h-4 w-4 items-center justify-center">
                            {mode === m ? (
                              <span className="h-2 w-2 rounded-full bg-gray-900"></span>
                            ) : (
                              <span className="h-2 w-2 rounded-full border-2 border-gray-300"></span>
                            )}
                          </div>
                          <span>{modeLabels[m]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
