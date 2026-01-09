# TITLE: Enhanced Service Addition Form with AI Integration

## 1. PURPOSE

Transform the current service addition form into a modern, AI-powered interface that enables travel agents to add services to orders with minimal manual data entry. The form should leverage AI to auto-fill information from various sources (emails, PDFs, screenshots, supplier confirmations), provide intelligent suggestions, and streamline the workflow to match or exceed the best travel CMS systems globally.

## 2. CURRENT STATE ANALYSIS

### What Works:
- ✅ Basic form structure with category selection (Flight, Hotel, Transfer, Tour, Insurance, Visa, Rent a Car, Cruise, Other)
- ✅ Flight itinerary input with PDF/image parsing (via `/api/ai/parse-flight-itinerary`)
- ✅ Support for multiple clients per service
- ✅ Category-specific fields (Hotel details, Transfer details, Flight segments)
- ✅ Date range picker
- ✅ Supplier/Client/Payer selection via PartySelect
- ✅ Price fields (Service Price, Client Price)
- ✅ Status and reference number fields

### What's Missing or Problematic:

**1. Manual Data Entry Burden:**
- ❌ No AI-powered extraction from emails/confirmations
- ❌ No smart suggestions based on order context
- ❌ No auto-completion from supplier history
- ❌ No bulk import capability
- ❌ No voice input or dictation

**2. Limited AI Integration:**
- ⚠️ AI parsing only for flights (PDF/images)
- ❌ No AI for hotel confirmations
- ❌ No AI for transfer bookings
- ❌ No AI for tour packages
- ❌ No AI for insurance documents
- ❌ No AI for visa documents

**3. Poor UX for Fast Data Entry:**
- ❌ Too many clicks to add a service
- ❌ No keyboard shortcuts
- ❌ No quick-add templates
- ❌ No copy/paste from previous services
- ❌ No drag-and-drop for documents
- ❌ No inline editing in table view

**4. Missing Smart Features:**
- ❌ No price validation (service price vs client price)
- ❌ No duplicate detection
- ❌ No conflict detection (overlapping dates, double bookings)
- ❌ No supplier rate lookup
- ❌ No automatic margin calculation
- ❌ No currency conversion

**5. Limited Context Awareness:**
- ❌ No suggestions based on order dates
- ❌ No suggestions based on order destinations
- ❌ No suggestions based on client preferences
- ❌ No suggestions based on supplier relationships
- ❌ No integration with order travellers

**6. No Modern Input Methods:**
- ❌ No voice input
- ❌ No OCR for printed confirmations
- ❌ No email integration (parse booking confirmations)
- ❌ No WhatsApp/Telegram integration
- ❌ No mobile app support

**7. Poor Error Prevention:**
- ❌ No validation for date conflicts
- ❌ No validation for missing required fields per category
- ❌ No warnings for unusual prices
- ❌ No confirmation for duplicate services

## 3. IN SCOPE

### Core Features:
- AI-powered data extraction from multiple sources
- Smart suggestions and auto-completion
- Fast data entry workflows
- Modern input methods (voice, drag-drop, paste)
- Context-aware recommendations
- Bulk import capabilities
- Real-time validation and conflict detection
- Template system for common services
- Integration with order context

### AI Capabilities:
- Extract service details from emails (booking confirmations)
- Parse PDF confirmations (hotels, transfers, tours, insurance, visas)
- OCR for printed confirmations (screenshots, photos)
- Extract data from supplier portals (if accessible)
- Parse WhatsApp/Telegram messages
- Voice-to-text input
- Smart field mapping (understand context)

### Smart Features:
- Auto-suggest suppliers based on category and destination
- Auto-suggest prices based on supplier history
- Auto-calculate client price with margin
- Auto-detect date conflicts
- Auto-detect duplicate services
- Auto-link related services (e.g., transfer to flight)
- Auto-assign travellers based on service dates

