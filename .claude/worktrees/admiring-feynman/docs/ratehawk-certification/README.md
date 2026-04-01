# RateHawk Certification Readiness (MVP)

This pack maps the Hotels Booking MVP implementation to RateHawk certification expectations.

## Scope Covered

- CMS search and offer creation with markup (`/api/hotels/search`, `/api/hotels/offers`).
- Offer lifecycle and channels:
  - send from CMS (`/api/hotels/offers/[id]/send`)
  - client confirmation via app and email:
    - `/api/client/v1/hotels/offers`
    - `/api/client/v1/hotels/offers/[id]/confirm`
    - `/api/client/v1/hotels/offers/confirm-by-token`
- Dual payment flow:
  - online checkout (`/api/hotels/offers/[id]/pay` with `online`)
  - invoice/manual mode (`/api/hotels/offers/[id]/pay` with `invoice` + `/api/hotels/offers/[id]/confirm` action `invoice_paid`)
- Booking finalization service:
  - `lib/hotels/finalizeBooking.ts`
  - payment success callback: `/api/hotels/offers/payment-success`
- CMS audit/log visibility:
  - `/api/hotels/offers/[id]/events`
  - `app/hotels-booking/page.tsx` "Requests & Payments Log" tab

## Evidence Mapping Template

Use this table when pasting exported checklist items from RateHawk docs:

| Checklist Item | Endpoint / Screen | Test Evidence | Status |
| --- | --- | --- | --- |
| Example: Hotel search | `POST /api/hotels/search` | request/response JSON + screenshot | DONE |
| Example: Offer confirmation | `POST /api/client/v1/hotels/offers/[id]/confirm` | API log + UI screenshot | DONE |
| Example: Payment and booking | `POST /api/hotels/offers/[id]/pay`, `lib/hotels/finalizeBooking.ts` | Stripe session + event log trail | DONE |

## Test Credentials Policy

- Do not commit test credentials in repository files.
- Store credential references in environment management only:
  - `RATEHAWK_KEY_ID`
  - `RATEHAWK_API_KEY`
  - `STRIPE_SECRET_KEY`
  - `NEXT_PUBLIC_BASE_URL`
- For certification handoff, provide credentials via secure channel to auditors.

## Best-Practices Notes

- Offer keeps rate snapshot and policy fields (`tariff_type`, `cancellation_policy`) to reduce ambiguity at confirmation/payment stage.
- Single event log stream (`hotel_offer_events`) captures timeline from creation to booking result.
- Company scoping follows fallback strategy (`profiles` and `user_profiles`) to avoid tenant lookup drift.
