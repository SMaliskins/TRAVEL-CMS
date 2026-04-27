import assert from "node:assert/strict";
import {
  getAppliedPaymentTotal,
  getEffectiveDueDate,
  summarizeOverdueDebt,
} from "../lib/finances/overdue.ts";

const invoices = [
  {
    id: "fully-covered-by-non-cancelled",
    total: 1000,
    due_date: "2026-04-01",
    final_payment_date: null,
  },
  {
    id: "final-date-wins",
    total: 500,
    due_date: "2026-03-01",
    final_payment_date: "2026-05-01",
  },
  {
    id: "real-overdue",
    total: 750,
    due_date: "2026-04-10",
    final_payment_date: null,
  },
  {
    id: "cancelled-payment-ignored",
    total: 300,
    due_date: "2026-04-15",
    final_payment_date: null,
  },
];

const paymentsByInvoice = {
  "fully-covered-by-non-cancelled": [
    { amount: 600, status: "completed" },
    { amount: 400, status: "pending" },
  ],
  "real-overdue": [
    { amount: 250, status: "completed" },
  ],
  "cancelled-payment-ignored": [
    { amount: 300, status: "cancelled" },
  ],
};

assert.equal(
  getAppliedPaymentTotal(paymentsByInvoice["fully-covered-by-non-cancelled"]),
  1000,
  "non-cancelled payments must reduce invoice debt"
);
assert.equal(
  getEffectiveDueDate(invoices[1]),
  "2026-05-01",
  "final_payment_date must override due_date for overdue checks"
);

const summary = summarizeOverdueDebt({
  invoices,
  paymentsByInvoice,
  today: "2026-04-27",
  periodStart: "2026-04-01",
  periodEnd: "2026-04-30",
});

assert.deepEqual(summary, {
  overdueAmount: 800,
  overdueInPeriodAmount: 800,
  overdueCount: 2,
  overdueInPeriodCount: 2,
});

console.log("Overdue calculation checks passed");
