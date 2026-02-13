"use client";

export type HotelModalVariant = "v1" | "v2" | "v3" | "v4" | "v5" | "v6";

interface HotelFieldsState {
  hotelName: string;
  hotelAddress: string;
  hotelPhone: string;
  hotelEmail: string;
}

interface HotelModalVariantMeta {
  id: HotelModalVariant;
  name: string;
  subtitle: string;
}

interface HotelVariantSelectorProps {
  value: HotelModalVariant;
  onChange: (variant: HotelModalVariant) => void;
}

interface HotelDesignLayoutProps {
  variant: HotelModalVariant;
  mode: "add" | "edit";
  fields: HotelFieldsState;
  onChange: (field: keyof HotelFieldsState, value: string) => void;
}

const VARIANTS: HotelModalVariantMeta[] = [
  { id: "v1", name: "V1 · Executive Grid", subtitle: "Balanced card layout" },
  { id: "v2", name: "V2 · Timeline Flow", subtitle: "Step-by-step sequence" },
  { id: "v3", name: "V3 · Split Focus", subtitle: "Info panel + form" },
  { id: "v4", name: "V4 · Glass", subtitle: "Soft gradient and glow" },
  { id: "v5", name: "V5 · Compact Rows", subtitle: "Fast data-entry matrix" },
  { id: "v6", name: "V6 · Insight Tiles", subtitle: "Tile-based modern cockpit" },
];

function FieldLabel({
  htmlFor,
  children,
  required = false,
}: {
  htmlFor: string;
  children: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-semibold text-gray-700">
      {children} {required && <span className="text-red-500">*</span>}
    </label>
  );
}

