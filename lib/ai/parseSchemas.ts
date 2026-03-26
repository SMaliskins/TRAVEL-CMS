/**
 * Parse Schemas — Zod schemas for all document types.
 *
 * These serve as:
 * - TypeScript types (via z.infer<>)
 * - Runtime validation contracts
 * - OpenAI Structured Output schemas (via zodToJsonSchema)
 * - Documentation of expected fields
 */

import { z } from "zod";

// ============== PASSPORT ==============

export const PassportSchema = z.object({
  passportNumber: z.string().optional(),
  passportIssueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  passportExpiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  passportIssuingCountry: z.string().optional(), // Full English name
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  passportFullName: z.string().optional(),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  nationality: z.string().optional(),
  personalCode: z.string().optional(),
  gender: z.enum(["male", "female"]).optional(),
  isAlienPassport: z.boolean().default(false),
  mrzLine1: z.string().optional(),
  mrzLine2: z.string().optional(),
});
export type PassportData = z.infer<typeof PassportSchema>;

export const PASSPORT_REQUIRED = ["passportNumber", "lastName"] as const;

// ============== FLIGHT TICKET ==============

const FlightSegmentSchema = z.object({
  flightNumber: z.string(),
  airline: z.string().optional(),
  departure: z.string().min(3).max(4), // IATA code
  departureCity: z.string().optional(),
  departureCountry: z.string().optional(),
  arrival: z.string().min(3).max(4),
  arrivalCity: z.string().optional(),
  arrivalCountry: z.string().optional(),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departureTimeScheduled: z.string().optional(),
  arrivalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  arrivalTimeScheduled: z.string().optional(),
  duration: z.string().optional(),
  cabinClass: z.enum(["economy", "premium_economy", "business", "first"]).optional(),
  bookingClass: z.string().optional(),
  baggage: z.string().optional(),
  ticketNumber: z.string().optional(),
  passengerName: z.string().optional(),
});

const PassengerSchema = z.object({
  name: z.string(),
  ticketNumber: z.string().optional(),
});

export const FlightTicketSchema = z.object({
  booking: z.object({
    bookingRef: z.string().optional(),
    airline: z.string().optional(),
    totalPrice: z.number().optional(),
    currency: z.string().optional(),
    ticketNumbers: z.array(z.string()).optional(),
    passengers: z.array(PassengerSchema).optional(),
    cabinClass: z.string().optional(),
    refundPolicy: z.string().optional(),
    baggage: z.string().optional(),
    changeFee: z.number().nullable().optional(),
  }).optional(),
  segments: z.array(FlightSegmentSchema).min(1),
});
export type FlightTicketData = z.infer<typeof FlightTicketSchema>;

export const FLIGHT_REQUIRED = ["segments"] as const;

// ============== PACKAGE TOUR ==============

