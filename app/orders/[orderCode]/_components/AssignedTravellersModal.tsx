"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { useEscapeKey } from '@/lib/hooks/useEscapeKey';
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useModalOverlay } from "@/contexts/ModalOverlayContext";
import { supabase } from "@/lib/supabaseClient";
import DirectoryCreateClientModal from "@/components/DirectoryCreateClientModal";

interface Traveller {
  id: string;
  firstName: string;
  lastName: string;
  title: string;
  dob?: string;
  personalCode?: string;
  contactNumber?: string;
  isMainClient?: boolean;
  avatarUrl?: string | null;
}

interface Service {
  id: string;
  dateFrom: string;
  dateTo: string;
  category: string;
  name: string;
  supplier: string;
  client: string;
  payer: string;
  servicePrice: number;
  clientPrice: number;
  resStatus: "draft" | "booked" | "confirmed" | "changed" | "rejected" | "cancelled";
  refNr?: string;
  ticketNr?: string;
  assignedTravellerIds: string[];
}

interface SuggestedGroup {
  id: string;
  name: string;
  mode: "last" | "second" | "frequent";
  travellers: Traveller[];
}

interface AssignedTravellersModalProps {
  service: Service;
  orderTravellers: Traveller[];
  setOrderTravellers: React.Dispatch<React.SetStateAction<Traveller[]>>;
  services: Service[];
  setServices: React.Dispatch<React.SetStateAction<Service[]>>;
  mainClientId: string;
  orderCode?: string;
  onClose: () => void;
}

