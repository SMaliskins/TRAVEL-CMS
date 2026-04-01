"use client";

import { useEffect, useRef, useCallback } from "react";
import { getTimeUntilCheckin, showCheckinNotification, requestNotificationPermission } from "@/lib/notifications/checkinNotifications";
import { getCheckinUrl } from "@/lib/flights/airlineCheckin";

interface FlightForNotification {
  serviceId: string;
  flightNumber: string;
  departureDateTime: string;
  bookingRef: string;
  clientName: string;
  agentEmail?: string;
}

interface UseCheckinNotificationsOptions {
  flights: FlightForNotification[];
  enabled?: boolean;
  notifyBeforeMinutes?: number; // Show desktop notification X minutes before check-in opens
}

/**
 * Hook to manage check-in notifications for flights
 * - Shows desktop notification when check-in is about to open
 * - Sends email via API when check-in opens
 */
export function useCheckinNotifications({
  flights,
  enabled = true,
  notifyBeforeMinutes = 15,
}: UseCheckinNotificationsOptions) {
  const notifiedFlights = useRef<Set<string>>(new Set());
  const emailSentFlights = useRef<Set<string>>(new Set());

  // Send email notification via API
  const sendEmailNotification = useCallback(async (flight: FlightForNotification) => {
    if (!flight.agentEmail) return;
    
    const key = `${flight.serviceId}-${flight.flightNumber}`;
    if (emailSentFlights.current.has(key)) return;
    
    try {
      const response = await fetch("/api/notifications/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flightNumber: flight.flightNumber,
          departureDateTime: flight.departureDateTime,
          bookingRef: flight.bookingRef,
          clientName: flight.clientName,
          agentEmail: flight.agentEmail,
          notificationType: "checkin_open",
        }),
      });
      
      if (response.ok) {
        emailSentFlights.current.add(key);
      }
    } catch (error) {
      console.error("Failed to send check-in email:", error);
    }
  }, []);

  // Check flights and trigger notifications
  useEffect(() => {
    if (!enabled || flights.length === 0) return;

    const checkFlights = async () => {
      // Request permission first
      const hasPermission = await requestNotificationPermission();
      
      for (const flight of flights) {
        const status = getTimeUntilCheckin(flight.flightNumber, flight.departureDateTime);
        const key = `${flight.serviceId}-${flight.flightNumber}`;
        
        // Check-in is about to open (within notifyBeforeMinutes)
        if (status.status === "opening_soon" && status.msUntilOpen !== undefined) {
          const minutesUntilOpen = status.msUntilOpen / (1000 * 60);
          
          if (minutesUntilOpen <= notifyBeforeMinutes && !notifiedFlights.current.has(`${key}-soon`)) {
            // Show desktop notification
            if (hasPermission) {
              const checkinUrl = getCheckinUrl(flight.flightNumber);
              showCheckinNotification({
                flightNumber: flight.flightNumber,
                clientName: flight.clientName,
                bookingRef: flight.bookingRef,
                checkinUrl: checkinUrl || "",
                type: "opening_soon",
              });
            }
            notifiedFlights.current.add(`${key}-soon`);
          }
        }
        
        // Check-in just opened
        if (status.status === "open" && !notifiedFlights.current.has(`${key}-open`)) {
          // Show desktop notification
          if (hasPermission) {
            const checkinUrl = getCheckinUrl(flight.flightNumber);
            showCheckinNotification({
              flightNumber: flight.flightNumber,
              clientName: flight.clientName,
              bookingRef: flight.bookingRef,
              checkinUrl: checkinUrl || "",
              type: "now_open",
            });
          }
          notifiedFlights.current.add(`${key}-open`);
          
          // Send email notification
          await sendEmailNotification(flight);
        }
      }
    };

    // Check immediately
    checkFlights();
    
    // Then check every minute
    const interval = setInterval(checkFlights, 60 * 1000);
    
    return () => clearInterval(interval);
  }, [flights, enabled, notifyBeforeMinutes, sendEmailNotification]);

  return {
    notifiedCount: notifiedFlights.current.size,
  };
}
