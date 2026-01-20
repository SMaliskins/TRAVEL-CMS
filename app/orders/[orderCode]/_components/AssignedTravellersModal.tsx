"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { useEscapeKey } from '@/lib/hooks/useEscapeKey';
import { supabase } from "@/lib/supabaseClient";

interface Traveller {
  id: string;
  firstName: string;
  lastName: string;
  title: "Mr" | "Mrs" | "Chd";
  dob?: string;
  personalCode?: string;
  contactNumber?: string;
  isMainClient?: boolean;
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
  resStatus: "booked" | "confirmed" | "changed" | "rejected" | "cancelled";
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

  // ESC key handler
  useEscapeKey(onClose);

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
    
    if (prevSorted !== currSorted) {
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
    const newTraveller: Traveller = {
      id: crypto.randomUUID(),
      firstName: "New Traveller",
      lastName: `${newTravellerCounter}`,
      title: "Mr",
    };

    if (suggestedMode === "none") {
      setOrderTravellers([...orderTravellers, newTraveller]);
    } else {
      setSuggestedTravellers([...suggestedTravellers, newTraveller]);
    }
    setNewTravellerCounter(newTravellerCounter + 1);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="mx-4 w-full max-w-6xl rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">👥</span>
                <h2 className="text-lg font-semibold text-gray-900">
                  Travellers
                </h2>
              </div>
              <div className="mt-1.5">
                <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                  {getServiceIcon(service.category)} {service.name} • {formatDate(service.dateFrom)}
                  {service.dateTo !== service.dateFrom &&
                    ` – ${formatDate(service.dateTo)}`}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Toast Message */}
        {toastMessage && (
          <div className="border-b border-gray-200 bg-green-50 px-4 py-2">
            <p className="text-xs font-medium text-green-800">{toastMessage}</p>
          </div>
        )}

        {/* Content */}
        <div className="flex p-4">
          {/* LEFT COLUMN - Pool */}
          <div className="w-64 flex-shrink-0 border-r border-gray-200 pr-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-700">
              Travellers (this order)
            </h3>

