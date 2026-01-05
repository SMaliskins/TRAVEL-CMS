"use client";

import React, { useState, useEffect, useImperativeHandle } from "react";
import {
  DirectoryRecord,
  DirectoryType,
  DirectoryRole,
  SupplierDetails,
  SubagentDetails,
  SubagentCommissionType,
  SubagentPeriodType,
} from "@/lib/types/directory";

interface DirectoryFormProps {
  record?: DirectoryRecord;
  mode: "create" | "edit";
  onSubmit: (data: Partial<DirectoryRecord>, closeAfterSave: boolean) => void;
  onCancel: () => void;
  onValidationChange?: (isValid: boolean) => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export interface DirectoryFormHandle {
  submit: (closeAfterSave: boolean) => void;
}

const DirectoryForm = React.forwardRef<DirectoryFormHandle, DirectoryFormProps>(
  function DirectoryForm(
    { record, mode, onSubmit, onCancel, onValidationChange, onDirtyChange },
    ref
  ) {
    const formRef = React.useRef<HTMLFormElement>(null);
    const supplierSectionRef = React.useRef<HTMLDivElement>(null);
    const subagentSectionRef = React.useRef<HTMLDivElement>(null);
    const supplierActivityAreaInputRef = React.useRef<HTMLInputElement>(null);
    const subagentCommissionTypeSelectRef = React.useRef<HTMLSelectElement>(null);
    const pendingCloseAfterSaveRef = React.useRef<boolean>(false);
    const [highlightedSection, setHighlightedSection] = useState<"supplier" | "subagent" | null>(null);
    // Determine base type from record or default to person
    const getBaseType = (): DirectoryType => {
      if (record?.type) return record.type;
      // If client role is selected and has clientType preference, use it
      return "person";
    };

    const [baseType, setBaseType] = useState<DirectoryType>(getBaseType());
    const [roles, setRoles] = useState<DirectoryRole[]>(record?.roles || []);
    const [isActive, setIsActive] = useState(record?.isActive ?? true);

    // Client type selection (for Client role only)
    const [clientType, setClientType] = useState<DirectoryType>(
      record?.roles.includes("client")
        ? record.type
        : "person"
    );

    // Person fields
    const [firstName, setFirstName] = useState(record?.firstName || "");
    const [lastName, setLastName] = useState(record?.lastName || "");
    const [personalCode, setPersonalCode] = useState(record?.personalCode || "");
    const [dob, setDob] = useState(record?.dob || "");

    // Company fields
    const [companyName, setCompanyName] = useState(record?.companyName || "");
    const [regNo, setRegNo] = useState(record?.regNo || "");
    const [address, setAddress] = useState(record?.address || "");
    const [contactPerson, setContactPerson] = useState(record?.contactPerson || "");

    // Common fields
    const [phone, setPhone] = useState(record?.phone || "");
    const [email, setEmail] = useState(record?.email || "");

    // Supplier fields
    const [supplierActivityArea, setSupplierActivityArea] = useState(
      record?.supplierDetails?.activityArea || ""
    );
    const [supplierCommissionType, setSupplierCommissionType] = useState<"percent" | "fixed">(
      record?.supplierDetails?.commissionType || "percent"
    );
    const [supplierCommissionValue, setSupplierCommissionValue] = useState<number | undefined>(
      record?.supplierDetails?.commissionValue
    );
    const [supplierCommissionCurrency, setSupplierCommissionCurrency] = useState(
      record?.supplierDetails?.commissionCurrency || "EUR"
    );
    const [supplierCommissionValidFrom, setSupplierCommissionValidFrom] = useState(
      record?.supplierDetails?.commissionValidFrom || ""
    );
    const [supplierCommissionValidTo, setSupplierCommissionValidTo] = useState(
      record?.supplierDetails?.commissionValidTo || ""
    );

    // Subagent fields
    const [subagentCommissionType, setSubagentCommissionType] = useState<SubagentCommissionType>(
      record?.subagentDetails?.commissionType || "revenue"
    );
    const [subagentCommissionValue, setSubagentCommissionValue] = useState<number | undefined>(
      record?.subagentDetails?.commissionValue
    );
    const [subagentCommissionCurrency, setSubagentCommissionCurrency] = useState(
      record?.subagentDetails?.commissionCurrency || "EUR"
    );
    const [subagentPeriodType, setSubagentPeriodType] = useState<SubagentPeriodType>(
      record?.subagentDetails?.periodType || "year"
    );
    const [subagentPeriodFrom, setSubagentPeriodFrom] = useState(
      record?.subagentDetails?.periodFrom || ""
    );
    const [subagentPeriodTo, setSubagentPeriodTo] = useState(
      record?.subagentDetails?.periodTo || ""
    );
    const [subagentPaymentDetails, setSubagentPaymentDetails] = useState(
      record?.subagentDetails?.paymentDetails || ""
    );

    // Update baseType when roles change (for Client role)
    useEffect(() => {
      if (roles.includes("client")) {
        setBaseType(clientType);
      } else if (mode === "create") {
        // If no client role, use baseType from initial selection
        setBaseType(baseType);
      }
    }, [roles, clientType, mode, baseType]);

    // Track initial values for dirty state
    const getInitialValues = (): Partial<DirectoryRecord> => {
      if (!record) return {};
      return {
        type: record.type,
        roles: record.roles,
        isActive: record.isActive,
        firstName: record.firstName,
        lastName: record.lastName,
        companyName: record.companyName,
        personalCode: record.personalCode,
        dob: record.dob,
        phone: record.phone,
        email: record.email,
        regNo: record.regNo,
        address: record.address,
        contactPerson: record.contactPerson,
        supplierDetails: record.supplierDetails,
        subagentDetails: record.subagentDetails,
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
        isActive !== initialValues.isActive ||
        firstName.trim() !== (initialValues.firstName || "").trim() ||
        lastName.trim() !== (initialValues.lastName || "").trim() ||
        companyName.trim() !== (initialValues.companyName || "").trim() ||
        personalCode.trim() !== (initialValues.personalCode || "").trim() ||
        dob !== (initialValues.dob || "") ||
        phone.trim() !== (initialValues.phone || "").trim() ||
        email.trim() !== (initialValues.email || "").trim() ||
        regNo.trim() !== (initialValues.regNo || "").trim() ||
        address.trim() !== (initialValues.address || "").trim() ||
        contactPerson.trim() !== (initialValues.contactPerson || "").trim()
      ) {
        return true;
      }

      // Check supplier details
      const initialSupplier = initialValues.supplierDetails;
      if (roles.includes("supplier")) {
        if (
          !initialSupplier ||
          supplierActivityArea.trim() !== (initialSupplier.activityArea || "").trim() ||
          supplierCommissionType !== initialSupplier.commissionType ||
          supplierCommissionValue !== initialSupplier.commissionValue ||
          supplierCommissionCurrency !== initialSupplier.commissionCurrency ||
          supplierCommissionValidFrom !== (initialSupplier.commissionValidFrom || "") ||
          supplierCommissionValidTo !== (initialSupplier.commissionValidTo || "")
        ) {
          return true;
        }
      } else if (initialSupplier) {
        return true;
      }

      // Check subagent details
      const initialSubagent = initialValues.subagentDetails;
      if (roles.includes("subagent")) {
        if (
          !initialSubagent ||
          subagentCommissionType !== initialSubagent.commissionType ||
          subagentCommissionValue !== initialSubagent.commissionValue ||
          subagentCommissionCurrency !== initialSubagent.commissionCurrency ||
          subagentPeriodType !== initialSubagent.periodType ||
          subagentPeriodFrom !== (initialSubagent.periodFrom || "") ||
          subagentPeriodTo !== (initialSubagent.periodTo || "") ||
          subagentPaymentDetails.trim() !== (initialSubagent.paymentDetails || "").trim()
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
        if (role === "supplier" && supplierSectionRef.current) {
          // Check if section is already visible in viewport
          const rect = supplierSectionRef.current.getBoundingClientRect();
          const isVisible =
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth);

          // Highlight immediately
          setHighlightedSection("supplier");

          // Scroll if not fully visible
          if (!isVisible) {
            requestAnimationFrame(() => {
              supplierSectionRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
              });
              // Focus first field after scroll
              setTimeout(() => {
                supplierActivityAreaInputRef.current?.focus();
              }, 300);
            });
          } else {
            // Section is visible, just focus first field
            setTimeout(() => {
              supplierActivityAreaInputRef.current?.focus();
            }, 0);
          }

          // Clear highlight after 1.2 seconds
          setTimeout(() => setHighlightedSection(null), 1200);
        } else if (role === "subagent" && subagentSectionRef.current) {
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
        isActive,
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
        formData.regNo = regNo || undefined;
        formData.address = address || undefined;
        formData.contactPerson = contactPerson || undefined;
        if (!record || !record.personalCode) {
          formData.personalCode = regNo || undefined;
        }
      }

      // Supplier details
      if (roles.includes("supplier")) {
        formData.supplierDetails = {
          activityArea: supplierActivityArea || undefined,
          commissionType: supplierCommissionType,
          commissionValue: supplierCommissionValue,
          commissionCurrency: supplierCommissionCurrency,
          commissionValidFrom: supplierCommissionValidFrom || undefined,
          commissionValidTo: supplierCommissionValidTo || undefined,
        };
      }

      // Subagent details
      if (roles.includes("subagent")) {
        formData.subagentDetails = {
          commissionType: subagentCommissionType,
          commissionValue: subagentCommissionValue,
          commissionCurrency: subagentCommissionCurrency,
          periodType: subagentPeriodType,
          periodFrom: subagentPeriodFrom || undefined,
          periodTo: subagentPeriodTo || undefined,
          paymentDetails: subagentPaymentDetails || undefined,
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

    return (
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className={`space-y-6 pb-24 transition-all duration-400 ${
          highlightedSection ? "" : ""
        }`}
      >
        {/* Main details and Roles sections in 2 columns */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Left: Main Details */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Main details</h2>
            <div className="space-y-4">
              {/* Type selection (only for create mode, or for Client role) */}
              {mode === "create" && !isClient && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex cursor-pointer items-center space-x-2">
                      <input
                        type="radio"
                        name="type"
                        value="person"
                        checked={baseType === "person"}
                        onChange={(e) => setBaseType(e.target.value as DirectoryType)}
                        className="h-4 w-4 border-gray-300 text-black focus:ring-black"
                      />
                      <span className="text-sm text-gray-700">Person</span>
                    </label>
                    <label className="flex cursor-pointer items-center space-x-2">
                      <input
                        type="radio"
                        name="type"
                        value="company"
                        checked={baseType === "company"}
                        onChange={(e) => setBaseType(e.target.value as DirectoryType)}
                        className="h-4 w-4 border-gray-300 text-black focus:ring-black"
                      />
                      <span className="text-sm text-gray-700">Company</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Client type selection (if Client role is selected) */}
              {isClient && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Client type <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-4">
                    <label className="flex cursor-pointer items-center space-x-2">
                      <input
                        type="radio"
                        name="clientType"
                        value="person"
                        checked={clientType === "person"}
                        onChange={(e) => setClientType(e.target.value as DirectoryType)}
                        className="h-4 w-4 border-gray-300 text-black focus:ring-black"
                      />
                      <span className="text-sm text-gray-700">Physical person</span>
                    </label>
                    <label className="flex cursor-pointer items-center space-x-2">
                      <input
                        type="radio"
                        name="clientType"
                        value="company"
                        checked={clientType === "company"}
                        onChange={(e) => setClientType(e.target.value as DirectoryType)}
                        className="h-4 w-4 border-gray-300 text-black focus:ring-black"
                      />
                      <span className="text-sm text-gray-700">Legal entity</span>
                    </label>
                  </div>
                </div>
              )}

              {/* Person fields */}
              {displayType === "person" && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      First name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Last name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Personal code
                    </label>
                    <input
                      type="text"
                      value={personalCode}
                      onChange={(e) => setPersonalCode(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Date of birth
                    </label>
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>
                </>
              )}

              {/* Company fields */}
              {displayType === "company" && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Company name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Reg Nr
                    </label>
                    <input
                      type="text"
                      value={regNo}
                      onChange={(e) => setRegNo(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Address
                    </label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Contact person
                    </label>
                    <input
                      type="text"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>
                </>
              )}

              {/* Common fields */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
            </div>
          </div>

          {/* Right: Roles & Status */}
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Roles & status</h2>
            <div className="space-y-4">
              {/* Roles */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Roles <span className="text-red-500">*</span>
                </label>
                {roles.length === 0 && (
                  <p className="mb-2 text-xs text-red-500">At least one role must be selected</p>
                )}
                <div className="space-y-2">
                  {(["client", "supplier", "subagent"] as DirectoryRole[]).map((role) => (
                    <label key={role} className="flex cursor-pointer items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={roles.includes(role)}
                        onChange={() => handleRoleToggle(role)}
                        className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                      />
                      <span className="text-sm text-gray-700 capitalize">{role}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">Status</label>
                <label className="flex cursor-pointer items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                  />
                  <span className="text-sm text-gray-700">Active</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Supplier Details Section */}
        {isSupplier && (
          <div
            id="supplier-settings"
            ref={supplierSectionRef}
            className={`rounded-lg bg-white p-6 shadow-sm transition-all duration-300 ${
              highlightedSection === "supplier"
                ? "ring-2 ring-blue-300 bg-blue-50/30"
                : ""
            }`}
          >
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Supplier Details</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Activity area
                </label>
                <input
                  ref={supplierActivityAreaInputRef}
                  type="text"
                  value={supplierActivityArea}
                  onChange={(e) => setSupplierActivityArea(e.target.value)}
                  placeholder="e.g., Hotels, Transportation"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Commission type
                </label>
                <select
                  value={supplierCommissionType}
                  onChange={(e) =>
                    setSupplierCommissionType(e.target.value as "percent" | "fixed")
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                >
                  <option value="percent">Percent (%)</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Commission value
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={supplierCommissionValue || ""}
                  onChange={(e) =>
                    setSupplierCommissionValue(
                      e.target.value ? parseFloat(e.target.value) : undefined
                    )
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Currency</label>
                <select
                  value={supplierCommissionCurrency}
                  onChange={(e) => setSupplierCommissionCurrency(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                >
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Commission valid from
                </label>
                <input
                  type="date"
                  value={supplierCommissionValidFrom}
                  onChange={(e) => setSupplierCommissionValidFrom(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Commission valid to
                </label>
                <input
                  type="date"
                  value={supplierCommissionValidTo}
                  onChange={(e) => setSupplierCommissionValidTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                />
              </div>
            </div>
          </div>
        )}

        {/* Subagent Details Section */}
        {isSubagent && (
          <div
            id="subagent-settings"
            ref={subagentSectionRef}
            className={`rounded-lg bg-white p-6 shadow-sm transition-all duration-300 ${
              highlightedSection === "subagent"
                ? "ring-2 ring-blue-300 bg-blue-50/30"
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
                    onChange={(e) =>
                      setSubagentCommissionType(e.target.value as SubagentCommissionType)
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
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
                    onChange={(e) =>
                      setSubagentCommissionValue(
                        e.target.value ? parseFloat(e.target.value) : undefined
                      )
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Currency</label>
                  <select
                    value={subagentCommissionCurrency}
                    onChange={(e) => setSubagentCommissionCurrency(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
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
                    onChange={(e) => setSubagentPeriodType(e.target.value as "year" | "custom")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
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
                      onChange={(e) => setSubagentPeriodFrom(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Period to</label>
                    <input
                      type="date"
                      value={subagentPeriodTo}
                      onChange={(e) => setSubagentPeriodTo(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
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
                  onChange={(e) => setSubagentPaymentDetails(e.target.value)}
                  rows={3}
                  placeholder="IBAN, bank name, account holder..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-black focus:outline-none focus:ring-1 focus:ring-black"
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
        <button type="submit" className="hidden" disabled={!isValid} />
      </form>
    );
  }
);

export default DirectoryForm;
