"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

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

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "lv", label: "Latvian" },
  { value: "ru", label: "Russian" },
  { value: "de", label: "German" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
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
  date_format?: string;
  document_language?: string;
  timezone?: string;
  city_label?: string;
  show_order_source?: boolean;
  // Additional
  working_hours?: string;
  emergency_contact?: string;
  invoice_prefix?: string;
  default_payment_terms?: number;
}

export default function CompanySettingsPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  useEffect(() => {
    loadCompany();
    checkRole();
  }, []);

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

      if (response.ok) {
        const data = await response.json();
        console.log("User role check:", data);
        setIsSupervisor(data.role === "Supervisor");
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
          const roleName = (data?.roles as { name: string } | null)?.name;
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
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                <input
                  type="text"
                  value={formData.country || ""}
                  onChange={(e) => updateField("country", e.target.value)}
                  disabled={readonly}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
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

          {/* Banking Details */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Banking Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                <input
                  type="text"
                  value={formData.bank_name || ""}
                  onChange={(e) => updateField("bank_name", e.target.value)}
                  disabled={readonly}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Account / IBAN</label>
                <input
                  type="text"
                  value={formData.bank_account || ""}
                  onChange={(e) => updateField("bank_account", e.target.value)}
                  disabled={readonly}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SWIFT / BIC</label>
                <input
                  type="text"
                  value={formData.swift_code || ""}
                  onChange={(e) => updateField("swift_code", e.target.value)}
                  disabled={readonly}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Beneficiary Name</label>
                <input
                  type="text"
                  value={formData.beneficiary_name || ""}
                  onChange={(e) => updateField("beneficiary_name", e.target.value)}
                  disabled={readonly}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
            </div>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">System Language</label>
                <select
                  value={formData.document_language || "en"}
                  onChange={(e) => updateField("document_language", e.target.value)}
                  disabled={readonly}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                >
                  {LANGUAGES.map((lang) => (
                    <option key={lang.value} value={lang.value}>{lang.label}</option>
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
