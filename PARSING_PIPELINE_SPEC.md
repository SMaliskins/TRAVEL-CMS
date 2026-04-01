# Document Parsing Pipeline — Technical Specification

> This spec is the single source of truth for refactoring the travel-cms document parsing system.
> It was produced after analysis of the full codebase and consensus between Claude (Cowork), GPT-4o, and Gemini 2.5 Pro.

---

## 1. Problem Statement

All 4 document types (passports, flight tickets, package tours, invoices) parse with errors.
6 independent parsers make direct `fetch()` to OpenAI, duplicating PDF extraction, base64 encoding, JSON parsing, and logging.
None of them uses the existing unified client at `lib/ai/client.ts`.
~2500 lines of duplicated code. No feedback system — users cannot influence parsing quality.

### Root Causes

1. **gpt-4o-mini for text** — weak model for structured extraction (used when unpdf extracts text successfully)
2. **No structured output** — parsers ask "Return valid JSON" and extract with `content.match(/\{[\s\S]*\}/)`
3. **No validation + retry** — if AI returns empty fields, the result is accepted as-is
4. **`unpdf` loses layout** — tables in tour operator contracts (Novatours, ANEX) become unstructured text
5. **No feedback loop** — users cannot report errors, system doesn't learn
6. **Chaotic prompts** — each parser has its own style, no unified standard

### Quantified Duplication

- **14 direct `fetch()` calls** to `https://api.openai.com/v1/chat/completions` across 6 route files
- **~500 lines** of duplicated system prompts
- **~500 lines** of duplicated fetch/error-handling/JSON-parsing logic
- **~400 lines** of duplicated invoice/expense extraction
- **3 duplicate** `normalizeDate()` / `formatDate()` / `parseDate()` implementations
- **Anthropic SDK** installed (v0.72.1) but `client.ts` returns `"Anthropic API not yet implemented"`

---

## 2. Current Architecture (AS-IS)

### 2.1 Files Inventory

#### AI Client Layer (exists but underused)
```
lib/ai/client.ts          — 247 lines. OpenAI works, Anthropic is placeholder.
lib/ai/config.ts           — 114 lines. Models, pricing, configs.
lib/ai/index.ts            — 122 lines. Re-exports everything.
lib/ai/usageLimit.ts       — AI usage limit checker.
lib/aiUsageLogger.ts       — Logs to ai_usage_log table.
```

#### API Route Parsers (each makes direct fetch to OpenAI)
```
app/api/ai/parse-passport/route.ts              — 687 lines. PDF/Image/Text → passport JSON
app/api/ai/parse-flight-itinerary/route.ts       — 507 lines. PDF/Image/Text → flights JSON
app/api/ai/parse-package-tour/route.ts           — 429 lines. PDF/Image/Text → tour JSON
app/api/ai/parse-company-doc/route.ts            — 204 lines. PDF/Image → company info JSON
app/api/orders/[orderCode]/documents/[docId]/parse/route.ts — 374 lines. Invoice parsing
app/api/finances/company-expenses/parse/route.ts  — 278 lines. Expense doc parsing
```

#### Library Parsers (non-AI, regex-based)
```
lib/passport/parseMrz.ts              — 172 lines. MRZ extraction (used by passport route)
lib/passport/parsePassportText.ts      — 418 lines. Regex passport parsing (DEAD CODE — not used by API)
lib/passport/extractPassportPhoto.ts   — Photo extraction from PDF
lib/passport/renderPdfPage.ts          — PDF page to image rendering
lib/flights/airlineParsers.ts          — 3031 lines. 15+ airline-specific regex parsers
lib/flights/flightTextParser.ts        — ~200 lines. Flight text helpers
lib/flights/parseTemplates.ts          — ~300 lines. Few-shot template matching
```

#### AI Task Files (lib layer, some use client.ts)
```
lib/ai/tasks/parseDocument.ts
lib/ai/tasks/parseFlightItinerary.ts
lib/ai/tasks/parseEmail.ts
lib/ai/tasks/suggestServices.ts
lib/ai/tasks/translateText.ts
```

