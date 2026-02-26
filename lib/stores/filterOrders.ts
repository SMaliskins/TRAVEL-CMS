import { OrdersSearchState } from "./ordersSearchStore";

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
  access: AccessType;
  updated: string;
  createdAt?: string;
  invoiceCount?: number;
  dueDate?: string;
}

export interface FilterOrdersOptions {
  /** Order codes from semantic search - when provided with queryText, include these orders even if text doesn't match */
  semanticOrderCodes?: string[];
}

/**
 * Filter orders based on search state
 */
export function filterOrders(
  orders: OrderRow[],
  searchState: OrdersSearchState,
  options?: FilterOrdersOptions
): OrderRow[] {
  const { semanticOrderCodes = [] } = options || {};
  const semanticSet = new Set(semanticOrderCodes);

  return orders.filter((order) => {
    // Query text search (case-insensitive, searches in orderId, client name, refNr if exists)
    // When semanticOrderCodes provided, also include orders whose orderId is in that set
    if (searchState.queryText) {
      const query = searchState.queryText.toLowerCase();
      const matchesOrderId = order.orderId.toLowerCase().includes(query);
      const matchesClient = order.client.toLowerCase().includes(query);
      const matchesSemantic = semanticSet.size > 0 && semanticSet.has(order.orderId);
      if (!matchesOrderId && !matchesClient && !matchesSemantic) {
        return false;
      }
    }

    // Client last name
    if (searchState.clientLastName) {
      const lastName = order.client.split(" ").pop()?.toLowerCase() || "";
      if (!lastName.includes(searchState.clientLastName.toLowerCase())) {
        return false;
      }
    }

    // Agent/Owner
    if (searchState.agentId !== "all") {
      if (order.owner !== searchState.agentId) {
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

    // Hotel name (TODO: would need to check services if available)
    // For now, skip this filter

    // RefNr (TODO: would need to be added to OrderRow interface)
    // For now, skip this filter

    return true;
  });
}