### Modern UX:
- Keyboard shortcuts (Ctrl+N for new, Ctrl+S for save, Ctrl+Enter for save & close)
- Quick-add buttons for common services
- Inline editing in table view
- Drag-and-drop document upload
- Paste from clipboard (text, images)
- Voice input button
- Template selector
- Bulk import wizard

## 4. OUT OF SCOPE

- Real-time supplier API integration (future phase)
- Payment processing integration
- Document storage and management (separate feature)
- Advanced reporting and analytics
- Mobile app (future phase)
- Multi-language support (future phase)
- Advanced workflow automation (future phase)

## 5. ACTORS & PERMISSIONS

**Actor: Authenticated Travel Agent**
- Can add services to orders they manage
- Can use AI features (subject to API limits)
- Can import bulk services
- Can use voice input
- Can access templates

**Permissions:**
- Authentication required
- Company-scoped access (can only add services to orders in their company)
- AI features may have usage limits (per user or per company)

## 6. UX / SCREENS

### Screen 1: Enhanced Add Service Modal

**Entry Point:**
- Click "Add Service" button in Order Services table
- Keyboard shortcut: `Ctrl+N` (when focus is on services table)

**Main UI States:**

**Empty State (Quick Start):**
- Large drop zone for documents (drag & drop)
- "Paste from clipboard" button (detects text/images)
- "Voice input" button (starts voice recording)
- "Quick templates" section (common service types)
- "Import from email" button (if email integration available)
- "Manual entry" button (shows full form)

**AI Processing State:**
- Progress indicator showing AI extraction progress
- Extracted fields highlighted in green
- Confidence scores for each field
- "Review & confirm" button
- "Edit extracted data" button

**Form State (Enhanced):**
- **Smart Category Selector:**
  - AI-suggested category based on extracted data
  - Visual icons for each category
  - Quick category buttons (Flight, Hotel, Transfer)
  
- **Service Name (AI-Enhanced):**
  - Auto-generated from extracted data
  - Smart suggestions dropdown (from previous services, supplier catalogs)
  - Voice input button inline
  - Paste button (extracts service name from pasted text)

- **Date Range (Smart):**
  - Auto-filled from extracted data
  - Calendar with order dates highlighted
  - Quick date buttons: "Order start", "Order end", "Today", "+1 day", "+7 days"
  - Conflict warnings (if dates overlap with existing services)

- **Supplier (AI-Suggested):**
  - Smart search with AI suggestions
  - Suggestions based on:
    - Category
    - Destination (from order)
    - Previous orders with same client
    - Supplier ratings/performance
  - "Add new supplier" quick action
  - Supplier rate lookup (if available)

- **Client/Payer (Context-Aware):**
  - Pre-filled from order
  - Multiple clients with smart suggestions
  - "Add from order travellers" quick action
  - Auto-suggest payer (usually same as primary client)

- **Prices (Smart Calculation):**
  - Service price: Auto-suggested from supplier rate card (if available)
  - Client price: Auto-calculated with margin (configurable per company)
  - Currency selector (auto-detected from supplier)
  - Price validation warnings:
    - "Service price higher than usual"
    - "Client price lower than service price"
    - "Margin too low/high"

- **Status (Smart Defaults):**
  - Auto-set based on:
    - Date (future = "booked", past = "confirmed")
    - Supplier confirmation status (if available)
    - Order status

- **Category-Specific AI Fields:**

  **Flight:**
  - Flight itinerary parser (existing, enhanced)
  - Auto-extract from email confirmations
  - Auto-link to transfer services
  - Auto-suggest return flights

  **Hotel:**
  - Extract from booking confirmations (PDF/email)
  - Auto-fill: hotel name, address, phone, email
  - Auto-suggest check-in/check-out times
  - Auto-link to transfer services (airport-hotel)

  **Transfer:**
  - Extract from booking confirmations
  - Auto-suggest pickup/dropoff based on:
    - Linked flights (airport codes)
    - Order hotels (addresses)
  - Auto-calculate duration based on distance
  - Auto-suggest pickup time based on flight arrival

  **Tour:**
  - Extract from tour operator confirmations
  - Auto-fill itinerary details
  - Auto-link to related services (hotels, transfers)

  **Insurance:**
  - Extract from policy documents
  - Auto-fill coverage details
  - Auto-calculate premium

  **Visa:**
  - Extract from visa documents
  - Auto-fill validity dates
  - Auto-link to related flights

