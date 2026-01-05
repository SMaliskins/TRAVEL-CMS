"use client";

import React, { useState, useEffect, useImperativeHandle } from "react";
import {
  DirectoryRecord,
  DirectoryType,
  DirectoryRole,
  SupplierDetails,
  SubagentDetails,
  SubagentCommissionType,
} from "@/lib/types/directory";

interface DirectoryFormProps {
  record?: DirectoryRecord;
  mode: "create" | "edit";
  onSubmit: (data: Partial<DirectoryRecord>, closeAfterSave: boolean) => void;
  onCancel: () => void;
  onValidationChange?: (isValid: boolean) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  saveSuccess?: boolean; // Signal that save was successful for green border effect
}

export interface DirectoryFormHandle {
  submit: (closeAfterSave: boolean) => void;
}

const DirectoryForm = React.forwardRef<DirectoryFormHandle, DirectoryFormProps>(
  function DirectoryForm(
    { record, mode, onSubmit, onCancel, onValidationChange, onDirtyChange, saveSuccess = false },
    ref
  ) {
    const formRef = React.useRef<HTMLFormElement>(null);
    const subagentSectionRef = React.useRef<HTMLDivElement>(null);
    const subagentCommissionTypeSelectRef = React.useRef<HTMLSelectElement>(null);
    const pendingCloseAfterSaveRef = React.useRef<boolean>(false);
    const [highlightedSection, setHighlightedSection] = useState<"supplier" | "subagent" | null>(null);
    
    // Active tab state for Statistics section
    const [activeTab, setActiveTab] = useState<"statistics" | "clientScore">("statistics");
    
    // Track dirty fields (fields that have been modified)
    const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
    
    // Track saved fields (for green border effect after save)
    const [savedFields, setSavedFields] = useState<Set<string>>(new Set());
    
    // Track field changes
    const markFieldDirty = (fieldName: string) => {
      setDirtyFields(prev => new Set(prev).add(fieldName));
    };
    
    // Handle save success - mark all dirty fields as saved temporarily
    useEffect(() => {
      if (saveSuccess && dirtyFields.size > 0) {
        setSavedFields(new Set(dirtyFields));
        // Clear saved fields after animation completes (1 second for faster animation)
        const timer = setTimeout(() => {
          setSavedFields(new Set());
          setDirtyFields(new Set()); // Clear dirty state after save
        }, 1000);
        return () => clearTimeout(timer);
      }
    }, [saveSuccess, dirtyFields]);
    
    // Determine base type from record or default to person
    const getBaseType = (): DirectoryType => {
      if (record?.type) return record.type;
      // If client role is selected and has clientType preference, use it
      return "person";
    };

    const [baseType, setBaseType] = useState<DirectoryType>(getBaseType());
    const [roles, setRoles] = useState<DirectoryRole[]>(record?.roles || []);

    // Client type selection (for Client role only)
    // Initialize from record.type if available, to preserve Type when adding Client role
    const [clientType, setClientType] = useState<DirectoryType>(
      record?.type || "person"
    );

    // Person fields
    const [firstName, setFirstName] = useState(record?.firstName || "");
    const [lastName, setLastName] = useState(record?.lastName || "");
    const [personalCode, setPersonalCode] = useState(record?.personalCode || "");
    const [dob, setDob] = useState(record?.dob || "");

    // Company fields
    const [companyName, setCompanyName] = useState(record?.companyName || "");
    const [regNo, setRegNo] = useState(record?.regNumber || "");
    const [address, setAddress] = useState(record?.legalAddress || "");
    const [actualAddress, setActualAddress] = useState(record?.actualAddress || "");
    const [contactPerson, setContactPerson] = useState("");

    // Common fields
    const [phone, setPhone] = useState(record?.phone || "");
    const [email, setEmail] = useState(record?.email || "");

    // Supplier fields - removed (no additional fields needed)

    // Subagent fields
    const [subagentCommissionType, setSubagentCommissionType] = useState<SubagentCommissionType>(
      record?.subagentExtras?.commissionType || "percentage"
    );
    const [subagentCommissionValue, setSubagentCommissionValue] = useState<number | undefined>(
      record?.subagentExtras?.commissionValue
    );
    const [subagentCommissionCurrency, setSubagentCommissionCurrency] = useState(
      record?.subagentExtras?.commissionCurrency || "EUR"
    );
    const [subagentPeriodType, setSubagentPeriodType] = useState<"year" | "custom">(
      "year"
    );
    const [subagentPeriodFrom, setSubagentPeriodFrom] = useState(
      ""
    );
    const [subagentPeriodTo, setSubagentPeriodTo] = useState(
      ""
    );
    const [subagentPaymentDetails, setSubagentPaymentDetails] = useState(
      ""
    );

    // Update clientType when roles change (for Client role)
    // When Client role is added, set clientType to current baseType
    // This preserves the existing Type (Company/Person) when adding Client role
    useEffect(() => {
      if (roles.includes("client")) {
        // When Client role is added, set clientType to current baseType
        // This preserves the existing Type (Company/Person) when adding Client role
        setClientType(baseType);
      }
    }, [roles, baseType]);

    // Track initial values for dirty state
    const getInitialValues = (): Partial<DirectoryRecord> => {
      if (!record) return {};
      return {
        type: record.type,
        roles: record.roles,
        firstName: record.firstName,
        lastName: record.lastName,
        companyName: record.companyName,
        personalCode: record.personalCode,
        dob: record.dob,
        phone: record.phone,
        email: record.email,
        regNumber: record.regNumber,
        legalAddress: record.legalAddress,
        actualAddress: record.actualAddress,
        supplierExtras: record.supplierExtras,
        subagentExtras: record.subagentExtras,
      };
    };

    const initialValues = React.useMemo(() => getInitialValues(), [record]);

    // Check if form is dirty
    const checkDirty = (): boolean => {
      if (mode === "create") {
        // For create mode, check if any field has value
        return (
          firstName.trim() !== "" ||
          lastName.trim() !== "" ||
          companyName.trim() !== "" ||
          phone.trim() !== "" ||
          email.trim() !== "" ||
          roles.length > 0
        );
      }

      // For edit mode, compare with initial values
      const normalizeRoles = (r: DirectoryRole[]) => [...r].sort().join(",");
      const currentRolesStr = normalizeRoles(roles);
      const initialRolesStr = normalizeRoles((initialValues.roles || []) as DirectoryRole[]);

      // Check basic fields
      const currentType = roles.includes("client") ? clientType : baseType;
      if (
        currentType !== initialValues.type ||
        currentRolesStr !== initialRolesStr ||
        firstName.trim() !== (initialValues.firstName || "").trim() ||
        lastName.trim() !== (initialValues.lastName || "").trim() ||
        companyName.trim() !== (initialValues.companyName || "").trim() ||
        personalCode.trim() !== (initialValues.personalCode || "").trim() ||
        dob !== (initialValues.dob || "") ||
        phone.trim() !== (initialValues.phone || "").trim() ||
        email.trim() !== (initialValues.email || "").trim() ||
        regNo.trim() !== (initialValues.regNumber || "").trim() ||
        address.trim() !== (initialValues.legalAddress || "").trim() ||
        actualAddress.trim() !== (initialValues.actualAddress || "").trim()
      ) {
        return true;
      }

      // Supplier role has no additional fields to check

      // Check subagent details
      const initialSubagent = initialValues.subagentExtras;
      if (roles.includes("subagent")) {
        if (
          !initialSubagent ||
          subagentCommissionType !== initialSubagent.commissionType ||
          subagentCommissionValue !== initialSubagent.commissionValue ||
          subagentCommissionCurrency !== initialSubagent.commissionCurrency
        ) {
          return true;
        }
      } else if (initialSubagent) {
        return true;
      }

      return false;
    };

    const isDirty = checkDirty();

    // Notify parent about dirty state
    useEffect(() => {
      onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);

    const handleRoleToggle = (role: DirectoryRole) => {
      const wasIncluded = roles.includes(role);
      const newRoles = wasIncluded
        ? roles.filter((r) => r !== role)
        : [...roles, role];

      setRoles(newRoles);

      // Jump to section if role was just enabled
      if (!wasIncluded && newRoles.includes(role)) {
        if (role === "subagent" && subagentSectionRef.current) {
          // Check if section is already visible in viewport
          const rect = subagentSectionRef.current.getBoundingClientRect();
          const isVisible =
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth);

          // Highlight immediately
          setHighlightedSection("subagent");

          // Scroll if not fully visible
          if (!isVisible) {
            requestAnimationFrame(() => {
              subagentSectionRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
              // Focus first field after scroll
              setTimeout(() => {
                subagentCommissionTypeSelectRef.current?.focus();
              }, 300);
            });
          } else {
            // Section is visible, just focus first field
            setTimeout(() => {
              subagentCommissionTypeSelectRef.current?.focus();
            }, 0);
          }

          // Clear highlight after 1.2 seconds
          setTimeout(() => setHighlightedSection(null), 1200);
        }
      }
    };

    const validateForm = (): boolean => {
      // At least one role must be selected
      if (roles.length === 0) return false;

      // Determine which type to validate based on roles
      let typeToValidate: DirectoryType = baseType;
      if (roles.includes("client")) {
        typeToValidate = clientType;
      }

      if (typeToValidate === "person") {
        return firstName.trim() !== "" && lastName.trim() !== "";
      } else {
        return companyName.trim() !== "";
      }
    };

    // Expose submit method via ref
    useImperativeHandle(ref, () => ({
      submit: (closeAfterSave: boolean) => {
        pendingCloseAfterSaveRef.current = closeAfterSave;
        if (formRef.current) {
          formRef.current.requestSubmit();
        }
      },
    }));

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!validateForm()) return;
      
      const closeAfterSave = pendingCloseAfterSaveRef.current;
      pendingCloseAfterSaveRef.current = false;

      // Determine the actual type based on roles
      let actualType: DirectoryType = baseType;
      if (roles.includes("client")) {
        actualType = clientType;
      }

      const formData: Partial<DirectoryRecord> = {
        type: actualType,
        roles,
        phone: phone || undefined,
        email: email || undefined,
      };

      // Set person or company fields based on actual type
      if (actualType === "person") {
        formData.firstName = firstName;
        formData.lastName = lastName;
        formData.personalCode = personalCode || undefined;
        formData.dob = dob || undefined;
      } else {
        formData.companyName = companyName;
        formData.regNumber = regNo || undefined;
        formData.legalAddress = address || undefined;
        formData.actualAddress = actualAddress || undefined;
        if (!record || !record.personalCode) {
          formData.personalCode = regNo || undefined;
        }
      }

      // Supplier details - no additional fields needed

      // Subagent details
      if (roles.includes("subagent")) {
        formData.subagentExtras = {
          commissionType: subagentCommissionType,
          commissionValue: subagentCommissionValue,
          commissionCurrency: subagentCommissionCurrency,
        };
      }

      onSubmit(formData, closeAfterSave);
    };

    const isValid = validateForm();

    // Notify parent about validation state changes
    useEffect(() => {
      onValidationChange?.(isValid);
    }, [isValid, onValidationChange]);

    // Determine which type to show fields for
    const displayType: DirectoryType = roles.includes("client") ? clientType : baseType;

    const isSupplier = roles.includes("supplier");
    const isSubagent = roles.includes("subagent");
    const isClient = roles.includes("client");
    
    // Helper function to get input classes based on field state - Modern 2025 styling
    const getInputClasses = (fieldName: string, isRequired: boolean = false, value: string | number | undefined = ""): string => {
      const baseClasses = "w-full rounded-xl border px-4 py-2.5 text-sm font-medium tracking-tight transition-all duration-300 placeholder:text-gray-400/60 placeholder:font-normal focus:outline-none h-[2.75rem] backdrop-blur-sm";
      
      // Check if field is required and empty
      const isEmpty = !value || (typeof value === "string" && value.trim() === "");
      const isRequiredEmpty = isRequired && isEmpty;
      
      // Priority: saved > required empty > dirty > normal
      if (savedFields.has(fieldName)) {
        // Simple green border for saved field
        return `${baseClasses} border-green-500 focus:border-green-600 saved-field-input`;
      } else if (isRequiredEmpty) {
        return `${baseClasses} border-red-300/70 bg-gradient-to-br from-red-50/60 to-white shadow-[0_0_0_3px_rgba(239,68,68,0.06)] focus:border-red-400 focus:shadow-[0_0_0_4px_rgba(239,68,68,0.1)]`;
      } else if (dirtyFields.has(fieldName)) {
        return `${baseClasses} border-amber-300/70 bg-gradient-to-br from-amber-50/60 to-white shadow-[0_0_0_3px_rgba(245,158,11,0.06)] focus:border-amber-400 focus:shadow-[0_0_0_4px_rgba(245,158,11,0.1)]`;
      } else {
        return `${baseClasses} border-gray-200/80 bg-white/90 shadow-[0_1px_2px_0_rgba(0,0,0,0.03)] hover:border-gray-300 hover:shadow-[0_2px_4px_0_rgba(0,0,0,0.04)] focus:border-gray-900/20 focus:shadow-[0_0_0_4px_rgba(0,0,0,0.04)]`;
      }
    };
    
    // Helper function for consistent label styling (fixed height to prevent jumping)
    const getLabelClasses = (): string => {
      return "mb-1.5 block min-h-[1.25rem] text-sm font-medium text-gray-700 transition-colors";
    };

    return (
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className={`space-y-6 pb-24 transition-all duration-400 ${
          highlightedSection ? "" : ""
        }`}
      >
        {/* Main details and Statistics sections in 2 columns */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Main Details (1/3 width) */}
          <div className={`lg:col-span-4 group rounded-2xl bg-white/80 backdrop-blur-xl p-7 shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.04)] border border-gray-100/50 transition-all duration-300 hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08),0_2px_4px_-1px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 ${saveSuccess && dirtyFields.size > 0 ? "main-details-saved" : ""}`}>
            <h2 className="mb-5 text-lg font-semibold tracking-tight text-gray-900">Main details</h2>
            <div className="space-y-4">
              {/* Type and Roles in one row - labels on top, options below */}
              {/* Always show in edit mode, or in create mode if not client, or if client */}
              {(mode === "edit" || (mode === "create" && !isClient) || isClient) ? (
                <div className="flex items-start gap-12">
                  {/* Type selection */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-semibold tracking-tight text-gray-900 whitespace-nowrap">
                      Type <span className="text-red-500 font-medium">*</span>
                    </label>
                    <div className="flex gap-4">
                      <label className="flex cursor-pointer items-center space-x-2 group/radio">
                        <input
                          type="radio"
                          name={isClient ? "clientType" : "type"}
                          value="person"
                          checked={isClient ? clientType === "person" : baseType === "person"}
                          onChange={(e) => {
                            if (isClient) {
                              setClientType(e.target.value as DirectoryType);
                              markFieldDirty("clientType");
                            } else {
                              setBaseType(e.target.value as DirectoryType);
                              markFieldDirty("baseType");
                            }
                          }}
                          className="h-4.5 w-4.5 border-2 border-gray-300 text-black transition-all duration-200 focus:ring-2 focus:ring-black focus:ring-offset-2 focus:ring-offset-white cursor-pointer group-hover/radio:border-gray-400"
                        />
                        <span className="text-sm font-medium text-gray-700 group-hover/radio:text-gray-900 transition-colors">Person</span>
                      </label>
                      <label className="flex cursor-pointer items-center space-x-2 group/radio">
                        <input
                          type="radio"
                          name={isClient ? "clientType" : "type"}
                          value="company"
                          checked={isClient ? clientType === "company" : baseType === "company"}
                          onChange={(e) => {
                            if (isClient) {
                              setClientType(e.target.value as DirectoryType);
                              markFieldDirty("clientType");
                            } else {
                              setBaseType(e.target.value as DirectoryType);
                              markFieldDirty("baseType");
                            }
                          }}
                          className="h-4.5 w-4.5 border-2 border-gray-300 text-black transition-all duration-200 focus:ring-2 focus:ring-black focus:ring-offset-2 focus:ring-offset-white cursor-pointer group-hover/radio:border-gray-400"
                        />
                        <span className="text-sm font-medium text-gray-700 group-hover/radio:text-gray-900 transition-colors">Company</span>
                      </label>
                    </div>
                  </div>

                  {/* Roles - on same line */}
                  <div className="flex flex-col gap-2 relative group/roles-container">
                    <label className="text-sm font-semibold tracking-tight text-gray-900 whitespace-nowrap">
                      Roles <span className="text-red-500 font-medium">*</span>
                    </label>
                    {/* Hover tooltip for error message - appears on hover over Roles section */}
                    {roles.length === 0 && (
                      <div className="absolute left-0 top-full mt-2 opacity-0 group-hover/roles-container:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                        <div className="whitespace-nowrap rounded-lg bg-red-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xl min-w-[220px]">
                          At least one role must be selected
                          <div className="absolute -top-1.5 left-5 h-3 w-3 rotate-45 bg-red-600"></div>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2.5 items-center flex-wrap">
                      {(["client", "supplier", "subagent"] as DirectoryRole[]).map((role) => (
                        <label 
                          key={role} 
                          className="flex cursor-pointer items-center space-x-1.5 group/checkbox shrink-0"
                        >
                          <input
                            type="checkbox"
                            checked={roles.includes(role)}
                            onChange={() => {
                              handleRoleToggle(role);
                              markFieldDirty(`role_${role}`);
                            }}
                            className="h-4 w-4 rounded border-2 border-gray-300 text-black transition-all duration-200 focus:ring-2 focus:ring-black focus:ring-offset-1 focus:ring-offset-white cursor-pointer group-hover/checkbox:border-gray-400 flex-shrink-0"
                          />
                          <span className="text-xs font-medium text-gray-700 capitalize whitespace-nowrap group-hover/checkbox:text-gray-900 transition-colors">{role}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Person fields */}
              {displayType === "person" && (
                <>
                  <div>
                    <label className="mb-2 block min-h-[1.25rem] text-xs font-semibold uppercase tracking-wider text-gray-600 transition-colors">
                      First name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative min-h-[2.5rem]">
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => {
                          setFirstName(e.target.value);
                          markFieldDirty("firstName");
                        }}
                        className={getInputClasses("firstName", true, firstName)}
                        required
                        aria-label="First name"
                      />
                      {firstName.trim() && (
                        <div className={`absolute right-3 top-1/2 -translate-y-1/2 ${savedFields.has("firstName") ? "opacity-100 animate-[checkmarkAppear_0.8s_ease-in-out]" : "opacity-0"}`}>
                          <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block min-h-[1.25rem] text-xs font-semibold uppercase tracking-wider text-gray-600 transition-colors truncate">
                      Last name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative min-h-[2.5rem]">
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => {
                          setLastName(e.target.value);
                          markFieldDirty("lastName");
                        }}
                        className={getInputClasses("lastName", true, lastName)}
                        required
                        aria-label="Last name"
                      />
                      {lastName.trim() && (
                        <div className={`absolute right-3 top-1/2 -translate-y-1/2 ${savedFields.has("lastName") ? "opacity-100 animate-[checkmarkAppear_0.8s_ease-in-out]" : "opacity-0"}`}>
                          <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block min-h-[1.25rem] text-xs font-semibold uppercase tracking-wider text-gray-600 transition-colors truncate">
                      Personal code
                    </label>
                    <div className="min-h-[2.5rem]">
                      <input
                        type="text"
                        value={personalCode}
                        onChange={(e) => {
                          setPersonalCode(e.target.value);
                          markFieldDirty("personalCode");
                        }}
                        className={getInputClasses("personalCode", false, personalCode)}
                        aria-label="Personal code"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block min-h-[1.25rem] text-xs font-semibold uppercase tracking-wider text-gray-600 transition-colors truncate">
                      Date of birth
                    </label>
                    <div className="min-h-[2.5rem]">
                      <input
                        type="date"
                        value={dob}
                        onChange={(e) => {
                          setDob(e.target.value);
                          markFieldDirty("dob");
                        }}
                        className={getInputClasses("dob", false, dob)}
                        aria-label="Date of birth"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Company fields */}
              {displayType === "company" && (
                <>
                  <div>
                    <label className="mb-2 block min-h-[1.25rem] text-xs font-semibold uppercase tracking-wider text-gray-600 transition-colors truncate">
                      Company name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative min-h-[2.5rem]">
                      <input
                        type="text"
                        value={companyName}
                        onChange={(e) => {
                          setCompanyName(e.target.value);
                          markFieldDirty("companyName");
                        }}
                        className={getInputClasses("companyName", true, companyName)}
                        required
                        aria-label="Company name"
                      />
                      {companyName.trim() && (
                        <div className={`absolute right-3 top-1/2 -translate-y-1/2 ${savedFields.has("companyName") ? "opacity-100 animate-[checkmarkAppear_0.8s_ease-in-out]" : "opacity-0"}`}>
                          <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block min-h-[1.25rem] text-xs font-semibold uppercase tracking-wider text-gray-600 transition-colors truncate">
                      Reg Nr
                    </label>
                    <div className="min-h-[2.5rem]">
                      <input
                        type="text"
                        value={regNo}
                        onChange={(e) => {
                          setRegNo(e.target.value);
                          markFieldDirty("regNo");
                        }}
                        className={getInputClasses("regNo", false, regNo)}
                        aria-label="Registration number"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block min-h-[1.25rem] text-xs font-semibold uppercase tracking-wider text-gray-600 transition-colors truncate">
                      Address
                    </label>
                    <div className="min-h-[2.5rem]">
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => {
                          setAddress(e.target.value);
                          markFieldDirty("address");
                        }}
                        className={getInputClasses("address", false, address)}
                        aria-label="Address"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block min-h-[1.25rem] text-xs font-semibold uppercase tracking-wider text-gray-600 transition-colors truncate">
                      Actual address
                    </label>
                    <div className="min-h-[2.5rem]">
                      <input
                        type="text"
                        value={actualAddress}
                        onChange={(e) => {
                          setActualAddress(e.target.value);
                          markFieldDirty("actualAddress");
                        }}
                        className={getInputClasses("actualAddress", false, actualAddress)}
                        aria-label="Actual address"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-2 block min-h-[1.25rem] text-xs font-semibold uppercase tracking-wider text-gray-600 transition-colors truncate">
                      Contact person
                    </label>
                    <div className="min-h-[2.5rem]">
                      <input
                        type="text"
                        value={contactPerson}
                        onChange={(e) => {
                          setContactPerson(e.target.value);
                          markFieldDirty("contactPerson");
                        }}
                        className={getInputClasses("contactPerson", false, contactPerson)}
                        aria-label="Contact person"
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Common fields */}
              <div>
                <label className="mb-2 flex items-center gap-2 min-h-[1.25rem] text-xs font-semibold uppercase tracking-wider text-gray-600 transition-colors truncate">
                  <svg className="h-3.5 w-3.5 text-gray-500 transition-transform duration-200 group-hover:scale-110 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  <span className="truncate">Phone</span>
                </label>
                <div className="min-h-[2.5rem]">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      markFieldDirty("phone");
                    }}
                    className={getInputClasses("phone", false, phone)}
                    aria-label="Phone"
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 flex items-center gap-2 min-h-[1.25rem] text-xs font-semibold uppercase tracking-wider text-gray-600 transition-colors truncate">
                  <svg className="h-3.5 w-3.5 text-gray-500 transition-transform duration-200 group-hover:scale-110 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="truncate">Email</span>
                </label>
                <div className="relative min-h-[2.5rem]">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      markFieldDirty("email");
                    }}
                    className={getInputClasses("email", false, email)}
                    aria-label="Email"
                  />
                  {email && email.includes("@") && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 animate-[fadeInZoom_0.2s_ease-in-out_forwards]">
                      <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Statistics with Tabs (2/3 width) - Always visible */}
          <div className="lg:col-span-8 group rounded-2xl bg-white/80 backdrop-blur-xl p-7 shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.04)] border border-gray-100/50 transition-all duration-300 hover:shadow-[0_4px_12px_-2px_rgba(0,0,0,0.08),0_2px_4px_-1px_rgba(0,0,0,0.04)] hover:-translate-y-0.5">
              <h2 className="mb-5 text-lg font-semibold tracking-tight text-gray-900">Statistics</h2>
              <div className="space-y-4">
                {/* Tabs - modern style with switching */}
                <div className="border-b border-gray-200/60">
                  <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                    <button
                      type="button"
                      onClick={() => setActiveTab("statistics")}
                      className={`relative border-b-2 px-3 py-2.5 text-sm font-semibold tracking-tight transition-all duration-200 truncate ${
                        activeTab === "statistics"
                          ? "border-gray-900 text-gray-900"
                          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                      }`}
                    >
                      Statistics
                      {activeTab === "statistics" && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900"></div>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab("clientScore")}
                      className={`relative border-b-2 px-3 py-2.5 text-sm font-semibold tracking-tight transition-all duration-200 truncate ${
                        activeTab === "clientScore"
                          ? "border-gray-900 text-gray-900"
                          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                      }`}
                    >
                      Client Score
                      {activeTab === "clientScore" && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-900"></div>
                      )}
                    </button>
                  </nav>
                </div>

                {/* Statistics Tab Content */}
                {activeTab === "statistics" && (
                  <div className="pt-4">
                    {roles.includes("client") ? (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center min-h-[1.5rem]">
                          <span className="text-sm text-gray-600 truncate">Total Spent</span>
                          <span className="text-sm font-medium text-gray-900 truncate ml-2">€0</span>
                        </div>
                        <div className="flex justify-between items-center min-h-[1.5rem]">
                          <span className="text-sm text-gray-600 truncate">Orders</span>
                          <span className="text-sm font-medium text-gray-900 truncate ml-2">0</span>
                        </div>
                        <div className="flex justify-between items-center min-h-[1.5rem]">
                          <span className="text-sm text-gray-600 truncate">Last Trip</span>
                          <span className="text-sm font-medium text-gray-900 truncate ml-2">-</span>
                        </div>
                        <div className="flex justify-between items-center min-h-[1.5rem]">
                          <span className="text-sm text-gray-600 truncate">Next Trip</span>
                          <span className="text-sm font-medium text-gray-900 truncate ml-2">-</span>
                        </div>
                        <div className="flex justify-between items-center min-h-[1.5rem]">
                          <span className="text-sm text-gray-600 truncate">Debt</span>
                          <span className="text-sm font-medium text-gray-900 truncate ml-2">€0</span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 italic min-h-[6rem] flex items-center">
                        Select "Client" role to view statistics
                      </div>
                    )}
                  </div>
                )}

                {/* Client Score Tab Content */}
                {activeTab === "clientScore" && (
                  <div className="pt-4">
                    {roles.includes("client") ? (
                      <div className="text-sm text-gray-600 min-h-[6rem]">
                        Client Score information will be displayed here.
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 italic min-h-[6rem] flex items-center">
                        Select "Client" role to view client score
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
        </div>


        {/* Subagent Details Section */}
        {isSubagent && (
          <div
            id="subagent-settings"
            ref={subagentSectionRef}
            className={`group opacity-0 animate-[fadeInSlideUp_0.5s_ease-in-out_forwards] rounded-lg bg-white p-6 shadow-sm transition-all duration-500 hover:shadow-md ${
              highlightedSection === "subagent"
                ? "ring-2 ring-purple-300 bg-gradient-to-br from-purple-50/50 to-white"
                : ""
            }`}
          >
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Subagent Details</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Commission type
                  </label>
                  <select
                    ref={subagentCommissionTypeSelectRef}
                    value={subagentCommissionType}
                    onChange={(e) => {
                      setSubagentCommissionType(e.target.value as SubagentCommissionType);
                      markFieldDirty("subagentCommissionType");
                    }}
                    className={getInputClasses("subagentCommissionType", false, subagentCommissionType)}
                    aria-label="Subagent commission type"
                  >
                    <option value="revenue">From revenue</option>
                    <option value="profit">From profit</option>
                    <option value="progressive">Progressive ladder</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Commission value
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={subagentCommissionValue || ""}
                    onChange={(e) => {
                      setSubagentCommissionValue(
                        e.target.value ? parseFloat(e.target.value) : undefined
                      );
                      markFieldDirty("subagentCommissionValue");
                    }}
                    className={getInputClasses("subagentCommissionValue", false, subagentCommissionValue)}
                    aria-label="Subagent commission value"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Currency</label>
                  <select
                    value={subagentCommissionCurrency}
                    onChange={(e) => {
                      setSubagentCommissionCurrency(e.target.value);
                      markFieldDirty("subagentCommissionCurrency");
                    }}
                    className={getInputClasses("subagentCommissionCurrency", false, subagentCommissionCurrency)}
                    aria-label="Subagent commission currency"
                  >
                    <option value="EUR">EUR</option>
                    <option value="USD">USD</option>
                    <option value="GBP">GBP</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Period type</label>
                  <select
                    value={subagentPeriodType}
                    onChange={(e) => {
                      setSubagentPeriodType(e.target.value as "year" | "custom");
                      markFieldDirty("subagentPeriodType");
                    }}
                    className={getInputClasses("subagentPeriodType", false, subagentPeriodType)}
                    aria-label="Subagent period type"
                  >
                    <option value="year">Default (year)</option>
                    <option value="custom">Custom period</option>
                  </select>
                </div>
              </div>
              {subagentPeriodType === "custom" && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Period from
                    </label>
                    <input
                      type="date"
                      value={subagentPeriodFrom}
                      onChange={(e) => {
                        setSubagentPeriodFrom(e.target.value);
                        markFieldDirty("subagentPeriodFrom");
                      }}
                      className={getInputClasses("subagentPeriodFrom", false, subagentPeriodFrom)}
                      aria-label="Subagent period from"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Period to</label>
                    <input
                      type="date"
                      value={subagentPeriodTo}
                      onChange={(e) => {
                        setSubagentPeriodTo(e.target.value);
                        markFieldDirty("subagentPeriodTo");
                      }}
                      className={getInputClasses("subagentPeriodTo", false, subagentPeriodTo)}
                      aria-label="Subagent period to"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Payment details (IBAN, bank, etc.)
                </label>
                <textarea
                  value={subagentPaymentDetails}
                  onChange={(e) => {
                    setSubagentPaymentDetails(e.target.value);
                    markFieldDirty("subagentPaymentDetails");
                  }}
                  rows={3}
                  placeholder="IBAN, bank name, account holder..."
                  className={getInputClasses("subagentPaymentDetails", false, subagentPaymentDetails)}
                  aria-label="Payment details"
                />
              </div>
            </div>
          </div>
        )}

        {/* Audit section (only for edit mode) */}
        {mode === "edit" && record && (
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Audit</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Created at</label>
                <div className="text-sm text-gray-700">
                  {new Date(record.createdAt).toLocaleString()}
                </div>
              </div>
              {record.updatedAt && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Last updated
                  </label>
                  <div className="text-sm text-gray-700">
                    {new Date(record.updatedAt).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Hidden submit button for form validation */}
        <button type="submit" className="hidden" disabled={!isValid} aria-label="Submit form" />
      </form>
    );
  }
);

export default DirectoryForm;
