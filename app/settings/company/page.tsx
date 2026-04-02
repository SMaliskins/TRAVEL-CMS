"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), { ssr: false });
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import { getInvoiceLanguageLabel, filterInvoiceLanguageSuggestions } from "@/lib/invoiceLanguages";
import { setGlobalDateFormat, DateFormatPattern } from "@/utils/dateFormat";
import BankAccountsManager from "./_components/BankAccountsManager";
import { INVOICE_TEMPLATES } from "@/lib/invoices/invoiceTemplates";

// Company types for classification
const COMPANY_TYPES = [
  { value: "travel_agency", label: "Travel Agency" },
  { value: "tour_operator", label: "Tour Operator" },
  { value: "ota", label: "Online Travel Agency (OTA)" },
  { value: "tmc", label: "Corporate Travel Management Company (TMC)" },
  { value: "dmc", label: "Destination Management Company (DMC)" },
  { value: "mice", label: "MICE Agency" },
  { value: "crew_marine", label: "Crew / Marine / Offshore Travel" },
  { value: "luxury_concierge", label: "Luxury / Concierge Travel" },
  { value: "medical_educational", label: "Medical / Educational Travel" },
  { value: "airline_gsa", label: "Airline / GSA / PSA" },
  { value: "other", label: "Other" },
];

const IATA_TYPES = [
  { value: "go_lite", label: "GoLite" },
  { value: "go_standard", label: "GoStandard" },
  { value: "go_eurozone", label: "GoEurozone" },
  { value: "go_global", label: "GoGlobal" },
];

const BSP_FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
];

const CURRENCIES = ["EUR", "USD", "GBP", "CHF", "PLN", "SEK", "NOK", "DKK", "AED", "CAD", "CNY", "JPY", "TRY"];

const DATE_FORMATS = [
  { value: "dd.mm.yyyy", label: "DD.MM.YYYY" },
  { value: "mm.dd.yyyy", label: "MM.DD.YYYY" },
  { value: "yyyy-mm-dd", label: "YYYY-MM-DD" },
];

