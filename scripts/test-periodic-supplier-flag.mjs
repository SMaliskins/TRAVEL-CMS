import assert from "node:assert/strict";
import {
  isPartyPeriodicSupplier,
  applyPeriodicSupplierBackfill,
} from "../lib/finances/periodicSupplierFlag.ts";

/**
 * A tiny stub of the Supabase client. Each `from(table)` call records the
 * table name and returns a chainable object. Tests pre-load the responses
 * keyed by table name + operation.
 */
function makeStub(plan) {
  const log = [];
  function chainFor(table, op) {
    const calls = { table, op, eq: {}, in: {}, payload: undefined };
    log.push(calls);
    const chain = {
      select(_cols) {
        calls.select = _cols;
        return chain;
      },
      update(payload) {
        calls.payload = payload;
        return chain;
      },
      eq(col, value) {
        calls.eq[col] = value;
        return chain;
      },
      in(col, value) {
        calls.in[col] = value;
        return chain;
      },
      maybeSingle() {
        const key = `${table}:${op}:single`;
        const entry = plan[key];
        if (!entry) throw new Error(`Stub missing plan entry: ${key}`);
        return Promise.resolve(entry);
      },
      then(resolve, reject) {
        const key = `${table}:${op}`;
        const entry = plan[key];
        if (!entry) {
          return reject(new Error(`Stub missing plan entry: ${key}`));
        }
        return resolve(entry);
      },
    };
    return chain;
  }
  return {
    log,
    from(table) {
      // We use op = "select" by default; .update() switches via payload.
      let currentOp = "select";
      const proxy = new Proxy(chainFor(table, currentOp), {
        get(target, prop) {
          if (prop === "update") {
            currentOp = "update";
            const next = chainFor(table, currentOp);
            return (payload) => next.update(payload);
          }
          return target[prop];
        },
      });
      return proxy;
    },
  };
}

// Test 1: isPartyPeriodicSupplier returns true when row exists with flag.
{
  const stub = makeStub({
    "party:select:single": { data: { id: "p1", is_periodic_supplier: true }, error: null },
  });
  const ok = await isPartyPeriodicSupplier(stub, "co1", "p1");
  assert.equal(ok, true);
}

// Test 2: isPartyPeriodicSupplier returns false when flag false.
{
  const stub = makeStub({
    "party:select:single": { data: { id: "p1", is_periodic_supplier: false }, error: null },
  });
  const ok = await isPartyPeriodicSupplier(stub, "co1", "p1");
  assert.equal(ok, false);
}

// Test 3: isPartyPeriodicSupplier handles missing partyId / companyId without DB call.
{
  const stub = makeStub({});
  assert.equal(await isPartyPeriodicSupplier(stub, "co1", null), false);
  assert.equal(await isPartyPeriodicSupplier(stub, "", "p1"), false);
  assert.equal(stub.log.length, 0, "Should short-circuit with no DB call");
}

// Test 4: isPartyPeriodicSupplier fails closed on DB error.
{
  const stub = makeStub({
    "party:select:single": { data: null, error: { message: "boom" } },
  });
  const ok = await isPartyPeriodicSupplier(stub, "co1", "p1");
  assert.equal(ok, false);
}

// Test 5: applyPeriodicSupplierBackfill returns 0/0 when no candidates.
{
  const stub = makeStub({
    "order_services:select": { data: [], error: null },
  });
  const res = await applyPeriodicSupplierBackfill(stub, "co1", "p1");
  assert.deepEqual(res, { servicesUpdated: 0, ordersAffected: 0 });
}

// Test 6: applyPeriodicSupplierBackfill skips services that are already linked
//         to a non-deleted supplier-invoice document.
{
  const stub = makeStub({
    "order_services:select": {
      data: [
        { id: "svc-a", order_id: "o1" },
        { id: "svc-b", order_id: "o1" },
        { id: "svc-c", order_id: "o2" },
      ],
      error: null,
    },
    "order_document_service_links:select": {
      data: [
        { service_id: "svc-b", order_documents: { document_state: "active" } },
        { service_id: "svc-c", order_documents: { document_state: "deleted" } },
      ],
      error: null,
    },
    "order_services:update": { data: null, error: null },
  });
  const res = await applyPeriodicSupplierBackfill(stub, "co1", "p1");
  // svc-a (no link) and svc-c (deleted link) should be updated; svc-b skipped.
  assert.equal(res.servicesUpdated, 2);
  assert.equal(res.ordersAffected, 2);
  const updateCall = stub.log.find((c) => c.op === "update");
  assert.ok(updateCall, "expected an update call");
  assert.deepEqual(
    [...(updateCall.in.id || [])].sort(),
    ["svc-a", "svc-c"],
    "update should target unlinked services only"
  );
  assert.deepEqual(updateCall.payload, { supplier_invoice_requirement: "periodic" });
  assert.equal(updateCall.eq.company_id, "co1", "tenant scope must be applied");
}

// Test 7: backfill returns 0/0 when every candidate is already linked.
{
  const stub = makeStub({
    "order_services:select": {
      data: [{ id: "svc-a", order_id: "o1" }],
      error: null,
    },
    "order_document_service_links:select": {
      data: [{ service_id: "svc-a", order_documents: { document_state: "active" } }],
      error: null,
    },
  });
  const res = await applyPeriodicSupplierBackfill(stub, "co1", "p1");
  assert.deepEqual(res, { servicesUpdated: 0, ordersAffected: 0 });
}

console.log("[test-periodic-supplier-flag] all tests passed");
