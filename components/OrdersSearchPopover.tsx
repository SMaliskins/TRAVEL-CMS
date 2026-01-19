"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import ordersSearchStore, { OrdersSearchState } from "@/lib/stores/ordersSearchStore";
import DateRangePicker from "./DateRangePicker";
import { useDebounce } from "@/hooks/useDebounce";
import { useClampedPopoverPosition } from "@/hooks/useClampedPopoverPosition";

interface OrdersSearchPopoverProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export default function OrdersSearchPopover({ inputRef }: OrdersSearchPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<OrdersSearchState>(() =>
    ordersSearchStore.getState()
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const [userPosition, setUserPosition] = useState<{ left: number; top: number } | null>(null);
  const hasUserMovedRef = useRef(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  // Debounce text inputs
  const debouncedQueryText = useDebounce(filters.queryText, 200);
  const debouncedClientLastName = useDebounce(filters.clientLastName, 200);
  const debouncedHotelName = useDebounce(filters.hotelName, 200);
  const debouncedCountry = useDebounce(filters.country, 200);

  // Calculate position
  const calculatePosition = useClampedPopoverPosition({
    anchorRef: inputRef,
    popoverWidth: 960,
    padding: 12,
    minSpaceBelow: 300,
  });

  // Calculate position state
  const [calculatedPosition, setCalculatedPosition] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);

  // Update calculated position when open state or anchor changes (only if not user-moved)
  useEffect(() => {
    if (!isOpen || hasUserMovedRef.current) return;
    
    const updatePosition = () => {
      const pos = calculatePosition();
      setCalculatedPosition(pos);
    };

    updatePosition();
    
    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();
    
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);
    
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [isOpen, calculatePosition]);

  // Get current position (either user-dragged or calculated)
  const getPosition = useCallback((): { left: number; top: number; width: number; maxHeight: number } | null => {
    if (hasUserMovedRef.current && userPosition) {
      // Use user position if they've dragged, but get width/maxHeight from calculated
      const base = calculatedPosition || calculatePosition();
      if (!base) return null;
      return {
        ...userPosition,
        width: base.width,
        maxHeight: base.maxHeight,
      };
    }
    // Use calculated position
    return calculatedPosition || calculatePosition();
  }, [userPosition, calculatedPosition, calculatePosition]);

  // Initialize store and subscribe to changes
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      ordersSearchStore.init();
    }
    const unsubscribe = ordersSearchStore.subscribe((state) => {
      setFilters(state);
    });
    return unsubscribe;
  }, []);

  // Apply debounced text values to store
  useEffect(() => {
    ordersSearchStore.setField("queryText", debouncedQueryText);
  }, [debouncedQueryText]);

  useEffect(() => {
    ordersSearchStore.setField("clientLastName", debouncedClientLastName);
  }, [debouncedClientLastName]);

  useEffect(() => {
    ordersSearchStore.setField("hotelName", debouncedHotelName);
  }, [debouncedHotelName]);

  useEffect(() => {
    ordersSearchStore.setField("country", debouncedCountry);
  }, [debouncedCountry]);

  // Cmd+K / Ctrl+K to focus search and open popover
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [inputRef]);

  // Scroll hints detection
  useEffect(() => {
    if (!isOpen || !scrollContainerRef.current) return;

    const checkScroll = () => {
      const container = scrollContainerRef.current;
      if (!container) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      setCanScrollDown(scrollTop < scrollHeight - clientHeight - 1);
    };

    const container = scrollContainerRef.current;
    container.addEventListener("scroll", checkScroll);
    checkScroll();

    const handleResize = () => checkScroll();
    window.addEventListener("resize", handleResize);

    return () => {
      container.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen]);

  // Handle window resize - reclamp position if not user-moved
  useEffect(() => {
    if (!isOpen) return;

    const handleResize = () => {
      if (!hasUserMovedRef.current) {
        setUserPosition(null);
      } else if (userPosition && overlayRef.current) {
        // Clamp user position to viewport
        const padding = 12;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const width = overlayRef.current.offsetWidth;
        const height = overlayRef.current.offsetHeight;

        const clampedLeft = Math.max(padding, Math.min(userPosition.left, viewportWidth - width - padding));
        const clampedTop = Math.max(padding, Math.min(userPosition.top, viewportHeight - height - padding));
        setUserPosition({ left: clampedLeft, top: clampedTop });
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen, userPosition]);

  // Handle window scroll - recalculate position if anchored
  useEffect(() => {
    if (!isOpen || hasUserMovedRef.current) return;

    const handleScroll = () => {
      setUserPosition(null); // Trigger recalculation
    };

    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [isOpen]);

  // Draggable handlers
  useEffect(() => {
    if (!isDragging || !dragOffset) return;

    const handleMouseMove = (e: MouseEvent) => {
      const padding = 12;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let newLeft = e.clientX - dragOffset.x;
      let newTop = e.clientY - dragOffset.y;

      // Clamp to viewport
      if (overlayRef.current) {
        const width = overlayRef.current.offsetWidth;
        const height = overlayRef.current.offsetHeight;

        newLeft = Math.max(padding, Math.min(newLeft, viewportWidth - width - padding));
        newTop = Math.max(padding, Math.min(newTop, viewportHeight - height - padding));
      }

      setUserPosition({ left: newLeft, top: newTop });
      hasUserMovedRef.current = true;
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setDragOffset(null);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.body.style.cursor = "grabbing";
    document.body.style.userSelect = "none";

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDragging, dragOffset]);

  const handleDragStart = (e: React.MouseEvent) => {
    if (!overlayRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    
    // Initialize user position if not set
    if (!userPosition) {
      const pos = getPosition();
      if (pos) {
        setUserPosition({ left: pos.left, top: pos.top });
      }
    }
    
    setIsDragging(true);
  };

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const calendarDropdowns = document.querySelectorAll('[data-calendar-dropdown]');
        if (calendarDropdowns.length > 0) return;
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if ((target as Element).closest('[data-calendar-dropdown]')) return;

      if (
        overlayRef.current &&
        !overlayRef.current.contains(target) &&
        inputRef.current &&
        !inputRef.current.contains(target)
      ) {
        handleClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, inputRef]);

  const handleFieldChange = <K extends keyof OrdersSearchState>(
    key: K,
    value: OrdersSearchState[K]
  ) => {
    // For text fields, update local state (will be debounced)
    if (key === "queryText" || key === "clientLastName" || key === "hotelName" || key === "country") {
      setFilters((prev) => ({ ...prev, [key]: value }));
    } else {
      // For other fields, update store immediately
      ordersSearchStore.setField(key, value);
    }
  };

  const handleCheckInRangeChange = (from: string | undefined, to: string | undefined) => {
    ordersSearchStore.setField("checkIn", { from, to });
  };

  const handleReturnRangeChange = (from: string | undefined, to: string | undefined) => {
    ordersSearchStore.setField("return", { from, to });
  };

  const handleClear = () => {
    ordersSearchStore.reset();
    // Don't close popover
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // Reset user position when closing
  useEffect(() => {
    if (!isOpen) {
      hasUserMovedRef.current = false;
      setUserPosition(null);
    }
  }, [isOpen]);

  const activeFiltersCount = ordersSearchStore.countActiveFilters();
  const finalPosition = isOpen ? getPosition() : null;

  if (!mounted) return null;

  return (
    <>
      {/* Search Input */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <svg
            className="h-4 w-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
        <input
          ref={inputRef}
          type="text"
          value={filters.queryText}
          onChange={(e) => handleFieldChange("queryText", e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Search (Orders only)..."
          className={`block w-full rounded-lg border py-1.5 pl-10 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 ${
            activeFiltersCount > 0
              ? "border-blue-500 bg-blue-50 focus:border-blue-600 focus:ring-blue-500 pr-28"
              : "border-gray-300 bg-white focus:border-gray-400 focus:ring-gray-400 pr-20"
          }`}
        />
        {/* Right side elements container */}
        <div className="absolute inset-y-0 right-0 flex items-center gap-2 pr-2 pointer-events-none">
          {/* Clear filters button */}
          {activeFiltersCount > 0 && (
            <button
              type="button"
              onClick={handleClear}
              className="pointer-events-auto text-gray-400 hover:text-gray-600"
              title="Clear all filters"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
          {/* Active filters count badge */}
          {activeFiltersCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
              {activeFiltersCount}
            </span>
          )}
          {/* ⌘K shortcut badge */}
          <span className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 text-xs font-medium text-gray-500">
            ⌘K
          </span>
        </div>
      </div>

      {/* Overlay via Portal */}
      {isOpen && finalPosition && createPortal(
        <div
          ref={overlayRef}
          className="z-[60] rounded-lg border border-gray-200 bg-white shadow-xl"
          style={{
            position: "fixed",
            left: `${finalPosition.left}px`,
            top: `${finalPosition.top}px`,
            width: `${finalPosition.width}px`,
            maxHeight: `${finalPosition.maxHeight}px`,
          }}
          data-calendar-container
        >
          <div className="flex h-full max-h-full flex-col">
            {/* Header with drag handle and close button */}
            <div
              ref={headerRef}
              className={`sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3 ${
                isDragging ? "cursor-grabbing" : "cursor-move"
              }`}
              onMouseDown={handleDragStart}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  Orders search
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">Esc</span>
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex h-6 w-6 items-center justify-center rounded hover:bg-gray-100"
                  title="Close"
                >
                  <svg
                    className="h-4 w-4 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="relative flex-1 overflow-hidden">
              <div
                ref={scrollContainerRef}
                className="overflow-y-auto"
                style={{ maxHeight: `calc(${finalPosition.maxHeight}px - 140px)` }}
              >
                <div className="p-4">
                  {/* Quick Search */}
                  <div className="mb-4">
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Quick Search
                    </label>
                    <input
                      type="text"
                      value={filters.queryText}
                      onChange={(e) => handleFieldChange("queryText", e.target.value)}
                      placeholder="Order ID / Client / Ref"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none"
                      autoFocus
                    />
                  </div>

                  {/* Advanced Filters */}
                  <div className="mb-4">
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Advanced Filters
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Check-in Range */}
                      <DateRangePicker
                        label="Check-in Range"
                        from={filters.checkIn.from}
                        to={filters.checkIn.to}
                        onChange={handleCheckInRangeChange}
                      />

                      {/* Return Range */}
                      <DateRangePicker
                        label="Return Range"
                        from={filters.return.from}
                        to={filters.return.to}
                        onChange={handleReturnRangeChange}
                      />

                      {/* Client Last Name */}
                      <div>
                        <label className="mb-1 block text-xs text-gray-600">
                          Client Last Name
                        </label>
                        <input
                          type="text"
                          value={filters.clientLastName}
                          onChange={(e) =>
                            handleFieldChange("clientLastName", e.target.value)
                          }
                          placeholder="Enter last name"
                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none"
                        />
                      </div>

                      {/* Hotel Name */}
                      <div>
                        <label className="mb-1 block text-xs text-gray-600">
                          Hotel Name
                        </label>
                        <input
                          type="text"
                          value={filters.hotelName}
                          onChange={(e) => handleFieldChange("hotelName", e.target.value)}
                          placeholder="Enter hotel name"
                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none"
                        />
                      </div>

                      {/* Country */}
                      <div>
                        <label className="mb-1 block text-xs text-gray-600">
                          Country
                        </label>
                        <input
                          type="text"
                          value={filters.country}
                          onChange={(e) => handleFieldChange("country", e.target.value)}
                          placeholder="Enter country"
                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none"
                        />
                      </div>

                      {/* Status */}
                      <div>
                        <label className="mb-1 block text-xs text-gray-600">
                          Status
                        </label>
                        <select
                          value={filters.status}
                          onChange={(e) => handleFieldChange("status", e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none"
                        >
                          <option value="all">All Statuses</option>
                          <option value="Draft">Draft</option>
                          <option value="Active">Active</option>
                          <option value="Cancelled">Cancelled</option>
                          <option value="Completed">Completed</option>
                          <option value="On hold">On hold</option>
                        </select>
                      </div>

                      {/* Order Type */}
                      <div>
                        <label className="mb-1 block text-xs text-gray-600">
                          Order Type
                        </label>
                        <select
                          value={filters.orderType}
                          onChange={(e) => handleFieldChange("orderType", e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none"
                        >
                          <option value="all">All Types</option>
                          <option value="TA">TA</option>
                          <option value="TO">TO</option>
                          <option value="CORP">CORP</option>
                          <option value="NON">NON</option>
                        </select>
                      </div>

                      {/* Agent */}
                      <div>
                        <label className="mb-1 block text-xs text-gray-600">Agent</label>
                        <select
                          value={filters.agentId}
                          onChange={(e) =>
                            handleFieldChange("agentId", e.target.value as "all" | string)
                          }
                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none"
                        >
                          <option value="all">All Agents</option>
                          <option value="JS">JS</option>
                          <option value="MK">MK</option>
                          <option value="AB">AB</option>
                        </select>
                      </div>

                      {/* Show delegated to me */}
                      <div className="flex items-end">
                        <label className="flex cursor-pointer items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={filters.delegatedToMe}
                            onChange={(e) =>
                              handleFieldChange("delegatedToMe", e.target.checked)
                            }
                            className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                          />
                          <span className="text-xs font-medium text-gray-700">
                            Show delegated to me
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom scroll hint */}
              {canScrollDown && (
                <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 h-8 bg-gradient-to-t from-white to-transparent" />
              )}
            </div>

            {/* Sticky footer */}
            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-gray-200 bg-white p-4">
              <button
                type="button"
                onClick={handleClear}
                className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
