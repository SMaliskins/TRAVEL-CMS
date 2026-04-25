"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { supabase } from "@/lib/supabaseClient";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useModalOverlay } from "@/contexts/ModalOverlayContext";
import { useCurrentUserRole } from "@/contexts/CurrentUserContext";
import { resolvePublicMediaUrl } from "@/lib/resolvePublicMediaUrl";
import { formatNameForDb } from "@/utils/nameFormat";

function toTitleCase(str: string): string {
  if (!str) return str;
  return str
    .toLowerCase()
    .replace(/(^|\s|[-/(])(\S)/g, (_m, sep, ch) => sep + ch.toUpperCase());
}

interface Party {
  id: string;
  displayId?: number | null;
  display_name: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  party_type?: string;
  avatarUrl?: string | null;
  companyAvatarUrl?: string | null;
}

interface PartySelectProps {
  value: string | null;
  onChange: (id: string | null, displayName: string) => void;
  error?: string;
  required?: boolean;
  roleFilter?: string;
  /** Initial display name to show without API fetch */
  initialDisplayName?: string;
  /** Order travellers to suggest first (Client/Payer in service forms) */
  prioritizedParties?: {
    id: string;
    display_name?: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string | null;
    companyAvatarUrl?: string | null;
  }[];
  /**
   * Match AssignedTravellersModal: GET /api/directory without ?role=, then filter rows like
   * roles.includes("client") || !roles.includes("supplier"). Ensures avatars match Travellers search.
   */
  directoryMatchTravellersApi?: boolean;
  /** Allow saving typed text without creating/selecting a Directory record. */
  allowFreeText?: boolean;
}

function directoryRowMatchesTravellersSearch(r: Record<string, unknown>): boolean {
  const roles = r.roles as string[] | undefined;
  return Boolean(roles?.includes("client") || !roles?.includes("supplier"));
}

export default function PartySelect({ 
  value, 
  onChange, 
  error, 
  required,
  roleFilter = "client",
  initialDisplayName = "",
  prioritizedParties = [],
  directoryMatchTravellersApi = false,
  allowFreeText = false,
}: PartySelectProps) {
  const currentRole = useCurrentUserRole();
  const isSubagentUser = currentRole === "subagent";
  const minSearchChars = isSubagentUser ? 3 : 2;
  const maxResults = isSubagentUser ? 5 : 10;
  // Initialize inputValue with initialDisplayName if provided
  const [inputValue, setInputValue] = useState(initialDisplayName);
  const [parties, setParties] = useState<Party[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedParty, setSelectedParty] = useState<Party | null>(null);
  const [showCreateOption, setShowCreateOption] = useState(false);
  
  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const createFormTrapRef = useFocusTrap<HTMLDivElement>(showCreateForm);
  useModalOverlay(showCreateForm);
  const [createType, setCreateType] = useState<"person" | "company">("person");
  const [createFirstName, setCreateFirstName] = useState("");
  const [createLastName, setCreateLastName] = useState("");
  const [createPersonalCode, setCreatePersonalCode] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createCompanyName, setCreateCompanyName] = useState("");
  const [createAddress, setCreateAddress] = useState("");
  const [createRegNumber, setCreateRegNumber] = useState("");
  const [createError, setCreateError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [duplicates, setDuplicates] = useState<{ id: string; displayName: string; displayId?: number }[]>([]);
  // Supplier-specific: service areas
  const [createServiceAreas, setCreateServiceAreas] = useState<string[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const [wasCleared, setWasCleared] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<{ top: number; left: number; width: number; openUpward?: boolean } | null>(null);
  /** Avatar URLs that failed to load — show initials fallback */
  const [avatarLoadFailed, setAvatarLoadFailed] = useState<Record<string, boolean>>({});

  // Update inputValue when initialDisplayName changes (e.g., after async load)
  // But don't restore if user manually cleared the field
  useEffect(() => {
    if (initialDisplayName && !inputValue && !wasCleared) {
      setInputValue(initialDisplayName);
    }
  }, [initialDisplayName, inputValue, wasCleared]);

  // Map prioritized parties to Party format (including avatars)
  const prioritizedAsParties: Party[] = useMemo(
    () =>
      prioritizedParties.map((p) => {
        const dn = p.display_name || [p.firstName, p.lastName].filter(Boolean).join(" ") || p.id;
        return {
          id: p.id,
          displayId: null,
          display_name: dn,
          first_name: p.firstName,
          last_name: p.lastName,
          avatarUrl: p.avatarUrl || null,
          companyAvatarUrl: p.companyAvatarUrl || null,
        };
      }),
    [prioritizedParties]
  );

  // Search parties
  const searchParties = useCallback(async (query: string) => {
    const q = query.trim().toLowerCase();
    // Prioritized parties (travellers): show matching even with < 2 chars
    const matchingPrioritized = q.length === 0
      ? prioritizedAsParties
      : prioritizedAsParties.filter((p) =>
          (p.display_name || "").toLowerCase().includes(q) ||
          (p.first_name || "").toLowerCase().includes(q) ||
          (p.last_name || "").toLowerCase().includes(q)
        );

    if (q.length < minSearchChars) {
      setParties(matchingPrioritized);
      setShowCreateOption(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const params = new URLSearchParams({ search: query, limit: String(maxResults) });
      const skipRoleParam = directoryMatchTravellersApi && roleFilter === "client";
      if (roleFilter && !skipRoleParam) params.set("role", roleFilter);
      
      const response = await fetch(`/api/directory?${params.toString()}`, {
        cache: "no-store",
        headers: { ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}) },
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        let results: Record<string, unknown>[] = (data.data || data.records || data.parties || []) as Record<
          string,
          unknown
        >[];
        if (directoryMatchTravellersApi && roleFilter === "client") {
          results = results.filter(directoryRowMatchesTravellersSearch);
        }
        const prioById = new Map(prioritizedAsParties.map((p) => [p.id, p]));
        const apiParties: Party[] = results.map((r: Record<string, unknown>) => {
          const id = r.id as string;
          const prio = prioById.get(id);
          const apiAvatar = (r.avatarUrl as string) || (r.avatar_url as string) || null;
          const apiCompany =
            (r.companyAvatarUrl as string) || (r.company_avatar_url as string) || (r.logo_url as string) || null;
          return {
            id,
            displayId:
              (r.displayId as number | null | undefined) ??
              (r.display_id as number | null | undefined) ??
              null,
            display_name:
              (r.displayName as string) ||
              (r.display_name as string) ||
              [r.firstName || r.first_name, r.lastName || r.last_name].filter(Boolean).join(" ") ||
              (r.companyName as string) ||
              (r.company_name as string) ||
              (r.name as string) ||
              "",
            first_name: (r.firstName as string) || (r.first_name as string),
            last_name: (r.lastName as string) || (r.last_name as string),
            party_type: (r.type as string) || (r.party_type as string),
            avatarUrl: apiAvatar || prio?.avatarUrl || null,
            companyAvatarUrl: apiCompany || prio?.companyAvatarUrl || null,
          };
        });
        const apiIds = new Set(apiParties.map((p) => p.id));
        const dedupedPrioritized = matchingPrioritized.filter((p) => !apiIds.has(p.id));
        const transformedResults = [...dedupedPrioritized, ...apiParties];
        
        setAvatarLoadFailed({});
        setParties(transformedResults);
        
        const exactMatch = transformedResults.some((p: Party) => 
          (p.display_name || "").toLowerCase() === query.toLowerCase()
        );
        setShowCreateOption(!exactMatch && query.length >= minSearchChars);
      } else {
        setParties(matchingPrioritized);
        setShowCreateOption(query.length >= minSearchChars);
      }
    } catch (err) {
      console.error("Party search error:", err);
      setParties(matchingPrioritized);
      setShowCreateOption(query.length >= minSearchChars);
    } finally {
      setIsLoading(false);
    }
  }, [roleFilter, prioritizedAsParties, minSearchChars, maxResults, directoryMatchTravellersApi]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (allowFreeText) {
      setSelectedParty(null);
    }
    setIsOpen(true);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchParties(val);
    }, 300);
  };

  const handleSelect = (party: Party) => {
    const displayName = party.display_name || party.name || 
                       [party.first_name, party.last_name].filter(Boolean).join(" ");
    setSelectedParty(party);
    setInputValue(displayName);
    setIsOpen(false);
    onChange(party.id, displayName);
  };

  // Open create form with pre-filled data
  const handleOpenCreateForm = () => {
    const nameParts = inputValue.trim().split(/\s+/);
    setCreateFirstName(nameParts[0] || "");
    setCreateLastName(nameParts.slice(1).join(" ") || "");
    setCreateCompanyName(inputValue.trim());
    setCreateType("person");
    setCreateError("");
    setShowCreateForm(true);
    setIsOpen(false);
  };

  // Create new party via form
  const handleCreateSubmit = async () => {
    setCreateError("");
    
    // Validate
    if (createType === "person") {
      if (!createFirstName.trim() || !createLastName.trim()) {
        setCreateError("First name and last name are required");
        return;
      }
    } else {
      if (!createCompanyName.trim()) {
        setCreateError("Company name is required");
        return;
      }
    }

    setIsCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const payload: Record<string, unknown> = {
        type: createType,
        roles: roleFilter ? [roleFilter] : ["client"],
        isActive: true,
      };

      if (createType === "person") {
        payload.firstName = formatNameForDb(createFirstName.trim());
        payload.lastName = formatNameForDb(createLastName.trim());
        if (createPersonalCode.trim()) payload.personalCode = createPersonalCode.trim();
        if (createPhone.trim()) payload.phone = createPhone.trim();
        if (createEmail.trim()) payload.email = createEmail.trim();
      } else {
        payload.companyName = toTitleCase(createCompanyName.trim());
        if (createAddress.trim()) payload.legalAddress = toTitleCase(createAddress.trim());
        if (createRegNumber.trim()) payload.regNumber = createRegNumber.trim();
      }
      
      // Add service areas for suppliers
      if (roleFilter === "supplier" && createServiceAreas.length > 0) {
        payload.serviceAreas = createServiceAreas;
      }
      
      const response = await fetch("/api/directory/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        const displayName = createType === "person" 
          ? `${createFirstName.trim()} ${createLastName.trim()}`
          : createCompanyName.trim();
        
        const partyId = data.record?.id || data.id || data.party?.id;
        
        if (!partyId) {
          console.error("API response missing party id:", data);
          setCreateError("Client created but ID not returned");
          return;
        }
        
        const newParty: Party = {
          id: partyId,
          displayId: data.record?.displayId ?? data.record?.display_id ?? data.displayId ?? data.display_id ?? null,
          display_name: displayName,
          party_type: createType,
        };
        
        handleSelect(newParty);
        setShowCreateForm(false);
        resetCreateForm();
        setDuplicates([]);
      } else if (response.status === 409) {
        const errData = await response.json().catch(() => ({}));
        if (errData.error === "duplicate_found" && errData.duplicates?.length > 0) {
          setDuplicates(errData.duplicates);
          setCreateError(errData.message || "A contact with this name already exists.");
        } else {
          setCreateError(errData.message || "Duplicate found");
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        setCreateError(errData.error || "Failed to create");
      }
    } catch (err) {
      console.error("Create party error:", err);
      setCreateError("Network error");
    } finally {
      setIsCreating(false);
    }
  };

  const resetCreateForm = () => {
    setCreateFirstName("");
    setCreateLastName("");
    setCreatePersonalCode("");
    setCreatePhone("");
    setCreateEmail("");
    setCreateCompanyName("");
    setCreateAddress("");
    setCreateRegNumber("");
    setCreateServiceAreas([]);
    setCreateError("");
    setDuplicates([]);
    setForceConfirmed(false);
  };

  const [forceConfirmed, setForceConfirmed] = useState(false);

  const handleForceCreate = async () => {
    // Require double confirmation to prevent accidental duplicates
    if (!forceConfirmed) {
      setForceConfirmed(true);
      return;
    }
    setForceConfirmed(false);
    setDuplicates([]);
    setCreateError("");
    setIsCreating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const payload: Record<string, unknown> = {
        type: createType,
        roles: roleFilter ? [roleFilter] : ["client"],
        isActive: true,
        skipDedupCheck: true,
      };
      if (createType === "person") {
        payload.firstName = formatNameForDb(createFirstName.trim());
        payload.lastName = formatNameForDb(createLastName.trim());
        if (createPersonalCode.trim()) payload.personalCode = createPersonalCode.trim();
        if (createPhone.trim()) payload.phone = createPhone.trim();
        if (createEmail.trim()) payload.email = createEmail.trim();
      } else {
        payload.companyName = toTitleCase(createCompanyName.trim());
        if (createAddress.trim()) payload.legalAddress = toTitleCase(createAddress.trim());
        if (createRegNumber.trim()) payload.regNumber = createRegNumber.trim();
      }
      if (roleFilter === "supplier" && createServiceAreas.length > 0) {
        payload.serviceAreas = createServiceAreas;
      }
      const response = await fetch("/api/directory/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        const data = await response.json();
        const displayName = createType === "person"
          ? `${createFirstName.trim()} ${createLastName.trim()}`
          : createCompanyName.trim();
        const partyId = data.record?.id || data.id || data.party?.id;
        if (partyId) {
          handleSelect({ id: partyId, display_name: displayName, party_type: createType });
          setShowCreateForm(false);
          resetCreateForm();
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        setCreateError(errData.error || "Failed to create");
      }
    } catch (err) {
      console.error("Force create error:", err);
      setCreateError("Network error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectDuplicate = (dup: { id: string; displayName: string }) => {
    handleSelect({ id: dup.id, display_name: dup.displayName });
    setShowCreateForm(false);
    resetCreateForm();
  };
  
  // Service area options for suppliers — loaded from Settings > Travel Services
  const [serviceAreaOptions, setServiceAreaOptions] = useState<string[]>([]);
  useEffect(() => {
    if (!showCreateForm || roleFilter !== "supplier") return;
    let cancelled = false;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const res = await fetch("/api/travel-service-categories", {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
          credentials: "include",
        });
        if (cancelled || !res.ok) return;
        const data = await res.json();
        const names = (data.categories || [])
          .filter((c: { is_active?: boolean }) => c.is_active !== false)
          .map((c: { name: string }) => c.name);
        if (!cancelled) setServiceAreaOptions(names);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [showCreateForm, roleFilter]);
  
  const toggleServiceArea = (area: string) => {
    setCreateServiceAreas(prev => 
      prev.includes(area) 
        ? prev.filter(a => a !== area)
        : [...prev, area]
    );
  };

  const handleCancelCreate = () => {
    setShowCreateForm(false);
    resetCreateForm();
    inputRef.current?.focus();
  };

  // Sync inputValue when initialDisplayName changes
  useEffect(() => {
    if (initialDisplayName) {
      setInputValue(initialDisplayName);
    }
  }, [initialDisplayName]);

  // Load selected party on mount (only if no initialDisplayName provided)
  useEffect(() => {
    if (value && !selectedParty && !initialDisplayName) {
      const fetchParty = async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const response = await fetch(`/api/directory/${value}`, {
            headers: {
              ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
            },
            credentials: "include",
          });
          if (response.ok) {
            const data = await response.json();
            const party = data.record || data;
            if (party) {
              const displayName =
                party.displayName ||
                party.display_name ||
                party.name ||
                [party.firstName || party.first_name, party.lastName || party.last_name].filter(Boolean).join(" ") ||
                "";
              setSelectedParty({
                id: party.id,
                displayId: party.displayId ?? party.display_id ?? null,
                display_name: displayName,
                name: party.name,
                first_name: party.firstName || party.first_name,
                last_name: party.lastName || party.last_name,
                party_type: party.type || party.party_type,
                avatarUrl: party.avatarUrl || party.avatar_url || null,
                companyAvatarUrl: party.companyAvatarUrl || party.company_avatar_url || party.logo_url || null,
              });
              setInputValue(displayName);
            }
          }
        } catch (err) {
          console.error("Fetch party error:", err);
        }
      };
      fetchParty();
    }
  }, [value, selectedParty, initialDisplayName]);

  const DROPDOWN_MAX_H = 240;
  const updateDropdownPosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const openUpward = spaceBelow < DROPDOWN_MAX_H && rect.top > spaceBelow;
      setDropdownStyle({
        top: openUpward ? rect.top - DROPDOWN_MAX_H - 4 : rect.bottom + 4,
        left: rect.left,
        width: rect.width,
        openUpward,
      });
    }
  }, []);

  useEffect(() => {
    if (isOpen && (inputValue.length >= minSearchChars || parties.length > 0 || isLoading) && !showCreateForm) {
      updateDropdownPosition();
      const onScrollOrResize = () => updateDropdownPosition();
      window.addEventListener("scroll", onScrollOrResize, true);
      window.addEventListener("resize", onScrollOrResize);
      return () => {
        window.removeEventListener("scroll", onScrollOrResize, true);
        window.removeEventListener("resize", onScrollOrResize);
      };
    } else {
      setDropdownStyle(null);
    }
  }, [isOpen, inputValue.length, parties.length, isLoading, showCreateForm, updateDropdownPosition]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && 
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const handleClear = () => {
    setSelectedParty(null);
    setInputValue("");
    setWasCleared(true);
    onChange(null, "");
    inputRef.current?.focus();
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => {
            setIsOpen(true);
            if (inputValue.length >= minSearchChars) {
              searchParties(inputValue);
            }
          }}
          onBlur={() => {
            if (!allowFreeText) return;
            const trimmed = inputValue.trim();
            setInputValue(trimmed);
            onChange(null, trimmed);
          }}
          onKeyDown={(e) => {
            if (!allowFreeText || e.key !== "Enter") return;
            e.preventDefault();
            const trimmed = inputValue.trim();
            setInputValue(trimmed);
            setIsOpen(false);
            onChange(null, trimmed);
          }}
          placeholder="Search or type name..."
          className={`w-full rounded-lg border px-3 py-2.5 ${
            selectedParty?.displayId ? "pr-28" : "pr-10"
          } text-sm focus:outline-none focus:ring-1 ${
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-gray-300 focus:border-black focus:ring-black"
          }`}
          required={required}
          autoComplete="off"
        />
        {selectedParty?.displayId ? (
          <span className="pointer-events-none absolute right-10 top-1/2 -translate-y-1/2 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
            #{String(selectedParty.displayId).padStart(5, "0")}
          </span>
        ) : null}
        {(inputValue || selectedParty) && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-0 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center text-gray-400 hover:text-gray-600"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        )}
      </div>

      {/* Dropdown — render via portal so it's not clipped by modal overflow */}
      {isOpen && (inputValue.length >= minSearchChars || parties.length > 0 || isLoading) && !showCreateForm && dropdownStyle && typeof document !== "undefined" && createPortal(
        <div
          ref={dropdownRef}
          className="fixed z-[99999] rounded-lg border border-gray-200 bg-white shadow-xl max-h-[min(400px,calc(100vh-120px))] overflow-y-auto"
          style={{
            top: dropdownStyle.top,
            left: dropdownStyle.left,
            width: Math.max(dropdownStyle.width, 200),
            minWidth: 200,
          }}
        >
          {isLoading && (
            <div className="px-3 py-2 text-sm text-gray-500">Searching...</div>
          )}

          {!isLoading && parties.length === 0 && inputValue.length >= minSearchChars && (
            <div className="px-3 py-2 text-sm text-gray-500">No results found</div>
          )}

          {parties.map((party) => {
            const displayName = party.display_name || party.name || [party.first_name, party.last_name].filter(Boolean).join(" ");
            const displayId = party.displayId;
            const initials = displayName.trim().split(/\s+/).map((w: string) => w.charAt(0).toUpperCase()).slice(0, 2).join("");
            const rawAvatar = (party.avatarUrl || party.companyAvatarUrl || "").trim() || null;
            const avatarSrc = rawAvatar ? resolvePublicMediaUrl(rawAvatar, "avatars") || rawAvatar : null;
            const showAvatar = Boolean(avatarSrc) && !avatarLoadFailed[party.id];
            return (
              <button
                key={party.id}
                type="button"
                onClick={() => handleSelect(party)}
                className="w-full px-3 py-3 text-left text-sm hover:bg-gray-100 flex items-center gap-2.5"
              >
                {showAvatar ? (
                  <img
                    src={avatarSrc!}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-7 w-7 rounded-full object-cover shrink-0 border border-gray-200"
                    onError={() =>
                      setAvatarLoadFailed((prev: Record<string, boolean>) =>
                        prev[party.id] ? prev : { ...prev, [party.id]: true }
                      )
                    }
                  />
                ) : (
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700 shrink-0">
                    {initials || "?"}
                  </span>
                )}
                <span className="flex-1 min-w-0 truncate">{displayName}</span>
                {displayId ? (
                  <span className="shrink-0 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-500">
                    #{String(displayId).padStart(5, "0")}
                  </span>
                ) : null}
                {party.party_type && (
                  <span className="text-xs text-gray-400 shrink-0">{party.party_type}</span>
                )}
              </button>
            );
          })}

          {showCreateOption && !isLoading && (
            <button
              type="button"
              onClick={handleOpenCreateForm}
              className="w-full px-3 py-2 text-left text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 border-t border-gray-200"
            >
              <span className="font-medium">+ Create &quot;{inputValue}&quot;</span>
            </button>
          )}
        </div>,
        document.body
      )}

      {/* Create Form — centered modal so fully visible */}
      {showCreateForm && typeof document !== "undefined" && createPortal(
        <div
          ref={dropdownRef}
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/30"
          onClick={(e) => e.target === e.currentTarget && handleCancelCreate()}
        >
          <div
            ref={createFormTrapRef}
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-lg border border-gray-200 shadow-xl p-4 w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
          <h4 className="font-medium text-sm mb-3">
            {roleFilter === "supplier" ? "Create New Supplier" : "Create New Client"}
          </h4>
          
          {/* Type selector */}
          <div className="flex gap-4 mb-3">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="createType"
                checked={createType === "person"}
                onChange={() => setCreateType("person")}
                className="text-blue-600"
              />
              Person
            </label>
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="createType"
                checked={createType === "company"}
                onChange={() => setCreateType("company")}
                className="text-blue-600"
              />
              Company
            </label>
          </div>

          {createType === "person" ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="First Name *"
                  value={createFirstName}
                  onChange={(e) => setCreateFirstName(e.target.value)}
                  onBlur={() => setCreateFirstName((v) => formatNameForDb(v))}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
                <input
                  type="text"
                  placeholder="Last Name *"
                  value={createLastName}
                  onChange={(e) => setCreateLastName(e.target.value)}
                  onBlur={() => setCreateLastName((v) => formatNameForDb(v))}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
              <input
                type="text"
                placeholder="Personal Code"
                value={createPersonalCode}
                onChange={(e) => setCreatePersonalCode(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="tel"
                  placeholder="Phone"
                  value={createPhone}
                  onChange={(e) => setCreatePhone(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Company Name *"
                value={createCompanyName}
                onChange={(e) => setCreateCompanyName(e.target.value)}
                onBlur={() => setCreateCompanyName(v => toTitleCase(v))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
              />
              <input
                type="text"
                placeholder="Address"
                value={createAddress}
                onChange={(e) => setCreateAddress(e.target.value)}
                onBlur={() => setCreateAddress(v => toTitleCase(v))}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
              />
              <input
                type="text"
                placeholder="Reg. Number"
                value={createRegNumber}
                onChange={(e) => setCreateRegNumber(e.target.value)}
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-black"
              />
            </div>
          )}
          
          {/* Service Areas for Suppliers */}
          {roleFilter === "supplier" && (
            <div className="mt-3 pt-3 border-t border-gray-200">
              <label className="block text-xs font-medium text-gray-700 mb-2">Service Areas</label>
              <div className="flex flex-wrap gap-1.5">
                {serviceAreaOptions.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => toggleServiceArea(area)}
                    className={`px-2 py-1 text-xs rounded-full border transition-colors ${
                      createServiceAreas.includes(area)
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-white text-gray-700 border-gray-300 hover:border-gray-400"
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>
          )}

          {createError && !duplicates.length && (
            <p className="text-xs text-red-600 mt-2">{createError}</p>
          )}

          {duplicates.length > 0 && (
            <div className="mt-3 p-3 rounded-lg border border-amber-300 bg-amber-50">
              <p className="text-xs font-semibold text-amber-800 mb-2">
                A contact with this name already exists:
              </p>
              {duplicates.map((dup) => (
                <button
                  key={dup.id}
                  type="button"
                  onClick={() => handleSelectDuplicate(dup)}
                  className="flex w-full items-center justify-between rounded px-2 py-1.5 text-sm text-left hover:bg-amber-100 transition-colors"
                >
                  <span className="font-medium text-gray-900">{dup.displayName}</span>
                  <span className="text-xs text-gray-500">
                    ID: {String(dup.displayId || "").padStart(5, "0")}
                  </span>
                </button>
              ))}
              <div className="flex gap-2 mt-2 pt-2 border-t border-amber-200">
                <button
                  type="button"
                  onClick={handleForceCreate}
                  disabled={isCreating}
                  className={`flex-1 px-2 py-1 text-xs font-medium rounded disabled:opacity-50 ${
                    forceConfirmed
                      ? "text-red-700 border border-red-400 bg-red-50 hover:bg-red-100"
                      : "text-amber-700 border border-amber-300 hover:bg-amber-100"
                  }`}
                >
                  {isCreating
                    ? "Creating..."
                    : forceConfirmed
                    ? "Confirm: create duplicate"
                    : "Create anyway"}
                </button>
                {forceConfirmed && (
                  <button
                    type="button"
                    onClick={() => setForceConfirmed(false)}
                    className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-3">
            <button
              type="button"
              onClick={handleCancelCreate}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
              disabled={isCreating}
            >
              Cancel
            </button>
            {!duplicates.length && (
              <button
                type="button"
                onClick={handleCreateSubmit}
                disabled={isCreating}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {isCreating ? "Creating..." : "Save"}
              </button>
            )}
          </div>
          </div>
        </div>,
        document.body
      )}

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
