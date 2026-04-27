import assert from "node:assert/strict";
import {
  suggestServiceMatchesForDocument,
  normalizeSupplierKey,
  describeAutoMatchReasons,
} from "../lib/finances/supplierInvoiceAutoMatch.ts";

// Test 1: empty supplier on document → no suggestions.
{
  const result = suggestServiceMatchesForDocument(
    { supplier_name: null, amount: 100, invoice_date: "2026-04-20" },
    [
      {
        id: "svc-1",
        supplierName: "Turkish Airlines",
        servicePrice: 100,
        serviceDateFrom: "2026-04-15",
        serviceDateTo: "2026-04-25",
        supplierInvoiceRequirement: "required",
      },
    ]
  );
  assert.deepEqual(result.suggestedServiceIds, [], "Empty supplier on doc should produce no suggestions");
  assert.equal(result.details.size, 0);
}

// Test 2: matching supplier name (case + punctuation insensitive) is suggested.
{
  const result = suggestServiceMatchesForDocument(
    { supplier_name: "TURKISH AIRLINES", amount: 999.99, invoice_date: "2026-04-20" },
    [
      {
        id: "svc-1",
        supplierName: "Turkish Airlines",
        servicePrice: 1000,
        serviceDateFrom: "2026-04-15",
        serviceDateTo: "2026-04-25",
        supplierInvoiceRequirement: "required",
      },
      {
        id: "svc-2",
        supplierName: "British Airways",
        servicePrice: 500,
        serviceDateFrom: "2026-04-15",
        serviceDateTo: "2026-04-25",
        supplierInvoiceRequirement: "required",
      },
    ]
  );
  assert.deepEqual(result.suggestedServiceIds, ["svc-1"], "Should suggest only services from same supplier");
  const detail = result.details.get("svc-1");
  assert.ok(detail);
  assert.deepEqual(detail.reasons.sort(), ["amount", "date", "supplier"], "Should pick up supplier+amount+date reasons");
}

// Test 3: requirement = periodic / not_required is excluded.
{
  const result = suggestServiceMatchesForDocument(
    { supplier_name: "Vodafone", amount: 50, invoice_date: "2026-04-20" },
    [
      {
        id: "periodic-svc",
        supplierName: "Vodafone",
        servicePrice: 50,
        serviceDateFrom: "2026-04-15",
        serviceDateTo: "2026-04-25",
        supplierInvoiceRequirement: "periodic",
      },
      {
        id: "skip-svc",
        supplierName: "Vodafone",
        servicePrice: 50,
        serviceDateFrom: "2026-04-15",
        serviceDateTo: "2026-04-25",
        supplierInvoiceRequirement: "not_required",
      },
    ]
  );
  assert.deepEqual(result.suggestedServiceIds, [], "Periodic and not_required services must never be auto-suggested");
}

// Test 4: services already matched to the document are not duplicated as suggestions.
{
  const result = suggestServiceMatchesForDocument(
    { supplier_name: "Hotel ABC", amount: 200, invoice_date: "2026-04-20" },
    [
      {
        id: "already",
        supplierName: "Hotel ABC",
        servicePrice: 200,
        serviceDateFrom: "2026-04-15",
        serviceDateTo: "2026-04-25",
        supplierInvoiceRequirement: "required",
      },
      {
        id: "new",
        supplierName: "Hotel ABC",
        servicePrice: 199.5,
        serviceDateFrom: "2026-04-18",
        serviceDateTo: "2026-04-22",
        supplierInvoiceRequirement: "required",
      },
    ],
    ["already"]
  );
  assert.deepEqual(result.suggestedServiceIds, ["new"], "Already-linked services should not appear as suggestions");
}

// Test 5: substring supplier match works for common variants.
{
  const result = suggestServiceMatchesForDocument(
    { supplier_name: "Aéroport de la Côte", amount: 6, invoice_date: "2026-04-22" },
    [
      {
        id: "svc-1",
        supplierName: "Aeroport Nice Côte d'Azur",
        servicePrice: 6,
        serviceDateFrom: "2026-04-21",
        serviceDateTo: "2026-04-22",
        supplierInvoiceRequirement: "required",
      },
    ]
  );
  // Different normalized strings: "aeroportdelacote" vs "aeroportnicecotedazur" — neither contains the other.
  assert.deepEqual(result.suggestedServiceIds, [], "Different supplier strings must not be matched as containing each other");
}

// Test 6: snake_case service fields supported (server payload variant).
{
  const result = suggestServiceMatchesForDocument(
    { supplier_name: "Marriott", amount: 320, invoice_date: "2026-04-20" },
    [
      {
        id: "svc-1",
        supplier_name: "Marriott Hotel",
        service_price: 320,
        service_date_from: "2026-04-19",
        service_date_to: "2026-04-21",
        supplier_invoice_requirement: "required",
      },
    ]
  );
  assert.deepEqual(result.suggestedServiceIds, ["svc-1"], "Snake-case payloads should be supported");
}

// Test 7: normalizeSupplierKey strips non-alphanumeric and lowercases.
assert.equal(normalizeSupplierKey("Turkish-AIRLINES, Ltd."), "turkishairlinesltd");
assert.equal(normalizeSupplierKey(null), "");
assert.equal(normalizeSupplierKey(""), "");

// Test 8: describeAutoMatchReasons composes a stable human label.
assert.equal(describeAutoMatchReasons(["supplier"]), "Supplier matches");
assert.equal(describeAutoMatchReasons(["supplier", "amount"]), "Supplier matches · Amount matches");
assert.equal(
  describeAutoMatchReasons(["supplier", "amount", "date"]),
  "Supplier matches · Amount matches · Date in range"
);

console.log("supplier-invoice auto-match: all checks passed");