export default function AssignedTravellersModal({
  service,
  orderTravellers,
  setOrderTravellers,
  services,
  setServices,
  mainClientId,
  orderCode,
  onClose,
}: AssignedTravellersModalProps) {
  useModalOverlay();
  const [draggedTravellerId, setDraggedTravellerId] = useState<string | null>(
    null
  );
  const [newTravellerCounter, setNewTravellerCounter] = useState(1);
  const [showSuggestedMenu, setShowSuggestedMenu] = useState(false);
  const suggestedMenuRef = useRef<HTMLDivElement>(null);
  const [suggestedMode, setSuggestedMode] = useState<"none" | "last" | "second" | "frequent">("none");
  const [suggestedTravellers, setSuggestedTravellers] = useState<Traveller[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [suggestedGroups, setSuggestedGroups] = useState<SuggestedGroup[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  
  // Add traveller search state
  const [showAddSearch, setShowAddSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ id: string; name: string; phone?: string; email?: string; avatarUrl?: string }>>([]);
  const [selectedSearchIds, setSelectedSearchIds] = useState<Set<string>>(new Set());
  const [isAddingSelected, setIsAddingSelected] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [showCreateClientModal, setShowCreateClientModal] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ESC key handler
  useEscapeKey(onClose);
  const trapRef = useFocusTrap<HTMLDivElement>(true);

  // Fetch suggested travellers from API
  const fetchSuggestedTravellers = useCallback(async () => {
    if (!mainClientId) return;
    
    setIsLoadingSuggestions(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/parties/${encodeURIComponent(mainClientId)}/suggested-travellers`, {
        headers: {
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setSuggestedGroups(data.suggestedGroups || []);
      }
    } catch (err) {
      console.error("Fetch suggested travellers error:", err);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [mainClientId]);

  useEffect(() => {
    fetchSuggestedTravellers();
  }, [fetchSuggestedTravellers]);

  // Search directory for travellers
  const searchDirectory = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/directory?search=${encodeURIComponent(query)}&limit=10`, {
        headers: {
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        // Filter to only show persons (clients)
        const results = (data.data || [])
          .filter((item: { roles?: string[] }) => 
            item.roles?.includes("client") || !item.roles?.includes("supplier")
          )
          .map((item: { id: string; firstName?: string; lastName?: string; companyName?: string; phone?: string; email?: string; avatarUrl?: string }) => {
            // Build display name from firstName + lastName or companyName
            let displayName = "";
            if (item.firstName || item.lastName) {
              displayName = [item.firstName, item.lastName].filter(Boolean).join(" ");
            } else if (item.companyName) {
              displayName = item.companyName;
            }
            return {
              id: item.id,
              name: displayName || "Unknown",
              phone: item.phone,
              email: item.email,
              avatarUrl: item.avatarUrl,
            };
          });
        setSearchResults(results);
      }
    } catch (err) {
      console.error("Search directory error:", err);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (showAddSearch && searchQuery) {
        searchDirectory(searchQuery);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, showAddSearch, searchDirectory]);

  // Focus search input when showing
  useEffect(() => {
    if (showAddSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showAddSearch]);

  // Save service travellers to API
  const saveServiceTravellers = useCallback(async (serviceId: string, travellerIds: string[]) => {
    if (!orderCode) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      await fetch(`/api/services/${encodeURIComponent(serviceId)}/travellers`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ travellerIds }),
      });
    } catch (err) {
      console.error("Save service travellers error:", err);
    }
  }, [orderCode]);

  // Add traveller to order via API
  const addTravellerToOrder = useCallback(async (partyId: string) => {
    if (!orderCode) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      await fetch(`/api/orders/${encodeURIComponent(orderCode)}/travellers`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ partyId }),
      });
    } catch (err) {
      console.error("Add traveller to order error:", err);
    }
  }, [orderCode]);

  const assignedTravellerIds = service.assignedTravellerIds;
  const prevAssignedRef = useRef<string[]>(assignedTravellerIds);

  // Auto-save service travellers when they change
  useEffect(() => {
    // Skip on initial mount
    if (prevAssignedRef.current === assignedTravellerIds) return;
    
    // Check if actually changed
    const prevSorted = [...prevAssignedRef.current].sort().join(",");
    const currSorted = [...assignedTravellerIds].sort().join(",");
    
    console.log("[Auto-save] Checking travellers change:", {
      prev: prevSorted,
      curr: currSorted,
      changed: prevSorted !== currSorted,
      assignedTravellerIds
    });
    
    if (prevSorted !== currSorted) {
      console.log("[Auto-save] Saving travellers for service:", service.id);
      saveServiceTravellers(service.id, assignedTravellerIds);
      prevAssignedRef.current = assignedTravellerIds;
    }
  }, [assignedTravellerIds, service.id, saveServiceTravellers]);

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Show list: orderTravellers or suggestedTravellers based on mode
  const showList = suggestedMode === "none" ? orderTravellers : suggestedTravellers;

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showSuggestedMenu) {
          setShowSuggestedMenu(false);
        } else if (suggestedMode !== "none") {
          setSuggestedMode("none");
        } else {
          onClose();
        }
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose, showSuggestedMenu, suggestedMode]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        suggestedMenuRef.current &&
        !suggestedMenuRef.current.contains(e.target as Node)
      ) {
        setShowSuggestedMenu(false);
      }
    };
    if (showSuggestedMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showSuggestedMenu]);

  const handleDragStart = (travellerId: string) => {
    setDraggedTravellerId(travellerId);
  };

  const handleDragEnd = () => {
    setDraggedTravellerId(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedTravellerId) return;

    handleAssignTraveller(draggedTravellerId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleAssignTraveller = (travellerId: string) => {
    const currentService = services.find((s) => s.id === service.id);
    if (!currentService) return;

    // If in suggested mode, add traveller to orderTravellers first
    if (suggestedMode !== "none") {
      const traveller = suggestedTravellers.find((t) => t.id === travellerId);
      if (traveller) {
        // Check if already exists in orderTravellers by ID (since suggested travellers have real party IDs)
        const existingTraveller = orderTravellers.find((t) => t.id === traveller.id);

        if (currentService.assignedTravellerIds.includes(traveller.id)) return;

        // Add to orderTravellers if doesn't exist
        if (!existingTraveller) {
          setOrderTravellers((current) => [...current, traveller]);
          // Also add to order via API
          addTravellerToOrder(traveller.id);
        }

        // Assign to service
        setServices(
          services.map((s) =>
            s.id === service.id
              ? {
                  ...s,
                  assignedTravellerIds: [...s.assignedTravellerIds, traveller.id],
                }
              : s
          )
        );
        return;
      }
    }

    // Normal mode
    if (currentService.assignedTravellerIds.includes(travellerId)) return;

    setServices(
      services.map((s) =>
        s.id === service.id
          ? {
              ...s,
              assignedTravellerIds: [...s.assignedTravellerIds, travellerId],
            }
          : s
      )
    );
  };

  const handleRemoveTraveller = (travellerId: string) => {
    setServices(
      services.map((s) =>
        s.id === service.id
          ? {
              ...s,
              assignedTravellerIds: s.assignedTravellerIds.filter(
                (id) => id !== travellerId
              ),
            }
          : s
      )
    );
  };

  const handleAssignAll = () => {
    if (suggestedMode !== "none") {
      // Add suggested travellers to orderTravellers first (without duplicates)
      setOrderTravellers((current) => {
        const travellersToAdd: Traveller[] = [];
        suggestedTravellers.forEach((suggestedTraveller) => {
          const exists = current.some((t) => t.id === suggestedTraveller.id);
          if (!exists) {
            travellersToAdd.push(suggestedTraveller);
            // Add to order via API
            addTravellerToOrder(suggestedTraveller.id);
          }
        });

        // Use traveller IDs directly (they're real party IDs from API)
        const suggestedIds = suggestedTravellers.map((t) => t.id);
        const uniqueIds = Array.from(
          new Set([...assignedTravellerIds, ...suggestedIds])
        );

        setServices(
          services.map((s) =>
            s.id === service.id
              ? { ...s, assignedTravellerIds: uniqueIds }
              : s
          )
        );

        return [...current, ...travellersToAdd];
      });
    } else {
      // Normal mode: assign all from orderTravellers
      const allTravellerIds = orderTravellers.map((t) => t.id);
      const uniqueIds = Array.from(
        new Set([...assignedTravellerIds, ...allTravellerIds])
      );

      setServices(
        services.map((s) =>
          s.id === service.id
            ? { ...s, assignedTravellerIds: uniqueIds }
            : s
        )
      );
    }
  };

  const handleRemoveAll = () => {
    setServices(
      services.map((s) =>
        s.id === service.id ? { ...s, assignedTravellerIds: [] } : s
      )
    );
  };

  const handleAddToPool = () => {
    setShowAddSearch(true);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedSearchIds(new Set());
  };

  const handleToggleSearchItem = (itemId: string) => {
    setSelectedSearchIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const handleAddSelectedTravellers = async () => {
    if (selectedSearchIds.size === 0) return;
    setIsAddingSelected(true);

    const itemsToAdd = searchResults.filter((r) => selectedSearchIds.has(r.id));
    const { data: { session } } = await supabase.auth.getSession();
    let addedCount = 0;

    for (const item of itemsToAdd) {
      if (orderTravellers.some((t) => t.id === item.id)) continue;
      try {
        const response = await fetch(`/api/directory/${encodeURIComponent(item.id)}`, {
          headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          const record = data.data || data;
          const newTraveller: Traveller = {
            id: item.id,
            firstName: record.firstName || item.name.split(" ")[0] || "",
            lastName: record.lastName || item.name.split(" ").slice(1).join(" ") || "",
            title: record.title || "Mr",
            dob: record.dob || undefined,
            personalCode: record.personalCode || undefined,
            contactNumber: record.phone || undefined,
            avatarUrl: record.avatarUrl || item.avatarUrl || null,
          };
          setOrderTravellers((prev) => [...prev, newTraveller]);
          addTravellerToOrder(item.id);
          addedCount++;
        }
      } catch (err) {
        console.error("Fetch traveller details error:", err);
      }
    }

    if (addedCount > 0) {
      setToastMessage(`Added ${addedCount} traveller${addedCount > 1 ? "s" : ""} to order`);
    }

    setShowAddSearch(false);
    setSearchQuery("");
    setSelectedSearchIds(new Set());
    setIsAddingSelected(false);
  };

  const handleDirectoryClientCreated = async (partyId: string, displayName: string) => {
    if (orderTravellers.some((t) => t.id === partyId)) {
      setShowCreateClientModal(false);
      return;
    }
    setShowCreateClientModal(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(`/api/directory/${encodeURIComponent(partyId)}`, {
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        const record = data.data || data;
        const newTraveller: Traveller = {
          id: partyId,
          firstName: record.firstName || displayName.split(" ")[0] || "",
          lastName: record.lastName || displayName.split(" ").slice(1).join(" ") || "",
          title: record.title || "Mr",
          dob: record.dob || undefined,
          personalCode: record.personalCode || undefined,
          contactNumber: record.phone || undefined,
          avatarUrl: record.avatarUrl || null,
        };
        setOrderTravellers((prev) => [...prev, newTraveller]);
        await addTravellerToOrder(partyId);
        setToastMessage(`Added ${displayName} to order`);
      }
    } catch (err) {
      console.error("Load new traveller after create:", err);
    }
    setShowAddSearch(false);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedSearchIds(new Set());
  };

  const travellerExists = (firstName: string, lastName: string): boolean => {
    return orderTravellers.some(
      (t) => t.firstName === firstName && t.lastName === lastName
    );
  };

  const handleSelectSuggestedGroup = (group: SuggestedGroup) => {
    // Use travellers from API (they already have IDs)
    setSuggestedTravellers(group.travellers);
    setSuggestedMode(group.mode);
    setShowSuggestedMenu(false);
  };

  const handleAddShownTravellersToService = () => {
    if (suggestedMode === "none") {
      return; // Disabled state - nothing to do
    }

    // Merge suggestedTravellers into orderTravellers (without duplicates by ID)
    setOrderTravellers((current) => {
      const travellersToAdd: Traveller[] = [];
      suggestedTravellers.forEach((suggestedTraveller) => {
        const exists = current.some((t) => t.id === suggestedTraveller.id);
        if (!exists) {
          travellersToAdd.push(suggestedTraveller);
          // Add to order via API
          addTravellerToOrder(suggestedTraveller.id);
        }
      });

      // Use traveller IDs directly (they're real party IDs from API)
      const suggestedIds = suggestedTravellers.map((t) => t.id);

      // Union: existing assigned + suggested IDs
      const unionIds = Array.from(
        new Set([...assignedTravellerIds, ...suggestedIds])
      );

      // Update services with functional update
      setServices((prevServices) =>
        prevServices.map((s) =>
          s.id === service.id
            ? { ...s, assignedTravellerIds: unionIds }
            : s
        )
      );

      const addedCount = suggestedIds.filter(
        (id) => !assignedTravellerIds.includes(id)
      ).length;
      if (addedCount > 0) {
        setToastMessage(
          `Added ${addedCount} traveller${addedCount > 1 ? "s" : ""} to service`
        );
      }

      return [...current, ...travellersToAdd];
    });
  };

  const handleReplaceTravellersForService = () => {
    // First, ensure all suggested travellers exist in orderTravellers
    setOrderTravellers((current) => {
      const travellersToAdd: Traveller[] = [];
      suggestedTravellers.forEach((suggestedTraveller) => {
        const exists = current.some((t) => t.id === suggestedTraveller.id);
        if (!exists) {
          travellersToAdd.push(suggestedTraveller);
          // Add to order via API
          addTravellerToOrder(suggestedTraveller.id);
        }
      });

      // Use traveller IDs directly
      const suggestedIds = suggestedTravellers.map((t) => t.id);

      // Replace assignedTravellerIds for current service
      setServices(
        services.map((s) =>
          s.id === service.id
            ? { ...s, assignedTravellerIds: suggestedIds }
            : s
        )
      );

      return [...current, ...travellersToAdd];
    });

    setToastMessage("Replaced travellers for this service");
    setSuggestedMode("none");
  };

  const handleExitSuggestions = () => {
    setSuggestedMode("none");
    setSuggestedTravellers([]);
  };

  const handleAssignAllSuggested = () => {
    handleAssignAll();
    setShowSuggestedMenu(false);
  };

  const handleRemoveFromPool = (travellerId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    // Cannot remove main client
    if (travellerId === mainClientId) {
      alert("Cannot remove main client from order.");
      return;
    }

    // If in suggested mode, remove from suggested list
    if (suggestedMode !== "none") {
      setSuggestedTravellers(
        suggestedTravellers.filter((t) => t.id !== travellerId)
      );
      return;
    }

    // Check if traveller is assigned to any service (including current)
    const isAssignedToAnyService = services.some((s) =>
      s.assignedTravellerIds.includes(travellerId)
    );

    if (isAssignedToAnyService) {
      alert(
        "Traveller is assigned to services. Remove from those services first."
      );
      return;
    }

    // Remove from orderTravellers
    setOrderTravellers(
      orderTravellers.filter((t) => t.id !== travellerId)
    );
  };

  // Use centralized date formatting
  const formatDate = formatDateDDMMYYYY;

  const getServiceIcon = (category: string) => {
    const categoryLower = category.toLowerCase();
    if (categoryLower.includes("hotel")) return "🏨";
    if (categoryLower.includes("flight")) return "✈️";
    if (categoryLower.includes("transfer")) return "🚗";
    return "🧾";
  };

  const getTravellerInitials = (travellerId: string) => {
    // For assigned travellers, always use orderTravellers
    const traveller = orderTravellers.find((t) => t.id === travellerId) ||
      showList.find((t) => t.id === travellerId);
    if (!traveller) return "??";
    return (
      traveller.firstName.charAt(0) + traveller.lastName.charAt(0)
    ).toUpperCase();
  };

  // Assigned travellers always come from orderTravellers (not suggested)
  const assignedTravellers = orderTravellers.filter((t) =>
    assignedTravellerIds.includes(t.id)
  );

  // Pool travellers come from showList (orderTravellers or suggestedTravellers)
  const poolTravellers = showList.filter(
    (t) => !assignedTravellerIds.includes(t.id)
  );

  return (
    <>
    <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div ref={trapRef} className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                  <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    Travellers
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {getServiceIcon(service.category)} {service.name} • {formatDate(service.dateFrom)}
                    {service.dateTo !== service.dateFrom && ` – ${formatDate(service.dateTo)}`}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
              title="Close"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Toast Message */}
        {toastMessage && (
          <div className="border-b border-gray-200 bg-green-50 px-6 py-3 flex-shrink-0">
            <p className="text-sm font-medium text-green-800">{toastMessage}</p>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-5">
            {/* TOP SECTION - Pool */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                  Travellers (this order)
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleAssignAll}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    Assign all
                  </button>
                  <div className="relative" ref={suggestedMenuRef}>
                    <button
                      onClick={() => setShowSuggestedMenu(!showSuggestedMenu)}
                      className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      Suggested
                    </button>
                    {showSuggestedMenu && (
                      <div className="absolute right-0 top-full z-10 mt-1 w-56 rounded-lg border border-gray-200 bg-white shadow-lg">
                        <div className="p-2">
                          {suggestedGroups.map((group) => (
                            <button
                              key={group.id}
                              onClick={() => handleSelectSuggestedGroup(group)}
                              className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100"
                            >
                              {group.name}
                            </button>
                          ))}
                          <div className="my-2 border-t border-gray-200" />
                          <button
                            onClick={handleAssignAllSuggested}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50"
                          >
                            Assign all to this service
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleAddToPool}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    + Add traveller
                  </button>
                </div>
              </div>

            {/* Add traveller search panel */}
            {showAddSearch && (
              <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium text-blue-800">Search Directory</span>
                  <button
                    onClick={() => setShowAddSearch(false)}
                    className="ml-auto p-1 rounded text-blue-600 hover:text-blue-800 hover:bg-blue-100"
                    title="Close search"
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
                {isSearching && (
                  <p className="mt-2 text-sm text-blue-600">Searching...</p>
                )}
                {searchResults.length > 0 && (
                  <div className="mt-3">
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-blue-200 bg-white">
                      {searchResults.map((item) => {
                        const isSelected = selectedSearchIds.has(item.id);
                        const alreadyInOrder = orderTravellers.some((t) => t.id === item.id);
                        return (
                          <button
                            key={item.id}
                            onClick={() => !alreadyInOrder && handleToggleSearchItem(item.id)}
                            disabled={alreadyInOrder}
                            className={`w-full px-4 py-3 text-left border-b border-blue-100 last:border-b-0 transition-colors ${
                              alreadyInOrder
                                ? "opacity-50 cursor-default bg-gray-50"
                                : isSelected
                                ? "bg-blue-100"
                                : "hover:bg-blue-50"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`flex h-5 w-5 items-center justify-center rounded border shrink-0 ${
                                alreadyInOrder
                                  ? "border-gray-300 bg-gray-200"
                                  : isSelected
                                  ? "border-blue-500 bg-blue-500"
                                  : "border-gray-300 bg-white"
                              }`}>
                                {(isSelected || alreadyInOrder) && (
                                  <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              {item.avatarUrl ? (
                                <img src={item.avatarUrl} alt={item.name} className="h-9 w-9 rounded-full object-cover border border-blue-200 shrink-0" />
                              ) : (
                                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700 shrink-0">
                                  {(item.name || "?").trim().charAt(0).toUpperCase()}
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-gray-900 text-sm truncate">
                                  {item.name}
                                  {alreadyInOrder && <span className="ml-1 text-xs text-gray-400">(in order)</span>}
                                </div>
                                {(item.phone || item.email) && (
                                  <div className="text-gray-500 text-sm mt-0.5 truncate">
                                    {item.phone} {item.email && `• ${item.email}`}
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    {selectedSearchIds.size > 0 && (
                      <button
                        onClick={handleAddSelectedTravellers}
                        disabled={isAddingSelected}
                        className="mt-2 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                      >
                        {isAddingSelected
                          ? "Adding..."
                          : `Add ${selectedSearchIds.size} traveller${selectedSearchIds.size > 1 ? "s" : ""}`}
                      </button>
                    )}
                  </div>
                )}
                {searchQuery.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
                  <p className="mt-2 text-sm text-gray-500">No results found</p>
                )}
                {searchQuery.trim().length >= 2 && !isSearching && (
                  <button
                    type="button"
                    onClick={() => setShowCreateClientModal(true)}
                    className="mt-3 w-full rounded-lg border border-blue-300 bg-blue-50 px-3 py-2.5 text-left text-sm font-medium text-blue-800 hover:bg-blue-100"
                  >
                    + Create new client
                    {searchQuery.trim() ? ` — "${searchQuery.trim()}"` : ""}
                  </button>
                )}
              </div>
            )}

            {/* Suggested mode badge */}
            {suggestedMode !== "none" && (
              <div className="mb-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4">
                <p className="mb-3 text-sm font-medium text-yellow-800">
                  Showing suggestions (not added to order)
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleAddShownTravellersToService}
                    className="rounded-lg border border-yellow-300 bg-white px-3 py-1.5 text-sm font-medium text-yellow-700 transition-colors hover:bg-yellow-100"
                  >
                    Add shown travellers
                  </button>
                  <button
                    onClick={handleReplaceTravellersForService}
                    className="rounded-lg border border-yellow-300 bg-white px-3 py-1.5 text-sm font-medium text-yellow-700 transition-colors hover:bg-yellow-100"
                  >
                    Replace travellers
                  </button>
                  <button
                    onClick={handleExitSuggestions}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Exit
                  </button>
                </div>
              </div>
            )}

              <div className="flex flex-wrap gap-2">
                {poolTravellers.length === 0 ? (
                  <p className="py-2 text-sm text-gray-400 italic">
                    {assignedTravellers.length > 0 ? "All travellers assigned" : "No travellers in order"}
                  </p>
                ) : (
                  poolTravellers.map((traveller) => {
                    const isMainClient = traveller.id === mainClientId;
                    return (
                      <div
                        key={traveller.id}
                        draggable
                        onDragStart={() => handleDragStart(traveller.id)}
                        onDragEnd={handleDragEnd}
                        className={`group flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors cursor-grab ${
                          draggedTravellerId === traveller.id
                            ? "opacity-50 border-blue-300 bg-blue-50"
                            : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50 hover:shadow-sm"
                        }`}
                      >
                        {traveller.avatarUrl ? (
                          <img src={traveller.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />
                        ) : (
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700 shrink-0">
                            {getTravellerInitials(traveller.id)}
                          </span>
                        )}
                        <span className="text-sm font-medium text-gray-900 whitespace-nowrap">
                          {traveller.firstName} {traveller.lastName}
                        </span>
                        {isMainClient && (
                          <span className="inline-flex items-center rounded-full bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                            Main
                          </span>
                        )}
                        <button
                          onClick={() => handleAssignTraveller(traveller.id)}
                          className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 ml-1"
                        >
                          Assign
                        </button>
                        {!isMainClient && (
                          <button
                            onClick={(e) => handleRemoveFromPool(traveller.id, e)}
                            aria-label="Remove from order"
                            className="rounded p-0.5 text-gray-400 opacity-0 transition-all hover:bg-red-100 hover:text-red-600 group-hover:opacity-100"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* BOTTOM SECTION - Assigned Table */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
                  Travellers for this service
                </h3>
                {assignedTravellers.length > 0 && (
                  <button
                    onClick={handleRemoveAll}
                    className="rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:border-red-300"
                  >
                    Remove all
                  </button>
                )}
              </div>
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="min-h-[300px] lg:min-h-[400px] rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-4"
              >
                {assignedTravellers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <svg className="h-12 w-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-sm text-gray-500">
                      Drag travellers from the list or click &quot;Assign&quot;
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
                    <table className="w-full border-collapse text-sm table-fixed">
                      <thead>
                        <tr className="border-b border-gray-200 bg-gray-50">
                          <th className="px-2 py-2 text-left font-medium text-gray-700 w-[30%]">
                            Traveller
                          </th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700 w-[8%]">
                            Title
                          </th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700 w-[16%]">
                            DOB
                          </th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700 hidden lg:table-cell w-[18%]">
                            Personal code
                          </th>
                          <th className="px-2 py-2 text-left font-medium text-gray-700 w-[18%]">
                            Contact
                          </th>
                          <th className="px-2 py-2 text-right font-medium text-gray-700 w-[10%]">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {assignedTravellers.map((traveller) => (
                          <tr key={traveller.id} className="hover:bg-gray-50">
                            <td className="px-2 py-2">
                              <div className="flex items-center gap-2">
                                {traveller.avatarUrl ? (
                                  <img src={traveller.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover shrink-0" />
                                ) : (
                                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700 shrink-0">
                                    {getTravellerInitials(traveller.id)}
                                  </span>
                                )}
                                <div className="min-w-0">
                                  <div className="font-medium text-gray-900 truncate">
                                    {traveller.firstName} {traveller.lastName}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-2 py-2 text-gray-700">
                              {traveller.title}
                            </td>
                            <td className="px-2 py-2 text-gray-700">
                              {traveller.dob ? formatDate(traveller.dob) : "-"}
                            </td>
                            <td className="px-2 py-2 text-gray-700 hidden lg:table-cell truncate">
                              {traveller.personalCode || "-"}
                            </td>
                            <td className="px-2 py-2 text-gray-700 truncate">
                              {traveller.contactNumber || "-"}
                            </td>
                            <td className="px-2 py-2 text-right">
                              <button
                                onClick={() => handleRemoveTraveller(traveller.id)}
                                className="text-sm text-red-600 hover:text-red-800 font-medium"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex-shrink-0 bg-gray-50">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
    <DirectoryCreateClientModal
      isOpen={showCreateClientModal}
      onClose={() => setShowCreateClientModal(false)}
      onCreated={handleDirectoryClientCreated}
      initialNameQuery={searchQuery}
    />
    </>
  );
}
