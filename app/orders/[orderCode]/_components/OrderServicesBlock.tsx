"use client";

import React, { useState, useEffect } from "react";
import AssignedTravellersModal from "./AssignedTravellersModal";

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

// Mock data
const initialOrderTravellers: Traveller[] = [
  { id: "t1", firstName: "John", lastName: "Smith", title: "Mr" },
  { id: "t2", firstName: "Jane", lastName: "Smith", title: "Mrs" },
  { id: "t3", firstName: "Bob", lastName: "Johnson", title: "Mr" },
];

const initialServices: Service[] = [
  {
    id: "s1",
    dateFrom: "2025-03-15",
    dateTo: "2025-03-16",
    category: "Flight",
    name: "Rome - Barcelona",
    supplier: "Airline Co",
    client: "John Smith",
    payer: "John Smith",
    servicePrice: 450,
    clientPrice: 600,
    resStatus: "confirmed",
    refNr: "REF-001",
    ticketNr: "TK-12345",
    assignedTravellerIds: ["t1"],
  },
  {
    id: "s2",
    dateFrom: "2025-03-16",
    dateTo: "2025-03-20",
    category: "Hotel",
    name: "Grand Hotel Barcelona",
    supplier: "Hotel Group",
    client: "John Smith",
    payer: "John Smith",
    servicePrice: 800,
    clientPrice: 1200,
    resStatus: "booked",
    refNr: "REF-002",
    assignedTravellerIds: ["t1", "t2"],
  },
  {
    id: "s3",
    dateFrom: "2025-03-18",
    dateTo: "2025-03-18",
    category: "Transfer",
    name: "Airport Transfer",
    supplier: "Transfer Service",
    client: "John Smith",
    payer: "John Smith",
    servicePrice: 60,
    clientPrice: 90,
    resStatus: "confirmed",
    assignedTravellerIds: [],
  },
];