### 2.2 Current Model Usage

| Parser | Text mode | Vision mode | Notes |
|--------|-----------|-------------|-------|
| Passport | — | gpt-4o | Also uses Anthropic SDK directly (imported but unclear usage) |
| Flight itinerary | gpt-4o-mini | gpt-4o | unpdf first → text → mini; image → 4o |
| Package tour | gpt-4o-mini | gpt-4o | unpdf first → text → mini; PDF fallback → 4o |
| Company doc | gpt-4o | gpt-4o | Always vision model |
| Invoice (order doc) | gpt-4o | gpt-4o | Has regex pre-extraction + AI |
| Expense | gpt-4o | gpt-4o | Similar to invoice |

### 2.3 Current Flow (per parser)

```
1. API route receives FormData/JSON
2. Detect file type (PDF/image/text)
3. If PDF → try unpdf extractText()
4. If text extracted → use gpt-4o-mini with text
   If no text (scanned) → send PDF/image to gpt-4o vision
5. Get response → regex match JSON from content
6. Return parsed object (no validation of fields)
```

### 2.4 Existing Config (lib/ai/config.ts)

```typescript
export const MODELS = {
  OPENAI_VISION: "gpt-4o",
  OPENAI_FAST: "gpt-4o-mini",
  OPENAI_COMPLEX: "gpt-4o",
  ANTHROPIC_FAST: "claude-3-haiku-20240307",
  ANTHROPIC_CHAT: "claude-sonnet-4-5",
} as const;

export const AI_CONFIGS = {
  vision:   { provider: "openai",    model: MODELS.OPENAI_VISION,   maxTokens: 2000, temperature: 0.1 },
  fast:     { provider: "openai",    model: MODELS.OPENAI_FAST,     maxTokens: 1000, temperature: 0.2 },
  complex:  { provider: "openai",    model: MODELS.OPENAI_COMPLEX,  maxTokens: 4000, temperature: 0.7 },
  chat:     { provider: "openai",    model: MODELS.OPENAI_COMPLEX,  maxTokens: 2000, temperature: 0.8 },
  parsing:  { provider: "anthropic", model: MODELS.ANTHROPIC_FAST,  maxTokens: 3000, temperature: 0.1 },
  concierge:{ provider: "anthropic", model: MODELS.ANTHROPIC_CHAT,  maxTokens: 2000, temperature: 0.7 },
};
```

Note: `parsing` and `concierge` configs exist but are unused because Anthropic is not implemented.

---

## 3. Target Architecture (TO-BE)

### 3.1 Four Layers

```
Layer 1: lib/ai/client.ts          — Unified AI client (OpenAI + Anthropic)
Layer 2: lib/ai/documentIntake.ts   — File loading, type detection, strategy selection
Layer 3: lib/ai/parseWithAI.ts      — Orchestrator: intake → rules → AI → validate → retry → log
Layer 4: parse_rules (DB + UI)      — User correction rules → injected into prompts
```

Supporting:
```
lib/ai/parseSchemas.ts              — Zod schemas for all 4 document types
lib/ai/parsePrompts.ts              — Centralized system prompts (extracted from route files)
```

### 3.2 Layer 1: `lib/ai/client.ts` — Unified Client

**What to change:**
- Implement `anthropicComplete()` using the installed `@anthropic-ai/sdk` (v0.72.1)
- Add support for **OpenAI Structured Outputs** via `response_format: { type: "json_schema", json_schema: {...} }`
- Add support for **Anthropic vision** (images as base64 in content blocks)
- Add support for **PDF-as-file** for OpenAI (the `file` content type used in current parsers)
- Add `timeout` parameter (default 60s)
- Add transport-level retry (429, 500, 503 — exponential backoff, max 3 attempts)
- Preserve raw response for logging
- Return token usage in every response

**New interface additions:**

