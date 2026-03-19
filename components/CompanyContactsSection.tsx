"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CompanyContact } from "@/lib/types/directory";
import { fetchWithAuth } from "@/lib/http/fetchWithAuth";
import { Star, Trash2, Plus, UserPlus, Loader2, Users, Briefcase, Check } from "lucide-react";
import { normalizeForSearch } from "@/lib/directory/searchNormalize";

interface CompanyContactsSectionProps {
  companyPartyId: string | undefined;
  mode: "create" | "edit";
}

interface PersonSearchResult {
  id: string;
  displayName: string;
  email: string;
  phone: string;
  alreadyLinked: boolean;
}

export default function CompanyContactsSection({
  companyPartyId,
  mode,
}: CompanyContactsSectionProps) {
  const [contacts, setContacts] = useState<CompanyContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingRole, setAddingRole] = useState<"financial" | "administrative" | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<PersonSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Reset stale state when switching to another company card.
  useEffect(() => {
    setContacts([]);
    setSearchResults([]);
    setSearchQuery("");
    setAddingRole(null);
  }, [companyPartyId]);

  const fetchContacts = useCallback(async () => {
    if (!companyPartyId || mode !== "edit") return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`/api/directory/${companyPartyId}/contacts`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts || []);
      } else {
        setContacts([]);
      }
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, [companyPartyId, mode]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const searchPersons = useCallback(async (query: string) => {
    if (query.length < 2 || !companyPartyId) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetchWithAuth(
        `/api/directory/${companyPartyId}/contacts?search=${encodeURIComponent(query)}`
      );
      if (res.ok) {
        const data = await res.json();
        const existing = new Set(
          contacts
            .filter((c) => c.role === addingRole)
            .map((c) => c.contactPartyId)
        );
        const queryNorm = normalizeForSearch(query).replace(/[^a-z0-9]/g, "");
        const results: PersonSearchResult[] = (data.results || [])
          .map((r: Record<string, unknown>) => {
            const full = (r.displayName as string) || "";
            return {
              id: (r.id as string) || "",
              displayName: full,
              email: (r.email as string) || "",
              phone: (r.phone as string) || "",
              alreadyLinked: existing.has((r.id as string) || ""),
            };
          })
          .filter((r: PersonSearchResult) => r.id && r.displayName)
          .sort((a, b) => {
            const aNorm = normalizeForSearch(a.displayName).replace(/[^a-z0-9]/g, "");
            const bNorm = normalizeForSearch(b.displayName).replace(/[^a-z0-9]/g, "");
            const aStarts = aNorm.startsWith(queryNorm) ? 0 : 1;
            const bStarts = bNorm.startsWith(queryNorm) ? 0 : 1;
            if (aStarts !== bStarts) return aStarts - bStarts;
            return aNorm.localeCompare(bNorm);
          })
          .slice(0, 10)
          .map((r: PersonSearchResult) => ({
            id: r.id,
            displayName: r.displayName,
            email: r.email,
            phone: r.phone,
            alreadyLinked: existing.has(r.id),
          }));
        setSearchResults(results);
      }
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  }, [companyPartyId, contacts, addingRole]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) searchPersons(searchQuery.trim());
      else setSearchResults([]);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchPersons]);

  const handleAdd = async (person: PersonSearchResult) => {
    if (!companyPartyId || !addingRole) return;
    setActionLoading(person.id);
    try {
      const res = await fetchWithAuth(
        `/api/directory/${companyPartyId}/contacts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contactPartyId: person.id,
            role: addingRole,
            isPrimary: contacts.filter((c) => c.role === addingRole).length === 0,
          }),
        }
      );
      if (res.ok) {
        await fetchContacts();
        setAddingRole(null);
        setSearchQuery("");
        setSearchResults([]);
      }
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemove = async (contactId: string) => {
    if (!companyPartyId) return;
    setActionLoading(contactId);
    try {
      await fetchWithAuth(
        `/api/directory/${companyPartyId}/contacts?contactId=${contactId}`,
        { method: "DELETE" }
      );
      await fetchContacts();
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  const handleTogglePrimary = async (contactId: string, currentPrimary: boolean) => {
    if (!companyPartyId || currentPrimary) return;
    setActionLoading(contactId);
    try {
      await fetchWithAuth(
        `/api/directory/${companyPartyId}/contacts`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId, isPrimary: true }),
        }
      );
      await fetchContacts();
    } catch {
      // ignore
    } finally {
      setActionLoading(null);
    }
  };

  if (mode !== "edit" || !companyPartyId) {
    return (
      <div className="md:col-span-2 mt-2 pt-3 border-t border-gray-200">
        <p className="text-sm text-gray-500 italic">
          Save the company first, then link contact persons.
        </p>
      </div>
    );
  }

  const financialContacts = contacts.filter((c) => c.role === "financial");
  const administrativeContacts = contacts.filter((c) => c.role === "administrative");

  const renderContactList = (
    list: CompanyContact[],
    role: "financial" | "administrative",
    icon: React.ReactNode,
    label: string,
    description: string
  ) => (
    <div className="space-y-2">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          {icon}
          <h4 className="text-sm font-semibold text-gray-800">{label}</h4>
          <span className="text-xs text-gray-400">·</span>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setAddingRole(addingRole === role ? null : role);
            setSearchQuery("");
            setSearchResults([]);
          }}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Link person
        </button>
      </div>

      {list.length === 0 && addingRole !== role && (
        <p className="text-xs text-gray-400 italic pl-1">
          {role === "financial" ? "No financial contacts linked" : "No administrative contacts linked"}
        </p>
      )}

      {list.map((contact) => (
        <div
          key={contact.id}
          className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg group"
        >
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => handleTogglePrimary(contact.id, contact.isPrimary)}
              className={`shrink-0 ${
                contact.isPrimary
                  ? "text-amber-500"
                  : "text-gray-300 hover:text-amber-400"
              }`}
              title={contact.isPrimary ? "Primary contact" : "Set as primary"}
            >
              <Star className={`h-4 w-4 ${contact.isPrimary ? "fill-current" : ""}`} />
            </button>
            <div className="min-w-0">
              <span className="text-sm font-medium text-gray-900 truncate block">
                {contact.displayName}
              </span>
              <span className="text-xs text-gray-500 truncate block">
                {[contact.email, contact.phone].filter(Boolean).join(" · ")}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => handleRemove(contact.id)}
            disabled={actionLoading === contact.id}
            className="shrink-0 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
            title="Remove link"
          >
            {actionLoading === contact.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      ))}

      {addingRole === role && (
        <div className="border border-blue-200 rounded-lg p-3 bg-blue-50/30 space-y-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search person by name..."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            autoFocus
          />
          {searching && (
            <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Searching...
            </div>
          )}
          {searchResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {searchResults.map((person) => (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => {
                    if (!person.alreadyLinked) handleAdd(person);
                  }}
                  disabled={actionLoading === person.id || person.alreadyLinked}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm text-left bg-white rounded-lg border transition-colors disabled:opacity-50 ${
                    person.alreadyLinked
                      ? "border-emerald-200 bg-emerald-50/50 cursor-not-allowed"
                      : "border-gray-200 hover:border-blue-300 hover:bg-blue-50"
                  }`}
                >
                  <div className="min-w-0">
                    <span className="font-medium text-gray-900 truncate block">
                      {person.displayName}
                    </span>
                    <span className="text-xs text-gray-500 truncate block">
                      {[person.email, person.phone].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  {actionLoading === person.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-500 shrink-0" />
                  ) : person.alreadyLinked ? (
                    <div className="inline-flex items-center gap-1 text-emerald-700 shrink-0">
                      <Check className="h-4 w-4" />
                      <span className="text-[11px] font-medium">Already linked</span>
                    </div>
                  ) : (
                    <Plus className="h-4 w-4 text-blue-500 shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}
          {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
            <p className="text-xs text-gray-400 px-1">No persons found</p>
          )}
          <button
            type="button"
            onClick={() => {
              setAddingRole(null);
              setSearchQuery("");
              setSearchResults([]);
            }}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="md:col-span-2 mt-2 pt-3 border-t border-gray-200 space-y-4">
      <h3 className="text-sm font-semibold text-gray-800">Contact persons</h3>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading contacts...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {renderContactList(
            financialContacts,
            "financial",
            <Briefcase className="h-4 w-4 text-emerald-600 shrink-0" />,
            "Financial",
            "Linked to payments & correspondence"
          )}
          {renderContactList(
            administrativeContacts,
            "administrative",
            <Users className="h-4 w-4 text-blue-600 shrink-0" />,
            "Administrative",
            "Correspondence only (assistant, secretary, or other admin contact)"
          )}
        </div>
      )}
    </div>
  );
}
