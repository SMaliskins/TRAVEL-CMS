import { create } from "zustand";

export interface DirectorySearchState {
  name: string;
  personalCode: string;
  phone: string;
  email: string;
  role: "all" | "client" | "supplier" | "subagent";
  type: "all" | "person" | "company";
  isActive: "all" | "active" | "inactive";
}

interface DirectorySearchStore extends DirectorySearchState {
  setName: (name: string) => void;
  setPersonalCode: (code: string) => void;
  setPhone: (phone: string) => void;
  setEmail: (email: string) => void;
  setRole: (role: DirectorySearchState["role"]) => void;
  setType: (type: DirectorySearchState["type"]) => void;
  setIsActive: (isActive: DirectorySearchState["isActive"]) => void;
  reset: () => void;
  init: () => void;
  countActiveFilters: () => number;
}

const initialState: DirectorySearchState = {
  name: "",
  personalCode: "",
  phone: "",
  email: "",
  role: "all",
  type: "all",
  isActive: "all",
};

const directorySearchStore = create<DirectorySearchStore>((set, get) => ({
  ...initialState,
  setName: (name) => set({ name }),
  setPersonalCode: (personalCode) => set({ personalCode }),
  setPhone: (phone) => set({ phone }),
  setEmail: (email) => set({ email }),
  setRole: (role) => set({ role }),
  setType: (type) => set({ type }),
  setIsActive: (isActive) => set({ isActive }),
  reset: () => set(initialState),
  init: () => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("travelcms.directory.search");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          set(parsed);
        } catch (e) {
          console.error("Failed to load directory search state", e);
        }
      }
    }
  },
  countActiveFilters: () => {
    const state = get();
    let count = 0;
    
    if (state.name.trim()) count++;
    if (state.personalCode.trim()) count++;
    if (state.phone.trim()) count++;
    if (state.email.trim()) count++;
    if (state.role !== "all") count++;
    if (state.type !== "all") count++;
    if (state.isActive !== "all") count++;
    
    return count;
  },
}));

// Persist to localStorage
directorySearchStore.subscribe((state) => {
  if (typeof window !== "undefined") {
    const { setName, setPersonalCode, setPhone, setEmail, setRole, setType, setIsActive, reset, init, ...persistState } = state;
    localStorage.setItem("travelcms.directory.search", JSON.stringify(persistState));
  }
});

export default directorySearchStore;