```typescript
export interface AICompletionOptions {
  configKey?: keyof typeof AI_CONFIGS;
  messages: AIMessage[];
  jsonMode?: boolean;
  jsonSchema?: Record<string, unknown>;  // NEW: OpenAI Structured Outputs
  maxTokens?: number;
  temperature?: number;
  timeout?: number;                       // NEW: ms, default 60000
}

export interface AIResponse {
  success: boolean;
  content?: string;
  error?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  rawResponse?: unknown;                  // NEW: for parse_runs logging
  model?: string;                         // NEW: actual model used
  provider?: string;                      // NEW: "openai" | "anthropic"
  latencyMs?: number;                     // NEW: request duration
}
```

**Anthropic implementation requirements:**
- Use `@anthropic-ai/sdk` (already installed), NOT raw fetch
- Support `system` parameter (Anthropic uses separate system param, not system message role)
- Support image content blocks: `{ type: "image", source: { type: "base64", media_type, data } }`
- Map response to same `AIResponse` interface
- Anthropic doesn't support `json_mode` natively — use prompt engineering + JSON extraction

**Message format for vision (must support both providers):**

```typescript
// For OpenAI - current format works:
{ type: "image_url", image_url: { url: "data:image/png;base64,...", detail: "high" } }

// For OpenAI PDF (native):
{ type: "file", file: { filename: "document.pdf", file_data: "data:application/pdf;base64,..." } }

// For Anthropic - needs mapping:
{ type: "image", source: { type: "base64", media_type: "image/png", data: "..." } }
```

The client should handle this mapping internally based on provider.

### 3.3 Layer 2: `lib/ai/documentIntake.ts` — Intake & Strategy

**Purpose:** Accept raw file input, determine what it is, extract content, and choose processing strategy.

```typescript
export type ContentMode = "text" | "vision" | "hybrid";
export type DocumentType = "passport" | "flight_ticket" | "package_tour" | "invoice" | "company_doc" | "expense";

export interface IntakeResult {
  documentType: DocumentType;
  contentMode: ContentMode;
  extractedText: string | null;      // from unpdf (if text PDF)
  pageImages: string[];               // base64 PNG per page (if vision needed)
  pdfBase64: string | null;           // raw PDF for native PDF vision
  mimeType: string;
  fileHash: string;                   // SHA-256 for dedup
  pageCount: number;
  layoutRisk: "low" | "medium" | "high";  // tables, complex formatting
  sourceMeta: {
    originalFilename?: string;
    fileSizeBytes: number;
    inputType: "pdf" | "image" | "text";
  };
}
```

**Strategy selection logic:**

```
IF documentType == "passport":
  → contentMode = "vision" (always — passports are image-heavy)

IF documentType == "flight_ticket":
  → Try text extraction first
  → IF text.length > 100 AND has structured data (PNR, flight numbers): contentMode = "text"
  → ELSE: contentMode = "vision"

IF documentType == "package_tour":
  → layoutRisk = "high" (tables from Novatours/ANEX/Tez/Coral)
  → Try text extraction
  → IF text includes recognizable table structure: contentMode = "hybrid" (text + images)
  → IF text is garbled or < 100 chars: contentMode = "vision"
  → PREFER vision for tour operators with known table-heavy formats

IF documentType in ["invoice", "expense", "company_doc"]:
  → Try text extraction first
  → IF text.length > 50: contentMode = "text"
  → ELSE: contentMode = "vision"
```

**Text extraction:** Continue using `unpdf` but with quality check:
```typescript
async function extractTextFromPdf(buffer: Buffer): Promise<{ text: string; quality: "good" | "poor" | "empty" }> {
  const { extractText } = await import("unpdf");
  const result = await extractText(new Uint8Array(buffer));
  const text = (Array.isArray(result?.text) ? result.text.join("\n") : result?.text || "").trim();

  if (!text || text.length < 10) return { text: "", quality: "empty" };
  // Check for garbled text (common with table PDFs)
  const wordCount = text.split(/\s+/).length;
  const avgWordLen = text.replace(/\s/g, "").length / wordCount;
  if (avgWordLen > 20 || wordCount < 5) return { text, quality: "poor" };
  return { text, quality: "good" };
}
```