export default function OrderServicesBlock() {
  // Mock main client ID (in real app would come from order.mainClientId)
  const [mainClientId] = useState<string>("t1"); // John Smith is main client

  const [orderTravellers, setOrderTravellers] =
    useState<Traveller[]>(initialOrderTravellers);
  const [services, setServices] = useState<Service[]>(initialServices);
  const [modalServiceId, setModalServiceId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    {}
  );

  // Initialize: ensure main client exists in orderTravellers (only once)
  useEffect(() => {
    const mainClient = orderTravellers.find((t) => t.id === mainClientId);
    if (!mainClient) {
      // Main client should always exist, but if not, create it
      const mainClientTraveller: Traveller = {
        id: mainClientId,
        firstName: "John",
        lastName: "Smith",
        title: "Mr",
      };
      setOrderTravellers((current) => [mainClientTraveller, ...current]);
    }
  }, []); // Run once on mount

  const selectedService = services.find((s) => s.id === modalServiceId);

  const getTravellerInitials = (travellerId: string) => {
    const traveller = orderTravellers.find((t) => t.id === travellerId);
    if (!traveller) return "??";
    return (
      traveller.firstName.charAt(0) + traveller.lastName.charAt(0)
    ).toUpperCase();
  };

  const getResStatusColor = (status: Service["resStatus"]) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800";
      case "booked":
        return "bg-blue-100 text-blue-800";
      case "changed":
        return "bg-yellow-100 text-yellow-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      case "cancelled":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDateDDMMYYYY = (dateString: string) => {
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

  const getDateRangeKey = (service: Service) => {
    const startDate = formatDateDDMMYYYY(service.dateFrom);
    const endDate = service.dateTo
      ? formatDateDDMMYYYY(service.dateTo)
      : formatDateDDMMYYYY(service.dateFrom);
    return `${startDate} - ${endDate}`;
  };

  // Group services by dateRangeKey
  const groupedServices = services.reduce(
    (acc, service) => {
      const key = getDateRangeKey(service);
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(service);
      return acc;
    },
    {} as Record<string, Service[]>
  );

  // Sort groups by startDate ASC
  const sortedGroupKeys = Object.keys(groupedServices).sort((a, b) => {
    const aStartDate = a.split(" - ")[0];
    const bStartDate = b.split(" - ")[0];
    // Compare DD.MM.YYYY format
    const [aDay, aMonth, aYear] = aStartDate.split(".").map(Number);
    const [bDay, bMonth, bYear] = bStartDate.split(".").map(Number);
    const aDate = new Date(aYear, aMonth - 1, aDay);
    const bDate = new Date(bYear, bMonth - 1, bDay);
    return aDate.getTime() - bDate.getTime();
  });

  // Initialize expandedGroups - all groups expanded by default
  useEffect(() => {
    const initialExpanded: Record<string, boolean> = {};
    sortedGroupKeys.forEach((key) => {
      initialExpanded[key] = true;
    });
    setExpandedGroups(initialExpanded);
  }, [services.length]); // Re-initialize if services change

  const toggleGroup = (groupKey: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const formatCurrency = (amount: number) => {
    return `€${amount.toLocaleString()}`;
  };

  const handleOpenModal = (serviceId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setModalServiceId(serviceId);
  };

  const handleCloseModal = () => {
    setModalServiceId(null);
  };

  return (
    <>
      <div className="rounded-lg bg-white shadow-sm">
        <div className="border-b border-gray-200 px-3 py-2">
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <h2 className="text-base font-semibold text-gray-900">Services</h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                  Category
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                  Name
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                  Supplier
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                  Client
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                  Payer
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                  Service Price
                </th>
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                  Client Price
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                  Res Status
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                  Ref Nr
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                  Ticket Nr
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                  Travellers
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {sortedGroupKeys.map((groupKey) => {
                const groupServices = groupedServices[groupKey].sort((a, b) => {
                  // Sort within group: category, then name
                  const categoryCompare = a.category.localeCompare(b.category);
                  if (categoryCompare !== 0) return categoryCompare;
                  return a.name.localeCompare(b.name);
                });
                const isExpanded = expandedGroups[groupKey] ?? true;

                return (
                  <React.Fragment key={`group-${groupKey}`}>
                    {/* Group header row */}
                    <tr
                      className="cursor-pointer bg-gray-100 hover:bg-gray-200"
                      onClick={() => toggleGroup(groupKey)}
                    >
                      <td className="px-3 py-1.5" colSpan={11}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">
                              {isExpanded ? "▼" : "▶"}
                            </span>
                            <span className="text-xs font-medium text-gray-900">
                              {groupKey}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {groupServices.length}
                          </span>
                        </div>
                      </td>
                    </tr>
                    {/* Services in group */}
                    {isExpanded &&
                      groupServices.map((service) => {
                        const assignedIds = service.assignedTravellerIds;
                        const visibleIds = assignedIds.slice(0, 3);
                        const remainingCount = assignedIds.length - 3;

                        return (
                          <tr
                            key={service.id}
                            className="transition-colors hover:bg-gray-50"
                          >
                            <td className="px-3 py-2 text-xs text-gray-700">
                              {service.category}
                            </td>
                            <td className="px-3 py-2 text-xs font-medium text-gray-900">
                              {service.name}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-700">
                              {service.supplier}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-700">
                              {service.client}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-700">
                              {service.payer}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-gray-700">
                              {formatCurrency(service.servicePrice)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-right text-xs font-medium text-gray-900">
                              {formatCurrency(service.clientPrice)}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              <span
                                className={`inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium ${getResStatusColor(
                                  service.resStatus
                                )}`}
                              >
                                {service.resStatus}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-700">
                              {service.refNr || "-"}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-700">
                              {service.ticketNr || "-"}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <div className="flex items-center gap-0.5">
                                  {visibleIds.map((travellerId) => (
                                    <div
                                      key={travellerId}
                                      className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-800"
                                      title={
                                        orderTravellers.find(
                                          (t) => t.id === travellerId
                                        )?.firstName +
                                        " " +
                                        orderTravellers.find(
                                          (t) => t.id === travellerId
                                        )?.lastName
                                      }
                                    >
                                      {getTravellerInitials(travellerId)}
                                    </div>
                                  ))}
                                  {remainingCount > 0 && (
                                    <span className="text-xs text-gray-500">
                                      +{remainingCount}
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={(e) =>
                                    handleOpenModal(service.id, e)
                                  }
                                  className="ml-1 flex h-5 w-5 items-center justify-center rounded border border-gray-300 bg-white text-xs text-gray-600 transition-colors hover:bg-gray-50"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedService && (
        <AssignedTravellersModal
          service={selectedService}
          orderTravellers={orderTravellers}
          setOrderTravellers={setOrderTravellers}
          services={services}
          setServices={setServices}
          mainClientId={mainClientId}
          onClose={handleCloseModal}
        />
      )}
    </>
  );
}
