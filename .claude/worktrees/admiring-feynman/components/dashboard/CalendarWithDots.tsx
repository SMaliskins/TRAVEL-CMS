"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

interface CalendarEvent {
  date: string; // YYYY-MM-DD
  status: "upcoming" | "in-progress" | "completed";
  orderCode: string;
  orderId?: string;
  count: number;
}

interface CalendarWithDotsProps {
  events: CalendarEvent[];
  className?: string;
}

export default function CalendarWithDots({
  events,
  className = "",
}: CalendarWithDotsProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Get first day of month and number of days
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Create calendar grid
  const days: (number | null)[] = [];
  // Add empty cells for days before month starts
  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }
  // Add days of month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const getEventsForDate = (day: number): CalendarEvent[] => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter((e) => e.date === dateStr);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "upcoming":
        return "bg-blue-500";
      case "in-progress":
        return "bg-green-500";
      case "completed":
        return "bg-orange-500";
      default:
        return "bg-gray-400";
    }
  };

  const handleDateClick = (day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dateEvents = getEventsForDate(day);
    if (dateEvents.length > 0) {
      setSelectedDate(selectedDate === dateStr ? null : dateStr);
    }
  };

  const monthName = today.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const selectedDateEvents =
    selectedDate ? events.filter((e) => e.date === selectedDate) : [];

  return (
    <div className={`booking-glass-panel !p-6 ${className}`}>
      <h3 className="mb-6 text-xl font-bold text-gray-900 tracking-tight">Calendar</h3>

      <div className="mb-4">
        <h4 className="text-sm font-medium text-gray-700">{monthName}</h4>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {/* Weekday headers */}
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div key={day} className="p-2 text-center text-xs font-medium text-gray-500">
            {day}
          </div>
        ))}

        {/* Calendar days */}
        {days.map((day, idx) => {
          if (day === null) {
            return <div key={idx} className="p-2"></div>;
          }

          const dateEvents = getEventsForDate(day);
          const isToday = day === today.getDate();
          const isSelected = selectedDate ===
            `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

          return (
            <button
              key={idx}
              onClick={() => handleDateClick(day)}
              className={`relative p-2 text-sm hover:bg-gray-50 ${isToday ? "font-bold text-blue-600" : "text-gray-700"} ${isSelected && dateEvents.length > 0 ? "bg-blue-50" : ""}`}
            >
              {day}
              {dateEvents.length > 0 && (
                <div className="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5">
                  {dateEvents.slice(0, 3).map((event, eventIdx) => (
                    <div
                      key={eventIdx}
                      className={`h-1.5 w-1.5 rounded-full ${getStatusColor(event.status)}`}
                    />
                  ))}
                  {dateEvents.length > 3 && (
                    <span className="text-xs text-gray-500">
                      +{dateEvents.length - 3}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected date events list */}
      {selectedDate && selectedDateEvents.length > 0 && (
        <div className="mt-4 space-y-2 border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-700">
            {formatDateDDMMYYYY(selectedDate)}
          </h4>
          {selectedDateEvents.map((event, idx) => (
            <button
              key={idx}
              onClick={() => {
                if (event.orderId) {
                  router.push(`/orders/${event.orderCode}`);
                }
              }}
              className="block w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-left hover:bg-gray-100"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-2 w-2 rounded-full ${getStatusColor(event.status)}`}
                  />
                  <span className="text-sm font-medium text-gray-900">
                    Order: {event.orderCode}
                  </span>
                </div>
                <span className="text-xs text-gray-500">{event.status}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-4 border-t border-gray-200 pt-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-blue-500"></div>
          <span className="text-xs text-gray-600">Upcoming</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500"></div>
          <span className="text-xs text-gray-600">In Progress</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-orange-500"></div>
          <span className="text-xs text-gray-600">Completed</span>
        </div>
      </div>
    </div>
  );
}