- **AI Extracted Data Review Panel:**
  - Shows all extracted fields with confidence scores
  - "Accept all" button
  - "Edit" button for each field
  - "Re-extract" button (if confidence low)

**Actions:**
- **Save** (Ctrl+S): Save and stay in form (for adding multiple services)
- **Save & Close** (Ctrl+Enter): Save and close modal
- **Save & Add Another** (Ctrl+Shift+S): Save and reset form
- **Cancel** (Esc): Close without saving (with unsaved changes warning)

**Keyboard Shortcuts:**
- `Ctrl+N`: New service
- `Ctrl+S`: Save
- `Ctrl+Enter`: Save & close
- `Ctrl+Shift+S`: Save & add another
- `Esc`: Cancel
- `Ctrl+V`: Paste and extract
- `Ctrl+/`: Voice input
- `Tab`: Navigate fields
- `Shift+Tab`: Navigate backwards

### Screen 2: Bulk Import Wizard

**Entry Point:**
- "Bulk Import" button in services table
- "Import from email" button in Add Service modal

**Steps:**

**Step 1: Select Source**
- Upload multiple files (PDFs, images)
- Paste multiple email confirmations
- Select email folder (if email integration available)
- Connect supplier portal (if available)

**Step 2: AI Processing**
- Progress bar showing extraction progress
- List of detected services
- Confidence scores
- "Review all" button

**Step 3: Review & Edit**
- Table view of all extracted services
- Edit individual services
- Bulk actions: Set supplier, Set client, Set dates
- "Import selected" button

**Step 4: Import**
- Import progress
- Success/error summary
- "View imported services" button

### Screen 3: Quick Templates

**Entry Point:**
- "Templates" button in Add Service modal
- Quick template buttons in empty state

**Template Types:**
- **Common Flight Routes:** Pre-filled with popular routes
- **Standard Hotel:** Pre-filled with common hotel fields
- **Airport Transfer:** Pre-filled with common transfer fields
- **Tour Package:** Pre-filled with tour structure
- **Insurance Policy:** Pre-filled with common coverage

**Template Features:**
- Save custom templates
- Share templates with team
- AI-suggested templates based on order context

### Screen 4: Voice Input Interface

**Entry Point:**
- "Voice input" button in Add Service modal
- Keyboard shortcut: `Ctrl+/`

**UI States:**

**Recording State:**
- Large microphone icon (animated)
- "Listening..." indicator
- Real-time transcription display
- "Stop" button

**Processing State:**
- "Processing speech..." indicator
- Extracted fields preview

**Review State:**
- Extracted data in form
- "Edit" button
- "Accept" button

## 7. DATA MODEL (LOGICAL)

**Service Entity (Enhanced):**
- All existing fields (category, name, dates, supplier, client, payer, prices, status, ref_nr, ticket_nr)
- **New AI Fields:**
  - `ai_extraction_source` (email, pdf, image, voice, manual)
  - `ai_extraction_confidence` (0-100)
  - `ai_extracted_fields` (JSON: which fields were AI-extracted)
  - `ai_extraction_timestamp`
  - `ai_review_status` (pending, accepted, rejected, edited)

**Service Template Entity:**
- `template_name`
- `template_category`
- `template_fields` (JSON: pre-filled values)
- `is_shared` (boolean)
- `created_by` (user_id)
- `usage_count`

