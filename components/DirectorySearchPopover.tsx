"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import directorySearchStore, { DirectorySearchState } from "@/lib/stores/directorySearchStore";
import { useDebounce } from "@/hooks/useDebounce";
import { useClampedPopoverPosition } from "@/hooks/useClampedPopoverPosition";

interface DirectorySearchPopoverProps {
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export default function DirectorySearchPopover({ inputRef }: DirectorySearchPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<DirectorySearchState>(() =>
    directorySearchStore.getState()
  );
  const [mounted, setMounted] = useState(false);

  // Debounce text inputs
  const [nameValue, setNameValue] = useState(filters.name);
  const debouncedName = useDebounce(nameValue, 200);
  const [personalCodeValue, setPersonalCodeValue] = useState(filters.personalCode);
  const debouncedPersonalCode = useDebounce(personalCodeValue, 200);
  const [phoneValue, setPhoneValue] = useState(filters.phone);
  const debouncedPhone = useDebounce(phoneValue, 200);
  const [emailValue, setEmailValue] = useState(filters.email);
  const debouncedEmail = useDebounce(emailValue, 200);

  const overlayRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);

  // Calculate position
  const calculatePosition = useClampedPopoverPosition({
    anchorRef: inputRef,
    popoverWidth: 900,
    padding: 16,
    minSpaceBelow: 300,
  });

  const [calculatedPosition, setCalculatedPosition] = useState<{ left: number; top: number; width: number; maxHeight: number } | null>(null);

  // Update calculated position when open state or anchor changes
  useEffect(() => {
    if (!isOpen) return;
    
    const updatePosition = () => {
      const calculated = calculatePosition();
      setCalculatedPosition(calculated);
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

  // Initialize store and subscribe to changes
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      directorySearchStore.getState().init();
      const currentState = directorySearchStore.getState();
      setFilters(currentState);
      setNameValue(currentState.name);
      setPersonalCodeValue(currentState.personalCode);
      setPhoneValue(currentState.phone);
      setEmailValue(currentState.email);
    }
    const unsubscribe = directorySearchStore.subscribe((state) => {
      setFilters(state);
      // Don't override local input values if user is typing
      // Only sync when store changes from external source
    });
    return unsubscribe;
  }, []);

  // Apply debounced text values to store
  useEffect(() => {
    directorySearchStore.getState().setField("name", debouncedName);
  }, [debouncedName]);

  useEffect(() => {
    directorySearchStore.getState().setField("personalCode", debouncedPersonalCode);
  }, [debouncedPersonalCode]);

  useEffect(() => {
    directorySearchStore.getState().setField("phone", debouncedPhone);
  }, [debouncedPhone]);

  useEffect(() => {
    directorySearchStore.getState().setField("email", debouncedEmail);
  }, [debouncedEmail]);

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

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
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

  const handleFieldChange = <K extends keyof DirectorySearchState>(
    key: K,
    value: DirectorySearchState[K]
  ) => {
    if (key === "name") {
      setNameValue(value as string);
    } else if (key === "personalCode") {
      setPersonalCodeValue(value as string);
    } else if (key === "phone") {
      setPhoneValue(value as string);
    } else if (key === "email") {
      setEmailValue(value as string);
    } else {
      directorySearchStore.getState().setField(key, value);
    }
  };

  const handleRoleChange = (role: "client" | "supplier" | "subagent", checked: boolean) => {
    // If checked, set the role; if unchecked, reset to "all"
    directorySearchStore.getState().setRole(checked ? role : "all");
  };

  const handleClear = () => {
    directorySearchStore.getState().reset();
    setNameValue("");
    setPersonalCodeValue("");
    setPhoneValue("");
    setEmailValue("");
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  const activeFiltersCount = directorySearchStore.getState().countActiveFilters();
  const finalPosition = isOpen && calculatedPosition ? calculatedPosition : null;

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
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Search (Directory only)..."
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
        >
          <div className="flex h-full max-h-full flex-col">
            {/* Header with close button */}
            <div
              ref={headerRef}
              className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  Directory search
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
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      placeholder="Name (first name, last name, company name)"
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
                      {/* Personal code */}
                      <div>
                        <label className="mb-1 block text-xs text-gray-600">
                          Personal code
                        </label>
                        <input
                          type="text"
                          value={personalCodeValue}
                          onChange={(e) => setPersonalCodeValue(e.target.value)}
                          placeholder="Enter personal code"
                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none"
                        />
                      </div>

                      {/* Date of birth */}
                      <div>
                        <label className="mb-1 block text-xs text-gray-600">
                          Date of birth
                        </label>
                        <input
                          type="date"
                          value={filters.dob}
                          onChange={(e) => handleFieldChange("dob", e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none"
                        />
                      </div>

                      {/* Phone */}
                      <div>
                        <label className="mb-1 block text-xs text-gray-600">
                          Phone
                        </label>
                        <input
                          type="text"
                          value={phoneValue}
                          onChange={(e) => setPhoneValue(e.target.value)}
                          placeholder="Enter phone number"
                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none"
                        />
                      </div>

                      {/* Email */}
                      <div>
                        <label className="mb-1 block text-xs text-gray-600">
                          Email
                        </label>
                        <input
                          type="email"
                          value={emailValue}
                          onChange={(e) => setEmailValue(e.target.value)}
                          placeholder="Enter email address"
                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none"
                        />
                      </div>

                      {/* Type */}
                      <div>
                        <label className="mb-1 block text-xs text-gray-600">
                          Type
                        </label>
                        <select
                          value={filters.type}
                          onChange={(e) => handleFieldChange("type", e.target.value as "all" | "person" | "company")}
                          className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-black focus:outline-none"
                        >
                          <option value="all">All</option>
                          <option value="person">Person</option>
                          <option value="company">Company</option>
                        </select>
                      </div>

                      {/* Roles */}
                      <div>
                        <label className="mb-1 block text-xs text-gray-600">
                          Roles
                        </label>
                        <div className="space-y-2 rounded-lg border border-gray-300 px-3 py-2">
                          <label className="flex cursor-pointer items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={filters.role === "client"}
                              onChange={(e) => handleRoleChange("client", e.target.checked)}
                              className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                            />
                            <span className="text-xs font-medium text-gray-700">Client</span>
                          </label>
                          <label className="flex cursor-pointer items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={filters.role === "supplier"}
                              onChange={(e) => handleRoleChange("supplier", e.target.checked)}
                              className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                            />
                            <span className="text-xs font-medium text-gray-700">Supplier</span>
                          </label>
                          <label className="flex cursor-pointer items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={filters.role === "subagent"}
                              onChange={(e) => handleRoleChange("subagent", e.target.checked)}
                              className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                            />
                            <span className="text-xs font-medium text-gray-700">Subagent</span>
                          </label>
                        </div>
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
                className="rounded-lg bg-black px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-800"
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

