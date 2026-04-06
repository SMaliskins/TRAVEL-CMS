"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchStaffNotificationsFull,
  staffNotificationsFullQueryKey,
  STAFF_NOTIFICATIONS_STALE_MS,
} from "@/lib/notifications/staffNotificationsQuery";

export function useStaffNotificationsFullQuery() {
  return useQuery({
    queryKey: staffNotificationsFullQueryKey,
    queryFn: fetchStaffNotificationsFull,
    staleTime: STAFF_NOTIFICATIONS_STALE_MS,
  });
}
