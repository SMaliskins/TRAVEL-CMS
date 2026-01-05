"use client";

import { useState } from "react";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";

interface Traveller {
  id: string;
  firstName: string;
  lastName: string;
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
  { id: "t1", firstName: "John", lastName: "Smith" },
  { id: "t2", firstName: "Jane", lastName: "Smith" },
  { id: "t3", firstName: "Bob", lastName: "Johnson" },
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

export default function OrderServicesTab() {
  const [orderTravellers, setOrderTravellers] =
    useState<Traveller[]>(initialOrderTravellers);
  const [services, setServices] = useState<Service[]>(initialServices);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(
    null
  );
  const [draggedTravellerId, setDraggedTravellerId] = useState<string | null>(
    null
  );
  const [newTravellerCounter, setNewTravellerCounter] = useState(1);

  const selectedService = services.find((s) => s.id === selectedServiceId);

  const handleServiceClick = (serviceId: string) => {
    setSelectedServiceId(serviceId);
  };

  const handleDragStart = (travellerId: string) => {
    setDraggedTravellerId(travellerId);
  };

  const handleDragEnd = () => {
    setDraggedTravellerId(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedTravellerId || !selectedServiceId) return;

    const service = services.find((s) => s.id === selectedServiceId);
    if (!service) return;

    // Don't add duplicates
    if (service.assignedTravellerIds.includes(draggedTravellerId)) return;

    setServices(
      services.map((s) =>
        s.id === selectedServiceId
          ? {
              ...s,
              assignedTravellerIds: [...s.assignedTravellerIds, draggedTravellerId],
            }
          : s
      )
    );
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleRemoveTraveller = (travellerId: string) => {
    if (!selectedServiceId) return;

    setServices(
      services.map((s) =>
        s.id === selectedServiceId
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
    if (!selectedServiceId) return;

    const service = services.find((s) => s.id === selectedServiceId);
    if (!service) return;

    const allTravellerIds = orderTravellers.map((t) => t.id);
    const uniqueIds = Array.from(
      new Set([...service.assignedTravellerIds, ...allTravellerIds])
    );

    setServices(
      services.map((s) =>
        s.id === selectedServiceId
          ? { ...s, assignedTravellerIds: uniqueIds }
          : s
      )
    );
  };

  const handleAddFromDatabase = () => {
    const newTraveller: Traveller = {
      id: `t-new-${newTravellerCounter}`,
      firstName: "New Traveller",
      lastName: `${newTravellerCounter}`,
    };

    setOrderTravellers([...orderTravellers, newTraveller]);
    setNewTravellerCounter(newTravellerCounter + 1);

    // Auto-assign to selected service if exists
    if (selectedServiceId) {
      setServices(
        services.map((s) =>
          s.id === selectedServiceId
            ? {
                ...s,
                assignedTravellerIds: [
                  ...s.assignedTravellerIds,
                  newTraveller.id,
                ],
              }
            : s
        )
      );
    }
  };

  const getTravellerName = (travellerId: string) => {
    const traveller = orderTravellers.find((t) => t.id === travellerId);
    return traveller
      ? `${traveller.firstName} ${traveller.lastName}`
      : "Unknown";
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

  // Use centralized date formatting
  const formatDate = formatDateDDMMYYYY;

  const formatCurrency = (amount: number) => {
    return `€${amount.toLocaleString()}`;
  };

  return (
    <div className="flex gap-6">
      {/* LEFT COLUMN - Services Table */}
      <div className="flex-1 space-y-4" style={{ flex: "0 0 65%" }}>
        <div className="rounded-lg bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                    Dates
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                    Supplier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                    Client
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                    Payer
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                    Service Price
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-700">
                    Client Price
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                    Res Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                    Ref Nr
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-700">
                    Ticket Nr
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {services.map((service) => (
                  <tr
                    key={service.id}
                    onClick={() => handleServiceClick(service.id)}
                    className={`cursor-pointer transition-colors ${
                      selectedServiceId === service.id
                        ? "bg-blue-50"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                      {formatDate(service.dateFrom)}
                      {service.dateTo !== service.dateFrom &&
                        ` - ${formatDate(service.dateTo)}`}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {service.category}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {service.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {service.supplier}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {service.client}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {service.payer}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">
                      {formatCurrency(service.servicePrice)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900">
                      {formatCurrency(service.clientPrice)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getResStatusColor(
                          service.resStatus
                        )}`}
                      >
                        {service.resStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {service.refNr || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {service.ticketNr || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Service Details Editor */}
        {selectedService && (
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">
              Service details
            </h2>

            <div className="space-y-4">
              <div>
                <h3 className="mb-2 text-sm font-medium text-gray-700">
                  Assigned travellers
                </h3>
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  className="min-h-[100px] rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-4"
                >
                  {selectedService.assignedTravellerIds.length === 0 ? (
                    <p className="text-center text-sm text-gray-500">
                      Drag travellers here or click "All" to assign all
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {selectedService.assignedTravellerIds.map((travellerId) => (
                        <div
                          key={travellerId}
                          className="flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-800"
                        >
                          <span>{getTravellerName(travellerId)}</span>
                          <button
                            onClick={() => handleRemoveTraveller(travellerId)}
                            className="ml-1 rounded-full p-0.5 hover:bg-blue-200"
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
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleAssignAll}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  All
                </button>
                <button
                  onClick={handleAddFromDatabase}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                >
                  + Add from database
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN - Travellers Pool */}
      <div className="flex-1 space-y-4" style={{ flex: "0 0 35%" }}>
        {selectedService ? (
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Travellers in this order
            </h2>
            <div className="space-y-2">
              {orderTravellers.map((traveller) => {
                const isAssigned = selectedService.assignedTravellerIds.includes(
                  traveller.id
                );
                return (
                  <div
                    key={traveller.id}
                    draggable
                    onDragStart={() => handleDragStart(traveller.id)}
                    onDragEnd={handleDragEnd}
                    className={`cursor-move rounded-lg border p-3 transition-colors ${
                      isAssigned
                        ? "border-blue-300 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                    } ${
                      draggedTravellerId === traveller.id ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900">
                        {traveller.firstName} {traveller.lastName}
                      </span>
                      {isAssigned && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">
                          Assigned
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center rounded-lg bg-white p-12 shadow-sm">
            <p className="text-center text-gray-500">
              Select a service to manage travellers
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

