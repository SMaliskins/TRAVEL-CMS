"use client";

import { useQuery } from "@tanstack/react-query";
import {
  fetchStaffNotificationsToolbar,
  staffNotificationsToolbarQueryKey,
  STAFF_NOTIFICATIONS_REFETCH_INTERVAL_MS,
  STAFF_NOTIFICATIONS_STALE_MS,
} from "@/lib/notifications/staffNotificationsQuery";

export function useStaffNotificationsToolbarQuery() {
  return useQuery({
    queryKey: staffNotificationsToolbarQueryKey,
    queryFn: fetchStaffNotificationsToolbar,
    refetchInterval: STAFF_NOTIFICATIONS_REFETCH_INTERVAL_MS,
    staleTime: STAFF_NOTIFICATIONS_STALE_MS,
  });
}
