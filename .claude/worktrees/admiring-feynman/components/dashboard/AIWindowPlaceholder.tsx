"use client";

import React, { useState } from "react";

interface AIWindowPlaceholderProps {
  className?: string;
}

export default function AIWindowPlaceholder({
  className = "",
}: AIWindowPlaceholderProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`${className}`}>
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 booking-btn-primary"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          Open AI Assistant
        </button>
      ) : (
        <div className="booking-glass-panel w-80">
          <div className="flex items-center justify-between border-b border-gray-200/50 p-4">
            <h3 className="text-lg font-bold tracking-tight text-gray-900">
              AI Assistant
            </h3>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg
                className="h-5 w-5"
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
          <div className="p-4">
            <div className="mb-4 rounded-xl bg-gray-50/50 border border-gray-200/50 p-4 backdrop-blur-sm">
              <p className="text-sm text-gray-600">
                AI chat interface will be implemented here. This will allow
                users to interact with AI for various tasks.
              </p>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Ask AI anything..."
                className="booking-input"
              />
              <button className="w-full booking-btn-primary py-2 text-sm">
                Send
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