const TIMEZONE_OPTIONS = [
  { cityLabel: "Riga", timezone: "Europe/Riga" },
  { cityLabel: "London", timezone: "Europe/London" },
  { cityLabel: "Berlin", timezone: "Europe/Berlin" },
  { cityLabel: "Paris", timezone: "Europe/Paris" },
  { cityLabel: "Rome", timezone: "Europe/Rome" },
  { cityLabel: "Madrid", timezone: "Europe/Madrid" },
  { cityLabel: "Dubai", timezone: "Asia/Dubai" },
  { cityLabel: "New York", timezone: "America/New_York" },
  { cityLabel: "Los Angeles", timezone: "America/Los_Angeles" },
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

interface License {
  id: string;
  type: string;
  number: string;
}

interface Contact {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
}

interface Company {
  id: string;
  name: string;
  legal_name?: string;
  trading_name?: string;
  logo_url?: string;
  registration_number?: string;
  country?: string;
  vat_number?: string;
  legal_address?: string;
  operating_address?: string;
  website?: string;
  primary_type?: string;
  additional_types?: string[];
  other_type_description?: string;
  // Contacts as JSON
  primary_contact?: Contact;
  finance_contact?: Contact;
  tech_contact?: Contact;
  general_contact?: Contact;
  // Licenses as JSON array
  licenses?: License[];
  // IATA
  is_iata_accredited?: boolean;
  iata_code?: string;
  iata_type?: string;
  bsp_remittance_frequency?: string;
  // Banking
  bank_name?: string;
  bank_account?: string;
  swift_code?: string;
  beneficiary_name?: string;
  // Regional Settings
  default_currency?: string;
  default_vat_rate?: number;
  date_format?: string;
  timezone?: string;
  city_label?: string;
  show_order_source?: boolean;
  // Additional
  working_hours?: string;
  emergency_contact?: string;
  invoice_prefix?: string;
  default_payment_terms?: number;
  invoice_email_from?: string;
  /** Shared HTML signature when a template uses “company” signature */
  email_signature?: string | null;
  invoice_languages?: string[];
  invoice_currencies?: string[];
  concierge_hotel_markup?: number;
  target_profit_monthly?: number;
  target_revenue_monthly?: number;
  target_orders_monthly?: number;
  resend_api_key?: string;
  resend_api_key_set?: boolean;
  email_domain_verified?: boolean;
  invoice_template?: string;
  invoice_accent_color?: string;
}

export default function CompanySettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentRole = useCurrentUserRole();
  
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Form state
  const [formData, setFormData] = useState<Partial<Company>>({});
  
  // Contact same as primary flags
  const [financeAsPrimary, setFinanceAsPrimary] = useState(false);
  const [techAsPrimary, setTechAsPrimary] = useState(false);
  const [generalAsPrimary, setGeneralAsPrimary] = useState(false);
  
  // Country autocomplete
  const [countrySearch, setCountrySearch] = useState("");
  const [countryDropdownOpen, setCountryDropdownOpen] = useState(false);
  const countryInputRef = useRef<HTMLInputElement>(null);

  // Email configuration
  const [resendApiKeyInput, setResendApiKeyInput] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [testEmailAddr, setTestEmailAddr] = useState("");
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Invoice languages: type-ahead add
  const [invoiceLanguageSearch, setInvoiceLanguageSearch] = useState("");
  const [invoiceLanguageSuggestOpen, setInvoiceLanguageSuggestOpen] = useState(false);
  const invoiceLanguageSuggestRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    loadCompany();
    checkRole();
  }, []);

  // Close invoice language suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const refEl = invoiceLanguageSuggestRef.current;
      if (!refEl) return;
      const target = e.target as HTMLElement;
      if (refEl.contains(target)) return;
      if (target.closest?.("input[placeholder='Type language name...']")) return;
      setInvoiceLanguageSuggestOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const invoiceLangList = Array.isArray(formData.invoice_languages) ? formData.invoice_languages : ["en"];
  const suggestions = filterInvoiceLanguageSuggestions(invoiceLanguageSearch, invoiceLangList);

  const checkRole = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        console.log("No session");
        return;
      }

      // Use API to get role (bypasses RLS)
      const response = await fetch("/api/users/me", {
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
        },
        credentials: "include",
      });

      console.log("API /api/users/me response status:", response.status);
      const responseData = await response.json();
      console.log("API /api/users/me response:", responseData);

      if (response.ok) {
        setIsSupervisor(responseData.role?.toLowerCase() === "supervisor");
      } else {
        // Fallback: try direct query
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data, error } = await supabase
            .from("user_profiles")
            .select("role_id, roles:role_id(name)")
            .eq("id", user.id)
            .single();
          
          console.log("User role fallback:", { data, error });
          const rolesRaw = data?.roles as unknown;
          const role = Array.isArray(rolesRaw) ? rolesRaw[0] : rolesRaw as { name: string } | null;
          const roleName = role?.name;
          setIsSupervisor(roleName === "Supervisor");
        }
      }
    } catch (err) {
      console.error("Role check error:", err);
    }
  };

  const loadCompany = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch("/api/company", {
        headers: {
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setCompany(data.company);
        setFormData(data.company || {});
      } else {
        const err = await response.json();
        setError(err.error || "Failed to load company");
      }
    } catch (err) {
      console.error("Load company error:", err);
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!isSupervisor) {
      setError("Only Supervisor can edit company settings");
      return;
    }
    
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch("/api/company", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        setCompany(data.company);
        setFormData(data.company);
        if (data.company?.date_format) {
          setGlobalDateFormat(data.company.date_format as DateFormatPattern);
        }
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const err = await response.json();
        setError(err.error || "Failed to save");
      }
    } catch (err) {
      console.error("Save error:", err);
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveApiKey = async () => {
    if (!isSupervisor || !resendApiKeyInput.trim()) return;
    try {
      setSaving(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/company", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ resend_api_key: resendApiKeyInput.trim() }),
      });
      if (response.ok) {
        const data = await response.json();
        setCompany(data.company);
        setFormData(data.company);
        setResendApiKeyInput("");
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        const err = await response.json();
        setError(err.error || "Failed to save API key");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmailAddr.trim()) return;
    try {
      setTestingEmail(true);
      setTestEmailResult(null);
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch("/api/company/email-test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { "Authorization": `Bearer ${session.access_token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ email: testEmailAddr.trim() }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setTestEmailResult({ ok: true, message: data.message || "Test email sent!" });
      } else {
        setTestEmailResult({ ok: false, message: data.error || "Failed to send test email" });
      }
    } catch {
      setTestEmailResult({ ok: false, message: "Network error" });
    } finally {
      setTestingEmail(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      
      const fileExt = file.name.split(".").pop();
      const fileName = `company-logo-${company?.id}-${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("avatars")
        .getPublicUrl(fileName);

      setFormData({ ...formData, logo_url: publicUrl });
    } catch (err) {
      console.error("Logo upload error:", err);
      setError("Failed to upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const updateField = (field: keyof Company, value: unknown) => {
    setFormData({ ...formData, [field]: value });
  };

  const updateContact = (type: 'primary_contact' | 'finance_contact' | 'tech_contact' | 'general_contact', field: keyof Contact, value: string) => {
    const current = formData[type] || { first_name: '', last_name: '', phone: '', email: '' };
    setFormData({ ...formData, [type]: { ...current, [field]: value } });
  };

  const copyPrimaryToContact = (type: 'finance_contact' | 'tech_contact' | 'general_contact') => {
    const primary = formData.primary_contact || { first_name: '', last_name: '', phone: '', email: '' };
    setFormData({ ...formData, [type]: { ...primary } });
  };

  const toggleAdditionalType = (type: string) => {
    const current = formData.additional_types || [];
    const updated = current.includes(type)
      ? current.filter(t => t !== type)
      : [...current, type];
    setFormData({ ...formData, additional_types: updated });
  };

  const addLicense = () => {
    const current = formData.licenses || [];
    const newLicense: License = { id: Date.now().toString(), type: '', number: '' };
    setFormData({ ...formData, licenses: [...current, newLicense] });
  };

  const updateLicense = (id: string, field: keyof License, value: string) => {
    const current = formData.licenses || [];
    const updated = current.map(l => l.id === id ? { ...l, [field]: value } : l);
    setFormData({ ...formData, licenses: updated });
  };

  const removeLicense = (id: string) => {
    const current = formData.licenses || [];
    setFormData({ ...formData, licenses: current.filter(l => l.id !== id) });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  const readonly = !isSupervisor;

  return (
    <div className="bg-gray-50 p-6">
      <div className="space-y-6">
        {/* Header with Logo */}
        <div className="bg-white border-b border-gray-200 rounded-t-lg px-6 py-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Logo */}
              <div 
                className="relative h-16 w-16 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-400 transition-colors"
                onClick={() => !readonly && fileInputRef.current?.click()}
              >
                {uploadingLogo ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                ) : formData.logo_url ? (
                  <img src={formData.logo_url} alt="Logo" className="h-full w-full object-contain" />
                ) : (
                  <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  disabled={readonly}
                />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Company Settings</h1>
                <p className="text-sm text-gray-500">{formData.name || company?.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/settings"
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                ← Back to Settings
              </Link>
              {isSupervisor && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</div>
        )}
        {success && (
          <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700">Settings saved successfully!</div>
        )}
        {readonly && (
          <div className="rounded-lg bg-yellow-50 p-4 text-sm text-yellow-700">
            Only Supervisors can edit company settings. Your role: {isSupervisor ? "Supervisor" : "Not Supervisor"}
          </div>
        )}

        {/* Settings Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          
          {/* Company Profile */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Profile</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Legal Company Name</label>
                <input
                  type="text"
                  value={formData.legal_name || ""}
                  onChange={(e) => updateField("legal_name", e.target.value)}
                  disabled={readonly}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Trading Name</label>
                <input
                  type="text"
                  value={formData.trading_name || ""}
                  onChange={(e) => updateField("trading_name", e.target.value)}
                  disabled={readonly}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="If different from legal name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registration Number</label>
                <input
                  type="text"
                  value={formData.registration_number || ""}
                  onChange={(e) => updateField("registration_number", e.target.value)}
                  disabled={readonly}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                <input
                  ref={countryInputRef}
                  type="text"
                  value={countryDropdownOpen ? countrySearch : (formData.country || "")}
                  onChange={(e) => {
                    setCountrySearch(e.target.value);
                    setCountryDropdownOpen(true);
                  }}
                  onFocus={() => {
                    setCountrySearch(formData.country || "");
                    setCountryDropdownOpen(true);
                  }}
                  onBlur={() => {
                    setTimeout(() => setCountryDropdownOpen(false), 200);
                  }}
                  disabled={readonly}
                  placeholder="Start typing..."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                {countryDropdownOpen && !readonly && (
                  <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                    {COUNTRIES.filter(c => 
                      c.toLowerCase().includes(countrySearch.toLowerCase())
                    ).slice(0, 10).map((country) => (
                      <button
                        key={country}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          updateField("country", country);
                          setCountrySearch(country);
                          setCountryDropdownOpen(false);
                        }}
                      >
                        {country}
                      </button>
                    ))}
                    {COUNTRIES.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-sm text-gray-400">No countries found</div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">VAT / Tax ID</label>
                <input
                  type="text"
                  value={formData.vat_number || ""}
                  onChange={(e) => updateField("vat_number", e.target.value)}
                  disabled={readonly}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Legal Address</label>
                <textarea
                  value={formData.legal_address || ""}
                  onChange={(e) => updateField("legal_address", e.target.value)}
                  disabled={readonly}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Operating Address</label>
                <textarea
                  value={formData.operating_address || ""}
                  onChange={(e) => updateField("operating_address", e.target.value)}
                  disabled={readonly}
                  rows={2}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="If different from legal address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
                <input
                  type="url"
                  value={formData.website || ""}
                  onChange={(e) => updateField("website", e.target.value)}
                  disabled={readonly}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="https://"
                />
              </div>
            </div>
          </div>

          {/* Company Type */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Company Type</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Primary Type</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {COMPANY_TYPES.map((type) => (
                    <label key={type.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="primary_type"
                        value={type.value}
                        checked={formData.primary_type === type.value}
                        onChange={(e) => updateField("primary_type", e.target.value)}
                        disabled={readonly}
                        className="h-4 w-4 text-blue-600"
                      />
                      <span className="text-sm text-gray-700">{type.label}</span>
                    </label>
                  ))}
                </div>
                {formData.primary_type === "other" && (
                  <input
                    type="text"
                    value={formData.other_type_description || ""}
                    onChange={(e) => updateField("other_type_description", e.target.value)}
                    disabled={readonly}
                    className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Specify other type"
                  />
                )}
              </div>
              <div className="pt-4 border-t">
                <label className="block text-sm font-medium text-gray-700 mb-2">Additional Types</label>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {COMPANY_TYPES.filter(t => t.value !== formData.primary_type).map((type) => (
                    <label key={type.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(formData.additional_types || []).includes(type.value)}
                        onChange={() => toggleAdditionalType(type.value)}
                        disabled={readonly}
                        className="h-4 w-4 text-blue-600 rounded"
                      />
                      <span className="text-sm text-gray-700">{type.label}</span>
                      {type.value === "other" && (formData.additional_types || []).includes("other") && (
                        <input
                          type="text"
                          value={formData.other_type_description || ""}
                          onChange={(e) => updateField("other_type_description", e.target.value)}
                          disabled={readonly}
                          className="ml-2 flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                          placeholder="Specify..."
                        />
                      )}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
            <div className="space-y-4">
              {/* Primary Contact */}
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Primary Contact</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input
                    type="text"
                    value={formData.primary_contact?.first_name || ""}
                    onChange={(e) => updateContact("primary_contact", "first_name", e.target.value)}
                    disabled={readonly}
                    placeholder="First name"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <input
                    type="text"
                    value={formData.primary_contact?.last_name || ""}
                    onChange={(e) => updateContact("primary_contact", "last_name", e.target.value)}
                    disabled={readonly}
                    placeholder="Last name"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="tel"
                    value={formData.primary_contact?.phone || ""}
                    onChange={(e) => updateContact("primary_contact", "phone", e.target.value)}
                    disabled={readonly}
                    placeholder="Phone"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <input
                    type="email"
                    value={formData.primary_contact?.email || ""}
                    onChange={(e) => updateContact("primary_contact", "email", e.target.value)}
                    disabled={readonly}
                    placeholder="Email"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Financial Contact */}
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">Financial Contact</p>
                  <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={financeAsPrimary}
                      onChange={(e) => {
                        setFinanceAsPrimary(e.target.checked);
                        if (e.target.checked) copyPrimaryToContact("finance_contact");
                      }}
                      disabled={readonly}
                      className="h-3 w-3 rounded"
                    />
                    Same as Primary
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input
                    type="text"
                    value={formData.finance_contact?.first_name || ""}
                    onChange={(e) => updateContact("finance_contact", "first_name", e.target.value)}
                    disabled={readonly || financeAsPrimary}
                    placeholder="First name"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <input
                    type="text"
                    value={formData.finance_contact?.last_name || ""}
                    onChange={(e) => updateContact("finance_contact", "last_name", e.target.value)}
                    disabled={readonly || financeAsPrimary}
                    placeholder="Last name"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="tel"
                    value={formData.finance_contact?.phone || ""}
                    onChange={(e) => updateContact("finance_contact", "phone", e.target.value)}
                    disabled={readonly || financeAsPrimary}
                    placeholder="Phone"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <input
                    type="email"
                    value={formData.finance_contact?.email || ""}
                    onChange={(e) => updateContact("finance_contact", "email", e.target.value)}
                    disabled={readonly || financeAsPrimary}
                    placeholder="Email"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Technical Support */}
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">Technical Support</p>
                  <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={techAsPrimary}
                      onChange={(e) => {
                        setTechAsPrimary(e.target.checked);
                        if (e.target.checked) copyPrimaryToContact("tech_contact");
                      }}
                      disabled={readonly}
                      className="h-3 w-3 rounded"
                    />
                    Same as Primary
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input
                    type="text"
                    value={formData.tech_contact?.first_name || ""}
                    onChange={(e) => updateContact("tech_contact", "first_name", e.target.value)}
                    disabled={readonly || techAsPrimary}
                    placeholder="First name"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <input
                    type="text"
                    value={formData.tech_contact?.last_name || ""}
                    onChange={(e) => updateContact("tech_contact", "last_name", e.target.value)}
                    disabled={readonly || techAsPrimary}
                    placeholder="Last name"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="tel"
                    value={formData.tech_contact?.phone || ""}
                    onChange={(e) => updateContact("tech_contact", "phone", e.target.value)}
                    disabled={readonly || techAsPrimary}
                    placeholder="Phone"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <input
                    type="email"
                    value={formData.tech_contact?.email || ""}
                    onChange={(e) => updateContact("tech_contact", "email", e.target.value)}
                    disabled={readonly || techAsPrimary}
                    placeholder="Email"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* General Queries */}
              <div className="pt-2 border-t">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-gray-700">General Queries</p>
                  <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={generalAsPrimary}
                      onChange={(e) => {
                        setGeneralAsPrimary(e.target.checked);
                        if (e.target.checked) copyPrimaryToContact("general_contact");
                      }}
                      disabled={readonly}
                      className="h-3 w-3 rounded"
                    />
                    Same as Primary
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <input
                    type="text"
                    value={formData.general_contact?.first_name || ""}
                    onChange={(e) => updateContact("general_contact", "first_name", e.target.value)}
                    disabled={readonly || generalAsPrimary}
                    placeholder="First name"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <input
                    type="text"
                    value={formData.general_contact?.last_name || ""}
                    onChange={(e) => updateContact("general_contact", "last_name", e.target.value)}
                    disabled={readonly || generalAsPrimary}
                    placeholder="Last name"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="tel"
                    value={formData.general_contact?.phone || ""}
                    onChange={(e) => updateContact("general_contact", "phone", e.target.value)}
                    disabled={readonly || generalAsPrimary}
                    placeholder="Phone"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <input
                    type="email"
                    value={formData.general_contact?.email || ""}
                    onChange={(e) => updateContact("general_contact", "email", e.target.value)}
                    disabled={readonly || generalAsPrimary}
                    placeholder="Email"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Financial */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Financial</h2>

            {/* Invoice languages — type to suggest, click to add, remove via tag */}
            <div className="mb-6 pb-6 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Invoice languages</h3>
              <p className="text-xs text-gray-500 mb-2">Languages available when creating an invoice. Type a language name for suggestions; click to add. At least one must be selected.</p>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {(Array.isArray(formData.invoice_languages) ? formData.invoice_languages : ["en"]).map((code) => (
                  <span
                    key={code}
                    className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-sm text-blue-800"
                  >
                    {getInvoiceLanguageLabel(code)}
                    {!readonly && (
                      <button
                        type="button"
                        onClick={() => {
                          const list = Array.isArray(formData.invoice_languages) ? formData.invoice_languages : ["en"];
                          const next = list.filter((c) => c !== code);
                          if (next.length === 0) return;
                          setFormData({ ...formData, invoice_languages: next });
                        }}
                        className="ml-0.5 rounded p-0.5 hover:bg-blue-100 text-blue-600"
                        aria-label={`Remove ${getInvoiceLanguageLabel(code)}`}
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))}
              </div>
              {!readonly && (
                <div className="relative">
                  <input
                    type="text"
                    value={invoiceLanguageSearch}
                    onChange={(e) => setInvoiceLanguageSearch(e.target.value)}
                    onFocus={() => setInvoiceLanguageSuggestOpen(true)}
                    placeholder="Type language name..."
                    className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {invoiceLanguageSuggestOpen && suggestions.length > 0 && (
                    <ul
                      ref={invoiceLanguageSuggestRef}
                      className="absolute z-10 mt-1 w-full max-w-xs rounded-lg border border-gray-200 bg-white shadow-lg py-1 text-sm"
                    >
                      {suggestions.map((opt) => (
                        <li key={opt.value}>
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 hover:bg-blue-50 text-gray-900"
                            onClick={() => {
                              const list = Array.isArray(formData.invoice_languages) ? formData.invoice_languages : ["en"];
                              if (list.includes(opt.value)) return;
                              setFormData({ ...formData, invoice_languages: [...list, opt.value] });
                              setInvoiceLanguageSearch("");
                              setInvoiceLanguageSuggestOpen(false);
                            }}
                          >
                            {opt.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            
            {/* Invoice Prefix & Default Payment Terms (Financial) */}
            <div className="mb-6 pb-6 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Invoice &amp; Payment</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Prefix</label>
                  <input
                    type="text"
                    value={formData.invoice_prefix || ""}
                    onChange={(e) => updateField("invoice_prefix", e.target.value)}
                    disabled={readonly}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="e.g., INV-"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Payment Terms (days)</label>
                  <input
                    type="number"
                    value={formData.default_payment_terms || 14}
                    onChange={(e) => updateField("default_payment_terms", parseInt(e.target.value))}
                    disabled={readonly}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
              </div>
            </div>

            {/* Tax Settings */}
            <div className="mb-6 pb-6 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Tax Settings</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default VAT Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={formData.default_vat_rate || ""}
                  onChange={(e) => updateField("default_vat_rate", e.target.value ? parseFloat(e.target.value) : undefined)}
                  disabled={readonly}
                  placeholder="21"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Default VAT rate for the country (e.g., 21% for Latvia)</p>
              </div>
            </div>
            
            {/* Banking Details = Payment Accounts */}
            <BankAccountsManager readonly={readonly} />
          </div>

          {/* Email Configuration */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Email Configuration</h2>

            {/* Status */}
            <div className="mb-4 flex items-center gap-2">
              {formData.resend_api_key_set ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Email configured
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  <span className="w-2 h-2 rounded-full bg-gray-400" />
                  Not configured
                </span>
              )}
              {formData.resend_api_key_set && formData.email_domain_verified && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                  Domain verified
                </span>
              )}
            </div>

            {/* Resend API Key */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Resend API Key</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={resendApiKeyInput}
                    onChange={(e) => setResendApiKeyInput(e.target.value)}
                    disabled={readonly}
                    placeholder={formData.resend_api_key_set ? "••••••••  (key is saved, enter new to replace)" : "re_xxxxxxxxxx"}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm pr-10 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                  >
                    {showApiKey ? "Hide" : "Show"}
                  </button>
                </div>
                <button
                  onClick={handleSaveApiKey}
                  disabled={readonly || saving || !resendApiKeyInput.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {saving ? "Saving..." : "Save Key"}
                </button>
              </div>
            </div>

            {/* From Address */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">From Address</label>
              <input
                type="email"
                value={formData.invoice_email_from || ""}
                onChange={(e) => updateField("invoice_email_from", e.target.value)}
                disabled={readonly}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="e.g. invoices@yourcompany.com"
              />
              <p className="text-xs text-gray-500 mt-1">All outgoing emails will be sent from this address. Domain must be verified in Resend.</p>
            </div>

            {/* Company-wide email signature (for templates that use “Company” signature) */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Company email signature (HTML)</label>
              <p className="text-xs text-gray-500 mb-2">
                Used when an email template is set to &quot;Company&quot; signature (Settings → Email Templates). Personal templates use each user&apos;s signature from Settings → Profile.
              </p>
              <div className={readonly ? "pointer-events-none opacity-60" : ""}>
              <RichTextEditor
                content={
                  (formData.email_signature || "").includes("<")
                    ? formData.email_signature || ""
                    : `<p>${(formData.email_signature || "").replace(/\n/g, "</p><p>")}</p>`.replace(/<p><\/p>/g, "<p><br></p>")
                }
                onChange={(html) => updateField("email_signature", html)}
                placeholder="Kind regards, …"
                compact
                onImageUpload={async () => {
                  return new Promise<string | null>((resolve) => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "image/*";
                    input.onchange = async (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0];
                      if (!file) {
                        resolve(null);
                        return;
                      }
                      try {
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session) {
                          resolve(null);
                          return;
                        }
                        const fd = new FormData();
                        fd.append("file", file);
                        const res = await fetch("/api/upload-avatar", {
                          method: "POST",
                          headers: { Authorization: `Bearer ${session.access_token}` },
                          body: fd,
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error);
                        resolve(data.url);
                      } catch {
                        resolve(null);
                      }
                    };
                    input.click();
                  });
                }}
              />
              </div>
            </div>

            {/* Test Email */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Send Test Email</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={testEmailAddr}
                  onChange={(e) => setTestEmailAddr(e.target.value)}
                  placeholder="your@email.com"
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                <button
                  onClick={handleTestEmail}
                  disabled={testingEmail || !testEmailAddr.trim() || !formData.resend_api_key_set}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                >
                  {testingEmail ? "Sending..." : "Send Test"}
                </button>
              </div>
              {testEmailResult && (
                <p className={`text-xs mt-1.5 ${testEmailResult.ok ? "text-green-600" : "text-red-600"}`}>
                  {testEmailResult.message}
                </p>
              )}
              {!formData.resend_api_key_set && (
                <p className="text-xs text-amber-600 mt-1">Save your Resend API key first to enable test emails.</p>
              )}
            </div>

            {/* Setup Guide */}
            <details className="mt-4 border border-gray-200 rounded-lg">
              <summary className="px-4 py-3 text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50 rounded-lg">
                Setup Guide
              </summary>
              <div className="px-4 pb-4 text-sm text-gray-600 space-y-2">
                <ol className="list-decimal list-inside space-y-1.5">
                  <li>
                    Create a free account at{" "}
                    <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">resend.com</a>
                    {" "}(100 emails/day free, $20/mo for 50k emails)
                  </li>
                  <li>
                    Add your domain in{" "}
                    <a href="https://resend.com/domains" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Resend Domains</a>
                    {" "}and configure the 3 DNS records (DKIM, MX, SPF)
                  </li>
                  <li>
                    Copy your API key from{" "}
                    <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Resend API Keys</a>
                    {" "}and paste it above
                  </li>
                  <li>Set your &quot;From&quot; email address (must use your verified domain)</li>
                  <li>Click &quot;Send Test&quot; to verify everything works</li>
                </ol>
                <p className="text-xs text-gray-400 mt-2">Each company manages their own Resend account and domain. Costs are billed directly by Resend to each company.</p>
              </div>
            </details>
          </div>

          {/* Licenses & Certifications + IATA */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Licenses & Certifications</h2>
              {!readonly && (
                <button
                  onClick={addLicense}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <span className="text-lg">+</span> Add
                </button>
              )}
            </div>
            <div className="space-y-3">
              {(formData.licenses || []).map((license) => (
                <div key={license.id} className="flex gap-2">
                  <input
                    type="text"
                    value={license.type}
                    onChange={(e) => updateLicense(license.id, "type", e.target.value)}
                    disabled={readonly}
                    placeholder="License type"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <input
                    type="text"
                    value={license.number}
                    onChange={(e) => updateLicense(license.id, "number", e.target.value)}
                    disabled={readonly}
                    placeholder="Number"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  {!readonly && (
                    <button
                      onClick={() => removeLicense(license.id)}
                      className="text-red-500 hover:text-red-600 px-2"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              {(formData.licenses || []).length === 0 && (
                <p className="text-sm text-gray-400 italic">No licenses added</p>
              )}
            </div>

            {/* IATA */}
            <div className="mt-6 pt-4 border-t">
              <label className="flex items-center gap-2 cursor-pointer mb-4">
                <input
                  type="checkbox"
                  checked={formData.is_iata_accredited || false}
                  onChange={(e) => updateField("is_iata_accredited", e.target.checked)}
                  disabled={readonly}
                  className="h-4 w-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700">IATA Accredited</span>
              </label>
              
              {formData.is_iata_accredited && (
                <div className="space-y-3 pl-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">IATA Code</label>
                    <input
                      type="text"
                      value={formData.iata_code || ""}
                      onChange={(e) => updateField("iata_code", e.target.value)}
                      disabled={readonly}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="e.g., 12345678"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Accreditation Type</label>
                    <select
                      value={formData.iata_type || ""}
                      onChange={(e) => updateField("iata_type", e.target.value)}
                      disabled={readonly}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">Select type</option>
                      {IATA_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">BSP Remittance Frequency</label>
                    <select
                      value={formData.bsp_remittance_frequency || ""}
                      onChange={(e) => updateField("bsp_remittance_frequency", e.target.value)}
                      disabled={readonly}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    >
                      <option value="">Select frequency</option>
                      {BSP_FREQUENCIES.map((freq) => (
                        <option key={freq.value} value={freq.value}>{freq.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Regional Settings */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Regional Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City / Timezone</label>
                <select
                  value={formData.timezone || "Europe/Riga"}
                  onChange={(e) => {
                    const opt = TIMEZONE_OPTIONS.find(o => o.timezone === e.target.value);
                    updateField("timezone", e.target.value);
                    if (opt) updateField("city_label", opt.cityLabel);
                  }}
                  disabled={readonly}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  {TIMEZONE_OPTIONS.map((opt) => (
                    <option key={opt.timezone} value={opt.timezone}>{opt.cityLabel}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
                <select
                  value={formData.default_currency || "EUR"}
                  onChange={(e) => updateField("default_currency", e.target.value)}
                  disabled={readonly}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  {CURRENCIES.map((cur) => (
                    <option key={cur} value={cur}>{cur}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Format</label>
                <select
                  value={formData.date_format || "dd.mm.yyyy"}
                  onChange={(e) => updateField("date_format", e.target.value)}
                  disabled={readonly}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  {DATE_FORMATS.map((fmt) => (
                    <option key={fmt.value} value={fmt.value}>{fmt.label}</option>
                  ))}
                </select>
              </div>
              
              <div className="pt-4 border-t">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.show_order_source || false}
                    onChange={(e) => updateField("show_order_source", e.target.checked)}
                    disabled={readonly}
                    className="h-4 w-4 text-blue-600 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Show Order Source (TA/TO/CORP/NON)</span>
                </label>
                <p className="text-xs text-gray-500 mt-1 ml-6">
                  For Latvian legislation compliance
                </p>
              </div>
            </div>

            {/* Additional */}
            <div className="mt-6 pt-4 border-t">
              <h3 className="text-md font-semibold text-gray-900 mb-4">Additional</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Working Hours</label>
                  <input
                    type="text"
                    value={formData.working_hours || ""}
                    onChange={(e) => updateField("working_hours", e.target.value)}
                    disabled={readonly}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="e.g., Mon-Fri 9:00-18:00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact (24/7)</label>
                  <input
                    type="text"
                    value={formData.emergency_contact || ""}
                    onChange={(e) => updateField("emergency_contact", e.target.value)}
                    disabled={readonly}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="+371..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Monthly Targets — visible to Supervisor/Director only */}
          {(currentRole === "supervisor" || currentRole === "director") && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Targets</h3>
              <p className="text-sm text-gray-500 mb-4">Targets shown on the Dashboard speedometer and comparison cards.</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Profit Target</label>
                  <input
                    type="number"
                    step="100"
                    min="0"
                    value={formData.target_profit_monthly ?? 0}
                    onChange={(e) => updateField("target_profit_monthly", parseFloat(e.target.value) || 0)}
                    disabled={readonly}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="e.g., 50000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Revenue Target</label>
                  <input
                    type="number"
                    step="100"
                    min="0"
                    value={formData.target_revenue_monthly ?? 0}
                    onChange={(e) => updateField("target_revenue_monthly", parseFloat(e.target.value) || 0)}
                    disabled={readonly}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="e.g., 200000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Orders Target</label>
                  <input
                    type="number"
                    step="1"
                    min="0"
                    value={formData.target_orders_monthly ?? 0}
                    onChange={(e) => updateField("target_orders_monthly", parseInt(e.target.value) || 0)}
                    disabled={readonly}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="e.g., 100"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Concierge / Client App Settings */}
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Client App &amp; Concierge</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Hotel Markup (%)
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="100"
                  value={formData.concierge_hotel_markup ?? 0}
                  onChange={(e) => updateField("concierge_hotel_markup", parseFloat(e.target.value) || 0)}
                  disabled={readonly}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                  placeholder="e.g., 15"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Applied to hotel prices shown to clients via Concierge (e.g. 15 = +15% to RateHawk price)
                </p>
              </div>
            </div>
          </div>

          {/* Invoice Design — full-width section */}
          <div className="col-span-1 lg:col-span-2 xl:col-span-3 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Invoice Design</h3>
            <p className="text-sm text-gray-500 mb-5">Choose a template and accent color. Changes are shown instantly in the preview.</p>

            <div className="grid grid-cols-1 xl:grid-cols-[380px_minmax(0,1fr)] gap-6">
              <div className="space-y-5">
                <div className="rounded-lg border border-gray-200 p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Accent Color</label>
                  <div className="flex items-center gap-3 mb-3">
                    <input
                      type="color"
                      value={formData.invoice_accent_color || "#1e40af"}
                      onChange={(e) => updateField("invoice_accent_color", e.target.value)}
                      disabled={readonly}
                      className="h-10 w-16 cursor-pointer rounded border border-gray-300 p-0.5 disabled:cursor-not-allowed"
                    />
                    <input
                      type="text"
                      value={formData.invoice_accent_color || "#1e40af"}
                      onChange={(e) => updateField("invoice_accent_color", e.target.value)}
                      disabled={readonly}
                      className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono disabled:bg-gray-100 disabled:cursor-not-allowed"
                      placeholder="#1e40af"
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {["#1e40af", "#0f766e", "#7c3aed", "#be123c", "#334155", "#b45309"].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => updateField("invoice_accent_color", color)}
                        disabled={readonly}
                        className={`h-7 w-7 rounded border-2 ${formData.invoice_accent_color === color ? "border-gray-900" : "border-white"} shadow-sm disabled:cursor-not-allowed`}
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 p-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Template</label>
                  <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                    {INVOICE_TEMPLATES.map((tpl) => {
                      const isSelected = (formData.invoice_template || "classic") === tpl.id;
                      return (
                        <button
                          key={tpl.id}
                          type="button"
                          disabled={readonly}
                          onClick={() => updateField("invoice_template", tpl.id)}
                          className={`w-full text-left rounded-lg border px-3 py-3 transition-all ${
                            isSelected
                              ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                              : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                          } disabled:cursor-not-allowed disabled:opacity-60`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className={`text-sm font-semibold ${isSelected ? "text-blue-900" : "text-gray-900"}`}>{tpl.name}</div>
                              <div className="text-xs text-gray-500 mt-0.5">{tpl.description}</div>
                            </div>
                            {isSelected && (
                              <span className="text-[11px] font-medium rounded-full bg-blue-600 text-white px-2 py-0.5">Selected</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">Live Preview</label>
                  <span className="text-xs text-gray-500">
                    Template: {INVOICE_TEMPLATES.find((t) => t.id === (formData.invoice_template || "classic"))?.name || "Classic Business"}
                  </span>
                </div>
                <div className="relative rounded-lg border border-gray-200 bg-gray-50 overflow-auto" style={{ height: "760px" }}>
                  <iframe
                    key={`${formData.invoice_template || "classic"}-${formData.invoice_accent_color || "#1e40af"}`}
                    src={`/api/invoice-preview?template=${encodeURIComponent(formData.invoice_template || "classic")}&accent=${encodeURIComponent(formData.invoice_accent_color || "#1e40af")}`}
                    className="absolute top-0 left-0 border-0"
                    style={{
                      width: "210mm",
                      height: "297mm",
                      transform: "scale(0.62)",
                      transformOrigin: "top left",
                    }}
                    title="Invoice Preview"
                    sandbox="allow-same-origin"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-2 text-center">A4 preview with sample data. Actual invoices use company and invoice data.</p>
              </div>
            </div>
          </div>


        </div>

        {/* Bottom Save Button */}
        {isSupervisor && (
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