**AI Extraction Log:**
- `extraction_id`
- `service_id` (nullable, if service created)
- `extraction_source`
- `extraction_input` (text, file_url, etc.)
- `extraction_output` (JSON: extracted fields)
- `confidence_scores` (JSON: per-field confidence)
- `extraction_timestamp`
- `user_id`

## 8. BUSINESS RULES

### AI Extraction Rules:

**Confidence Thresholds:**
- **High confidence (≥80%):** Auto-fill field, show green highlight
- **Medium confidence (50-79%):** Show suggestion, require confirmation
- **Low confidence (<50%):** Show in review panel, require manual entry

**Field Priority:**
1. **Critical fields:** Service name, category, dates (require high confidence or manual entry)
2. **Important fields:** Supplier, prices (can use medium confidence)
3. **Optional fields:** Reference numbers, notes (can use any confidence)

**Extraction Sources Priority:**
1. Structured data (PDF confirmations, emails with booking details)
2. Semi-structured data (screenshots, images with text)
3. Unstructured data (voice input, free text)

### Validation Rules:

**Date Validation:**
- Service dates must be within order date range (warning if outside)
- Detect overlapping services (same category, same dates)
- Detect duplicate services (same supplier, same dates, same client)

**Price Validation:**
- Service price must be ≥ 0
- Client price must be ≥ service price (warning if lower)
- Margin must be within acceptable range (configurable per company)
- Currency must match order currency (warning if different)

**Required Fields by Category:**
- **Flight:** Service name, dates, at least one flight segment
- **Hotel:** Service name, dates, hotel name
- **Transfer:** Service name, dates, pickup location, dropoff location
- **Tour:** Service name, dates
- **Insurance:** Service name, dates, coverage details
- **Visa:** Service name, dates, validity dates

### Smart Suggestions Rules:

**Supplier Suggestions:**
- Prioritize suppliers with:
  - High ratings
  - Recent successful bookings
  - Existing relationship with client
  - Good rates for destination
  - Fast response times

**Price Suggestions:**
- Use supplier rate card (if available)
- Use historical prices (same supplier, same category, similar dates)
- Apply company margin rules
- Consider seasonal pricing

**Date Suggestions:**
- Suggest dates based on order dates
- Suggest dates based on linked services (e.g., transfer after flight arrival)
- Suggest dates based on client preferences (if available)

### Template Rules:

**Template Usage:**
- Templates pre-fill fields but allow editing
- Templates can include placeholders (e.g., `{client_name}`, `{order_dates}`)
- Templates can be category-specific or generic

**Template Sharing:**
- Company-level templates: visible to all users in company
- User-level templates: visible only to creator
- Shared templates: can be shared with specific users

## 9. FLOWS

### Flow 1: AI-Powered Service Addition from Email

1. User clicks "Add Service" → Modal opens
2. User clicks "Import from email" button
3. System shows email selector (if email integration available) or paste email text
4. User selects email or pastes email text
5. AI extracts service details:
   - Detects service type (flight, hotel, transfer, etc.)
   - Extracts dates, supplier, prices, reference numbers
   - Extracts category-specific details
6. System shows extracted data with confidence scores
7. User reviews extracted data:
   - Accepts high-confidence fields (green)
   - Confirms medium-confidence fields (yellow)
   - Edits low-confidence fields (red)
8. User clicks "Accept & Create"
9. System creates service with AI extraction metadata
10. Service appears in services table

### Flow 2: Quick Add with Voice Input

1. User clicks "Add Service" → Modal opens
2. User clicks "Voice input" button (or presses `Ctrl+/`)
3. System starts voice recording
4. User speaks: "Add flight service, Swiss Airlines, LX348, Geneva to London, January 15th, 10:30 AM departure, booked status, reference ABC123"
5. System processes speech and extracts:
   - Category: Flight
   - Supplier: Swiss Airlines
   - Flight number: LX348
   - Route: Geneva - London
   - Date: January 15th
   - Time: 10:30 AM
   - Status: Booked
   - Reference: ABC123
