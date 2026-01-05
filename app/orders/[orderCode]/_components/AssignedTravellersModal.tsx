"use client";

import { useState, useEffect, useRef } from "react";

interface Traveller {
  id: string;
  firstName: string;
  lastName: string;
  title: "Mr" | "Mrs" | "Chd";
  dob?: string;
  personalCode?: string;
  contactNumber?: string;
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

interface AssignedTravellersModalProps {
  service: Service;
  orderTravellers: Traveller[];
  setOrderTravellers: React.Dispatch<React.SetStateAction<Traveller[]>>;
  services: Service[];
  setServices: React.Dispatch<React.SetStateAction<Service[]>>;
  mainClientId: string;
  onClose: () => void;
}

// Mock suggested travellers groups
const suggestedGroups: Array<{
  id: string;
  name: string;
  mode: "last" | "second" | "frequent";
  travellers: Array<{
    firstName: string;
    lastName: string;
    title: "Mr" | "Mrs" | "Chd";
    dob?: string;
    personalCode?: string;
    contactNumber?: string;
  }>;
}> = [
  {
    id: "last-trip",
    name: "Last trip party",
    mode: "last",
    travellers: [
      { firstName: "John", lastName: "Smith", title: "Mr" },
      { firstName: "Jane", lastName: "Smith", title: "Mrs" },
    ],
  },
  {
    id: "second-last",
    name: "Second last party",
    mode: "second",
    travellers: [
      { firstName: "Alice", lastName: "Brown", title: "Mrs" },
      { firstName: "Bob", lastName: "Johnson", title: "Mr" },
      { firstName: "Charlie", lastName: "Wilson", title: "Chd", dob: "2015-06-15" },
    ],
  },
  {
    id: "most-frequent",
    name: "Most frequent party",
    mode: "frequent",
    travellers: [
      { firstName: "David", lastName: "Martinez", title: "Mr" },
      { firstName: "Emma", lastName: "Garcia", title: "Mrs" },
    ],
  },
];

export default function AssignedTravellersModal({
  service,
  orderTravellers,
  setOrderTravellers,
  services,
  setServices,
  mainClientId,
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

  const assignedTravellerIds = service.assignedTravellerIds;

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
        // Check if already exists in orderTravellers
        const existingTraveller = orderTravellers.find(
          (t) =>
            t.firstName === traveller.firstName &&
            t.lastName === traveller.lastName
        );

        const finalId = existingTraveller ? existingTraveller.id : traveller.id;

        if (currentService.assignedTravellerIds.includes(finalId)) return;

        // Add to orderTravellers if doesn't exist
        if (!existingTraveller) {
          setOrderTravellers((current) => [...current, traveller]);
        }

        // Assign to service
        setServices(
          services.map((s) =>
            s.id === service.id
              ? {
                  ...s,
                  assignedTravellerIds: [...s.assignedTravellerIds, finalId],
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
          const exists = current.some(
            (t) =>
              t.firstName === suggestedTraveller.firstName &&
              t.lastName === suggestedTraveller.lastName
          );
          if (!exists) {
            travellersToAdd.push(suggestedTraveller);
          }
        });

        // Map suggested IDs to orderTraveller IDs (with new ones added)
        const updatedOrderTravellers = [...current, ...travellersToAdd];
        const mappedIds = suggestedTravellers.map((t) => {
          const existing = updatedOrderTravellers.find(
            (ot) =>
              ot.firstName === t.firstName &&
              ot.lastName === t.lastName
          );
          return existing ? existing.id : t.id;
        });
        const uniqueIds = Array.from(
          new Set([...assignedTravellerIds, ...mappedIds])
        );

        setServices(
          services.map((s) =>
            s.id === service.id
              ? { ...s, assignedTravellerIds: uniqueIds }
              : s
          )
        );

        return updatedOrderTravellers;
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

  const handleSelectSuggestedGroup = (group: typeof suggestedGroups[0]) => {
    // Create Traveller objects from suggested group
    const travellers: Traveller[] = group.travellers.map((t) => ({
      id: crypto.randomUUID(),
      firstName: t.firstName,
      lastName: t.lastName,
      title: t.title,
      dob: t.dob,
      personalCode: t.personalCode,
      contactNumber: t.contactNumber,
    }));

    setSuggestedTravellers(travellers);
    setSuggestedMode(group.mode);
    setShowSuggestedMenu(false);
  };

  const handleAddShownTravellersToService = () => {
    if (suggestedMode === "none") {
      return; // Disabled state - nothing to do
    }

    // Merge suggestedTravellers into orderTravellers (without duplicates by name, then map to IDs)
    setOrderTravellers((current) => {
      const travellersToAdd: Traveller[] = [];
      suggestedTravellers.forEach((suggestedTraveller) => {
        const exists = current.some(
          (t) =>
            t.firstName === suggestedTraveller.firstName &&
            t.lastName === suggestedTraveller.lastName
        );
        if (!exists) {
          travellersToAdd.push(suggestedTraveller);
        }
      });

      // Add new travellers to orderTravellers
      const updatedOrderTravellers =
        travellersToAdd.length > 0
          ? [...current, ...travellersToAdd]
          : current;

      // Map suggested travellers to their IDs in orderTravellers (by name)
      const suggestedIds = suggestedTravellers.map((suggestedTraveller) => {
        const existing = updatedOrderTravellers.find(
          (t) =>
            t.firstName === suggestedTraveller.firstName &&
            t.lastName === suggestedTraveller.lastName
        );
        return existing ? existing.id : suggestedTraveller.id;
      });

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

      return updatedOrderTravellers;
    });
  };

  const handleReplaceTravellersForService = () => {
    // First, ensure all suggested travellers exist in orderTravellers
    setOrderTravellers((current) => {
      const travellersToAdd: Traveller[] = [];
      suggestedTravellers.forEach((suggestedTraveller) => {
        const exists = current.some(
          (t) =>
            t.firstName === suggestedTraveller.firstName &&
            t.lastName === suggestedTraveller.lastName
        );
        if (!exists) {
          travellersToAdd.push(suggestedTraveller);
        }
      });

      // Map suggested travellers to their IDs in orderTravellers (with new ones added)
      const updatedOrderTravellers = [...current, ...travellersToAdd];
      const suggestedIds = suggestedTravellers.map((suggestedTraveller) => {
        const existing = updatedOrderTravellers.find(
          (t) =>
            t.firstName === suggestedTraveller.firstName &&
            t.lastName === suggestedTraveller.lastName
        );
        return existing ? existing.id : suggestedTraveller.id;
      });

      // Replace assignedTravellerIds for current service
      setServices(
        services.map((s) =>
          s.id === service.id
            ? { ...s, assignedTravellerIds: suggestedIds }
            : s
        )
      );

      return updatedOrderTravellers;
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

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString + "T00:00:00");
      if (isNaN(date.getTime())) return "-";
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}.${month}.${year}`;
    } catch {
      return "-";
    }
  };

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
                className="rounded bg-black px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
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
                  Drag travellers from left list or click &quot;Assign&quot;
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
              className="rounded bg-black px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-gray-800"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
