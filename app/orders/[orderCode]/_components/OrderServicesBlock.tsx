"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import AssignedTravellersModal from "./AssignedTravellersModal";
import AddServiceModal, { ServiceData } from "./AddServiceModal";
import DateRangePicker from "@/components/DateRangePicker";
import PartyCombobox from "./PartyCombobox";
import EditServiceModalNew from "./EditServiceModalNew";
import SplitServiceModal from "./SplitServiceModal";
import SplitModalMulti from "./SplitModalMulti";

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
  payerPartyId?: string;
  clientPartyId?: string;
  servicePrice: number;
  clientPrice: number;
  resStatus: "booked" | "confirmed" | "changed" | "rejected" | "cancelled";
  refNr?: string;
  ticketNr?: string;
  assignedTravellerIds: string[];
  invoice_id?: string | null; // NEW: Invoice lock
  splitGroupId?: string | null; // NEW: Split group identifier
}

interface OrderServicesBlockProps {
  orderCode: string;
  // Default client from order for auto-fill in AddServiceModal
  defaultClientId?: string | null;
  defaultClientName?: string;
  onIssueInvoice?: (services: any[]) => void;
}

export default function OrderServicesBlock({ 
  orderCode,
  defaultClientId,
  defaultClientName,
  onIssueInvoice,
}: OrderServicesBlockProps) {
  const [orderTravellers, setOrderTravellers] = useState<Traveller[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [modalServiceId, setModalServiceId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editServiceId, setEditServiceId] = useState<string | null>(null);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [splitMultiModalOpen, setSplitMultiModalOpen] = useState(false);
  const [splitServiceId, setSplitServiceId] = useState<string | null>(null);

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
          invoice_id: s.invoice_id || null,
          payerPartyId: s.payerPartyId,
          clientPartyId: s.clientPartyId,
          splitGroupId: s.splitGroupId || null,
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
      invoice_id: null,
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
                <th className="w-20 px-2 py-1.5 text-center text-sm font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Invoice
                </th>
                <th className="px-2 py-1.5 text-left text-sm font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Category
                </th>
                <th className="px-2 py-1.5 text-left text-sm font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Name
                </th>
                <th className="px-2 py-1.5 text-left text-sm font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Supplier
                </th>
                <th className="px-2 py-1.5 text-left text-sm font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Client
                </th>
                <th className="px-2 py-1.5 text-left text-sm font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Payer
                </th>
                <th className="px-2 py-1.5 text-right text-sm font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Service Price
                </th>
                <th className="px-2 py-1.5 text-right text-sm font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Client Price
                </th>
                <th className="px-2 py-1.5 text-left text-sm font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Res Status
                </th>
                <th className="px-2 py-1.5 text-left text-sm font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Ref Nr
                </th>
                <th className="px-2 py-1.5 text-left text-sm font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Ticket Nr
                </th>
                <th className="px-2 py-1.5 text-left text-sm font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Travellers
                </th>
                <th className="px-2 py-1.5 text-center text-sm font-medium uppercase tracking-wider leading-tight text-gray-700">
                  Actions
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
                      <td className="px-3 py-1.5" colSpan={12}>
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

                        // Calculate split group info
                        let splitInfo = null;
                        if (service.splitGroupId) {
                          const splitGroupServices = services.filter(s => s.splitGroupId === service.splitGroupId);
                          const splitIndex = splitGroupServices.findIndex(s => s.id === service.id) + 1;
                          splitInfo = { index: splitIndex, total: splitGroupServices.length };
                        }

                        return (
                          <React.Fragment key={service.id}>
                          <tr
                            className={`group border-b border-gray-100 hover:bg-gray-50 leading-tight transition-colors ${service.splitGroupId ? "border-l-4 border-l-green-500" : ""}`}
                            onDoubleClick={() => setEditServiceId(service.id)}
                          >
                            <td className="w-20 px-2 py-1 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {service.invoice_id ? (
                                  <div className="flex items-center justify-center">
                                    {/* Clickable Invoice Icon */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        window.location.href = `/orders/${orderCode}?tab=finance&invoice=${service.invoice_id}`;
                                      }}
                                      className="flex items-center justify-center text-green-600 hover:text-green-800 hover:scale-110 transition-all cursor-pointer"
                                      title="View invoice"
                                    >
                                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    </button>
                                  </div>
                                ) : (
                                  <input
                                    type="checkbox"
                                    checked={selectedServiceIds.includes(service.id)}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      if (e.target.checked) {
                                        setSelectedServiceIds(prev => [...prev, service.id]);
                                      } else {
                                        setSelectedServiceIds(prev => prev.filter(id => id !== service.id));
                                      }
                                    }}
                                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                    aria-label={`Select ${service.name} for invoice`}
                                    title="Select for invoice"
                                  />
                                )}
                              </div>
                            </td>
                            <td 
                              className="px-2 py-1 text-sm text-gray-700 leading-tight cursor-pointer"
                              onDoubleClick={() => setEditServiceId(service.id)}
                              title="Double-click to edit"
                            >
                              {service.category}
                            </td>
                            <td className="px-2 py-1 text-sm font-medium text-gray-900 leading-tight">
                              <div className="flex items-center gap-2">
                                {splitInfo && (
                                  <span className="inline-flex items-center gap-1 rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-800">
                                    🔗 {splitInfo.index}/{splitInfo.total}
                                  </span>
                                )}
                                <span>{service.name}</span>
                              </div>
                            </td>
                            <td className="px-2 py-1 text-sm text-gray-700 leading-tight">
                              {service.supplier}
                            </td>
                            <td className="px-2 py-1 text-sm text-gray-700 leading-tight">
                              {service.client}
                            </td>
                            <td className="px-2 py-1 text-sm text-gray-700 leading-tight">
                              {service.payer}
                            </td>
                            <td className="whitespace-nowrap px-2 py-1 text-right text-sm text-gray-700 leading-tight">
                              {formatCurrency(service.servicePrice)}
                            </td>
                            <td className="whitespace-nowrap px-2 py-1 text-right text-sm font-medium text-gray-900 leading-tight">
                              {formatCurrency(service.clientPrice)}
                            </td>
                            <td className="px-2 py-1 text-sm leading-tight">
                              <span
                                className={`inline-flex rounded-full px-1.5 py-0.5 text-xs font-medium ${getResStatusColor(
                                  service.resStatus
                                )}`}
                              >
                                {service.resStatus}
                              </span>
                            </td>
                            <td className="px-2 py-1 text-sm text-gray-700 leading-tight">
                              {service.refNr || "-"}
                            </td>
                            <td className="px-2 py-1 text-sm text-gray-700 leading-tight">
                              {service.ticketNr || "-"}
                            </td>
                            <td className="px-2 py-1 leading-tight">
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


                            {/* Split Button (always visible) */}
                            <td className="px-2 py-1 text-center">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSplitServiceId(service.id);
                                }}
                                className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors text-sm"
                                title="Split Service"
                              >
                                🔗
                              </button>
                            </td>
                            {/* Duplicate Button */}
                            <td className="px-2 py-1 text-center">
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (confirm(`Duplicate service: ${service.name}?`)) {
                                    try {
                                      const { data: { session } } = await supabase.auth.getSession();
                                      const response = await fetch(
                                        `/api/orders/${encodeURIComponent(orderCode)}/services`,
                                        {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                            ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
                                          },
                                          body: JSON.stringify({
                                            serviceName: service.name,
                                            category: service.category,
                                            servicePrice: service.servicePrice,
                                            clientPrice: service.clientPrice,
                                            resStatus: service.resStatus,
                                            refNr: service.refNr,
                                            ticketNr: service.ticketNr,
                                            dateFrom: service.dateFrom,
                                            dateTo: service.dateTo,
                                            supplierPartyId: service.supplier_party_id,
                                            supplierName: service.supplier,
                                            clientPartyId: service.client_party_id,
                                            clientName: service.client,
                                            payerPartyId: service.payer_party_id,
                                            payerName: service.payer,
                                          })
                                        }
                                      );
                                      if (!response.ok) throw new Error("Failed to duplicate service");
                                      fetchServices();
                                    } catch (error) {
                                      console.error("Error duplicating service:", error);
                                      alert("Failed to duplicate service");
                                    }
                                  }
                                }}
                                className="text-purple-600 hover:text-purple-800 p-1 rounded hover:bg-purple-50 transition-colors text-sm"
                                title="Duplicate Service"
                              >
                                📋
                              </button>
                            </td>
                            {/* Cancel Button (hover effect) */}
                            <td className="px-2 py-1 text-right">
                              {service.resStatus !== "cancelled" && (
                                <button
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirm(`Cancel service: ${service.name}?`)) {
                                      try {
                                        const response = await fetch(
                                          `/api/orders/${encodeURIComponent(orderCode)}/services/${service.id}`,
                                          {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({
                                              ...service,
                                              res_status: "cancelled"
                                            })
                                          }
                                        );
                                        if (!response.ok) throw new Error("Failed to cancel service");
                                        fetchServices();
                                      } catch (error) {
                                        console.error("Error cancelling service:", error);
                                        alert("Failed to cancel service");
                                      }
                                    }
                                  }}
                                  className="opacity-0 group-hover:opacity-100 transition-opacity text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                                  title="Cancel Service"
                                >
                                  🚫
                                </button>
                              )}
                            </td>
                          </tr>
                          </React.Fragment>
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
          mainClientId={defaultClientId || ""}
          onClose={handleCloseModal}
        />
      )}

      {showAddModal && (
        <AddServiceModal
          orderCode={orderCode}
          defaultClientId={defaultClientId}
          defaultClientName={defaultClientName}
          onClose={() => setShowAddModal(false)}
          onServiceAdded={handleServiceAdded}
        />
      )}

      {/* Edit Service Modal - simple inline editor */}
      {editServiceId && (
        <EditServiceModalNew
          service={services.find(s => s.id === editServiceId)!}
          orderCode={orderCode}
          onClose={() => setEditServiceId(null)}
          onServiceUpdated={(updated) => {
            setServices(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } as Service : s));
            setEditServiceId(null);
          }}
        />
      )}


      {/* Split Service Modal (Single) */}
      {splitServiceId && (
        <SplitServiceModal
          service={services.find(s => s.id === splitServiceId)!}
          orderCode={orderCode}
          onClose={() => setSplitServiceId(null)}
          onSuccess={() => {
            fetchServices();
            setSplitServiceId(null);
          }}
        />
      )}
      {/* Split Multi Modal */}
      {splitMultiModalOpen && (
        <SplitModalMulti
          services={services.filter(s => selectedServiceIds.includes(s.id))}
          orderCode={orderCode}
          onClose={() => setSplitMultiModalOpen(false)}
          onServicesUpdated={(updated) => {
            fetchServices();
            setSplitMultiModalOpen(false);
            setSelectedServiceIds([]);
          }}
        />
      )}

      {/* Floating Action Bar */}
      {selectedServiceIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-[slideUp_0.2s_ease-out]">
          <div className="bg-black text-white rounded-lg shadow-2xl px-6 py-3 flex items-center gap-6">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
              <span className="font-medium">
                {selectedServiceIds.length} {selectedServiceIds.length === 1 ? 'service' : 'services'} selected
              </span>
            </div>
            <div className="h-6 w-px bg-gray-600" />
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-bold text-green-400">
                €{services
                  .filter(s => selectedServiceIds.includes(s.id))
                  .reduce((sum, s) => sum + s.clientPrice, 0)
                  .toLocaleString()}
              </span>
            </div>
            <div className="h-6 w-px bg-gray-600" />
            <button
              onClick={() => {
                if (onIssueInvoice) {
                  const selectedServicesData = services
                    .filter(s => selectedServiceIds.includes(s.id))
                    .map(s => ({
                      id: s.id,
                      name: s.name,
                      clientPrice: s.clientPrice,
                      category: s.category,
                      dateFrom: s.dateFrom,
                      dateTo: s.dateTo,
                    }));
                  onIssueInvoice(selectedServicesData);
                  setSelectedServiceIds([]); // Clear selection
                }
              }}
              className="px-4 py-2 bg-white text-black font-medium rounded hover:bg-gray-100 transition-colors"
            >
              Issue Invoice
            </button>
            <button
              onClick={() => {
                const selectedServicesData = services.filter(s => selectedServiceIds.includes(s.id));
                if (selectedServicesData.length > 0) {
                  setSplitMultiModalOpen(true);
                }
              }}
              className="px-4 py-2 bg-amber-500 text-white font-medium rounded hover:bg-amber-600 transition-colors ml-2"
            >
              🔗 Split ({selectedServiceIds.length})
            </button>
            <button
              onClick={() => setSelectedServiceIds([])}
              className="ml-2 text-gray-400 hover:text-white transition-colors"
              aria-label="Clear selection"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

