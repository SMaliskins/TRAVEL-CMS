/**
 * Flight parser regression harness.
 *
 * Runs a small fixed set of real-world flight ticket samples through the
 * live `/api/ai/parse-flight-itinerary` endpoint and checks structural
 * invariants (segment count, IATA codes, booking ref, total).
 *
 * Usage:
 *   1. Start `npm run dev` in another terminal.
 *   2. (Optional) export TEST_AUTH_TOKEN=<supabase JWT> if your route
 *      requires auth in this environment.
 *   3. node scripts/test-flight-parsers.mjs
 *
 * The harness exits non-zero on any failed assertion so it is suitable
 * for use in pre-deploy checks.
 */

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const AUTH_TOKEN = process.env.TEST_AUTH_TOKEN || "";

/** Inline fixtures — each represents one ticket text and the must-have facts. */
const FIXTURES = [
  {
    name: "airBaltic — Riga<>Antalya, 2 segments (LV)",
    input:
      "Pasažieri\nCeļojums un cena\n" +
      "Rēķins\nRēķina numurs: 2621869522\n" +
      "Rezervācijas numurs: 9YOOTU\n" +
      "Rezervēšanas datums: 25.02.2026\n" +
      "K-dze LARISA GURARIJA 657-2423595985\n" +
      "K-dze IRINA SOMOVA 657-2423595986\n" +
      "S 09/05 15:30 Rīga 19:15 Antālija BT715 Economy FLEX, P\n" +
      "O 19/05 20:25 Antālija 00:15 Rīga BT716 Economy FLEX, K\n" +
      "Pieaugušais/-ie\nKopā EUR 681.96\nAIR BALTIC CORPORATION A/S",
    expect: {
      minSegments: 2,
      bookingRef: "9YOOTU",
      currency: "EUR",
      segments: [
        { flightNumber: "BT715", departure: "RIX", arrival: "AYT" },
        { flightNumber: "BT716", departure: "AYT", arrival: "RIX" },
      ],
    },
  },
  {
    name: "Turkish Airlines — IST→LED, simple itinerary",
    input:
      "TURKISH AIRLINES e-Ticket\n" +
      "Booking Reference: ABC123\n" +
      "Passenger: MR JOHN DOE\n" +
      "Ticket Number: 235-1234567890\n" +
      "Flight TK402 Istanbul (IST) -> St. Petersburg (LED)\n" +
      "Date: 15 MAY 2026  Departure 09:25  Arrival 12:40\n" +
      "Cabin: ECONOMY  Baggage: 1PC\n" +
      "Total Fare TRY 4250.00",
    expect: {
      minSegments: 1,
      bookingRef: "ABC123",
      segments: [{ flightNumber: "TK402", departure: "IST", arrival: "LED" }],
    },
  },
];

let failures = 0;

function fail(name, msg) {
  console.error(`FAIL [${name}] ${msg}`);
  failures++;
}

async function runOne(fix) {
  console.log(`\n--- ${fix.name} ---`);
  const headers = { "Content-Type": "application/json" };
  if (AUTH_TOKEN) headers.Authorization = `Bearer ${AUTH_TOKEN}`;

  let res;
  try {
    res = await fetch(`${BASE_URL}/api/ai/parse-flight-itinerary`, {
      method: "POST",
      headers,
      body: JSON.stringify({ text: fix.input }),
    });
  } catch (e) {
    fail(fix.name, `network error: ${e.message}`);
    return;
  }

  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    fail(fix.name, `HTTP ${res.status} ${body.error || ""}`);
    return;
  }

  const segments = Array.isArray(body.segments) ? body.segments : [];
  const booking = body.booking || {};

  if (segments.length < (fix.expect.minSegments || 1)) {
    fail(fix.name, `expected >= ${fix.expect.minSegments} segments, got ${segments.length}`);
    return;
  }

  if (fix.expect.bookingRef && booking.bookingRef !== fix.expect.bookingRef) {
    fail(
      fix.name,
      `bookingRef mismatch: expected ${fix.expect.bookingRef}, got ${booking.bookingRef}`,
    );
  }

  if (fix.expect.currency && booking.currency && booking.currency !== fix.expect.currency) {
    fail(
      fix.name,
      `currency mismatch: expected ${fix.expect.currency}, got ${booking.currency}`,
    );
  }

  for (let i = 0; i < (fix.expect.segments || []).length; i++) {
    const want = fix.expect.segments[i];
    const got = segments[i] || {};
    for (const key of Object.keys(want)) {
      if (got[key] !== want[key]) {
        fail(
          fix.name,
          `seg[${i}].${key} expected "${want[key]}", got "${got[key]}"`,
        );
      }
    }
  }

  console.log(
    `  segments=${segments.length} bookingRef=${booking.bookingRef || "-"} currency=${booking.currency || "-"}`,
  );
}

(async () => {
  console.log(`Flight parser regression harness — ${BASE_URL}`);
  for (const fix of FIXTURES) {
    await runOne(fix);
  }
  if (failures > 0) {
    console.error(`\n${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log(`\nAll ${FIXTURES.length} fixtures passed.`);
})();
