"use client";

import React from "react";

interface Traveller {
  id: string;
  firstName: string;
  lastName: string;
  title?: string;
}

interface ItineraryTabsProps {
  travellers: Traveller[];
  selectedTravellerId: string | null; // null means "All"
  onSelectTraveller: (travellerId: string | null) => void;
  serviceCountByTraveller: Record<string, number>; // travellerId -> count
}

export default function ItineraryTabs({
  travellers,
  selectedTravellerId,
  onSelectTraveller,
  serviceCountByTraveller,
}: ItineraryTabsProps) {
  // Filter travellers to only show those with active services
  const travellersWithServices = travellers.filter(
    (t) => (serviceCountByTraveller[t.id] || 0) > 0
  );

  // Don't show tabs if only 1 or fewer travellers with services
  if (travellersWithServices.length <= 1) {
    return null;
  }

  const totalServices = Object.values(serviceCountByTraveller).reduce((sum, count) => sum + count, 0);

  return (
    <div className="border-b border-gray-200 mb-3">
      <div className="flex items-center gap-1 overflow-x-auto pb-px">
        {/* "All" tab */}
        <button
          onClick={() => onSelectTraveller(null)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
            selectedTravellerId === null
              ? "border-blue-600 text-blue-600 bg-blue-50"
              : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
          }`}
        >
          <span>All Travellers</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            selectedTravellerId === null ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
          }`}>
            {totalServices}
          </span>
        </button>

        {/* Individual traveller tabs - only show those with active services */}
        {travellersWithServices.map((traveller) => {
          const count = serviceCountByTraveller[traveller.id] || 0;
          const isSelected = selectedTravellerId === traveller.id;
          
          return (
            <button
              key={traveller.id}
              onClick={() => onSelectTraveller(traveller.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap ${
                isSelected
                  ? "border-blue-600 text-blue-600 bg-blue-50"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span>{traveller.firstName} {traveller.lastName}</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                isSelected ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
