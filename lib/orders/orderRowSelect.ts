/**
 * Minimal `orders` columns for single-order reads (bootstrap, GET by code) and
 * `buildExpandedOrderAndInvoiceSummary` input. Replaces `select("*")` (ORDER_PAGE_PERF B1).
 */
export const ORDER_ROW_DETAIL_SELECT = [
  "id",
  "company_id",
  "order_code",
  "order_number",
  "client_display_name",
  "client_party_id",
  "client_phone",
  "client_email",
  "countries_cities",
  "date_from",
  "date_to",
  "amount_total",
  "amount_paid",
  "amount_debt",
  "profit_estimated",
  "status",
  "order_type",
  "order_source",
  "owner_user_id",
  "manager_user_id",
  "created_by",
  "created_at",
  "updated_at",
  "client_payment_due_date",
  "referral_party_id",
  "referral_commission_confirmed",
  "referral_commission_confirmed_at",
  "referral_commission_confirmed_by",
].join(",");