const TravellerSchema = z.object({
  name: z.string(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  dateOfBirth: z.string().optional(),
});

const TourFlightSegmentSchema = z.object({
  flightNumber: z.string().optional(),
  airline: z.string().optional(),
  departure: z.string().optional(),
  departureCity: z.string().optional(),
  arrival: z.string().optional(),
  arrivalCity: z.string().optional(),
  departureDate: z.string().optional(),
  departureTimeScheduled: z.string().optional(),
  arrivalDate: z.string().optional(),
  arrivalTimeScheduled: z.string().optional(),
  duration: z.string().optional(),
  cabinClass: z.string().optional(),
  baggage: z.string().optional(),
});

export const PackageTourSchema = z.object({
  detectedOperator: z.string(),
  operator: z.object({
    name: z.string(),
    registrationNo: z.string().optional(),
    licenseNo: z.string().optional(),
  }).optional(),
  bookingRef: z.string().optional(),
  travellers: z.array(TravellerSchema).optional(),
  direction: z.string().optional(),
  accommodation: z.object({
    hotelName: z.string().optional(),
    starRating: z.string().optional(),
    roomType: z.string().optional(),
    mealPlan: z.string().optional(),
    arrivalDate: z.string().optional(),
    departureDate: z.string().optional(),
    nights: z.number().optional(),
  }).optional(),
  flights: z.object({
    segments: z.array(TourFlightSegmentSchema).optional(),
  }).optional(),
  transfers: z.object({
    type: z.string().optional(),
    description: z.string().optional(),
  }).optional(),
  additionalServices: z.array(z.object({
    description: z.string(),
    price: z.number().optional(),
    currency: z.string().optional(),
  })).optional(),
  pricing: z.object({
    packagePrice: z.number().optional(),
    discount: z.number().optional(),
    additionalServicesTotal: z.number().optional(),
    totalPrice: z.number().optional(),
    currency: z.string().default("EUR"),
  }).optional(),
  paymentTerms: z.object({
    depositAmount: z.number().optional(),
    depositDueDate: z.string().optional(),
    finalAmount: z.number().optional(),
    finalDueDate: z.string().optional(),
    depositPercent: z.number().optional(),
    finalPercent: z.number().optional(),
  }).optional(),
});
export type PackageTourData = z.infer<typeof PackageTourSchema>;

export const PACKAGE_TOUR_REQUIRED = ["detectedOperator"] as const;

// ============== INVOICE / EXPENSE ==============

export const InvoiceSchema = z.object({
  supplier: z.string().optional(),
  invoiceNumber: z.string().optional(),
  invoiceDate: z.string().optional(),
  amount: z.number().optional(),
  amountWithoutVat: z.number().optional(),
  vatAmount: z.number().optional(),
  vatRate: z.number().optional(),
  currency: z.string().default("EUR"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
});
export type InvoiceData = z.infer<typeof InvoiceSchema>;

export const INVOICE_REQUIRED = ["amount"] as const;

// ============== COMPANY DOC ==============

export const CompanyDocSchema = z.object({
  companyName: z.string().optional(),
  regNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  legalAddress: z.string().optional(),
  country: z.string().optional(),
  bankName: z.string().optional(),
  iban: z.string().optional(),
  swift: z.string().optional(),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
});
export type CompanyDocData = z.infer<typeof CompanyDocSchema>;

export const COMPANY_DOC_REQUIRED = ["companyName"] as const;

// ============== DOCUMENT TYPE ==============

export type DocumentType =
  | "passport"
  | "flight_ticket"
  | "package_tour"
  | "invoice"
  | "company_doc"
  | "expense";

// ============== SCHEMA REGISTRY ==============

export const PARSE_SCHEMAS = {
  passport: { schema: PassportSchema, required: PASSPORT_REQUIRED },
  flight_ticket: { schema: FlightTicketSchema, required: FLIGHT_REQUIRED },
  package_tour: { schema: PackageTourSchema, required: PACKAGE_TOUR_REQUIRED },
  invoice: { schema: InvoiceSchema, required: INVOICE_REQUIRED },
  company_doc: { schema: CompanyDocSchema, required: COMPANY_DOC_REQUIRED },
  expense: { schema: InvoiceSchema, required: INVOICE_REQUIRED },
} as const;

// ============== ZOD → JSON SCHEMA UTILITY ==============

/**
 * Convert a Zod schema to an OpenAI-compatible JSON schema for Structured Outputs.
 *
 * Uses Zod v4 built-in z.toJSONSchema(), then adapts for OpenAI strict mode:
 * - ALL properties must be in `required` array
 * - Optional properties become nullable (anyOf: [{...}, {type: "null"}])
 * - additionalProperties: false on all objects
 */
export function zodSchemaToOpenAI(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  zodSchema: any,
  name: string
): { name: string; schema: Record<string, unknown>; strict: boolean } {
  // Zod v4 built-in JSON Schema conversion
  const raw = z.toJSONSchema(zodSchema) as Record<string, unknown>;

  // Remove $schema — OpenAI doesn't want it
  delete raw.$schema;

  // Adapt for OpenAI strict mode
  makeOpenAIStrict(raw);

  return { name, schema: raw, strict: true };
}

// Keys not supported by OpenAI Structured Outputs strict mode
const UNSUPPORTED_KEYS = new Set([
  "pattern", "default", "format", "minimum", "maximum",
  "minLength", "maxLength", "minItems", "maxItems",
  "exclusiveMinimum", "exclusiveMaximum", "multipleOf",
  "minProperties", "maxProperties", "uniqueItems",
]);

/**
 * Remove keys not supported by OpenAI Structured Outputs from a schema node.
 */
function stripUnsupportedKeys(obj: Record<string, unknown>): void {
  UNSUPPORTED_KEYS.forEach((key) => {
    delete obj[key];
  });
}

/**
 * Recursively adapt a JSON Schema for OpenAI Structured Outputs strict mode:
 * 1. All properties must be in `required`
 * 2. Properties not originally required become nullable
 * 3. additionalProperties: false on all objects
 * 4. Remove unsupported keys (pattern, default, format, etc.)
 */
function makeOpenAIStrict(obj: Record<string, unknown>): void {
  stripUnsupportedKeys(obj);

  if (obj.type === "object" && obj.properties) {
    const props = obj.properties as Record<string, Record<string, unknown>>;
    const currentRequired = new Set(
      Array.isArray(obj.required) ? (obj.required as string[]) : []
    );
    const allKeys = Object.keys(props);

    // Clean each property first, then make optional ones nullable
    for (const key of allKeys) {
      const propSchema = props[key];
      if (propSchema && typeof propSchema === "object") {
        stripUnsupportedKeys(propSchema);
        if (!currentRequired.has(key)) {
          // Wrap in anyOf: [original, null] to make it nullable
          props[key] = {
            anyOf: [
              { ...propSchema },
              { type: "null" },
            ],
          };
        }
      }
    }

    // ALL properties required for strict mode
    obj.required = allKeys;
    obj.additionalProperties = false;

    // Recurse into all property schemas
    for (const prop of Object.values(props)) {
      if (prop && typeof prop === "object") {
        recurseIntoSchema(prop);
      }
    }
  }

  // Handle arrays
  if (obj.items && typeof obj.items === "object") {
    recurseIntoSchema(obj.items as Record<string, unknown>);
  }

  // Handle $defs
  if (obj.$defs && typeof obj.$defs === "object") {
    for (const def of Object.values(obj.$defs as Record<string, Record<string, unknown>>)) {
      if (def && typeof def === "object") {
        makeOpenAIStrict(def);
      }
    }
  }
}

/**
 * Recurse into nested schemas, handling anyOf/oneOf/allOf wrappers.
 */
function recurseIntoSchema(obj: Record<string, unknown>): void {
  // Direct object type
  if (obj.type === "object" && obj.properties) {
    makeOpenAIStrict(obj);
    return;
  }

  // Array items
  if (obj.type === "array" && obj.items && typeof obj.items === "object") {
    recurseIntoSchema(obj.items as Record<string, unknown>);
    return;
  }

  // anyOf / oneOf / allOf — recurse into each branch
  for (const combiner of ["anyOf", "oneOf", "allOf"] as const) {
    if (Array.isArray(obj[combiner])) {
      for (const branch of obj[combiner] as Record<string, unknown>[]) {
        if (branch && typeof branch === "object") {
          recurseIntoSchema(branch);
        }
      }
    }
  }
}
