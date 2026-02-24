"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useEscapeKey } from "@/lib/hooks/useEscapeKey";
import { supabase } from "@/lib/supabaseClient";

interface OrderTraveller {
  id: string;
  firstName: string;
  lastName: string;
  title?: string;
  isMainClient?: boolean;
}

interface AddAccompanyingModalProps {
  orderCode: string;
  existingClientIds: (string | null)[];
  onAddClients: (clients: { id: string; name: string }[]) => void;
  onClose: () => void;
}

export default function AddAccompanyingModal({
  orderCode,
  existingClientIds,
  onAddClients,
  onClose,
}: AddAccompanyingModalProps) {
  const [orderTravellers, setOrderTravellers] = useState<OrderTraveller[]>([]);
  const [loadingOrder, setLoadingOrder] = useState(true);
  const [showAddSearch, setShowAddSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; phone?: string; email?: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEscapeKey(onClose);

  const existingSet = new Set(existingClientIds.filter((id): id is string => id != null));

  const fetchOrderTravellers = useCallback(async () => {
    if (!orderCode) return;
    setLoadingOrder(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/travellers`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.travellers) {
        setOrderTravellers(data.travellers);
      } else {
        setOrderTravellers([]);
      }
    } catch {
      setOrderTravellers([]);
    } finally {
      setLoadingOrder(false);
    }
  }, [orderCode]);

  useEffect(() => {
    fetchOrderTravellers();
  }, [fetchOrderTravellers]);

  const searchDirectory = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`/api/directory?search=${encodeURIComponent(query)}&role=client&limit=10`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        credentials: "include",
      });
      const data = await res.json();
      const results = (data.data || data.records || [])
        .map((item: { id: string; firstName?: string; lastName?: string; first_name?: string; last_name?: string; companyName?: string; company_name?: string; phone?: string; email?: string }) => {
          const name = [item.firstName ?? item.first_name, item.lastName ?? item.last_name].filter(Boolean).join(" ") ||
            (item.companyName ?? item.company_name) || "Unknown";
          return { id: item.id, name, phone: item.phone, email: item.email };
        });
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (showAddSearch && searchQuery.trim().length >= 2) {
        searchDirectory(searchQuery.trim());
      } else {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, showAddSearch, searchDirectory]);

  useEffect(() => {
    if (showAddSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showAddSearch]);

  const travellersNotYetAdded = orderTravellers.filter((t) => !existingSet.has(t.id));
  const displayName = (t: OrderTraveller) => [t.firstName, t.lastName].filter(Boolean).join(" ").trim() || "—";

  const handleAddFromOrder = (t: OrderTraveller) => {
    onAddClients([{ id: t.id, name: displayName(t) }]);
  };

  const handleAddFromSearch = (item: { id: string; name: string }) => {
    if (existingSet.has(item.id)) return;
    onAddClients([{ id: item.id, name: item.name }]);
    setShowAddSearch(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col">
        <div className="border-b border-gray-200 px-6 py-4 flex-shrink-0 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Add accompanying persons</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Already in this order — like Travellers modal */}
          <div>
            <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-700">
              Already in this order
            </h3>
            {loadingOrder ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : travellersNotYetAdded.length === 0 ? (
              <p className="text-sm text-gray-500">No one else in this order yet.</p>
            ) : (
              <ul className="space-y-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50/50">
                {travellersNotYetAdded.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
                  >
                    <span className="text-sm font-medium text-gray-900">{displayName(t)}</span>
                    <button
                      type="button"
                      onClick={() => handleAddFromOrder(t)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Add from directory — same as Travellers "+ Add traveller" panel */}
          <div>
            {!showAddSearch ? (
              <button
                type="button"
                onClick={() => setShowAddSearch(true)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                + Add from directory
              </button>
            ) : (
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium text-blue-800">Search directory</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddSearch(false);
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                    className="ml-auto p-1 rounded text-blue-600 hover:bg-blue-100"
                    aria-label="Close search"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type name to search..."
                  className="w-full rounded-lg border border-blue-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
                {isSearching && <p className="mt-2 text-sm text-blue-600">Searching…</p>}
                {searchResults.length > 0 && (
                  <ul className="mt-3 max-h-48 overflow-y-auto rounded-lg border border-blue-200 bg-white">
                    {searchResults.map((item) => {
                      const alreadyAdded = existingSet.has(item.id);
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => !alreadyAdded && handleAddFromSearch(item)}
                            disabled={alreadyAdded}
                            className="w-full px-4 py-3 text-left hover:bg-blue-50 border-b border-gray-100 last:border-b-0 disabled:opacity-50 disabled:cursor-default"
                          >
                            <div className="font-medium text-gray-900 text-sm">{item.name}</div>
                            {(item.phone || item.email) && (
                              <div className="text-gray-500 text-xs mt-0.5">
                                {item.phone} {item.email && `• ${item.email}`}
                              </div>
                            )}
                            {alreadyAdded && <span className="text-xs text-gray-400">already added</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {searchQuery.length >= 2 && !isSearching && searchResults.length === 0 && (
                  <p className="mt-2 text-sm text-gray-500">No results</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
