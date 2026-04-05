import { OrdersSearchState } from "./ordersSearchStore";
import { getSearchPatterns, matchesLooseTextQuery, matchesSearch } from "@/lib/directory/searchNormalize";

// Types matching orders/page.tsx
type OrderStatus = "Draft" | "Active" | "Cancelled" | "Completed" | "On hold";
type OrderType = "TA" | "TO" | "CORP" | "NON";
type AccessType = "Owner" | "Delegated";

// Interface for filtering - matches OrderRow from orders/page.tsx
// This should match the OrderRow interface in app/orders/page.tsx
export interface OrderRow {
  orderId: string;
  client: string;
  countriesCities: string;
  datesFrom: string;
  datesTo: string;
  amount: number;
  paid: number;
  debt: number;
  vat: number;
  profit: number;
  status: OrderStatus;
  type: OrderType;
  owner: string;
  ownerId: string;
  access: AccessType;
  updated: string;
  createdAt?: string;
  invoiceCount?: number;
  dueDate?: string;
  payers?: string[];
  /** Names for list search: service line client_name + travellers (order / service-linked) */
  serviceClients?: string[];
}

export interface FilterOrdersOptions {
  /** Order codes from semantic search - when provided with queryText, include these orders even if text doesn't match */
  semanticOrderCodes?: string[];
  /**
   * When true, the list API already narrowed rows with `search` (ilike on order code + lead client name).
   * Skip client-side queryText matching to avoid stripping valid server rows (fuzzy rules differ).
   */
  skipClientQueryTextMatch?: boolean;
}

/**
 * Filter orders based on search state
 */
export function filterOrders(
  orders: OrderRow[],
  searchState: OrdersSearchState,
  options?: FilterOrdersOptions
): OrderRow[] {
  const { semanticOrderCodes = [], skipClientQueryTextMatch = false } = options || {};
  const semanticSet = new Set(semanticOrderCodes);

  // Pre-compute search patterns once (expensive)
  const surnamePatterns = searchState.clientLastName
    ? getSearchPatterns(searchState.clientLastName)
    : null;

  return orders.filter((order) => {
    // Query text search (case-insensitive, searches in orderId, client name, refNr if exists)
    // When semanticOrderCodes provided, also include orders whose orderId is in that set
    if (searchState.queryText && !skipClientQueryTextMatch) {
      const query = searchState.queryText.trim();
      const matchesOrderId = matchesLooseTextQuery(order.orderId, query, { fuzzy: false });
      const matchesClient = matchesLooseTextQuery(order.client, query);
      const matchesServiceClient = (order.serviceClients || []).some((c) =>
        matchesLooseTextQuery(c, query)
      );
      const matchesPayer = (order.payers || []).some((p) => matchesLooseTextQuery(p, query));
      const matchesSemantic = semanticSet.size > 0 && semanticSet.has(order.orderId);
      if (
        !matchesOrderId &&
        !matchesClient &&
        !matchesServiceClient &&
        !matchesPayer &&
        !matchesSemantic
      ) {
        return false;
      }
    }

    // Client / Payer surname search with layout + diacritics + typo tolerance
    if (surnamePatterns) {
      const matchClient = matchesSearch(order.client, surnamePatterns);
      const matchPayer = (order.payers || []).some(p => matchesSearch(p, surnamePatterns));
      const matchServiceClient = (order.serviceClients || []).some((c) =>
        matchesSearch(c, surnamePatterns)
      );
      if (!matchClient && !matchPayer && !matchServiceClient) {
        return false;
      }
    }

    // Agent/Owner — match by ownerId (UUID) or owner name
    if (searchState.agentId !== "all") {
      if (order.ownerId !== searchState.agentId && order.owner !== searchState.agentId) {
        return false;
      }
    }

    // Country (contains in countriesCities)
    if (searchState.country) {
      if (
        !order.countriesCities
          .toLowerCase()
          .includes(searchState.country.toLowerCase())
      ) {
        return false;
      }
    }

    // Status
    if (searchState.status !== "all") {
      if (order.status !== searchState.status) {
        return false;
      }
    }

    // Order Type
    if (searchState.orderType !== "all") {
      if (order.type !== searchState.orderType) {
        return false;
      }
    }

    // Delegated to me
    if (searchState.delegatedToMe) {
      if (order.access !== "Delegated") {
        return false;
      }
    }

    // Check-in date range
    if (searchState.checkIn.from || searchState.checkIn.to) {
      const orderStart = order.datesFrom;
      const orderEnd = order.datesTo;
      const filterFrom = searchState.checkIn.from || "0000-01-01";
      const filterTo = searchState.checkIn.to || "9999-12-31";

      // Check if date ranges overlap
      // Ranges overlap if: orderStart <= filterTo && orderEnd >= filterFrom
      if (!(orderStart <= filterTo && orderEnd >= filterFrom)) {
        return false;
      }
    }

    // Return date range
    if (searchState.return.from || searchState.return.to) {
      const orderStart = order.datesFrom;
      const orderEnd = order.datesTo;
      const filterFrom = searchState.return.from || "0000-01-01";
      const filterTo = searchState.return.to || "9999-12-31";

      if (!(orderStart <= filterTo && orderEnd >= filterFrom)) {
        return false;
      }
    }

    // Created at date range
    if (searchState.createdAt?.from || searchState.createdAt?.to) {
      const created = (order.createdAt || order.updated || "").slice(0, 10);
      if (!created) return false;
      if (searchState.createdAt.from && created < searchState.createdAt.from) return false;
      if (searchState.createdAt.to && created > searchState.createdAt.to) return false;
    }

    return true;
  });
}

