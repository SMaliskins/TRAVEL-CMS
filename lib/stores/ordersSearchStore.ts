"use client";

export interface OrdersSearchState {
  queryText: string;
  agentId: string | "all";
  country: string;
  status: string | "all";
  orderType: string | "all";
  delegatedToMe: boolean;
  checkIn: { from?: string; to?: string }; // ISO date YYYY-MM-DD
  return: { from?: string; to?: string };
  hotelName: string;
  clientLastName: string;
  refNr: string;
}

const STORAGE_KEY = "travelcms.orders.search";

const DEFAULT_STATE: OrdersSearchState = {
  queryText: "",
  agentId: "all",
  country: "",
  status: "all",
  orderType: "all",
  delegatedToMe: false,
  checkIn: {},
  return: {},
  hotelName: "",
  clientLastName: "",
  refNr: "",
};

type Listener = (state: OrdersSearchState) => void;

class OrdersSearchStore {
  private state: OrdersSearchState;
  private listeners: Set<Listener> = new Set();
  private isMounted = false;

  constructor() {
    this.state = DEFAULT_STATE;
  }

  init() {
    if (typeof window === "undefined" || this.isMounted) return;
    this.isMounted = true;
    this.loadFromStorage();
  }

  private loadFromStorage() {
    if (typeof window === "undefined") return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.state = { ...DEFAULT_STATE, ...parsed };
        this.notifyListeners();
      }
    } catch (e) {
      console.error("Failed to load orders search state from localStorage", e);
    }
  }

  private saveToStorage() {
    if (typeof window === "undefined" || !this.isMounted) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error("Failed to save orders search state to localStorage", e);
    }
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.state));
  }

  getState(): OrdersSearchState {
    return { ...this.state };
  }

  setField<K extends keyof OrdersSearchState>(
    key: K,
    value: OrdersSearchState[K]
  ) {
    this.state = { ...this.state, [key]: value };
    this.saveToStorage();
    this.notifyListeners();
  }

  applyPatch(patch: Partial<OrdersSearchState>) {
    this.state = { ...this.state, ...patch };
    this.saveToStorage();
    this.notifyListeners();
  }

  reset() {
    this.state = { ...DEFAULT_STATE };
    this.saveToStorage();
    this.notifyListeners();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // Count active filters (non-empty, non-default values)
  countActiveFilters(): number {
    let count = 0;
    if (this.state.queryText) count++;
    if (this.state.agentId !== "all") count++;
    if (this.state.country) count++;
    if (this.state.status !== "all") count++;
    if (this.state.orderType !== "all") count++;
    if (this.state.delegatedToMe) count++;
    if (this.state.checkIn.from || this.state.checkIn.to) count++;
    if (this.state.return.from || this.state.return.to) count++;
    if (this.state.hotelName) count++;
    if (this.state.clientLastName) count++;
    if (this.state.refNr) count++;
    return count;
  }
}

// Singleton instance
const store = new OrdersSearchStore();

export default store;

