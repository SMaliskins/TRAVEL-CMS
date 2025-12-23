"use client";

import { useRef } from "react";
import { usePathname } from "next/navigation";
import OrdersSearchPopover from "./OrdersSearchPopover";
import DirectorySearchPopover from "./DirectorySearchPopover";

export default function TopBarSearch() {
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const isOrders = pathname === "/orders" || pathname.startsWith("/orders/");
  const isDirectory = pathname === "/directory" || pathname.startsWith("/directory/");

  if (isOrders) {
    // Full Orders search with popover
    return (
      <div className="relative">
        <OrdersSearchPopover inputRef={inputRef} />
      </div>
    );
  }

  if (isDirectory) {
    // Full Directory search with popover
    return (
      <div className="relative">
        <DirectorySearchPopover inputRef={inputRef} />
      </div>
    );
  }

  // Disabled placeholder for other pages
  return (
    <div className="relative">
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
          disabled
          placeholder="Search (coming soon)"
          className="block w-full rounded-lg border border-gray-300 bg-gray-50 py-1.5 pl-10 pr-12 text-sm text-gray-500 placeholder:text-gray-400"
        />
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
          <span className="rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 text-xs font-medium text-gray-400">
            ⌘K
          </span>
        </div>
      </div>
    </div>
  );
}
