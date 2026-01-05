"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import AssignedTravellersModal from "./AssignedTravellersModal";
import AddServiceModal, { ServiceData } from "./AddServiceModal";

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

interface OrderServicesBlockProps {
  orderCode: string;
}

export default function OrderServicesBlock({ orderCode }: OrderServicesBlockProps) {
  const [mainClientId] = useState<string>("t1");
  const [orderTravellers, setOrderTravellers] = useState<Traveller[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [modalServiceId, setModalServiceId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Fetch services from API
  const fetchServices = useCallback(async () => {
    if (!orderCode) return;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/services`, {
        headers: {
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        // Map API response to Service interface
        const mappedServices: Service[] = (data.services || []).map((s: ServiceData) => ({
          id: s.id,
          dateFrom: s.dateFrom || "",
          dateTo: s.dateTo || s.dateFrom || "",
          category: s.category || "Other",
          name: s.serviceName,
          supplier: s.supplierName || "-",
          client: s.clientName || "-",
          payer: s.payerName || "-",
          servicePrice: s.servicePrice || 0,
          clientPrice: s.clientPrice || 0,
          resStatus: s.resStatus || "booked",
          refNr: s.refNr || "",
          ticketNr: s.ticketNr || "",
          assignedTravellerIds: s.travellerIds || [],
        }));
        setServices(mappedServices);
      }
    } catch (err) {
      console.error("Fetch services error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [orderCode]);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  // Handle new service added
  const handleServiceAdded = (service: ServiceData) => {
    const newService: Service = {
      id: service.id,
      dateFrom: service.dateFrom || "",
      dateTo: service.dateTo || service.dateFrom || "",
      category: service.category || "Other",
      name: service.serviceName,
      supplier: service.supplierName || "-",
      client: service.clientName || "-",
      payer: service.payerName || "-",
      servicePrice: service.servicePrice || 0,
      clientPrice: service.clientPrice || 0,
      resStatus: service.resStatus || "booked",
      refNr: service.refNr || "",
      ticketNr: service.ticketNr || "",
      assignedTravellerIds: service.travellerIds || [],
    };
    setServices(prev => [...prev, newService]);
  };

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

  if (isLoading) {
    return (
      <div className="rounded-lg bg-white shadow-sm p-6">
        <div className="text-center text-gray-500">Loading services...</div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg bg-white shadow-sm">
        <div className="border-b border-gray-200 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <h2 className="text-base font-semibold text-gray-900">Services</h2>
            <span className="text-xs text-gray-500">({services.length})</span>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1 px-3 py-1 text-sm font-medium text-white bg-black rounded hover:bg-gray-800"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Service
          </button>
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

      {showAddModal && (
        <AddServiceModal
          orderCode={orderCode}
          onClose={() => setShowAddModal(false)}
          onServiceAdded={handleServiceAdded}
        />
      )}
    </>
  );
}