**Page rendering for vision:** Use existing `pdf-to-img` (already installed):
```typescript
async function renderPdfPages(buffer: Buffer): Promise<string[]> {
  const { pdf } = await import("pdf-to-img");
  const pages: string[] = [];
  const document = await pdf(buffer, { scale: 2.0 });
  for await (const page of document) {
    pages.push(Buffer.from(page).toString("base64"));
  }
  return pages;
}
```

### 3.4 Layer 3: `lib/ai/parseWithAI.ts` — Orchestrator

This is the heart of the system. Single entry point for all document parsing.

```typescript
export interface ParseOptions {
  file?: Buffer;
  text?: string;
  filename?: string;
  mimeType?: string;
  documentType?: DocumentType;       // optional: auto-detect if not provided
  companyId: string;
  userId: string;
  orderId?: string;                   // for context
}

export interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  confidence: number;                 // 0-1, based on filled required fields
  warnings: string[];                 // e.g. "missing passenger DOB"
  runId: string;                      // parse_runs.id for tracking
  retryCount: number;
  model: string;
  provider: string;
  latencyMs: number;
}
```

**Orchestration flow:**

```
1. INTAKE
   → documentIntake.processFile(file, filename, mimeType)
   → Returns IntakeResult with contentMode, text, images, etc.

2. RESOLVE DOCUMENT TYPE
   → If not provided, detect from content (operator names, document structure)
   → Validate: must be one of known types

3. LOAD RULES FROM DB
   → SELECT * FROM parse_rules WHERE document_type = ? AND is_active = true ORDER BY priority
   → Filter by scope (operator-specific rules if operator detected)
   → Returns: extraction rules + correction rules

4. BUILD PROMPT
   → Load base system prompt from parsePrompts.ts
   → Append applicable rules as "Additional instructions from corrections database:"
   → Append Zod schema description as "Required output format:"
   → For few-shot: load relevant parse_feedback examples

5. CHOOSE MODEL & STRATEGY
   → Based on documentType + contentMode:
     - passport: vision → gpt-4o (primary), claude-sonnet (fallback)
     - flight_ticket: text → gpt-4o, vision → gpt-4o
     - package_tour: vision/hybrid → gpt-4o (primary), claude-sonnet (fallback)
     - invoice: text → gpt-4o, vision → gpt-4o
     - company_doc: text → gpt-4o, vision → gpt-4o
     - expense: text → gpt-4o, vision → gpt-4o

6. CALL AI
   → Use client.ts aiComplete() — NOT direct fetch
   → Pass jsonSchema for OpenAI Structured Outputs when possible

7. VALIDATE
   → Parse response with Zod schema (parseSchemas.ts)
   → Check required fields per document type:
     - passport: passportNumber, lastName, firstName (at least 2 of 3)
     - flight_ticket: at least 1 segment with flightNumber + departure + arrival
     - package_tour: detectedOperator + at least accommodation OR flights
     - invoice: amount OR supplier (at least 1)
   → Calculate confidence score (filled required fields / total required fields)

8. RETRY (if validation fails)
   → Retry 1: Same model, enhanced prompt with "You missed these fields: [list]. Look more carefully."
   → Retry 2: Switch contentMode (text → vision, or add page images)
   → Retry 3: Switch provider (OpenAI → Anthropic or vice versa)
   → Max 3 retries total

9. LOG TO parse_runs
   → Save: document_type, provider, model, contentMode, prompt_version,
     rules_applied[], validation_status, retry_count, latency_ms,
     token_usage, raw_output, normalized_output, confidence, success/failure

10. RETURN ParseResult<T>
    → Typed result based on Zod schema
    → Includes confidence score and warnings
```

### 3.5 `lib/ai/parseSchemas.ts` — Zod Schemas

Define strict schemas for each document type. These serve as:
- TypeScript types (via `z.infer<>`)
- Validation contracts
- OpenAI Structured Output schemas (via `zodToJsonSchema`)
- Documentation of expected fields

