"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";

interface SuggestedTraveller {
  id: string;
  firstName: string;
  lastName: string;
}

interface SuggestedGroup {
  id: string;
  name: string;
  mode: string;
  travellers: SuggestedTraveller[];
}

interface ClientEntry {
  id: string | null;
  name: string;
}

interface ClientSuggestedButtonProps {
  mainClientId: string | null;
  onAddClients: (clients: ClientEntry[]) => void;
  existingClientIds: (string | null)[];
  className?: string;
}

export default function ClientSuggestedButton({
  mainClientId,
  onAddClients,
  existingClientIds,
  className = "",
}: ClientSuggestedButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [suggestedGroups, setSuggestedGroups] = useState<SuggestedGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuStyle, setMenuStyle] = useState<{ top?: number; bottom?: number; left: number } | null>(null);

  useEffect(() => {
    if (showMenu && mainClientId && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const left = Math.max(8, rect.right - 280);
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      if (spaceAbove >= 200 && spaceAbove > spaceBelow) {
        setMenuStyle({ bottom: window.innerHeight - rect.top + 4, left });
      } else {
        setMenuStyle({ top: rect.bottom + 4, left });
      }
    } else {
      setMenuStyle(null);
    }
  }, [showMenu]);

  useEffect(() => {
    if (showMenu && mainClientId) {
      setLoading(true);
      supabase.auth.getSession().then(({ data: { session } }) => {
        fetch(`/api/parties/${encodeURIComponent(mainClientId)}/suggested-travellers`, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
          credentials: "include",
        })
          .then((r) => r.json())
          .then((data) => {
            setSuggestedGroups(data.suggestedGroups || []);
          })
          .catch(() => setSuggestedGroups([]))
          .finally(() => setLoading(false));
      });
    }
  }, [showMenu, mainClientId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target) && buttonRef.current && !buttonRef.current.contains(target)) {
        setShowMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectGroup = (group: SuggestedGroup) => {
    const toAdd: ClientEntry[] = group.travellers
      .filter((t) => !existingClientIds.includes(t.id))
      .map((t) => ({
        id: t.id,
        name: [t.firstName, t.lastName].filter(Boolean).join(" ").trim() || t.id,
      }));
    if (toAdd.length > 0) {
      onAddClients(toAdd);
    }
    setShowMenu(false);
  };

  if (!mainClientId) return null;

  const menuContent = showMenu && menuStyle && (
    <div
      ref={menuRef}
      className="fixed z-[9999] w-72 min-w-56 rounded-lg border border-gray-200 bg-white shadow-lg overflow-hidden"
      style={{
        ...(menuStyle.bottom != null ? { bottom: menuStyle.bottom } : {}),
        ...(menuStyle.top != null ? { top: menuStyle.top } : {}),
        left: menuStyle.left,
      }}
    >
      <div className="p-2 border-b bg-gray-50">
        <span className="text-xs font-medium text-gray-600">Suggested from main client&apos;s history</span>
      </div>
      <div className="max-h-48 overflow-y-auto">
        {loading && (
          <div className="px-3 py-4 text-sm text-gray-500 text-center">Loading...</div>
        )}
        {!loading && suggestedGroups.length === 0 && (
          <div className="px-3 py-4 text-sm text-gray-500 text-center">No suggestions</div>
        )}
        {!loading &&
          suggestedGroups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => handleSelectGroup(group)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
            >
              {group.name}
            </button>
          ))}
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setShowMenu(!showMenu)}
        className={`text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors ${className}`}
      >
        Suggested
      </button>
      {menuContent && createPortal(menuContent, document.body)}
    </>
  );
}
