"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import UserList from "@/components/users/UserList";
import AddUserModal from "@/components/users/AddUserModal";

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
  created_at: string;
  last_login_at: string | null;
  last_sign_in_at?: string | null;
  role: Role;
}

interface Profile {
  id: string;
  role: { name: string; level: number } | null;
}

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = useCallback(async () => {
    try {
      // Fetch profile, users, and roles in parallel
      const [profileRes, usersRes, rolesRes] = await Promise.all([
        fetch("/api/profile"),
        fetch("/api/users"),
        fetch("/api/roles"),
      ]);

      // Check profile access
      if (!profileRes.ok) {
        if (profileRes.status === 401) {
          router.push("/login");
          return;
        }
        throw new Error("Failed to fetch profile");
      }

      const profileData = await profileRes.json();
      setProfile(profileData);

      // Check role - must be manager (4) or supervisor (5)
      const roleLevel = profileData.role?.level || 0;
      if (roleLevel < 4) {
        setError("Access denied. Manager or Supervisor role required.");
        setIsLoading(false);
        return;
      }

      // Check users access
      if (!usersRes.ok) {
        if (usersRes.status === 403) {
          setError("Access denied. Manager or Supervisor role required.");
          setIsLoading(false);
          return;
        }
        throw new Error("Failed to fetch users");
      }

      const usersData = await usersRes.json();
      setUsers(usersData);

      // Fetch roles
      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setRoles(rolesData);
      }

      setError(null);
    } catch (err) {
      console.error("Error fetching data:", err);
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUserUpdated = () => {
    fetchData();
  };

  const isSupervisor = profile?.role?.name === "supervisor";

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="rounded-lg bg-white p-8 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-red-600">Error</h2>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-4 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="mt-1 text-sm text-gray-500">
              {users.length} user{users.length !== 1 ? "s" : ""} in your organization
            </p>
          </div>
          {isSupervisor && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 rounded-lg bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add User
            </button>
          )}
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative max-w-md">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
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
            <input
              type="text"
              placeholder="Search by name, email, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
          </div>
        </div>

        {/* User List */}
        <UserList
          users={users}
          roles={roles}
          currentUserId={profile?.id || ""}
          canEdit={isSupervisor}
          onUserUpdated={handleUserUpdated}
          searchQuery={searchQuery}
        />

        {/* Info box for managers */}
        {!isSupervisor && (
          <div className="mt-6 rounded-lg bg-blue-50 p-4">
            <p className="text-sm text-blue-700">
              You have read-only access to the user list. Contact a Supervisor to add or modify users.
            </p>
          </div>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <AddUserModal
          roles={roles}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            handleUserUpdated();
          }}
        />
      )}
    </div>
  );
}
