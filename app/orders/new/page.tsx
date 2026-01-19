"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { DirectoryProvider } from "@/lib/directory/directoryStore";
import { orderCodeToSlug } from "@/lib/orders/orderCode";
import PartySelect from "@/components/PartySelect";
import CityMultiSelect, { CityWithCountry } from "@/components/CityMultiSelect";
import DateRangePicker from "@/components/DateRangePicker";
import ConfirmModal from "@/components/ConfirmModal";

type OrderType = "TA" | "TO" | "CORP" | "NON";

// Extract initials from email (e.g., "john.smith@example.com" -> "JS")
function getInitialsFromEmail(email: string | null | undefined): string {
  if (!email) return "XX";
  const parts = email.split("@")[0].split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase().slice(0, 2);
  }
  return email.slice(0, 2).toUpperCase();
}

// Extract full name from user metadata or email
function getUserFullName(user: any): { fullName: string; initials: string } {
  // Try user_metadata first
  if (user?.user_metadata?.full_name) {
    const fullName = user.user_metadata.full_name;
    // Extract initials from full name
    const nameParts = fullName.trim().split(/\s+/);
    const initials =
      nameParts.length >= 2
        ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
        : fullName.slice(0, 2).toUpperCase();
    return { fullName, initials };
  }

  // Fallback to email
  const email = user?.email || "";
  const emailPrefix = email.split("@")[0];
  const emailParts = emailPrefix.split(/[._-]/);
  const fullName =
    emailParts.length >= 2
      ? `${emailParts[0]} ${emailParts[1]}`
      : emailPrefix || "User";
  const initials = getInitialsFromEmail(email);
  return { fullName, initials };
}