6. System shows extracted data in form
7. User reviews and edits if needed
8. User clicks "Save & Close"
9. Service is created

### Flow 3: Bulk Import from PDFs

1. User clicks "Bulk Import" button
2. System shows bulk import wizard
3. User uploads multiple PDF files (booking confirmations)
4. System processes each PDF with AI:
   - Extracts service details
   - Groups by service type
   - Shows confidence scores
5. System shows table of extracted services
6. User reviews and edits services:
   - Bulk edit: Set supplier for all flights
   - Bulk edit: Set client for all services
   - Individual edit: Fix incorrect extractions
7. User selects services to import
8. User clicks "Import Selected"
9. System creates all selected services
10. System shows import summary (success/errors)

### Flow 4: Smart Template Usage

1. User clicks "Add Service" → Modal opens
2. User clicks "Templates" button
3. System shows template selector with:
   - Common templates (Flight, Hotel, Transfer)
   - Recent templates
   - AI-suggested templates (based on order context)
4. User selects "Standard Hotel" template
5. System pre-fills form with template fields:
   - Category: Hotel
   - Common fields pre-filled
   - Placeholders replaced (e.g., `{order_dates}` → actual order dates)
6. User edits pre-filled fields as needed
7. User adds hotel-specific details
8. User clicks "Save & Close"
9. Service is created

### Flow 5: Drag & Drop Document Upload

1. User clicks "Add Service" → Modal opens
2. User drags PDF confirmation file to drop zone
3. System shows upload progress
4. System processes PDF with AI
5. System extracts service details
6. System shows extracted data in form
7. User reviews and confirms
8. User clicks "Save & Close"
9. Service is created

### Flow 6: Conflict Detection

1. User adds service with dates overlapping existing service
2. System detects conflict:
   - Same category
   - Overlapping dates
   - Same client
3. System shows warning:
   - "Warning: Overlapping dates with existing [Service Name]"
   - Shows conflicting service details
   - "View conflict" button
4. User reviews conflict
5. User either:
   - Adjusts dates to resolve conflict
   - Confirms duplicate (if intentional)
   - Cancels creation

## 10. AI INTEGRATION SPECIFICATIONS

### AI Endpoints:

**1. Extract Service from Email**
- **Endpoint:** `/api/ai/extract-service-from-email`
- **Method:** POST
- **Input:** Email text or email ID
- **Output:** Extracted service fields with confidence scores

**2. Extract Service from PDF**
- **Endpoint:** `/api/ai/extract-service-from-pdf` (existing, enhance)
- **Method:** POST
- **Input:** PDF file
- **Output:** Extracted service fields with confidence scores

**3. Extract Service from Image**
- **Endpoint:** `/api/ai/extract-service-from-image` (existing, enhance)
- **Method:** POST
- **Input:** Image file (screenshot, photo)
- **Output:** Extracted service fields with confidence scores

**4. Extract Service from Voice**
- **Endpoint:** `/api/ai/extract-service-from-voice`
- **Method:** POST
- **Input:** Audio file or transcription
- **Output:** Extracted service fields with confidence scores

**5. Suggest Supplier**
- **Endpoint:** `/api/ai/suggest-supplier`
- **Method:** POST
- **Input:** Category, destination, client_id, order_context
- **Output:** Ranked list of suggested suppliers with reasons

**6. Suggest Price**
- **Endpoint:** `/api/ai/suggest-price`
- **Method:** POST
- **Input:** Category, supplier_id, destination, dates, service_details
- **Output:** Suggested service price and client price with margin

**7. Detect Conflicts**
- **Endpoint:** `/api/ai/detect-conflicts`
- **Method:** POST
- **Input:** Service data, order_id
- **Output:** List of detected conflicts (overlaps, duplicates)

### AI Models & Services:

**For Text Extraction:**
- OpenAI GPT-4 Vision (for images/PDFs)
- OpenAI Whisper (for voice transcription)
- Custom fine-tuned model for travel confirmations