```typescript
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

// Required fields for validation
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
    baggage: z.string().optional(),
  }).optional(),
  segments: z.array(FlightSegmentSchema).min(1),
});
export type FlightTicketData = z.infer<typeof FlightTicketSchema>;

export const FLIGHT_REQUIRED = ["segments"] as const; // at least 1 segment

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
  direction: z.string().optional(), // "Latvia, Riga - Turkey, Antalya"
  accommodation: z.object({
    hotelName: z.string().optional(),
    starRating: z.string().optional(),
    roomType: z.string().optional(),
    mealPlan: z.string().optional(), // UAI, AI, HB, BB, FB, RO
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
  invoiceDate: z.string().optional(), // YYYY-MM-DD
  amount: z.number().optional(),
  amountWithoutVat: z.number().optional(),
  vatAmount: z.number().optional(),
  vatRate: z.number().optional(),
  currency: z.string().default("EUR"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
});
export type InvoiceData = z.infer<typeof InvoiceSchema>;

export const INVOICE_REQUIRED = ["amount"] as const; // at minimum need an amount

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

// ============== SCHEMA REGISTRY ==============
export const PARSE_SCHEMAS = {
  passport: { schema: PassportSchema, required: PASSPORT_REQUIRED },
  flight_ticket: { schema: FlightTicketSchema, required: FLIGHT_REQUIRED },
  package_tour: { schema: PackageTourSchema, required: PACKAGE_TOUR_REQUIRED },
  invoice: { schema: InvoiceSchema, required: INVOICE_REQUIRED },
  company_doc: { schema: CompanyDocSchema, required: COMPANY_DOC_REQUIRED },
  expense: { schema: InvoiceSchema, required: INVOICE_REQUIRED }, // same schema as invoice
} as const;
```

### 3.6 `lib/ai/parsePrompts.ts` — Centralized Prompts

Extract all system prompts from route files into one place. Each prompt should follow a unified template:

```
ROLE: You are a [document type] parser for a travel agency CRM.
INPUT: [what the model receives]
TASK: Extract structured data from the document.
OUTPUT FORMAT: [Zod schema description — auto-generated]
OPERATOR-SPECIFIC RULES: [from DB parse_rules, injected dynamically]
CORRECTION EXAMPLES: [from DB parse_feedback, injected as few-shot]
CONSTRAINTS: [validation hints, date formats, etc.]
```

**Preserve ALL operator-specific rules** from current prompts:
- **Coral Travel**: Latvian format, NAKTSMĪTNES, LIDOJUMI, KOPĒJĀ CEĻOJUMA CENA
- **Novatours**: "Rezervācijas numurs: RNxxxxxx", comma-as-decimal (1,478,00 = 1478.00), "Mrs Surname, Firstname" format, BT=airBaltic
- **Tez Tour**: "LĪGUMS Par tūrisma pakalpojumu sniegšanu", "Rezervācijas Nr.", BT=airBaltic (NOT Bulgaria Air), "Nakšu skaits"
- **ANEX Tour**: "Ceļojumu pakalpojumu sniegšanas līgums Nr.", ALL CAPS concatenated names (e.g. "INESEELIZABETE" → "Inese Elizabete"), 4M flight codes
- **Join Up**: Extract what available

These rules currently live in the SYSTEM_PROMPT constant in `app/api/ai/parse-package-tour/route.ts` (lines 25-159). They MUST be preserved — they represent months of trial-and-error learning.

Similarly preserve:
- Passport prompt rules from `app/api/ai/parse-passport/route.ts` (lines 49-98): MRZ parsing, diacritics, date formats, personalCode, isAlienPassport
- Flight prompt rules from `app/api/ai/parse-flight-itinerary/route.ts` `getSystemPrompt()` function
- Company doc prompt rules from `app/api/ai/parse-company-doc/route.ts` (lines 20-53)
- Invoice prompt rules from `app/api/orders/[orderCode]/documents/[docId]/parse/route.ts`
- Expense prompt rules from `app/api/finances/company-expenses/parse/route.ts`

### 3.7 Domain Validators

