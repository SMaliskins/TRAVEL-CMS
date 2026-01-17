"use client";

import { getRoleDisplayName, getRoleColorClasses, RoleName } from "@/lib/auth/roles";

interface RoleBadgeProps {
  role: RoleName | string;
  size?: "sm" | "md" | "lg";
  showLevel?: boolean;
}

const ROLE_LEVELS: Record<string, number> = {
  subagent: 1,
  agent: 2,
  accountant: 3,
  director: 4,
  supervisor: 5,
};

export default function RoleBadge({ 
  role, 
  size = "md",
  showLevel = false 
}: RoleBadgeProps) {
  const displayName = getRoleDisplayName(role);
  const colorClasses = getRoleColorClasses(role);
  const level = ROLE_LEVELS[role] || 0;
  
  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[10px]",
    md: "px-2 py-1 text-xs",
    lg: "px-3 py-1.5 text-sm",
  };
  
  return (
    <span
      className={`
        inline-flex items-center gap-1 
        font-medium rounded-full
        ${colorClasses}
        ${sizeClasses[size]}
      `}
    >
      {showLevel && (
        <span className="opacity-60">L{level}</span>
      )}
      {displayName}
    </span>
  );
}
