"use client";

import React, { useState, useEffect, useImperativeHandle } from "react";
import {
  DirectoryRecord,
  DirectoryType,
  DirectoryRole,
  SupplierDetails,
  SupplierCommission,
  SubagentDetails,
  SubagentCommissionType,
  CorporateAccount,
  LoyaltyCard,
} from "@/lib/types/directory";
import { useRipple } from "@/hooks/useRipple";
import { ValidationIcon } from "@/components/ValidationIcon";
import PassportDetailsInput, { PassportData } from "@/components/PassportDetailsInput";
import SingleDatePicker from "@/components/SingleDatePicker";
import { fetchWithAuth } from "@/lib/http/fetchWithAuth";
import { formatPhoneForDisplay, normalizePhoneForSave } from "@/utils/phone";
import { formatDateDDMMYYYY } from "@/utils/dateFormat";
import { getSearchPatterns, matchesSearch } from "@/lib/directory/searchNormalize";
import { Check, X, Plus } from "lucide-react";

function getZodiacSign(dateStr: string): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const day = d.getDate();
  const month = d.getMonth() + 1;
  // [month, lastDayOfFirstSign, signIfDay<=cutoff, signIfDay>cutoff]
  const periods: [number, number, string, string][] = [
    [1, 19, "♑ Capricorn", "♒ Aquarius"], [2, 18, "♒ Aquarius", "♓ Pisces"], [3, 20, "♓ Pisces", "♈ Aries"],
    [4, 19, "♈ Aries", "♉ Taurus"], [5, 20, "♉ Taurus", "♊ Gemini"], [6, 20, "♊ Gemini", "♋ Cancer"],
    [7, 22, "♋ Cancer", "♌ Leo"], [8, 22, "♌ Leo", "♍ Virgo"], [9, 22, "♍ Virgo", "♎ Libra"],
    [10, 22, "♎ Libra", "♏ Scorpio"], [11, 21, "♏ Scorpio", "♐ Sagittarius"], [12, 21, "♐ Sagittarius", "♑ Capricorn"],
  ];
  const p = periods.find(([m]) => m === month);
  return p ? (day <= p[1] ? p[2] : p[3]) : null;
}

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "lv", label: "Latvian" },
  { value: "ru", label: "Russian" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
];

const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Argentina", "Armenia", "Australia",
  "Austria", "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium",
  "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei",
  "Bulgaria", "Burkina Faso", "Burundi", "Cambodia", "Cameroon", "Canada", "Cape Verde", "Central African Republic",
  "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus",
  "Czech Republic", "Denmark", "Djibouti", "Dominica", "Dominican Republic", "Ecuador", "Egypt",
  "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia", "Fiji", "Finland",
  "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea",
  "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hungary", "Iceland", "India", "Indonesia", "Iran",
  "Iraq", "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati",
  "Kuwait", "Kyrgyzstan", "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein",
  "Lithuania", "Luxembourg", "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Mauritania",
  "Mauritius", "Mexico", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
  "Namibia", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea",
  "North Macedonia", "Norway", "Oman", "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea",
  "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Rwanda",
  "Saint Lucia", "Samoa", "San Marino", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone",
  "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "Spain",
  "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania",
  "Thailand", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan",
  "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
];

interface DirectoryFormProps {
  record?: DirectoryRecord;
  mode: "create" | "edit";
  onSubmit: (data: Partial<DirectoryRecord>, closeAfterSave: boolean) => void;
  onCancel: () => void;
  onValidationChange?: (isValid: boolean) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  onAvatarChange?: (avatarUrl: string | undefined) => void;
  saveSuccess?: boolean; // Signal that save was successful for green border effect
}

export interface DirectoryFormHandle {
  submit: (closeAfterSave: boolean) => void;
}