Beyond Zod schema validation, add domain-specific checks:

```typescript
// Passport
- expiryDate > issueDate (if both present)
- dob < today (nobody born in the future)
- IATA nationality codes: 2 letters

// Flight
- IATA airport codes: 3 letters uppercase
- departureDate <= arrivalDate
- flightNumber format: 2-letter airline code + 1-4 digits (e.g. BT 683)

// Package Tour
- arrivalDate < departureDate (check-in before check-out)
- nights = daysBetween(arrivalDate, departureDate) when both present
- totalPrice > 0
- mealPlan in ["RO", "BB", "HB", "FB", "AI", "UAI"]

// Invoice
- amount > 0
- currency is ISO 4217 (EUR, USD, GBP, etc.)
- invoiceDate is valid date
```

---

## 4. Database Schema (3 tables)

### 4.1 `parse_runs` — Log of every parsing attempt

```sql
CREATE TABLE parse_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID NOT NULL,
  document_type TEXT NOT NULL, -- passport, flight_ticket, package_tour, invoice, company_doc, expense
  provider TEXT NOT NULL, -- openai, anthropic
  model TEXT NOT NULL, -- gpt-4o, claude-sonnet-4-5, etc.
  content_mode TEXT NOT NULL, -- text, vision, hybrid
  prompt_version TEXT, -- for tracking prompt changes
  rules_applied UUID[], -- array of parse_rules.id that were injected
  validation_status TEXT NOT NULL, -- valid, partial, invalid
  confidence NUMERIC(3,2), -- 0.00 to 1.00
  retry_count INTEGER DEFAULT 0,
  latency_ms INTEGER,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  estimated_cost_usd NUMERIC(10,6),
  raw_output JSONB, -- raw AI response
  normalized_output JSONB, -- after Zod parsing & normalization
  warnings TEXT[],
  error_message TEXT,
  success BOOLEAN DEFAULT true,
  -- context
  order_id UUID, -- if parsing was for a specific order
  document_id UUID, -- if linked to order_documents
  file_hash TEXT, -- SHA-256 for dedup
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_parse_runs_company ON parse_runs(company_id, created_at DESC);
CREATE INDEX idx_parse_runs_document_type ON parse_runs(document_type, created_at DESC);
CREATE INDEX idx_parse_runs_file_hash ON parse_runs(file_hash);

-- RLS
ALTER TABLE parse_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own company parse runs" ON parse_runs
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM profiles WHERE user_id = auth.uid()
  ));
```

### 4.2 `parse_feedback` — User corrections

```sql
CREATE TABLE parse_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES parse_runs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id),
  user_id UUID NOT NULL,
  field_name TEXT NOT NULL, -- e.g. "accommodation.hotelName", "travellers[0].firstName"
  old_value TEXT, -- what AI returned
  new_value TEXT, -- what user corrected to
  feedback_type TEXT DEFAULT 'correction', -- correction, missing_field, wrong_format, other
  comment TEXT, -- optional user comment
  document_type TEXT NOT NULL,
  detected_operator TEXT, -- for operator-specific learning
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_parse_feedback_company ON parse_feedback(company_id, created_at DESC);
CREATE INDEX idx_parse_feedback_run ON parse_feedback(run_id);
CREATE INDEX idx_parse_feedback_field ON parse_feedback(document_type, field_name);
CREATE INDEX idx_parse_feedback_operator ON parse_feedback(detected_operator) WHERE detected_operator IS NOT NULL;

-- RLS
ALTER TABLE parse_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own company feedback" ON parse_feedback
  FOR ALL USING (company_id IN (
    SELECT company_id FROM profiles WHERE user_id = auth.uid()
  ));
```

### 4.3 `parse_rules` — Confirmed extraction/correction rules

