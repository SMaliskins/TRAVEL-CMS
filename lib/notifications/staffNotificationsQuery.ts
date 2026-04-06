import { supabase } from "@/lib/supabaseClient";

/** Shared list for TopBar + dashboard widget (one GET, refetchInterval). */
export const STAFF_NOTIFICATIONS_TOOLBAR_LIMIT = 50;

export const staffNotificationsToolbarQueryKey = [
  "staff-notifications",
  "toolbar",
  STAFF_NOTIFICATIONS_TOOLBAR_LIMIT,
] as const;

export type StaffNotificationRow = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  created_at: string;
  /** Present on full `select("*")` rows (notifications page). */
  ref_id?: string;
};

export type StaffNotificationsToolbarPayload = {
  notifications: StaffNotificationRow[];
  unreadCount: number;
};

export const STAFF_NOTIFICATIONS_REFETCH_INTERVAL_MS = 60_000;
export const STAFF_NOTIFICATIONS_STALE_MS = 45_000;

export async function fetchStaffNotificationsToolbar(): Promise<StaffNotificationsToolbarPayload> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { notifications: [], unreadCount: 0 };
  }
  const res = await fetch(
    `/api/notifications/staff?limit=${STAFF_NOTIFICATIONS_TOOLBAR_LIMIT}`,
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
      credentials: "include",
    }
  );
  if (!res.ok) {
    return { notifications: [], unreadCount: 0 };
  }
  const data = (await res.json()) as {
    notifications?: StaffNotificationRow[];
    unreadCount?: number;
  };
  return {
    notifications: data.notifications ?? [],
    unreadCount: data.unreadCount ?? 0,
  };
}

/** Full notifications page */
export const STAFF_NOTIFICATIONS_FULL_LIMIT = 200;

export const staffNotificationsFullQueryKey = [
  "staff-notifications",
  "full",
  STAFF_NOTIFICATIONS_FULL_LIMIT,
] as const;

export type StaffNotificationsFullPayload = {
  notifications: StaffNotificationRow[];
  unreadCount: number;
};

export async function fetchStaffNotificationsFull(): Promise<StaffNotificationsFullPayload> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    return { notifications: [], unreadCount: 0 };
  }
  const res = await fetch(
    `/api/notifications/staff?limit=${STAFF_NOTIFICATIONS_FULL_LIMIT}`,
    {
      headers: { Authorization: `Bearer ${session.access_token}` },
      credentials: "include",
    }
  );
  if (!res.ok) {
    return { notifications: [], unreadCount: 0 };
  }
  const data = (await res.json()) as {
    notifications?: StaffNotificationRow[];
    unreadCount?: number;
  };
  return {
    notifications: data.notifications ?? [],
    unreadCount: data.unreadCount ?? 0,
  };
}

/** Invalidate toolbar + full list (and any future staff-notification queries). */
export const staffNotificationsRootQueryKey = ["staff-notifications"] as const;
