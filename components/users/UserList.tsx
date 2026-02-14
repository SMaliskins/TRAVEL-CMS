"use client";

import { useState } from "react";
import { useUser } from "@/contexts/UserContext";
import RoleBadge from "./RoleBadge";
import EditUserModal from "./EditUserModal";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

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
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  last_login_at: string | null;
  last_sign_in_at?: string | null;
  role: Role;
}

interface UserListProps {
  users: User[];
  roles: Role[];
  currentUserId: string;
  canEdit: boolean;
  onUserUpdated: () => void;
  searchQuery: string;
}

export default function UserList({
  users,
  roles,
  currentUserId,
  canEdit,
  onUserUpdated,
  searchQuery,
}: UserListProps) {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const { profile: currentUserProfile } = useUser();

  // Filter users by search query
  const filteredUsers = users.filter((user) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${user.first_name} ${user.last_name}`.toLowerCase();
    return (
      fullName.includes(query) ||
      user.email.toLowerCase().includes(query) ||
      user.role.display_name.toLowerCase().includes(query)
    );
  });

  // Format relative date
  const formatRelativeDate = (date: string | null | undefined) => {
    if (!date) return "Never";
    
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    
    return formatDateDDMMYYYY(date);
  };

  if (filteredUsers.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
        <p className="text-gray-500">
          {searchQuery ? "No users found matching your search" : "No users yet"}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Email
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Role
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Last Login
              </th>
              {canEdit && (
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredUsers.map((user) => {
              const isSelf = user.id === currentUserId;
              return (
                <tr
                  key={user.id}
                  className={`transition-colors hover:bg-gray-50 ${
                    !user.is_active ? "opacity-60" : ""
                  }`}
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gray-200 text-sm font-medium text-gray-700">
                        {(() => {
                          // For current user, use avatar from context (updates instantly)
                          const avatarUrl = isSelf && currentUserProfile?.avatar_url
                            ? currentUserProfile.avatar_url
                            : user.avatar_url;
                          
                          return avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <>
                              {user.first_name?.[0]?.toUpperCase() || ""}
                              {user.last_name?.[0]?.toUpperCase() || ""}
                            </>
                          );
                        })()}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                          {isSelf && (
                            <span className="ml-2 text-xs text-gray-500">(you)</span>
                          )}
                        </div>
                        {user.phone && (
                          <div className="text-xs text-gray-500">{user.phone}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {user.email}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <RoleBadge role={user.role.name} size="sm" />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {user.is_active ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {formatRelativeDate(user.last_sign_in_at || user.last_login_at)}
                  </td>
                  {canEdit && (
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <button
                        onClick={() => setEditingUser(user)}
                        className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                      >
                        Edit
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editingUser && (
        <EditUserModal
          user={editingUser}
          roles={roles}
          currentUserId={currentUserId}
          onClose={() => setEditingUser(null)}
          onSuccess={() => {
            setEditingUser(null);
            onUserUpdated();
          }}
        />
      )}
    </>
  );
}