**For Suggestions:**
- OpenAI GPT-4 (for smart suggestions)
- Vector database (for supplier/catalog search)
- Historical data analysis (for price suggestions)

**For Validation:**
- Rule-based validation (dates, prices)
- ML-based anomaly detection (unusual prices, patterns)

## 11. ACCEPTANCE CRITERIA

**AC1: AI Extraction from Email**
- Given user pastes email confirmation, when AI processes email, then service fields are extracted with confidence scores ≥80% for critical fields
- Given extracted data, when user reviews and accepts, then service is created with AI extraction metadata

**AC2: Voice Input**
- Given user clicks voice input, when user speaks service details, then speech is transcribed and fields are extracted
- Given transcribed data, when user reviews and confirms, then service is created

**AC3: Bulk Import**
- Given user uploads multiple PDFs, when AI processes all PDFs, then multiple services are extracted and shown in review table
- Given review table, when user selects services and imports, then all selected services are created

**AC4: Smart Suggestions**
- Given user selects category and destination, when system suggests suppliers, then suggestions are ranked by relevance (ratings, history, rates)
- Given user enters supplier and dates, when system suggests prices, then prices are based on supplier rate card or historical data

**AC5: Conflict Detection**
- Given user adds service with overlapping dates, when system detects conflict, then warning is shown with conflicting service details
- Given conflict warning, when user adjusts dates, then conflict is resolved

**AC6: Template System**
- Given user selects template, when template is applied, then form is pre-filled with template fields
- Given pre-filled form, when user edits and saves, then service is created with template metadata

**AC7: Keyboard Shortcuts**
- Given user presses `Ctrl+N`, when focus is on services table, then Add Service modal opens
- Given user presses `Ctrl+S` in form, when form is valid, then service is saved
- Given user presses `Ctrl+Enter` in form, when form is valid, then service is saved and modal closes

**AC8: Drag & Drop**
- Given user drags PDF file to drop zone, when file is dropped, then PDF is processed and service fields are extracted
- Given extracted fields, when user confirms, then service is created

## 12. OPEN QUESTIONS

**1. AI Service Provider:**
- Which AI service to use? (OpenAI, Anthropic, Google, self-hosted)
- What are the cost implications?
- What are the rate limits?
- What is the latency?

**2. Email Integration:**
- How to integrate with email providers? (Gmail, Outlook, IMAP)
- How to handle authentication?
- How to handle privacy/security?
- Should email integration be optional?

**3. Voice Input:**
- Which voice service to use? (OpenAI Whisper, Google Speech-to-Text, Azure)
- Should voice input be real-time or post-recording?
- How to handle multiple languages?
- What are the accuracy requirements?

**4. Supplier Rate Cards:**
- How to access supplier rate cards? (API, manual upload, scraping)
- How to keep rate cards up-to-date?
- Should rate cards be company-specific or global?

**5. Template System:**
- Should templates be user-created or system-provided?
- How to handle template versioning?
- Should templates support conditional logic?

**6. Bulk Import Limits:**
- What is the maximum number of services per bulk import?
- What is the maximum file size per PDF?
- How to handle import failures?

**7. Conflict Resolution:**
- Should conflicts be blocking or warnings?
- How to handle intentional duplicates?
- Should system auto-resolve conflicts?

**8. Price Validation:**
- What are acceptable margin ranges? (configurable per company?)
- Should price validation be blocking or warnings?
- How to handle currency conversion?

## 13. FUTURE EXTENSIONS

**NOT PART OF CURRENT TASK - DO NOT IMPLEMENT:**

- Real-time supplier API integration
- Advanced workflow automation
- Mobile app support
- Multi-language support
- Advanced analytics and reporting
- Integration with payment systems
- Integration with accounting systems
- Advanced document management
- Supplier portal integration
- Client portal integration

---

SPEC COMPLETE — READY FOR ARCHITECT REVIEW

