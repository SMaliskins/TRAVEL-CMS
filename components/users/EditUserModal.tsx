"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { getRoleDisplayName } from "@/lib/auth/roles";
import RoleBadge from "./RoleBadge";
import RolePermissionsModal from "./RolePermissionsModal";

// Role descriptions
const ROLE_DESCRIPTIONS: Record<string, { en: string; ru: string }> = {
  subagent: {
    en: "External partner — access to own clients only",
    ru: "Внешний партнёр — доступ только к своим клиентам",
  },
  agent: {
    en: "Travel consultant — bookings and client service",
    ru: "Консультант — бронирование и работа с клиентами",
  },
  finance: {
    en: "Accountant — payments and reports only",
    ru: "Бухгалтер — только платежи и отчёты",
  },
  manager: {
    en: "Team lead — full operations access",
    ru: "Руководитель — полный доступ к операциям",
  },
  supervisor: {
    en: "Administrator — full access including users",
    ru: "Администратор — полный доступ включая пользователей",
  },
};

interface Role {
  id: string;
  name: string;
  display_name: string;
  display_name_en?: string;
  level: number;
  color: string;
}

interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_active: boolean;
  role: Role;
}

interface EditUserModalProps {
  user: User;
  roles: Role[];
  currentUserId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditUserModal({
  user,
  roles,
  currentUserId,
  onClose,
  onSuccess,
}: EditUserModalProps) {
  const [firstName, setFirstName] = useState(user.first_name);
  const [lastName, setLastName] = useState(user.last_name);
  const [phone, setPhone] = useState(user.phone || "");
  const [roleId, setRoleId] = useState(user.role.id);
  const [isActive, setIsActive] = useState(user.is_active);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPermissions, setShowPermissions] = useState(false);

  useEscapeKey(onClose, true);
  const { prefs } = useUserPreferences();

  const isSelf = user.id === currentUserId;

  const availableRoles = roles;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Session expired. Please refresh the page.");
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          firstName,
          lastName,
          phone: phone || null,
          roleId,
          isActive,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update user");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm(`Are you sure you want to deactivate ${user.first_name} ${user.last_name}?`)) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError("Session expired. Please refresh the page.");
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to deactivate user");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deactivate user");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Edit User</h3>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                placeholder="+371 12345678"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center gap-2">
                <label className="block text-sm font-medium text-gray-700">
                  Role
                </label>
                <button
                  type="button"
                  onClick={() => setShowPermissions(true)}
                  className="flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-xs text-blue-600 hover:bg-blue-100"
                  title="View role permissions"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{prefs.language === "ru" ? "Права" : "Permissions"}</span>
                </button>
              </div>
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                disabled={isSelf}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400 disabled:bg-gray-100"
              >
                {availableRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {getRoleDisplayName(role.name, prefs.language)}
                  </option>
                ))}
              </select>
              {(() => {
                const selectedRole = availableRoles.find(r => r.id === roleId);
                const desc = selectedRole ? ROLE_DESCRIPTIONS[selectedRole.name] : null;
                const lang = prefs.language === "ru" ? "ru" : "en";
                return desc ? (
                  <p className="mt-1 text-xs text-gray-500">{desc[lang]}</p>
                ) : null;
              })()}
              {isSelf && (
                <p className="mt-1 text-xs text-amber-600">
                  You cannot change your own role
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Status
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => !isSelf && setIsActive(true)}
                  disabled={isSelf}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  } ${isSelf ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => !isSelf && setIsActive(false)}
                  disabled={isSelf}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    !isActive
                      ? "bg-gray-800 text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  } ${isSelf ? "cursor-not-allowed opacity-50" : ""}`}
                >
                  Inactive
                </button>
              </div>
              {isSelf && (
                <p className="mt-1 text-xs text-gray-500">
                  You cannot deactivate yourself
                </p>
              )}
            </div>

            {/* Current role display */}
            <div className="rounded-lg bg-gray-50 p-3">
              <p className="mb-1 text-xs font-medium text-gray-500">Current Role</p>
              <RoleBadge role={user.role.name} />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div>
              {!isSelf && user.is_active && (
                <button
                  type="button"
                  onClick={handleDeactivate}
                  disabled={isSubmitting}
                  className="text-sm text-red-600 hover:text-red-700 hover:underline disabled:opacity-50"
                >
                  Deactivate user
                </button>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {showPermissions && (
        <RolePermissionsModal onClose={() => setShowPermissions(false)} />
      )}
    </div>
  );
}