function NewOrderForm() {
  const router = useRouter();
  
  // Form state
  const [clientPartyId, setClientPartyId] = useState<string | null>(null);
  const [clientDisplayName, setClientDisplayName] = useState("");
  const [orderType, setOrderType] = useState<OrderType>("TA");
  const [ownerAgent, setOwnerAgent] = useState("SM");
  const [ownerFullName, setOwnerFullName] = useState("User");
  const [selectedCities, setSelectedCities] = useState<CityWithCountry[]>([]);
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [checkInDate, setCheckInDate] = useState<string | undefined>(undefined);
  const [returnDate, setReturnDate] = useState<string | undefined>(undefined);

  // UI state
  const [isDirty, setIsDirty] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [hasCreated, setHasCreated] = useState(false); // Track if order was already created

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Get current user info on mount (from profile)
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          // Load profile from database for real name
          const { data: profile } = await supabase
            .from("user_profiles")
            .select("first_name, last_name")
            .eq("user_id", data.user.id)
            .single();
          
          if (profile?.first_name && profile?.last_name) {
            const fullName = `${profile.first_name} ${profile.last_name}`;
            const initials = (profile.first_name[0] + profile.last_name[0]).toUpperCase();
            setOwnerFullName(fullName);
            setOwnerAgent(initials);
          } else {
            // Fallback to auth metadata
            const { fullName, initials } = getUserFullName(data.user);
            setOwnerFullName(fullName);
            setOwnerAgent(initials);
          }
        }
      } catch (error) {
        console.error("Failed to get user:", error);
        // Keep defaults
      }
    };
    fetchUser();
  }, []);

  // Track dirty state
  useEffect(() => {
    const dirty =
      clientPartyId !== null ||
      selectedCities.length > 0 ||
      checkInDate !== undefined ||
      returnDate !== undefined ||
      orderType !== "TA" ||
      ownerAgent !== "SM";
    setIsDirty(dirty);
  }, [clientPartyId, selectedCities, checkInDate, returnDate, orderType, ownerAgent]);

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!clientPartyId) {
      errors.clientPartyId = "Client is required";
    }

    if (!orderType) {
      errors.orderType = "Order type is required";
    }

    if (checkInDate && returnDate) {
      if (new Date(checkInDate) > new Date(returnDate)) {
        errors.dateRange = "Start date must be before end date";
      }
    }

    if (checkInDate && !returnDate) {
      errors.dateRange = "Please select both check-in and return dates";
    }

    if (!checkInDate && returnDate) {
      errors.dateRange = "Please select check-in date first";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    // Prevent multiple submissions
    if (isCreating || hasCreated) {
      return;
    }

    if (!validateForm()) {
      setCreateError("Please fix validation errors");
      return;
    }

    setIsCreating(true);
    setCreateError(null);

    try {
      // Get current user session token
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token || null;

      // Call server action to create order
      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...(accessToken ? { "Authorization": `Bearer ${accessToken}` } : {})
        },
        credentials: "include", // Include cookies
        body: JSON.stringify({
          clientPartyId,
          clientDisplayName: clientDisplayName || undefined,
          orderType,
          ownerAgent,
          ownerName: ownerFullName,
          cities: selectedCities.map((c) => c.city),
          countries: selectedCountries,
          checkIn: checkInDate || null,
          return: returnDate || null,
          status: "Active",
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        const errorMsg = errorData.error || errorData.message || `HTTP ${response.status}`;
        throw new Error(errorMsg);
      }

      const data = await response.json();
      
      // Mark as created to prevent duplicate submissions
      setHasCreated(true);
      
      // Immediately redirect to the new order page (convert to slug for URL)
      router.push(`/orders/${orderCodeToSlug(data.order_number)}`);
    } catch (error: unknown) {
      console.error("ERROR: Failed to create order:", error);
      const errorMsg = error instanceof Error ? error.message : error ? String(error) : "Unknown error";
      setIsCreating(false);
      setCreateError(errorMsg || "Failed to create order. Please try again.");
    }
  };

  const handleCancel = () => {
    // Prevent cancel if order was already created
    if (hasCreated) {
      return;
    }
    if (isDirty) {
      setShowCancelConfirm(true);
    } else {
      router.push("/orders");
    }
  };

  const handleConfirmCancel = () => {
    setShowCancelConfirm(false);
    router.push("/orders");
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S / Cmd+S - Create & Open
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!isCreating && !hasCreated) {
          handleSubmit();
        }
      }
      // Ctrl+Enter / Cmd+Enter - Create & Open
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!isCreating && !hasCreated) {
          handleSubmit();
        }
      }
      // Esc - Close confirm modal or cancel if dirty
      if (e.key === "Escape") {
        if (showCancelConfirm) {
          setShowCancelConfirm(false);
        } else if (isDirty && !hasCreated) {
          handleCancel();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDirty, isCreating, hasCreated, showCancelConfirm]);

  const canCreate = !isCreating && !hasCreated && clientPartyId !== null && orderType;

  return (
    <div className="min-h-screen bg-gray-50">
      <div>
        {/* Sticky Page Header */}
        <div className="sticky top-14 z-30 -mx-6 bg-white border-b border-gray-200 px-6 py-4 shadow-sm mb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-semibold text-gray-900">New Order</h1>
              <div className="mt-1 flex items-center gap-3 text-sm text-gray-600">
                <span className="text-xs text-gray-500">
                  Order number: Will be assigned on save
                </span>
                <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                  Active
                </span>
                {isDirty && !hasCreated && (
                  <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                    Unsaved changes
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2">
              {createError && (
                <span className="text-xs text-red-600">{createError}</span>
              )}
              <button
                onClick={handleCancel}
                disabled={isCreating || hasCreated}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!canCreate || isCreating || hasCreated}
                className="flex items-center gap-1.5 rounded-lg bg-black px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                style={isCreating ? { cursor: "wait" } : {}}
              >
                {isCreating ? (
                  <>
                    <svg
                      className="h-3.5 w-3.5 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Creating…
                  </>
                ) : (
                  "Create & Open"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Left Column: Main */}
          <div className="rounded-lg bg-white p-4 shadow-sm border border-gray-200">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Main</h2>
            <div className="space-y-4">
              {/* Client */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Client <span className="text-red-500">*</span>
                </label>
                <PartySelect
                  value={clientPartyId}
                  onChange={(id, displayName) => {
                    setClientPartyId(id);
                    setClientDisplayName(displayName);
                  }}
                  error={validationErrors.clientPartyId}
                  required
                />
              </div>

              {/* City Multi-select */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  City
                </label>
                <CityMultiSelect
                  selectedCities={selectedCities}
                  onChange={setSelectedCities}
                  onCountryChange={setSelectedCountries}
                />
              </div>

              {/* Countries (read-only, auto-filled, multiple) */}
              {selectedCountries.length > 0 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {selectedCountries.length === 1 ? "Country" : "Countries"}
                  </label>
                  <input
                    type="text"
                    value={selectedCountries.join(", ")}
                    readOnly
                    className="w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600 cursor-not-allowed"
                  />
                </div>
              )}

              {/* Travel dates */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Travel dates
                </label>
                <DateRangePicker
                  label="Travel dates"
                  from={checkInDate}
                  to={returnDate}
                  onChange={(from, to) => {
                    setCheckInDate(from);
                    setReturnDate(to);
                  }}
                />
                {validationErrors.dateRange && (
                  <p className="mt-1 text-xs text-red-600">{validationErrors.dateRange}</p>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Parties */}
          <div className="rounded-lg bg-white p-4 shadow-sm border border-gray-200">
            <h2 className="mb-4 text-base font-semibold text-gray-900">Parties</h2>
            <div className="space-y-4">
              {/* Order Type */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Order Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={orderType}
                  onChange={(e) => setOrderType(e.target.value as OrderType)}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1 ${
                    validationErrors.orderType
                      ? "border-red-300 focus:border-red-500 focus:ring-red-500"
                      : "border-gray-300 focus:border-black focus:ring-black"
                  }`}
                >
                  <option value="TA">TA</option>
                  <option value="TO">TO</option>
                  <option value="CORP">CORP</option>
                  <option value="NON">NON</option>
                </select>
                {validationErrors.orderType && (
                  <p className="mt-1 text-xs text-red-600">{validationErrors.orderType}</p>
                )}
              </div>

              {/* Owner/Agent */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Owner/Agent
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={`${ownerFullName} (${ownerAgent})`}
                    readOnly
                    className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600 cursor-not-allowed"
                  />
                  <input
                    type="hidden"
                    value={ownerAgent}
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Order code will use initials: {ownerAgent}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Cancel confirmation modal */}
      <ConfirmModal
        isOpen={showCancelConfirm}
        title="Discard changes?"
        message="You have unsaved changes. Are you sure you want to cancel?"
        confirmText="Discard"
        cancelText="Keep editing"
        onConfirm={handleConfirmCancel}
        onCancel={() => setShowCancelConfirm(false)}
      />
    </div>
  );
}

export default function NewOrderPage() {
  return (
    <DirectoryProvider>
      <NewOrderForm />
    </DirectoryProvider>
  );
}