function Input({
  id,
  type = "text",
  value,
  onChange,
  placeholder,
  className = "",
}: {
  id: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full rounded-lg border border-gray-300 px-3 py-2 text-sm transition-colors focus:border-black focus:outline-none ${className}`}
    />
  );
}

function blockId(mode: "add" | "edit", variant: HotelModalVariant, field: keyof HotelFieldsState) {
  return `${mode}-${variant}-${field}`;
}

export function HotelVariantSelector({ value, onChange }: HotelVariantSelectorProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">
          Hotel modal design
        </p>
        <span className="text-xs text-gray-500">Choose 1 of 6</span>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {VARIANTS.map((variant) => {
          const active = value === variant.id;
          return (
            <button
              key={variant.id}
              type="button"
              onClick={() => onChange(variant.id)}
              className={`rounded-lg border px-3 py-2 text-left transition-all ${
                active
                  ? "border-black bg-black text-white shadow-sm"
                  : "border-gray-300 bg-white text-gray-800 hover:border-gray-500"
              }`}
            >
              <p className="text-sm font-semibold">{variant.name}</p>
              <p className={`text-xs ${active ? "text-gray-200" : "text-gray-500"}`}>{variant.subtitle}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function HotelDesignLayout({
  variant,
  mode,
  fields,
  onChange,
}: HotelDesignLayoutProps) {
  const nameId = blockId(mode, variant, "hotelName");
  const addressId = blockId(mode, variant, "hotelAddress");
  const phoneId = blockId(mode, variant, "hotelPhone");
  const emailId = blockId(mode, variant, "hotelEmail");

  if (variant === "v1") {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-900">Executive Grid</h4>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">Classic</span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <FieldLabel htmlFor={nameId} required>
              Hotel Name
            </FieldLabel>
            <Input id={nameId} value={fields.hotelName} onChange={(v) => onChange("hotelName", v)} placeholder="e.g., Grand Palace Rome" />
          </div>
          <div>
            <FieldLabel htmlFor={phoneId}>Hotel Phone</FieldLabel>
            <Input id={phoneId} type="tel" value={fields.hotelPhone} onChange={(v) => onChange("hotelPhone", v)} placeholder="+39 06 1234567" />
          </div>
          <div className="md:col-span-2">
            <FieldLabel htmlFor={addressId}>Address</FieldLabel>
            <Input id={addressId} value={fields.hotelAddress} onChange={(v) => onChange("hotelAddress", v)} placeholder="Street, city, country" />
          </div>
          <div className="md:col-span-2">
            <FieldLabel htmlFor={emailId}>Hotel Email</FieldLabel>
            <Input id={emailId} type="email" value={fields.hotelEmail} onChange={(v) => onChange("hotelEmail", v)} placeholder="reservations@hotel.com" />
          </div>
        </div>
      </div>
    );
  }

  if (variant === "v2") {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <h4 className="mb-3 text-sm font-semibold text-blue-900">Timeline Flow</h4>
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="mt-1 h-5 w-5 rounded-full bg-blue-700 text-center text-xs font-bold leading-5 text-white">1</div>
            <div className="flex-1 rounded-lg bg-white p-3">
              <FieldLabel htmlFor={nameId} required>
                Identify Hotel
              </FieldLabel>
              <Input id={nameId} value={fields.hotelName} onChange={(v) => onChange("hotelName", v)} placeholder="Hotel legal/commercial name" />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="mt-1 h-5 w-5 rounded-full bg-blue-700 text-center text-xs font-bold leading-5 text-white">2</div>
            <div className="flex-1 rounded-lg bg-white p-3">
              <FieldLabel htmlFor={addressId}>Location & Address</FieldLabel>
              <Input id={addressId} value={fields.hotelAddress} onChange={(v) => onChange("hotelAddress", v)} placeholder="Full address with district/area" />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="mt-1 h-5 w-5 rounded-full bg-blue-700 text-center text-xs font-bold leading-5 text-white">3</div>
            <div className="grid flex-1 grid-cols-1 gap-3 rounded-lg bg-white p-3 md:grid-cols-2">
              <div>
                <FieldLabel htmlFor={phoneId}>Contact Phone</FieldLabel>
                <Input id={phoneId} type="tel" value={fields.hotelPhone} onChange={(v) => onChange("hotelPhone", v)} placeholder="+39 06 1234567" />
              </div>
              <div>
                <FieldLabel htmlFor={emailId}>Contact Email</FieldLabel>
                <Input id={emailId} type="email" value={fields.hotelEmail} onChange={(v) => onChange("hotelEmail", v)} placeholder="frontdesk@hotel.com" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "v3") {
    return (
      <div className="overflow-hidden rounded-xl border border-emerald-200 bg-white shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3">
          <div className="bg-emerald-700 p-4 text-white md:col-span-1">
            <p className="text-xs uppercase tracking-wider text-emerald-100">Split Focus</p>
            <h4 className="mt-1 text-base font-semibold">Hotel profile</h4>
            <p className="mt-2 text-xs text-emerald-50">
              Fast scan panel for manager:
              <br />• Property identity
              <br />• Contact channels
              <br />• Location reference
            </p>
          </div>
          <div className="space-y-3 p-4 md:col-span-2">
            <div>
              <FieldLabel htmlFor={nameId} required>
                Hotel Name
              </FieldLabel>
              <Input id={nameId} value={fields.hotelName} onChange={(v) => onChange("hotelName", v)} placeholder="e.g., Hilton Garden Inn" />
            </div>
            <div>
              <FieldLabel htmlFor={addressId}>Address</FieldLabel>
              <Input id={addressId} value={fields.hotelAddress} onChange={(v) => onChange("hotelAddress", v)} placeholder="Address + city + ZIP" />
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <FieldLabel htmlFor={phoneId}>Phone</FieldLabel>
                <Input id={phoneId} type="tel" value={fields.hotelPhone} onChange={(v) => onChange("hotelPhone", v)} />
              </div>
              <div>
                <FieldLabel htmlFor={emailId}>Email</FieldLabel>
                <Input id={emailId} type="email" value={fields.hotelEmail} onChange={(v) => onChange("hotelEmail", v)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "v4") {
    return (
      <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-purple-900">Glass Layout</h4>
          <span className="rounded-full border border-purple-300 bg-white/80 px-2 py-0.5 text-xs text-purple-700">Modern</span>
        </div>
        <div className="grid grid-cols-1 gap-3">
          <div className="rounded-lg border border-white/70 bg-white/80 p-3 backdrop-blur-sm">
            <FieldLabel htmlFor={nameId} required>
              Property Name
            </FieldLabel>
            <Input id={nameId} value={fields.hotelName} onChange={(v) => onChange("hotelName", v)} placeholder="Hotel / Resort / Apartments" className="bg-white/90" />
          </div>
          <div className="rounded-lg border border-white/70 bg-white/80 p-3 backdrop-blur-sm">
            <FieldLabel htmlFor={addressId}>Property Address</FieldLabel>
            <Input id={addressId} value={fields.hotelAddress} onChange={(v) => onChange("hotelAddress", v)} placeholder="Street + City + Region" className="bg-white/90" />
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-white/70 bg-white/80 p-3 backdrop-blur-sm">
              <FieldLabel htmlFor={phoneId}>Phone</FieldLabel>
              <Input id={phoneId} type="tel" value={fields.hotelPhone} onChange={(v) => onChange("hotelPhone", v)} className="bg-white/90" />
            </div>
            <div className="rounded-lg border border-white/70 bg-white/80 p-3 backdrop-blur-sm">
              <FieldLabel htmlFor={emailId}>Email</FieldLabel>
              <Input id={emailId} type="email" value={fields.hotelEmail} onChange={(v) => onChange("hotelEmail", v)} className="bg-white/90" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "v5") {
    return (
      <div className="rounded-xl border border-gray-300 bg-white">
        <div className="border-b border-gray-200 px-4 py-2">
          <h4 className="text-sm font-semibold text-gray-900">Compact Rows</h4>
        </div>
        <div className="p-4">
          <div className="space-y-2">
            <div className="grid grid-cols-12 items-center gap-2">
              <p className="col-span-12 text-xs font-semibold text-gray-600 md:col-span-3">Hotel Name</p>
              <div className="col-span-12 md:col-span-9">
                <Input id={nameId} value={fields.hotelName} onChange={(v) => onChange("hotelName", v)} placeholder="Required" />
              </div>
            </div>
            <div className="grid grid-cols-12 items-center gap-2">
              <p className="col-span-12 text-xs font-semibold text-gray-600 md:col-span-3">Address</p>
              <div className="col-span-12 md:col-span-9">
                <Input id={addressId} value={fields.hotelAddress} onChange={(v) => onChange("hotelAddress", v)} />
              </div>
            </div>
            <div className="grid grid-cols-12 items-center gap-2">
              <p className="col-span-12 text-xs font-semibold text-gray-600 md:col-span-3">Phone</p>
              <div className="col-span-12 md:col-span-9">
                <Input id={phoneId} type="tel" value={fields.hotelPhone} onChange={(v) => onChange("hotelPhone", v)} />
              </div>
            </div>
            <div className="grid grid-cols-12 items-center gap-2">
              <p className="col-span-12 text-xs font-semibold text-gray-600 md:col-span-3">Email</p>
              <div className="col-span-12 md:col-span-9">
                <Input id={emailId} type="email" value={fields.hotelEmail} onChange={(v) => onChange("hotelEmail", v)} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-amber-900">Insight Tiles</h4>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">Visual</span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-amber-200 bg-white p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-700">Identity</p>
          <FieldLabel htmlFor={nameId} required>
            Hotel Name
          </FieldLabel>
          <Input id={nameId} value={fields.hotelName} onChange={(v) => onChange("hotelName", v)} />
        </div>
        <div className="rounded-lg border border-amber-200 bg-white p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-700">Location</p>
          <FieldLabel htmlFor={addressId}>Address</FieldLabel>
          <Input id={addressId} value={fields.hotelAddress} onChange={(v) => onChange("hotelAddress", v)} />
        </div>
        <div className="rounded-lg border border-amber-200 bg-white p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-700">Voice</p>
          <FieldLabel htmlFor={phoneId}>Phone</FieldLabel>
          <Input id={phoneId} type="tel" value={fields.hotelPhone} onChange={(v) => onChange("hotelPhone", v)} />
        </div>
        <div className="rounded-lg border border-amber-200 bg-white p-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-amber-700">Digital</p>
          <FieldLabel htmlFor={emailId}>Email</FieldLabel>
          <Input id={emailId} type="email" value={fields.hotelEmail} onChange={(v) => onChange("hotelEmail", v)} />
        </div>
      </div>
    </div>
  );
}