```sql
CREATE TABLE parse_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id), -- NULL = global rule
  document_type TEXT NOT NULL,
  rule_type TEXT NOT NULL, -- 'extraction' | 'correction' | 'validation' | 'fallback'
  scope TEXT, -- operator name (e.g. "Novatours"), field name, or NULL for global
  priority INTEGER DEFAULT 100, -- lower = higher priority
  rule_text TEXT NOT NULL, -- human-readable rule to inject into prompt
  is_active BOOLEAN DEFAULT true,
  source_feedback_count INTEGER DEFAULT 0, -- how many parse_feedback entries led to this rule
  example_before TEXT, -- optional: what AI typically gets wrong
  example_after TEXT, -- optional: what the correct value should be
  created_by UUID, -- user or system
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_parse_rules_lookup ON parse_rules(document_type, is_active) WHERE is_active = true;
CREATE INDEX idx_parse_rules_scope ON parse_rules(scope) WHERE scope IS NOT NULL;

-- RLS
ALTER TABLE parse_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Global rules visible to all" ON parse_rules
  FOR SELECT USING (company_id IS NULL OR company_id IN (
    SELECT company_id FROM profiles WHERE user_id = auth.uid()
  ));
CREATE POLICY "Company admins manage rules" ON parse_rules
  FOR ALL USING (company_id IN (
    SELECT company_id FROM profiles WHERE user_id = auth.uid() AND role IN ('supervisor', 'admin')
  ));
```

---

## 5. Migration Plan

### Phase 1: Foundation (Layer 1 + Schemas)

1. **Update `lib/ai/client.ts`**
   - Implement `anthropicComplete()` using `@anthropic-ai/sdk`
   - Add Structured Outputs support for OpenAI
   - Add timeout, transport retry, latency tracking, raw response preservation
   - Add PDF-as-file content type support
   - Add provider-specific vision message mapping

2. **Create `lib/ai/parseSchemas.ts`**
   - All Zod schemas as defined in section 3.5
   - Export types via `z.infer<>`
   - Export required fields arrays
   - Export `PARSE_SCHEMAS` registry
   - Add `zodToJsonSchema` conversion utility for OpenAI Structured Outputs

3. **Update `lib/ai/config.ts`**
   - Add new config presets for parsing:
     ```
     parsing_vision: { provider: "openai", model: "gpt-4o", maxTokens: 4000, temperature: 0.1 }
     parsing_text: { provider: "openai", model: "gpt-4o", maxTokens: 4000, temperature: 0.1 }
     parsing_fallback: { provider: "anthropic", model: "claude-sonnet-4-5", maxTokens: 4000, temperature: 0.1 }
     ```
   - Note: use gpt-4o for ALL parsing (not gpt-4o-mini) — the cost difference is negligible at travel agency volume

### Phase 2: Core Pipeline (Layers 2+3)

4. **Create `lib/ai/documentIntake.ts`**
   - As defined in section 3.3
   - Reuse existing `unpdf` for text extraction
   - Reuse existing `pdf-to-img` for page rendering
   - Add quality assessment for extracted text
   - Add file hash computation (SHA-256)

5. **Create `lib/ai/parsePrompts.ts`**
   - Extract ALL system prompts from current route files
   - Organize by document type
   - Add rule injection mechanism: `buildPrompt(documentType, rules[], feedbackExamples[])`
   - PRESERVE every operator-specific instruction from current prompts

6. **Create `lib/ai/parseWithAI.ts`**
   - As defined in section 3.4
   - Single `parseDocument()` entry point
   - Full orchestration: intake → rules → prompt → AI → validate → retry → log

7. **Apply database migration**
   - Create the 3 tables from section 4
   - Generate SQL migration file for manual review + application

### Phase 3: First Parser Migration (Package Tours)

8. **Migrate `app/api/ai/parse-package-tour/route.ts`**
   - Replace the entire implementation with a call to `parseWithAI()`
   - Route becomes a thin wrapper: auth check → rate limit → parseWithAI() → return result
   - Keep the API response format identical (backward compatible)
   - Verify: same output structure, better quality on Novatours/ANEX/Tez/Coral

### Phase 4: Remaining Parsers