const DirectoryForm = React.forwardRef<DirectoryFormHandle, DirectoryFormProps>(
  function DirectoryForm(
    { record, mode, onSubmit, onCancel, onValidationChange, onDirtyChange, onAvatarChange, saveSuccess = false },
    ref
  ) {
    const formRef = React.useRef<HTMLFormElement>(null);
    const subagentSectionRef = React.useRef<HTMLDivElement>(null);
    const subagentCommissionTypeSelectRef = React.useRef<HTMLSelectElement>(null);
    const pendingCloseAfterSaveRef = React.useRef<boolean>(false);
    const [highlightedSection, setHighlightedSection] = useState<"supplier" | "subagent" | null>(null);
    
    // Active tab state for Statistics section
    const [activeTab, setActiveTab] = useState<"statistics" | "clientScore">("statistics");
    
    // Statistics state
    const [stats, setStats] = useState<{
      ordersCount: number;
      totalSpent: number;
      totalSpentBreakdown?: Array<{ orderCode: string; amount: number }>;
      debt: number;
      lastTrip: string | null;
      nextTrip: string | null;
      invoicesCount?: number;
      invoicesTotal?: number;
      paymentsTotal?: number;
      paymentStatus?: "paid" | "partial" | "overdue" | "overpaid";
      balance?: number;
      overdueInvoices?: Array<{ invoice_number: string | null; due_date: string; total: number }>;
    } | null>(null);
    const [statsLoading, setStatsLoading] = useState(false);
    
    // Ripple effects for tab buttons
    const statisticsTabRipple = useRipple({ color: 'rgba(0, 0, 0, 0.1)' });
    const clientScoreTabRipple = useRipple({ color: 'rgba(0, 0, 0, 0.1)' });
    
    // Track dirty fields (fields that have been modified)
    const [dirtyFields, setDirtyFields] = useState<Set<string>>(new Set());
    
    // Track saved fields (for green border effect after save)
    const [savedFields, setSavedFields] = useState<Set<string>>(new Set());
    
    // Track touched fields (fields that user has interacted with)
    const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
    
    // Track passport fields parsed from PDF/AI (for green border)
    const [passportParsedFields, setPassportParsedFields] = useState<Set<string>>(new Set());
    
    // Track field changes
    const markFieldDirty = (fieldName: string) => {
      setDirtyFields(prev => new Set(prev).add(fieldName));
    };
    
    // Determine base type from record or default to person
    const getBaseType = (): DirectoryType => {
      if (record?.type) return record.type;
      // If client role is selected and has clientType preference, use it
      return "person";
    };

    const [baseType, setBaseType] = useState<DirectoryType>(getBaseType());
    const [roles, setRoles] = useState<DirectoryRole[]>(record?.roles || []);
    
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
    
    // Fetch statistics when client role is active in edit mode
    const fetchStats = React.useCallback(async () => {
      if (mode === "edit" && record?.id && roles.includes("client")) {
        console.log('[DirectoryForm] Fetching stats for:', record.id);
        setStatsLoading(true);
        try {
          // Add cache buster to force fresh data
          const response = await fetch(`/api/directory/${record.id}/stats?t=${Date.now()}`);
          console.log('[DirectoryForm] Stats API response:', response.status);
          if (response.ok) {
            const data = await response.json();
            console.log('[DirectoryForm] Stats data received:', data);
            setStats(data);
          } else {
            console.error("Failed to fetch stats:", response.statusText);
          }
        } catch (error) {
          console.error("Error fetching stats:", error);
        } finally {
          setStatsLoading(false);
        }
      } else {
        console.log('[DirectoryForm] Not fetching stats - condition not met');
        setStats(null);
      }
    }, [mode, record?.id, roles]);

    // Fetch stats on component mount and whenever record changes (each time card opens)
    useEffect(() => {
      console.log('[DirectoryForm] Stats useEffect triggered - component mounted/record changed', {
        mode,
        recordId: record?.id,
        roles,
        hasClientRole: roles.includes("client")
      });
      
      fetchStats();
    }, [fetchStats, record]);
    
    // Auto-refresh stats when switching to Statistics tab
    useEffect(() => {
      if (activeTab === "statistics" && roles.includes("client") && mode === "edit" && record?.id) {
        fetchStats();
      }
    }, [activeTab, fetchStats, roles, mode, record?.id]);
    
    // Auto-refresh stats when page becomes visible (user returns to tab)
    useEffect(() => {
      const handleVisibilityChange = () => {
        if (!document.hidden && activeTab === "statistics" && roles.includes("client")) {
          fetchStats();
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [activeTab, roles, fetchStats]);

    // Client type selection (for Client role only)
    // Initialize from record.type if available, to preserve Type when adding Client role
    const [clientType, setClientType] = useState<DirectoryType>(
      record?.type || "person"
    );

    // Person fields
    const [firstName, setFirstName] = useState(record?.firstName || "");
    const [lastName, setLastName] = useState(record?.lastName || "");
    const [gender, setGender] = useState(record?.gender || "");
    const [personalCode, setPersonalCode] = useState(record?.personalCode || "");
    const [dob, setDob] = useState(record?.dob || "");

    // Passport fields
    const [passportData, setPassportData] = useState<PassportData>({
      passportNumber: record?.passportNumber || undefined,
      passportIssueDate: record?.passportIssueDate || undefined,
      passportExpiryDate: record?.passportExpiryDate || undefined,
      passportIssuingCountry: record?.passportIssuingCountry || undefined,
      passportFullName: record?.passportFullName || undefined,
      dob: record?.dob || undefined,
      nationality: record?.nationality || undefined,
      avatarUrl: record?.avatarUrl || undefined,
      personalCode: record?.personalCode || undefined,
      isAlienPassport: record?.isAlienPassport,
    });

    // Company fields
    const [companyName, setCompanyName] = useState(record?.companyName || "");
    const [regNo, setRegNo] = useState(record?.regNumber || "");
    const [vatNo, setVatNo] = useState(record?.vatNumber || "");
    const [address, setAddress] = useState(record?.legalAddress || "");
    const [actualAddress, setActualAddress] = useState(record?.actualAddress || "");
    const [bankName, setBankName] = useState(record?.bankName || "");
    const [iban, setIban] = useState(record?.iban || "");
    const [swift, setSwift] = useState(record?.swift || "");
    const [contactPerson, setContactPerson] = useState(record?.contactPerson || "");
    const [correspondenceLanguages, setCorrespondenceLanguages] = useState<string[]>(
      Array.isArray(record?.correspondenceLanguages) && record.correspondenceLanguages.length > 0
        ? record.correspondenceLanguages
        : ["en"]
    );
    const [invoiceLanguage, setInvoiceLanguage] = useState(record?.invoiceLanguage || "en");
    const [showAddCorrespondenceLang, setShowAddCorrespondenceLang] = useState(false);
    const [showInvoiceLangSelect, setShowInvoiceLangSelect] = useState(false);

    // Common fields
    const [phone, setPhone] = useState(record?.phone || "");
    const [email, setEmail] = useState(record?.email || "");

    // Country field (for company)
    const [country, setCountry] = useState(record?.country || "");
    const [countrySearch, setCountrySearch] = useState("");
    const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);

    // Supplier fields
    const [serviceAreas, setServiceAreas] = useState<string[]>(
      record?.supplierExtras?.serviceAreas || []
    );
    const [availableCategories, setAvailableCategories] = useState<{id: string; name: string; type: string}[]>([]);
    const [supplierCommissions, setSupplierCommissions] = useState<SupplierCommission[]>(
      record?.supplierExtras?.commissions || []
    );

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

    // Corporate accounts (Company) / Loyalty cards (Person)
    const [corporateAccounts, setCorporateAccounts] = useState<CorporateAccount[]>(
      record?.corporateAccounts || []
    );
    const [loyaltyCards, setLoyaltyCards] = useState<LoyaltyCard[]>(
      record?.loyaltyCards || []
    );
    // Provider autocomplete state
    const [providerQuery, setProviderQuery] = useState("");
    const [providerResults, setProviderResults] = useState<{id: string; name: string}[]>([]);
    const [providerLoading, setProviderLoading] = useState(false);
    const [activeProviderIdx, setActiveProviderIdx] = useState<number | null>(null);
    const providerDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const addCorrespondenceLangRef = React.useRef<HTMLDivElement>(null);
    const invoiceLangSelectRef = React.useRef<HTMLDivElement>(null);

    const searchProviders = React.useCallback(async (query: string) => {
      if (!query.trim()) { setProviderResults([]); return; }
      setProviderLoading(true);
      try {
        const res = await fetchWithAuth(`/api/directory?search=${encodeURIComponent(query)}&limit=8`);
        if (res.ok) {
          const json = await res.json();
          setProviderResults((json.data || []).map((r: any) => ({
            id: r.id,
            name: r.companyName || [r.firstName, r.lastName].filter(Boolean).join(" ") || r.id,
          })));
        }
      } catch { /* ignore */ }
      setProviderLoading(false);
    }, []);

    const createProviderInline = React.useCallback(async (name: string): Promise<{id: string; name: string} | null> => {
      try {
        const res = await fetchWithAuth("/api/directory/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "company", roles: ["supplier"], companyName: name }),
        });
        if (res.ok) {
          const json = await res.json();
          const rec = json.record;
          return { id: rec.id, name: rec.companyName || name };
        }
      } catch { /* ignore */ }
      return null;
    }, []);

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

    // Load travel service categories for Supplier Service Areas
    useEffect(() => {
      const loadCategories = async () => {
        try {
          const response = await fetchWithAuth("/api/travel-service-categories");
          if (response.ok) {
            const data = await response.json();
            const cats = (data.categories || []).filter((c: any) => c.is_active);
            setAvailableCategories(cats.map((c: any) => ({ id: c.id, name: c.name, type: c.type })));
          }
        } catch (error) {
          console.error("Error loading categories:", error);
        }
      };
      loadCategories();
    }, []);

    // Sync fields from record when record changes (after save)
    useEffect(() => {
      if (record) {
        setFirstName(record.firstName || "");
        setLastName(record.lastName || "");
        setGender(record.gender || "");
        setPhone(record.phone ? formatPhoneForDisplay(record.phone) || record.phone : "");
        setEmail(record.email || "");
        setCountry(record.country || "");
        setContactPerson(record.contactPerson || "");
        setCorrespondenceLanguages(
          Array.isArray(record.correspondenceLanguages) && record.correspondenceLanguages.length > 0
            ? record.correspondenceLanguages
            : ["en"]
        );
        setInvoiceLanguage(record.invoiceLanguage || "en");
        setCompanyName(record.companyName || "");
        setBankName(record.bankName || "");
        setIban(record.iban || "");
        setSwift(record.swift || "");
        setRegNo(record.regNumber || "");
        setVatNo(record.vatNumber || "");
        setAddress(record.legalAddress || "");
        setActualAddress(record.actualAddress || "");
        setCorporateAccounts(record.corporateAccounts || []);
        setLoyaltyCards(record.loyaltyCards || []);
        setPassportData({
          passportNumber: record.passportNumber || undefined,
          passportIssueDate: record.passportIssueDate || undefined,
          passportExpiryDate: record.passportExpiryDate || undefined,
          passportIssuingCountry: record.passportIssuingCountry || undefined,
          passportFullName: record.passportFullName || undefined,
          dob: record.dob || undefined,
          nationality: record.nationality || undefined,
          avatarUrl: record.avatarUrl || undefined,
          personalCode: record.personalCode || undefined,
          isAlienPassport: record.isAlienPassport,
        });
      } else if (mode === "create") {
        // Reset passport fields in create mode
        setPassportData({
          passportNumber: undefined,
          passportIssueDate: undefined,
          passportExpiryDate: undefined,
          passportIssuingCountry: undefined,
          passportFullName: undefined,
          dob: undefined,
          nationality: undefined,
          personalCode: undefined,
        });
      }
    }, [record, mode]);

    // Close correspondence/invoice lang popovers on click outside or Escape
    useEffect(() => {
      if (!showAddCorrespondenceLang && !showInvoiceLangSelect) return;
      const handleClickOutside = (e: MouseEvent) => {
        const el1 = addCorrespondenceLangRef.current;
        const el2 = invoiceLangSelectRef.current;
        if (el1 && !el1.contains(e.target as Node)) setShowAddCorrespondenceLang(false);
        if (el2 && !el2.contains(e.target as Node)) setShowInvoiceLangSelect(false);
      };
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          setShowAddCorrespondenceLang(false);
          setShowInvoiceLangSelect(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
        document.removeEventListener("keydown", handleEscape);
      };
    }, [showAddCorrespondenceLang, showInvoiceLangSelect]);

    // Track initial values for dirty state
    const getInitialValues = (): Partial<DirectoryRecord> => {
      if (!record) return {};
      return {
        type: record.type,
        roles: record.roles,
        firstName: record.firstName,
        lastName: record.lastName,
        gender: record.gender,
        companyName: record.companyName,
        companyAvatarUrl: record.companyAvatarUrl,
        personalCode: record.personalCode,
        dob: record.dob,
        phone: record.phone,
        email: record.email,
        regNumber: record.regNumber,
        legalAddress: record.legalAddress,
        actualAddress: record.actualAddress,
        bankName: record.bankName,
        iban: record.iban,
        swift: record.swift,
        contactPerson: record.contactPerson,
        correspondenceLanguages: record.correspondenceLanguages,
        invoiceLanguage: record.invoiceLanguage,
        country: record.country,
        supplierExtras: record.supplierExtras,
        subagentExtras: record.subagentExtras,
        passportNumber: record.passportNumber,
        passportIssueDate: record.passportIssueDate,
        passportExpiryDate: record.passportExpiryDate,
        passportIssuingCountry: record.passportIssuingCountry,
        passportFullName: record.passportFullName,
        nationality: record.nationality,
        avatarUrl: record.avatarUrl,
        isAlienPassport: record.isAlienPassport,
        corporateAccounts: record.corporateAccounts,
        loyaltyCards: record.loyaltyCards,
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
        gender !== (initialValues.gender || "") ||
        companyName.trim() !== (initialValues.companyName || "").trim() ||
        personalCode.trim() !== (initialValues.personalCode || "").trim() ||
        dob !== (initialValues.dob || "") ||
        phone.trim() !== (initialValues.phone || "").trim() ||
        email.trim() !== (initialValues.email || "").trim() ||
        regNo.trim() !== (initialValues.regNumber || "").trim() ||
        vatNo.trim() !== (initialValues.vatNumber || "").trim() ||
        address.trim() !== (initialValues.legalAddress || "").trim() ||
        actualAddress.trim() !== (initialValues.actualAddress || "").trim() ||
        bankName.trim() !== (initialValues.bankName || "").trim() ||
        iban.trim() !== (initialValues.iban || "").trim() ||
        swift.trim() !== (initialValues.swift || "").trim() ||
        contactPerson.trim() !== (initialValues.contactPerson || "").trim() ||
        (() => {
          const a = correspondenceLanguages.slice().sort();
          const b = ((initialValues.correspondenceLanguages as string[]) || ["en"]).slice().sort();
          return a.length !== b.length || a.some((v, i) => v !== b[i]);
        })() ||
        invoiceLanguage !== (initialValues.invoiceLanguage || "en") ||
        (record?.companyAvatarUrl || "") !== (initialValues.companyAvatarUrl || "") ||
        (passportData.avatarUrl || "") !== (initialValues.avatarUrl || "") ||
        (passportData.isAlienPassport ?? false) !== (initialValues.isAlienPassport ?? false)
      ) {
        return true;
      }

      // Check supplier details
      const initialSupplier = initialValues.supplierExtras;
      if (roles.includes("supplier")) {
        const initialAreas = initialSupplier?.serviceAreas || [];
        const currentAreas = [...serviceAreas].sort().join(",");
        const initialAreasStr = [...initialAreas].sort().join(",");
        if (currentAreas !== initialAreasStr) {
          return true;
        }
      }

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

      // Check corporate accounts / loyalty cards
      if (JSON.stringify(corporateAccounts) !== JSON.stringify(initialValues.corporateAccounts || [])) return true;
      if (JSON.stringify(loyaltyCards) !== JSON.stringify(initialValues.loyaltyCards || [])) return true;

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
        phone: phone.trim() ? (normalizePhoneForSave(phone) || undefined) : undefined,
        email: email.trim() ? email.trim() : undefined,
      };

      // Set person or company fields based on actual type
      if (actualType === "person") {
        formData.firstName = firstName;
        formData.lastName = lastName;
        formData.gender = gender || undefined;
        formData.personalCode = personalCode || undefined;
        formData.dob = dob || undefined;
        
        // Passport fields
        formData.passportNumber = passportData.passportNumber || undefined;
        formData.passportIssueDate = passportData.passportIssueDate || undefined;
        formData.passportExpiryDate = passportData.passportExpiryDate || undefined;
        formData.passportIssuingCountry = passportData.passportIssuingCountry || undefined;
        formData.passportFullName = passportData.passportFullName || undefined;
        formData.nationality = passportData.nationality || undefined;
        formData.avatarUrl = passportData.avatarUrl || undefined;
        formData.isAlienPassport = passportData.isAlienPassport;
        // dob is already set above, but update from passport if provided
        if (passportData.dob) {
          formData.dob = passportData.dob;
        }
      } else {
        formData.companyName = companyName;
        formData.companyAvatarUrl = record?.companyAvatarUrl || undefined;
        formData.regNumber = regNo || undefined;
        formData.vatNumber = vatNo || undefined;
        formData.legalAddress = address || undefined;
        formData.actualAddress = actualAddress || undefined;
        formData.bankName = bankName || undefined;
        formData.iban = iban || undefined;
        formData.swift = swift || undefined;
        formData.contactPerson = contactPerson || undefined;
        if (!record || !record.personalCode) {
          formData.personalCode = regNo || undefined;
        }
      }

      // Country
      if (displayType === "company") {
        formData.country = country.trim() || undefined;
        formData.correspondenceLanguages = correspondenceLanguages.length > 0 ? correspondenceLanguages : undefined;
        formData.invoiceLanguage = invoiceLanguage || undefined;
      }

      // Supplier details
      if (roles.includes("supplier")) {
        formData.supplierExtras = {
          serviceAreas: serviceAreas.length > 0 ? serviceAreas : undefined,
          commissions: supplierCommissions.length > 0 ? supplierCommissions : undefined,
        };
      }

      // Subagent details
      if (roles.includes("subagent")) {
        formData.subagentExtras = {
          commissionType: subagentCommissionType,
          commissionValue: subagentCommissionValue,
          commissionCurrency: subagentCommissionCurrency,
        };
      }

      // Corporate accounts / Loyalty cards
      if (displayType === "company") {
        formData.corporateAccounts = corporateAccounts.filter(a => a.providerName.trim() && a.accountCode.trim());
      }
      if (displayType === "person") {
        formData.loyaltyCards = loyaltyCards.filter(c => c.providerName.trim() && c.cardCode.trim());
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
      // Match Company Settings style: simple and clean
      const baseClasses = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm";
      
      // Check if field is required and empty
      const isEmpty = !value || (typeof value === "string" && value.trim() === "");
      const isRequiredEmpty = isRequired && isEmpty;
      
      // Priority: saved > required empty > dirty > normal
      if (savedFields.has(fieldName)) {
        return `${baseClasses} border-green-500 focus:border-green-600`;
      } else if (isRequiredEmpty) {
        return `${baseClasses} border-red-300 focus:border-red-400`;
      } else if (dirtyFields.has(fieldName)) {
        return `${baseClasses} border-amber-300 focus:border-amber-400`;
      } else {
        return `${baseClasses} focus:border-blue-500 focus:ring-1 focus:ring-blue-500`;
      }
    };
    
    // Helper function for consistent label styling (match Company Settings)
    const getLabelClasses = (): string => {
      return "block text-sm font-medium text-gray-700 mb-1";
    };
    
    // Helper function to get validation status for a field
    const getValidationStatus = (
      fieldName: string,
      isRequired: boolean,
      value: string | number | undefined,
      touched: boolean = false
    ): 'valid' | 'invalid' | 'warning' | null => {
      const isEmpty = !value || (typeof value === "string" && value.trim() === "");
      
      // Always show valid for saved fields
      if (savedFields.has(fieldName)) {
        return 'valid';
      }
      
      // Only show validation icon if field is touched or has value
      if (!touched && isEmpty && !touchedFields.has(fieldName)) {
        return null;
      }
      
      // Required fields
      if (isRequired) {
        return isEmpty ? 'invalid' : 'valid';
      }
      
      // Optional fields
      if (isEmpty) {
        return touched || touchedFields.has(fieldName) ? 'warning' : null;
      }
      
      // Email validation
      if (fieldName === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const emailValue = typeof value === 'string' ? value.trim() : String(value);
        return emailRegex.test(emailValue) ? 'valid' : 'invalid';
      }
      
      // Phone validation (basic)
      if (fieldName === 'phone' && value) {
        const phoneValue = typeof value === 'string' ? value.trim() : String(value);
        // At least 5 digits for valid phone
        const phoneRegex = /^[\d\s\+\-\(\)]{5,}$/;
        return phoneRegex.test(phoneValue) ? 'valid' : 'invalid';
      }
      
      // Date validation (for dob)
      if (fieldName === 'dob' && value) {
        const dateValue = typeof value === 'string' ? value.trim() : String(value);
        // Basic date validation (YYYY-MM-DD format)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (dateRegex.test(dateValue)) {
          const date = new Date(dateValue);
          return !isNaN(date.getTime()) ? 'valid' : 'invalid';
        }
        return 'invalid';
      }
      
      // For other optional fields with value
      return 'valid';
    };
    
    // Helper to mark field as touched
    const markFieldTouched = (fieldName: string) => {
      setTouchedFields(prev => new Set(prev).add(fieldName));
    };

    return (
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className={`space-y-4 md:space-y-6 pb-24 transition-all duration-400 ${
          highlightedSection ? "" : ""
        }`}
      >
        {/* Main details and Statistics sections in 2 columns */}
        <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-12">
          {/* Left: Main Details (2/3 width) */}
          <div className={`lg:col-span-6 group rounded-2xl bg-white/80 backdrop-blur-xl p-4 md:p-6 lg:p-7 shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.04)] border border-gray-100/50 transition-all duration-300 hover:shadow-md ${saveSuccess && dirtyFields.size > 0 ? "main-details-saved" : ""}`}>
            <h2 className="mb-5 text-lg font-semibold tracking-tight text-gray-900">Main details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              {/* Type and Roles in one row - labels on top, options below */}
              {/* Always show in edit mode, or in create mode if not client, or if client */}
              {(mode === "edit" || (mode === "create" && !isClient) || isClient) ? (
                <div className="flex items-start gap-12 md:col-span-2">
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
                  <div className="flex flex-wrap gap-4 md:col-span-2">
                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        First name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => {
                          setFirstName(e.target.value);
                          markFieldDirty("firstName");
                        }}
                        onBlur={() => markFieldTouched("firstName")}
                        onFocus={() => markFieldTouched("firstName")}
                        className={getInputClasses("firstName", true, firstName)}
                        required
                        aria-label="First name"
                      />
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Last name <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => {
                          setLastName(e.target.value);
                          markFieldDirty("lastName");
                        }}
                        onBlur={() => markFieldTouched("lastName")}
                        onFocus={() => markFieldTouched("lastName")}
                        className={getInputClasses("lastName", true, lastName)}
                        required
                        aria-label="Last name"
                      />
                    </div>
                    <div className="min-w-[100px]">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Gender
                      </label>
                      <select
                        value={gender}
                        onChange={(e) => {
                          setGender(e.target.value);
                          markFieldDirty("gender");
                        }}
                        onBlur={() => markFieldTouched("gender")}
                        onFocus={() => markFieldTouched("gender")}
                        className={getInputClasses("gender", false, gender)}
                        aria-label="Gender"
                      >
                        <option value="">—</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 md:col-span-2">
                    <div className="flex-1 min-w-[120px]">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Personal code
                      </label>
                      <input
                        type="text"
                        value={personalCode}
                        onChange={(e) => {
                          setPersonalCode(e.target.value);
                          markFieldDirty("personalCode");
                        }}
                        onBlur={() => markFieldTouched("personalCode")}
                        onFocus={() => markFieldTouched("personalCode")}
                        className={getInputClasses("personalCode", false, personalCode)}
                        aria-label="Personal code"
                      />
                    </div>
                    <div className="flex-1 min-w-[120px]">
                      <SingleDatePicker
                        label="Date of birth"
                        value={dob || undefined}
                        onChange={(date) => {
                          setDob(date || "");
                          markFieldDirty("dob");
                        }}
                        placeholder="dd.mm.yyyy"
                      />
                    </div>
                    <div className="min-w-[100px]">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Zodiac
                      </label>
                      <div className="min-h-[2.25rem] flex items-center text-sm text-gray-600">
                        {dob && getZodiacSign(dob) ? getZodiacSign(dob) : "—"}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Company fields */}
              {displayType === "company" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => {
                        setCompanyName(e.target.value);
                        markFieldDirty("companyName");
                      }}
                      onBlur={() => markFieldTouched("companyName")}
                      onFocus={() => markFieldTouched("companyName")}
                      className={getInputClasses("companyName", true, companyName)}
                      required
                      aria-label="Company name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reg Nr
                    </label>
                    <input
                      type="text"
                      value={regNo}
                      onChange={(e) => {
                        setRegNo(e.target.value);
                        markFieldDirty("regNo");
                      }}
                      onBlur={() => markFieldTouched("regNo")}
                      onFocus={() => markFieldTouched("regNo")}
                      className={getInputClasses("regNo", false, regNo)}
                      aria-label="Registration number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      VAT Nr.
                    </label>
                    <input
                      type="text"
                      value={vatNo}
                      onChange={(e) => {
                        setVatNo(e.target.value);
                        markFieldDirty("vatNo");
                      }}
                      onBlur={() => markFieldTouched("vatNo")}
                      onFocus={() => markFieldTouched("vatNo")}
                      className={getInputClasses("vatNo", false, vatNo)}
                      aria-label="VAT number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Legal address</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => {
                        setAddress(e.target.value);
                        markFieldDirty("address");
                      }}
                      onBlur={() => markFieldTouched("address")}
                      onFocus={() => markFieldTouched("address")}
                      className={getInputClasses("address", false, address)}
                      aria-label="Legal address"
                    />
                  </div>
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={countryDropdownOpen ? countrySearch : country}
                        onChange={(e) => {
                          setCountrySearch(e.target.value);
                          setCountryDropdownOpen(true);
                          if (!e.target.value) setCountry("");
                          markFieldDirty("country");
                        }}
                        onFocus={() => {
                          setCountrySearch(country);
                          setCountryDropdownOpen(true);
                        }}
                        onBlur={() => {
                          setTimeout(() => {
                            if (countryDropdownOpen) setCountry(countrySearch || country);
                            setCountryDropdownOpen(false);
                          }, 200);
                        }}
                        className={`${getInputClasses("country", false, country)} ${touchedFields.has("country") || country.trim() ? "pr-10" : ""}`}
                        aria-label="Country"
                        placeholder="Start typing country..."
                      />
                      <ValidationIcon
                        status={getValidationStatus("country", false, country, touchedFields.has("country"))}
                        show={touchedFields.has("country") || country.trim() !== ""}
                      />
                      {countryDropdownOpen && (() => {
                        const q = (countryDropdownOpen ? countrySearch : country).trim();
                        const filtered = !q ? COUNTRIES : COUNTRIES.filter((c) => matchesSearch(c, getSearchPatterns(q)));
                        return (
                        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                          {filtered.slice(0, 12).map((c) => (
                              <button
                                key={c}
                                type="button"
                                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  setCountry(c);
                                  setCountrySearch(c);
                                  setCountryDropdownOpen(false);
                                  markFieldDirty("country");
                                }}
                              >
                                {c}
                              </button>
                            ))}
                          {filtered.length === 0 && (
                            <div className="px-3 py-2 text-sm text-gray-400">No countries found</div>
                          )}
                        </div>
                        );
                      })()}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Actual address</label>
                    <input
                      type="text"
                      value={actualAddress}
                      onChange={(e) => {
                        setActualAddress(e.target.value);
                        markFieldDirty("actualAddress");
                      }}
                      onBlur={() => markFieldTouched("actualAddress")}
                      onFocus={() => markFieldTouched("actualAddress")}
                      className={getInputClasses("actualAddress", false, actualAddress)}
                      aria-label="Actual address"
                    />
                  </div>
                </>
              )}

              {/* Contact person + Phone + Email — company only section */}
              {displayType === "company" && (
                <div className="md:col-span-2 mt-2 pt-3 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Contact person</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block mb-1 text-sm font-medium text-gray-700">Name</label>
                      <div className="relative min-h-[2.5rem]">
                        <input
                          type="text"
                          value={contactPerson}
                          onChange={(e) => {
                            setContactPerson(e.target.value);
                            markFieldDirty("contactPerson");
                          }}
                          onBlur={() => markFieldTouched("contactPerson")}
                          onFocus={() => markFieldTouched("contactPerson")}
                          className={`${getInputClasses("contactPerson", false, contactPerson)} ${touchedFields.has("contactPerson") || contactPerson.trim() ? 'pr-10' : ''}`}
                          aria-label="Contact person"
                        />
                        <ValidationIcon
                          status={getValidationStatus("contactPerson", false, contactPerson, touchedFields.has("contactPerson"))}
                          show={touchedFields.has("contactPerson") || contactPerson.trim() !== ""}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => { setPhone(e.target.value); markFieldDirty("phone"); }}
                        onBlur={() => {
                          markFieldTouched("phone");
                          if (phone.trim()) {
                            const formatted = formatPhoneForDisplay(phone);
                            if (formatted) setPhone(formatted);
                          }
                        }}
                        onFocus={() => markFieldTouched("phone")}
                        placeholder="(+371) 722727218"
                        className={getInputClasses("phone", false, phone)}
                        aria-label="Phone"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); markFieldDirty("email"); }}
                        onBlur={() => markFieldTouched("email")}
                        onFocus={() => markFieldTouched("email")}
                        placeholder="client@email.com"
                        className={getInputClasses("email", false, email)}
                        aria-label="Email"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Common fields - Phone and Email in one row (person only, company has them in Contact person section) */}
              {displayType !== "company" && (
              <div className="flex flex-wrap gap-4 md:col-span-2">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      markFieldDirty("phone");
                    }}
                    onBlur={() => {
                      markFieldTouched("phone");
                      if (phone.trim()) {
                        const formatted = formatPhoneForDisplay(phone);
                        if (formatted) setPhone(formatted);
                      }
                    }}
                    onFocus={() => markFieldTouched("phone")}
                    placeholder="(+371) 722727218"
                    className={getInputClasses("phone", false, phone)}
                    aria-label="Phone"
                  />
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      markFieldDirty("email");
                    }}
                    onBlur={() => markFieldTouched("email")}
                    onFocus={() => markFieldTouched("email")}
                    placeholder="client@email.com"
                    className={getInputClasses("email", false, email)}
                    aria-label="Email"
                  />
                </div>
              </div>
              )}

              {/* Language of correspondence & invoice - company only: show only selected, edit via + / dropdown */}
              {displayType === "company" && (
                <div className="md:col-span-2 mt-2 pt-3 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Languages</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Correspondence language</label>
                      <div className="flex flex-wrap items-center gap-2">
                        {correspondenceLanguages.map((code) => {
                          const opt = LANGUAGES.find((o) => o.value === code);
                          const label = opt?.label ?? code;
                          return (
                            <span
                              key={code}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500 bg-blue-50 px-2.5 py-1.5 text-sm text-blue-800"
                            >
                              <Check size={14} className="shrink-0 text-blue-600" strokeWidth={2.5} />
                              {label}
                              <button
                                type="button"
                                onClick={() => {
                                  if (correspondenceLanguages.length <= 1) return;
                                  setCorrespondenceLanguages(correspondenceLanguages.filter((c) => c !== code));
                                  markFieldDirty("correspondenceLanguages");
                                  markFieldTouched("correspondenceLanguages");
                                }}
                                className="shrink-0 rounded p-0.5 hover:bg-blue-200/50 text-blue-700"
                                aria-label={`Remove ${label}`}
                              >
                                <X size={14} strokeWidth={2} />
                              </button>
                            </span>
                          );
                        })}
                        <div className="relative inline-block" ref={addCorrespondenceLangRef}>
                          <button
                            type="button"
                            onClick={() => setShowAddCorrespondenceLang((v) => !v)}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full border-2 border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600"
                            aria-label="Add language"
                          >
                            <Plus size={16} strokeWidth={2} />
                          </button>
                          {showAddCorrespondenceLang && (
                            <div className="absolute left-0 top-full mt-1 z-20 w-48 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                              {LANGUAGES.filter((o) => !correspondenceLanguages.includes(o.value)).map((opt) => (
                                <button
                                  key={opt.value}
                                  type="button"
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 rounded-none"
                                  onClick={() => {
                                    setCorrespondenceLanguages([...correspondenceLanguages, opt.value]);
                                    markFieldDirty("correspondenceLanguages");
                                    markFieldTouched("correspondenceLanguages");
                                    setShowAddCorrespondenceLang(false);
                                  }}
                                >
                                  {opt.label}
                                </button>
                              ))}
                              {LANGUAGES.filter((o) => !correspondenceLanguages.includes(o.value)).length === 0 && (
                                <div className="px-3 py-2 text-sm text-gray-500">All added</div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Invoice language</label>
                      <div className="flex flex-wrap items-center gap-2 relative" ref={invoiceLangSelectRef}>
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500 bg-blue-50 px-2.5 py-1.5 text-sm text-blue-800">
                          <Check size={14} className="shrink-0 text-blue-600" strokeWidth={2.5} />
                          {LANGUAGES.find((o) => o.value === invoiceLanguage)?.label ?? invoiceLanguage}
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowInvoiceLangSelect((v) => !v)}
                          className="text-sm text-gray-600 hover:text-blue-600 underline"
                        >
                          Edit
                        </button>
                        {showInvoiceLangSelect && (
                          <div className="absolute left-0 top-full mt-1 z-20 w-48 rounded-lg border border-gray-200 bg-white shadow-lg py-1">
                            {LANGUAGES.map((opt) => (
                              <button
                                key={opt.value}
                                type="button"
                                className={`w-full text-left px-3 py-2 text-sm rounded-none ${invoiceLanguage === opt.value ? "bg-blue-50 text-blue-800 font-medium" : "hover:bg-gray-50"}`}
                                onClick={() => {
                                  setInvoiceLanguage(opt.value);
                                  markFieldDirty("invoiceLanguage");
                                  markFieldTouched("invoiceLanguage");
                                  setShowInvoiceLangSelect(false);
                                }}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Bank details - company only, after contact info */}
              {displayType === "company" && (
                <div className="md:col-span-2 mt-2 pt-3 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Bank details</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Bank name</label>
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => { setBankName(e.target.value); markFieldDirty("bankName"); }}
                        onBlur={() => markFieldTouched("bankName")}
                        onFocus={() => markFieldTouched("bankName")}
                        className={getInputClasses("bankName", false, bankName)}
                        aria-label="Bank name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
                      <input
                        type="text"
                        value={iban}
                        onChange={(e) => { setIban(e.target.value); markFieldDirty("iban"); }}
                        onBlur={() => markFieldTouched("iban")}
                        onFocus={() => markFieldTouched("iban")}
                        className={getInputClasses("iban", false, iban)}
                        placeholder="e.g. LV80BANK0000435195001"
                        aria-label="IBAN"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">SWIFT</label>
                      <input
                        type="text"
                        value={swift}
                        onChange={(e) => { setSwift(e.target.value); markFieldDirty("swift"); }}
                        onBlur={() => markFieldTouched("swift")}
                        onFocus={() => markFieldTouched("swift")}
                        className={getInputClasses("swift", false, swift)}
                        placeholder="e.g. HABALV22"
                        aria-label="SWIFT/BIC"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Corporate accounts - company only */}
              {displayType === "company" && (
                <div className="md:col-span-2 mt-2 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-800">Corporate accounts</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setCorporateAccounts([...corporateAccounts, { providerName: "", accountCode: "" }]);
                        markFieldDirty("corporateAccounts");
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <span>+</span> Add
                    </button>
                  </div>
                  {corporateAccounts.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No corporate accounts</p>
                  ) : (
                    <div className="space-y-2">
                      {corporateAccounts.map((account, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white rounded-lg p-3 border border-gray-100">
                          <div className="relative flex-1 min-w-0">
                            <input
                              type="text"
                              placeholder="Provider (type to search)"
                              value={account.providerName}
                              onChange={(e) => {
                                const updated = [...corporateAccounts];
                                updated[idx] = { ...updated[idx], providerName: e.target.value, providerId: undefined };
                                setCorporateAccounts(updated);
                                markFieldDirty("corporateAccounts");
                                setActiveProviderIdx(idx);
                                if (providerDebounceRef.current) clearTimeout(providerDebounceRef.current);
                                providerDebounceRef.current = setTimeout(() => searchProviders(e.target.value), 300);
                              }}
                              onFocus={() => {
                                setActiveProviderIdx(idx);
                                if (account.providerName.trim()) searchProviders(account.providerName);
                              }}
                              onBlur={() => setTimeout(() => { if (activeProviderIdx === idx) setActiveProviderIdx(null); }, 200)}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                            />
                            {activeProviderIdx === idx && (providerResults.length > 0 || providerLoading || account.providerName.trim()) && (
                              <div className="absolute z-20 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                                {providerLoading && <div className="px-3 py-2 text-xs text-gray-400">Searching...</div>}
                                {providerResults.map((p) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      const updated = [...corporateAccounts];
                                      updated[idx] = { ...updated[idx], providerId: p.id, providerName: p.name };
                                      setCorporateAccounts(updated);
                                      markFieldDirty("corporateAccounts");
                                      setActiveProviderIdx(null);
                                      setProviderResults([]);
                                    }}
                                  >
                                    {p.name}
                                  </button>
                                ))}
                                {!providerLoading && account.providerName.trim() && (
                                  <button
                                    type="button"
                                    className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 border-t border-gray-100 font-medium"
                                    onMouseDown={async (e) => {
                                      e.preventDefault();
                                      const created = await createProviderInline(account.providerName.trim());
                                      if (created) {
                                        const updated = [...corporateAccounts];
                                        updated[idx] = { ...updated[idx], providerId: created.id, providerName: created.name };
                                        setCorporateAccounts(updated);
                                        markFieldDirty("corporateAccounts");
                                      }
                                      setActiveProviderIdx(null);
                                      setProviderResults([]);
                                    }}
                                  >
                                    + Create &quot;{account.providerName.trim()}&quot; as supplier
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <input
                            type="text"
                            placeholder="Account code"
                            value={account.accountCode}
                            onChange={(e) => {
                              const updated = [...corporateAccounts];
                              updated[idx] = { ...updated[idx], accountCode: e.target.value };
                              setCorporateAccounts(updated);
                              markFieldDirty("corporateAccounts");
                            }}
                            className="flex-1 min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setCorporateAccounts(corporateAccounts.filter((_, i) => i !== idx));
                              markFieldDirty("corporateAccounts");
                            }}
                            className="text-red-500 hover:text-red-600 p-1 self-center"
                            aria-label="Remove"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Passport Details - under Phone/Email, left-aligned (person only) */}
              {displayType === "person" && (
                <div className="md:col-span-2 mt-4 pt-4 border-t border-gray-200">
                  <PassportDetailsInput
                    data={passportData}
                    parsedFields={passportParsedFields}
                    onChange={(data, options) => {
                      setPassportData(data);
                      if (options?.parsedFields) setPassportParsedFields(options.parsedFields);
                      if (data.avatarUrl !== undefined) onAvatarChange?.(data.avatarUrl);
                      if (data.firstName && data.lastName) {
                        setFirstName(data.firstName);
                        setLastName(data.lastName);
                        markFieldDirty("firstName");
                        markFieldDirty("lastName");
                      }
                      if (data.dob) {
                        setDob(data.dob);
                        markFieldDirty("dob");
                      }
                      if (data.personalCode) {
                        setPersonalCode(data.personalCode);
                        markFieldDirty("personalCode");
                      }
                      if (data.gender === "male" || data.gender === "female") {
                        setGender(data.gender);
                        markFieldDirty("gender");
                      }
                      markFieldDirty("passport");
                    }}
                    readonly={false}
                  />
                </div>
              )}

              {/* Loyalty cards & programs - person only */}
              {displayType === "person" && (
                <div className="md:col-span-2 mt-2 pt-3 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-800">Loyalty cards & programs</h3>
                    <button
                      type="button"
                      onClick={() => {
                        setLoyaltyCards([...loyaltyCards, { providerName: "", cardCode: "" }]);
                        markFieldDirty("loyaltyCards");
                      }}
                      className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                    >
                      <span>+</span> Add
                    </button>
                  </div>
                  {loyaltyCards.length === 0 ? (
                    <p className="text-sm text-gray-400 italic">No loyalty cards</p>
                  ) : (
                    <div className="space-y-2">
                      {loyaltyCards.map((card, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white rounded-lg p-3 border border-gray-100">
                          <div className="relative flex-1 min-w-0">
                            <input
                              type="text"
                              placeholder="Provider (type to search)"
                              value={card.providerName}
                              onChange={(e) => {
                                const updated = [...loyaltyCards];
                                updated[idx] = { ...updated[idx], providerName: e.target.value, providerId: undefined };
                                setLoyaltyCards(updated);
                                markFieldDirty("loyaltyCards");
                                setActiveProviderIdx(1000 + idx);
                                if (providerDebounceRef.current) clearTimeout(providerDebounceRef.current);
                                providerDebounceRef.current = setTimeout(() => searchProviders(e.target.value), 300);
                              }}
                              onFocus={() => {
                                setActiveProviderIdx(1000 + idx);
                                if (card.providerName.trim()) searchProviders(card.providerName);
                              }}
                              onBlur={() => setTimeout(() => { if (activeProviderIdx === 1000 + idx) setActiveProviderIdx(null); }, 200)}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                            />
                            {activeProviderIdx === 1000 + idx && (providerResults.length > 0 || providerLoading || card.providerName.trim()) && (
                              <div className="absolute z-20 mt-1 w-full max-h-48 overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                                {providerLoading && <div className="px-3 py-2 text-xs text-gray-400">Searching...</div>}
                                {providerResults.map((p) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      const updated = [...loyaltyCards];
                                      updated[idx] = { ...updated[idx], providerId: p.id, providerName: p.name };
                                      setLoyaltyCards(updated);
                                      markFieldDirty("loyaltyCards");
                                      setActiveProviderIdx(null);
                                      setProviderResults([]);
                                    }}
                                  >
                                    {p.name}
                                  </button>
                                ))}
                                {!providerLoading && card.providerName.trim() && (
                                  <button
                                    type="button"
                                    className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 border-t border-gray-100 font-medium"
                                    onMouseDown={async (e) => {
                                      e.preventDefault();
                                      const created = await createProviderInline(card.providerName.trim());
                                      if (created) {
                                        const updated = [...loyaltyCards];
                                        updated[idx] = { ...updated[idx], providerId: created.id, providerName: created.name };
                                        setLoyaltyCards(updated);
                                        markFieldDirty("loyaltyCards");
                                      }
                                      setActiveProviderIdx(null);
                                      setProviderResults([]);
                                    }}
                                  >
                                    + Create &quot;{card.providerName.trim()}&quot; as supplier
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                          <input
                            type="text"
                            placeholder="Program name"
                            value={card.programName || ""}
                            onChange={(e) => {
                              const updated = [...loyaltyCards];
                              updated[idx] = { ...updated[idx], programName: e.target.value || undefined };
                              setLoyaltyCards(updated);
                              markFieldDirty("loyaltyCards");
                            }}
                            className="flex-1 min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                          />
                          <input
                            type="text"
                            placeholder="Card / member code"
                            value={card.cardCode}
                            onChange={(e) => {
                              const updated = [...loyaltyCards];
                              updated[idx] = { ...updated[idx], cardCode: e.target.value };
                              setLoyaltyCards(updated);
                              markFieldDirty("loyaltyCards");
                            }}
                            className="flex-1 min-w-0 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setLoyaltyCards(loyaltyCards.filter((_, i) => i !== idx));
                              markFieldDirty("loyaltyCards");
                            }}
                            className="text-red-500 hover:text-red-600 p-1 self-center"
                            aria-label="Remove"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Supplier Details - inside Main details so visible when Supplier checked */}
              {isSupplier && (
                <div className="md:col-span-2 mt-6 pt-6 border-t border-gray-200">
                  <div
                    id="supplier-settings"
                    className="rounded-lg bg-gray-50/80 p-4 border border-gray-100"
                  >
                    <h2 className="mb-3 text-lg font-semibold text-gray-900">Supplier Details</h2>
                    <div className="space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Service Areas
                        </label>
                        <p className="text-xs text-gray-500 mb-3">
                          Select the travel service categories this supplier provides
                        </p>
                        {availableCategories.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {availableCategories.map((cat) => {
                              const isSelected = serviceAreas.includes(cat.name);
                              return (
                                <button
                                  key={cat.id}
                                  type="button"
                                  onClick={() => {
                                    if (isSelected) {
                                      setServiceAreas(serviceAreas.filter(s => s !== cat.name));
                                    } else {
                                      setServiceAreas([...serviceAreas, cat.name]);
                                    }
                                    markFieldDirty("serviceAreas");
                                  }}
                                  className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                                    isSelected
                                      ? "bg-green-100 text-green-800 ring-2 ring-green-500"
                                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                  }`}
                                >
                                  {cat.name}
                                  {isSelected && (
                                    <svg className="ml-1.5 h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">
                            No categories available. Add categories in{" "}
                            <a href="/settings/travel-services" className="text-blue-600 hover:underline">
                              Settings → Travel Services
                            </a>
                          </p>
                        )}
                      </div>
                      <div className="pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-sm font-medium text-gray-700">Commissions</label>
                          <button
                            type="button"
                            onClick={() => {
                              setSupplierCommissions([
                                ...supplierCommissions,
                                { name: "", rate: 0, isActive: true }
                              ]);
                              markFieldDirty("supplierCommissions");
                            }}
                            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                          >
                            <span>+</span> Add Commission
                          </button>
                        </div>
                        {supplierCommissions.length === 0 ? (
                          <p className="text-sm text-gray-400 italic">No commissions added</p>
                        ) : (
                          <div className="space-y-3">
                            {supplierCommissions.map((commission, index) => (
                              <div key={index} className="flex items-center gap-3 bg-white rounded-lg p-3 border border-gray-100">
                                <input
                                  type="text"
                                  placeholder="Commission name"
                                  value={commission.name}
                                  onChange={(e) => {
                                    const updated = [...supplierCommissions];
                                    updated[index] = { ...updated[index], name: e.target.value };
                                    setSupplierCommissions(updated);
                                    markFieldDirty("supplierCommissions");
                                  }}
                                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                />
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    placeholder="Rate"
                                    value={commission.rate || ""}
                                    onChange={(e) => {
                                      const updated = [...supplierCommissions];
                                      updated[index] = { ...updated[index], rate: parseFloat(e.target.value) || 0 };
                                      setSupplierCommissions(updated);
                                      markFieldDirty("supplierCommissions");
                                    }}
                                    className="w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                                  />
                                  <span className="text-sm text-gray-500">%</span>
                                </div>
                                <label className="flex items-center gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={commission.isActive}
                                    onChange={(e) => {
                                      const updated = [...supplierCommissions];
                                      updated[index] = { ...updated[index], isActive: e.target.checked };
                                      setSupplierCommissions(updated);
                                      markFieldDirty("supplierCommissions");
                                    }}
                                    className="h-4 w-4 rounded text-green-600"
                                  />
                                  <span className="text-xs text-gray-600">Active</span>
                                </label>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSupplierCommissions(supplierCommissions.filter((_, i) => i !== index));
                                    markFieldDirty("supplierCommissions");
                                  }}
                                  className="text-red-500 hover:text-red-600 p-1"
                                  aria-label="Remove commission"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Subagent Details - inside Main details */}
              {isSubagent && (
                <div className="md:col-span-2 mt-6 pt-6 border-t border-gray-200">
                  <div
                    id="subagent-settings"
                    ref={subagentSectionRef}
                    className="rounded-lg bg-gray-50/80 p-4 border border-gray-100"
                  >
                    <h2 className="mb-4 text-lg font-semibold text-gray-900">Subagent Details</h2>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">Commission type</label>
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
                          <label className="mb-1 block text-sm font-medium text-gray-700">Commission value</label>
                          <div className="relative">
                            <input
                              type="number"
                              step="0.01"
                              value={subagentCommissionValue || ""}
                              onChange={(e) => {
                                setSubagentCommissionValue(e.target.value ? parseFloat(e.target.value) : undefined);
                                markFieldDirty("subagentCommissionValue");
                              }}
                              onBlur={() => markFieldTouched("subagentCommissionValue")}
                              onFocus={() => markFieldTouched("subagentCommissionValue")}
                              className={`${getInputClasses("subagentCommissionValue", false, String(subagentCommissionValue ?? ""))} w-full`}
                              aria-label="Commission value"
                            />
                            <ValidationIcon
                              status={getValidationStatus("subagentCommissionValue", false, String(subagentCommissionValue ?? ""), touchedFields.has("subagentCommissionValue"))}
                              show={touchedFields.has("subagentCommissionValue") || subagentCommissionValue !== undefined}
                            />
                          </div>
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">Commission currency</label>
                        <select
                          value={subagentCommissionCurrency}
                          onChange={(e) => {
                            setSubagentCommissionCurrency(e.target.value);
                            markFieldDirty("subagentCommissionCurrency");
                          }}
                          className={getInputClasses("subagentCommissionCurrency", false, subagentCommissionCurrency)}
                          aria-label="Commission currency"
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
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 mt-4">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">Period from</label>
                          <input
                            type="date"
                            value={subagentPeriodFrom}
                            onChange={(e) => { setSubagentPeriodFrom(e.target.value); markFieldDirty("subagentPeriodFrom"); }}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            aria-label="Period from"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">Period to</label>
                          <input
                            type="date"
                            value={subagentPeriodTo}
                            onChange={(e) => { setSubagentPeriodTo(e.target.value); markFieldDirty("subagentPeriodTo"); }}
                            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                            aria-label="Period to"
                          />
                        </div>
                      </div>
                    )}
                    <div className="mt-4">
                      <label className="mb-1 block text-sm font-medium text-gray-700">Payment details (IBAN, bank, etc.)</label>
                      <textarea
                        value={subagentPaymentDetails}
                        onChange={(e) => { setSubagentPaymentDetails(e.target.value); markFieldDirty("subagentPaymentDetails"); }}
                        rows={3}
                        placeholder="IBAN, bank name, account holder..."
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Statistics with Tabs (1/3 width) - Always visible */}
          <div className="lg:col-span-6 group rounded-2xl bg-white/80 backdrop-blur-xl p-4 md:p-6 lg:p-7 shadow-[0_1px_3px_0_rgba(0,0,0,0.06),0_1px_2px_-1px_rgba(0,0,0,0.04)] border border-gray-100/50 transition-all duration-300 hover:shadow-md">
              <h2 className="mb-4 md:mb-5 text-base md:text-lg font-semibold tracking-tight text-gray-900">Statistics</h2>
              <div className="space-y-3 md:space-y-4">
                {/* Tabs - modern style with switching */}
                <div className="border-b border-gray-200/60">
                  <nav className="-mb-px flex space-x-4 md:space-x-6" aria-label="Tabs">
                    <button
                      {...statisticsTabRipple.rippleProps}
                      type="button"
                      onClick={(e) => {
                        statisticsTabRipple.createRipple(e);
                        setActiveTab("statistics");
                      }}
                      className={`relative border-b-2 px-4 py-3 md:px-3 md:py-2.5 text-sm font-semibold tracking-tight transition-all duration-200 truncate min-h-[44px] md:min-h-0 ${
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
                      {...clientScoreTabRipple.rippleProps}
                      type="button"
                      onClick={(e) => {
                        clientScoreTabRipple.createRipple(e);
                        setActiveTab("clientScore");
                      }}
                      className={`relative border-b-2 px-4 py-3 md:px-3 md:py-2.5 text-sm font-semibold tracking-tight transition-all duration-200 truncate min-h-[44px] md:min-h-0 ${
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
                      statsLoading ? (
                        <div className="flex items-center justify-center min-h-[6rem]">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                        </div>
                      ) : stats ? (
                        <div className="space-y-3">
                          <div className="flex justify-between items-center min-h-[1.5rem]">
                            <span className="text-sm text-gray-600 truncate">Orders</span>
                            <span className="text-sm font-medium text-gray-900 truncate ml-2">{stats.ordersCount}</span>
                          </div>
                          <div className="flex justify-between items-center min-h-[1.5rem]">
                            <span className="text-sm text-gray-600 truncate">Turnover</span>
                            <span className="text-sm font-medium text-gray-900 truncate ml-2">
                              €{stats.totalSpent.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center min-h-[1.5rem]">
                            <span className="text-sm text-gray-600 truncate">Debt</span>
                            <span className={`text-sm font-medium truncate ml-2 ${stats.debt > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                              €{stats.debt.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex justify-between items-center min-h-[1.5rem]">
                            <span className="text-sm text-gray-600 truncate">Last Trip</span>
                            <span className="text-sm font-medium text-gray-900 truncate ml-2">
                              {stats.lastTrip ? formatDateDDMMYYYY(stats.lastTrip) : "-"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center min-h-[1.5rem]">
                            <span className="text-sm text-gray-600 truncate">Next Trip</span>
                            <span className="text-sm font-medium text-gray-900 truncate ml-2">
                              {stats.nextTrip ? formatDateDDMMYYYY(stats.nextTrip) : "-"}
                            </span>
                          </div>
                          {(stats.invoicesCount !== undefined || stats.invoicesTotal !== undefined || stats.paymentsTotal !== undefined) && (
                            <>
                              <div className="border-t border-gray-200/60 pt-3 mt-1 space-y-2">
                                <div className="flex justify-between items-center min-h-[1.5rem]">
                                  <span className="text-sm text-gray-600 truncate">Invoices</span>
                                  <span className="text-sm font-medium text-gray-900 truncate ml-2">
                                    {stats.invoicesCount ?? 0}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center min-h-[1.5rem]">
                                  <span className="text-sm text-gray-600 truncate">Invoices total</span>
                                  <span className="text-sm font-medium text-gray-900 truncate ml-2">
                                    €{(stats.invoicesTotal ?? 0).toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center min-h-[1.5rem]">
                                  <span className="text-sm text-gray-600 truncate">Payments total</span>
                                  <span className="text-sm font-medium text-gray-900 truncate ml-2">
                                    €{(stats.paymentsTotal ?? 0).toFixed(2)}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center min-h-[1.5rem]">
                                  <span className="text-sm text-gray-600 truncate">Payment status</span>
                                  <span className={`text-sm font-medium truncate ml-2 ${
                                    stats.paymentStatus === "overdue" ? "text-amber-600" :
                                    stats.paymentStatus === "overpaid" ? "text-green-600" :
                                    stats.paymentStatus === "partial" ? "text-orange-600" : "text-gray-900"
                                  }`}>
                                    {stats.paymentStatus === "paid" ? "Paid" :
                                     stats.paymentStatus === "partial" ? "Partial" :
                                     stats.paymentStatus === "overdue" ? "Overdue" :
                                     stats.paymentStatus === "overpaid" ? "Overpaid" : "-"}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center min-h-[1.5rem]">
                                  <span className="text-sm text-gray-600 truncate">Balance</span>
                                  <span className={`text-sm font-medium truncate ml-2 ${
                                    (stats.balance ?? 0) > 0.01 ? "text-red-600" : (stats.balance ?? 0) < -0.01 ? "text-green-600" : "text-gray-900"
                                  }`}>
                                    {(stats.balance ?? 0) > 0.01 ? `Debt €${(stats.balance ?? 0).toFixed(2)}` :
                                     (stats.balance ?? 0) < -0.01 ? `Overpayment €${Math.abs(stats.balance ?? 0).toFixed(2)}` : "—"}
                                  </span>
                                </div>
                                {stats.overdueInvoices && stats.overdueInvoices.length > 0 && (
                                  <div className="pt-1">
                                    <span className="text-sm text-gray-600 block mb-1">Overdue</span>
                                    <div className="text-xs text-gray-700 space-y-0.5">
                                      {stats.overdueInvoices.map((inv, i) => (
                                        <div key={i} className="flex justify-between gap-2">
                                          <span className="truncate">{inv.invoice_number || "—"}</span>
                                          <span>{inv.due_date ? formatDateDDMMYYYY(inv.due_date) : ""} €{inv.total.toFixed(2)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 italic min-h-[6rem] flex items-center">
                          No statistics available
                        </div>
                      )
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

        {/* Audit section (only for edit mode) */}
        {mode === "edit" && record && (
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">Audit</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-500">Created at</label>
                <div className="text-sm text-gray-700">
                  {formatDateDDMMYYYY(record.createdAt)}
                  <span className="block mt-0.5 text-gray-500">
                    by {record.createdByDisplayName ?? "—"}
                  </span>
                </div>
              </div>
              {record.updatedAt && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-500">
                    Last updated
                  </label>
                  <div className="text-sm text-gray-700">
                    {formatDateDDMMYYYY(record.updatedAt)}
                    <span className="block mt-0.5 text-gray-500">
                      by {record.updatedByDisplayName ?? "—"}
                    </span>
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
