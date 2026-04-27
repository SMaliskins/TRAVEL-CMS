import assert from "node:assert/strict";

import {
  buildInvoiceLanguagePreferenceRequest,
  normalizeInvoiceLanguagePreference,
} from "../lib/invoices/invoiceLanguagePreference.ts";

assert.equal(normalizeInvoiceLanguagePreference(" LV "), "lv");
assert.equal(normalizeInvoiceLanguagePreference(""), null);
assert.equal(normalizeInvoiceLanguagePreference(null), null);

assert.deepEqual(buildInvoiceLanguagePreferenceRequest("client-1", "lv", "company"), {
  url: "/api/directory/client-1",
  init: {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "company", invoiceLanguage: "lv" }),
  },
});

assert.equal(buildInvoiceLanguagePreferenceRequest("", "lv", "company"), null);
assert.equal(buildInvoiceLanguagePreferenceRequest("client-1", "", "company"), null);
assert.equal(buildInvoiceLanguagePreferenceRequest("client-1", "lv", "supplier"), null);

console.log("Invoice language preference tests passed");
