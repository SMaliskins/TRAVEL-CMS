"use client";

import React, { useState, useEffect, useMemo } from "react";
import { getAirlineCheckinInfo } from "@/lib/flights/airlineCheckin";

interface CheckinCountdownProps {
  flightNumber: string;
  departureDateTime: string; // ISO string
  checkinUrl?: string;
  bookingRef?: string;
  clientName?: string;
  onCheckinOpen?: () => void;
}

interface TimeRemaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
}

type CheckinStatus = "upcoming" | "open" | "closed" | "past";

function formatCountdown(time: TimeRemaining): string {
  if (time.days > 0) {
    return `${time.days}d ${time.hours}h`;
  }
  if (time.hours > 0) {
    return `${time.hours}h ${time.minutes}m`;
  }
  return `${time.minutes}m ${time.seconds}s`;
}

function calculateStatus(
  depTime: number,
  checkinOpensAt: number,
  checkinClosesAt: number,
  now: number
): { status: CheckinStatus; timeRemaining: TimeRemaining | null } {
  if (now > depTime) {
    return { status: "past", timeRemaining: null };
  }
  
  if (now >= checkinClosesAt) {
    return { status: "closed", timeRemaining: null };
  }
  
  if (now >= checkinOpensAt) {
    const msUntilClose = checkinClosesAt - now;
    return {
      status: "open",
      timeRemaining: {
        days: Math.floor(msUntilClose / (1000 * 60 * 60 * 24)),
        hours: Math.floor((msUntilClose % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((msUntilClose % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((msUntilClose % (1000 * 60)) / 1000),
        totalMs: msUntilClose,
      },
    };
  }
  
  const msUntilOpen = checkinOpensAt - now;
  return {
    status: "upcoming",
    timeRemaining: {
      days: Math.floor(msUntilOpen / (1000 * 60 * 60 * 24)),
      hours: Math.floor((msUntilOpen % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((msUntilOpen % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((msUntilOpen % (1000 * 60)) / 1000),
      totalMs: msUntilOpen,
    },
  };
}

export default function CheckinCountdown({
  flightNumber,
  departureDateTime,
  checkinUrl,
  onCheckinOpen,
}: CheckinCountdownProps) {
  const [now, setNow] = useState(() => Date.now());
  const [notificationSent, setNotificationSent] = useState(false);

  // Extract airline code from flight number
  const airlineCode = flightNumber.match(/^([A-Z]{2})/i)?.[1]?.toUpperCase() || "";
  const airlineInfo = getAirlineCheckinInfo(airlineCode);

  // Calculate times once
  const depTime = useMemo(() => new Date(departureDateTime).getTime(), [departureDateTime]);
  const checkinOpensAt = useMemo(
    () => airlineInfo ? depTime - (airlineInfo.checkinHoursBefore * 60 * 60 * 1000) : 0,
    [depTime, airlineInfo]
  );
  const checkinClosesAt = useMemo(
    () => airlineInfo ? depTime - (airlineInfo.checkinHoursClose * 60 * 60 * 1000) : 0,
    [depTime, airlineInfo]
  );

  // Calculate status based on current time
  const { status, timeRemaining } = useMemo(
    () => airlineInfo 
      ? calculateStatus(depTime, checkinOpensAt, checkinClosesAt, now)
      : { status: "upcoming" as CheckinStatus, timeRemaining: null },
    [depTime, checkinOpensAt, checkinClosesAt, now, airlineInfo]
  );

  // Update time periodically
  useEffect(() => {
    if (!airlineInfo) return;
    
    // Update every minute (60 seconds)
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => clearInterval(interval);
  }, [airlineInfo]);

  // Trigger notification when check-in opens
  useEffect(() => {
    if (status === "open" && !notificationSent && onCheckinOpen) {
      onCheckinOpen();
      setNotificationSent(true);
    }
  }, [status, notificationSent, onCheckinOpen]);

  if (!airlineInfo) {
    return null;
  }

  if (status === "past") {
    return (
      <span className="text-[10px] text-gray-400">Flight departed</span>
    );
  }

  if (status === "closed") {
    return (
      <span className="text-[10px] text-red-500">Check-in closed</span>
    );
  }

  if (status === "open" && checkinUrl) {
    return (
      <a
        href={checkinUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 hover:bg-green-200"
      >
        Check-in NOW
        {timeRemaining && (
          <span className="text-green-600 ml-1">
            (closes in {formatCountdown(timeRemaining)})
          </span>
        )}
      </a>
    );
  }

  // Upcoming - show countdown
  if (timeRemaining) {
    const isNear = timeRemaining.totalMs < 3600000; // < 1 hour
    
    return (
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${
        isNear 
          ? "bg-blue-100 text-blue-600" 
          : "bg-gray-100 text-gray-500"
      }`}>
        <span>Check-in in {formatCountdown(timeRemaining)}</span>
      </div>
    );
  }

  return null;
}