9. **Migrate in order:**
   - `parse-passport/route.ts` — preserve MRZ extraction as pre-processing step
   - `parse-flight-itinerary/route.ts` — preserve few-shot template system from `parseTemplates.ts`
   - `parse-company-doc/route.ts`
   - `orders/[orderCode]/documents/[docId]/parse/route.ts`
   - `finances/company-expenses/parse/route.ts`

10. **After all migrated:**
    - Remove dead code: `lib/passport/parsePassportText.ts` (unused)
    - Consolidate duplicate utility functions (formatDate, normalizeDate, toTitleCase)
    - Update `lib/ai/index.ts` exports

### Phase 5: Feedback UI

11. **Add feedback API endpoint:**
    - `POST /api/ai/parse-feedback` — save user correction
    - `GET /api/ai/parse-rules` — list active rules for admin UI

12. **Add feedback UI in existing document views:**
    - When displaying parsed fields, add "Report error" / pencil icon per field
    - On correction: save to parse_feedback with run_id, field_name, old/new values
    - Show correction count badges for admin visibility

---

## 6. Key Decisions (Consensus)

| Decision | Rationale |
|----------|-----------|
| **3 DB tables, not 6** | `parse_schemas` and `parse_validators` stay in TypeScript code (Zod). Avoids migration overhead, gives autocompletion. |
| **gpt-4o everywhere** (not mini) | Cost difference negligible at travel agency volume. Quality improvement significant. |
| **Anthropic in client.ts NOW** | SDK already installed, placeholder exists. Infrastructure readiness, not premature optimization. |
| **Simple switch routing** (not dynamic) | 4-6 document types don't need a routing policy engine. Simple switch + fallback sufficient. |
| **Start with package tours** | Maximum pain point, most complex (tables, operators). If it works here, everything else is easier. |
| **Preserve existing prompts** | Months of trial-and-error encoded. Extract to parsePrompts.ts but don't rewrite. |
| **Backward-compatible API routes** | Route files become thin wrappers. Same request/response format. No frontend changes needed. |

---

## 7. Files to Create / Modify

### New files:
```
lib/ai/parseSchemas.ts       — Zod schemas for all document types
lib/ai/parsePrompts.ts        — Centralized system prompts
lib/ai/documentIntake.ts      — File intake + strategy selection
lib/ai/parseWithAI.ts         — Main orchestrator
migrations/add_parse_tables.sql — 3 new tables
```

### Files to modify:
```
lib/ai/client.ts              — Add Anthropic, Structured Outputs, timeout, retry
lib/ai/config.ts              — Add parsing-specific configs
lib/ai/index.ts               — Add new exports
lib/aiUsageLogger.ts          — Extend operation types
```

### Files to eventually thin out (Phase 3-4):
```
app/api/ai/parse-package-tour/route.ts
app/api/ai/parse-passport/route.ts
app/api/ai/parse-flight-itinerary/route.ts
app/api/ai/parse-company-doc/route.ts
app/api/orders/[orderCode]/documents/[docId]/parse/route.ts
app/api/finances/company-expenses/parse/route.ts
```

### Dead code to remove:
```
lib/passport/parsePassportText.ts — regex parser, unused by any route
```

---

## 8. Testing Strategy

For each migrated parser:

1. **Collect test documents** — at least 1 real document per operator/format
2. **Run old parser** — save output as baseline
3. **Run new pipeline** — compare output field by field
4. **Verify:**
   - All previously-filled fields are still filled
   - Empty fields that should be filled are now filled (improvement)
   - No regressions (fields that were correct before are still correct)
   - Zod validation passes
   - parse_runs entry is created
   - Confidence score is reasonable

---

## 9. Non-Goals (Explicitly Out of Scope)

- **Dynamic model routing policy** — overkill for 4-6 document types
- **`parse_learning_candidates` table** — use SQL queries on parse_feedback instead
- **Admin UI for prompt editing** — prompts stay in code for now
- **Multi-language prompt templates** — current prompts handle multi-language documents fine
- **OCR integration** — rely on vision models for scanned documents (they handle OCR internally)
- **Batch processing** — one document at a time is sufficient for travel agency volume