            <div className="mb-3 flex flex-wrap gap-2">
              <button
                onClick={handleAssignAll}
                className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Assign all
              </button>
              <div className="relative" ref={suggestedMenuRef}>
                <button
                  onClick={() => setShowSuggestedMenu(!showSuggestedMenu)}
                  className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Suggested
                </button>
                {showSuggestedMenu && (
                  <div className="absolute left-0 top-full z-10 mt-1 w-48 rounded-lg border border-gray-200 bg-white shadow-lg">
                    <div className="p-1">
                      {suggestedGroups.map((group) => (
                        <button
                          key={group.id}
                          onClick={() => handleSelectSuggestedGroup(group)}
                          className="w-full rounded px-2 py-1.5 text-left text-xs text-gray-700 transition-colors hover:bg-gray-100"
                        >
                          {group.name}
                        </button>
                      ))}
                      <div className="my-1 border-t border-gray-200" />
                      <button
                        onClick={handleAssignAllSuggested}
                        className="w-full rounded px-2 py-1.5 text-left text-xs font-medium text-blue-700 transition-colors hover:bg-blue-50"
                      >
                        Assign all to this service
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <button
                onClick={handleAddToPool}
                className="rounded border border-gray-300 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                + Add traveller
              </button>
            </div>

            {/* Suggested mode badge */}
            {suggestedMode !== "none" && (
              <div className="mb-2 rounded-lg border border-yellow-200 bg-yellow-50 p-2">
                <p className="mb-2 text-xs font-medium text-yellow-800">
                  Showing suggestions (not added to order)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={handleAddShownTravellersToService}
                    className="rounded border border-yellow-300 bg-white px-2 py-0.5 text-xs font-medium text-yellow-700 transition-colors hover:bg-yellow-100"
                  >
                    Add shown travellers to service
                  </button>
                  <button
                    onClick={handleReplaceTravellersForService}
                    className="rounded border border-yellow-300 bg-white px-2 py-0.5 text-xs font-medium text-yellow-700 transition-colors hover:bg-yellow-100"
                  >
                    Replace travellers for this service
                  </button>
                  <button
                    onClick={handleExitSuggestions}
                    className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    Exit suggestions
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1 max-h-[500px] overflow-y-auto">
              {poolTravellers.length === 0 ? (
                <p className="py-4 text-center text-xs text-gray-500">
                  No travellers in order
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
                      className={`group flex items-center justify-between rounded border p-2 transition-colors ${
                        draggedTravellerId === traveller.id
                          ? "opacity-50 border-blue-300 bg-blue-50"
                          : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <div className="text-xs font-medium text-gray-900 truncate">
                            {getTravellerInitials(traveller.id)} {traveller.firstName}{" "}
                            {traveller.lastName}
                          </div>
                          {isMainClient && (
                            <span className="inline-flex items-center rounded-full bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700">
                              Main client
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleAssignTraveller(traveller.id)}
                          className="rounded border border-gray-300 bg-white px-1.5 py-0.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100"
                        >
                          Assign
                        </button>
                        {!isMainClient && (
                          <button
                            onClick={(e) => handleRemoveFromPool(traveller.id, e)}
                            aria-label="Remove from order"
                            className="rounded p-0.5 text-gray-400 opacity-0 transition-opacity hover:bg-red-100 hover:text-red-600 group-hover:opacity-100"
                          >
                            <svg
                              className="h-3 w-3"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT COLUMN - Assigned Table */}
          <div className="flex-1 pl-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                Travellers for this service
              </h3>
              {assignedTravellers.length > 0 && (
                <button
                  onClick={handleRemoveAll}
                  className="rounded border border-red-200 bg-white px-2 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 hover:border-red-300"
                >
                  Remove all
                </button>
              )}
            </div>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="min-h-[400px] rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-2"
            >
              {assignedTravellers.length === 0 ? (
                <p className="py-8 text-center text-xs text-gray-500">
                  Drag travellers from left list or click "Assign"
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse bg-white text-xs">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-2 py-2 text-left font-medium text-gray-700">
                          Initials
                        </th>
                        <th className="px-2 py-2 text-left font-medium text-gray-700">
                          Title
                        </th>
                        <th className="px-2 py-2 text-left font-medium text-gray-700">
                          Name
                        </th>
                        <th className="px-2 py-2 text-left font-medium text-gray-700">
                          Surname
                        </th>
                        <th className="px-2 py-2 text-left font-medium text-gray-700">
                          DOB
                        </th>
                        <th className="px-2 py-2 text-left font-medium text-gray-700">
                          Personal code
                        </th>
                        <th className="px-2 py-2 text-left font-medium text-gray-700">
                          Contact number
                        </th>
                        <th className="px-2 py-2 text-left font-medium text-gray-700">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {assignedTravellers.map((traveller) => (
                        <tr
                          key={traveller.id}
                          className="hover:bg-gray-50"
                        >
                          <td className="px-2 py-2 font-medium text-gray-900">
                            {getTravellerInitials(traveller.id)}
                          </td>
                          <td className="px-2 py-2 text-gray-700">
                            {traveller.title}
                          </td>
                          <td className="px-2 py-2 text-gray-700">
                            {traveller.firstName}
                          </td>
                          <td className="px-2 py-2 text-gray-700">
                            {traveller.lastName}
                          </td>
                          <td className="px-2 py-2 text-gray-700">
                            {traveller.dob ? formatDate(traveller.dob) : "-"}
                          </td>
                          <td className="px-2 py-2 text-gray-700">
                            {traveller.personalCode || "-"}
                          </td>
                          <td className="px-2 py-2 text-gray-700">
                            {traveller.contactNumber || "-"}
                          </td>
                          <td className="px-2 py-2">
                            <button
                              onClick={() => handleRemoveTraveller(traveller.id)}
                              className="text-xs text-red-600 hover:text-red-800 hover:underline"
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

        {/* Footer */}
        <div className="border-t border-gray-200 px-4 py-3">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="rounded bg-blue-600 px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
