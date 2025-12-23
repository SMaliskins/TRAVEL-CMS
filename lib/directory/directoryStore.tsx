"use client";

import React, { createContext, useContext, useReducer, useState, ReactNode } from "react";
import { DirectoryRecord } from "@/lib/types/directory";
import { fetchWithAuth } from "@/lib/http/fetchWithAuth";

interface DirectoryState {
  records: DirectoryRecord[];
}

type DirectoryAction =
  | { type: "SET_RECORDS"; payload: DirectoryRecord[] }
  | { type: "CREATE_RECORD"; payload: DirectoryRecord }
  | { type: "UPDATE_RECORD"; payload: { id: string; patch: Partial<DirectoryRecord> } }
  | { type: "DELETE_RECORD"; payload: string };

function directoryReducer(state: DirectoryState, action: DirectoryAction): DirectoryState {
  switch (action.type) {
    case "SET_RECORDS":
      return { records: action.payload };
    case "CREATE_RECORD":
      return { records: [...state.records, action.payload] };
    case "UPDATE_RECORD":
      return {
        records: state.records.map((r) =>
          r.id === action.payload.id ? { ...r, ...action.payload.patch } : r
        ),
      };
    case "DELETE_RECORD":
      return { records: state.records.filter((r) => r.id !== action.payload) };
    default:
      return state;
  }
}

const initialState: DirectoryState = { records: [] };

interface DirectoryContextType {
  state: DirectoryState;
  createRecord: (record: Omit<DirectoryRecord, "id" | "createdAt">) => Promise<DirectoryRecord>;
  updateRecord: (id: string, patch: Partial<DirectoryRecord>) => void;
  getRecordById: (id: string) => DirectoryRecord | undefined;
}

const DirectoryContext = createContext<DirectoryContextType | undefined>(undefined);

export function DirectoryProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(directoryReducer, initialState);
  const [isLoading, setIsLoading] = useState(true);

  const createRecord = async (recordData: Omit<DirectoryRecord, "id" | "createdAt">): Promise<DirectoryRecord> => {
    try {
      const response = await fetchWithAuth("/api/directory/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(recordData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      if (!data.ok || !data.record) {
        throw new Error("Failed to create record: Invalid response");
      }

      const newRecord = data.record as DirectoryRecord;
      dispatch({ type: "CREATE_RECORD", payload: newRecord });
      return newRecord;
    } catch (error) {
      console.error("Error creating directory record:", error);
      throw error;
    }
  };

  const updateRecord = (id: string, patch: Partial<DirectoryRecord>) => {
    dispatch({ type: "UPDATE_RECORD", payload: { id, patch } });
  };

  const getRecordById = (id: string): DirectoryRecord | undefined => {
    return state.records.find((record) => record.id === id);
  };

  return (
    <DirectoryContext.Provider
      value={{
        state,
        createRecord,
        updateRecord,
        getRecordById,
      }}
    >
      {children}
    </DirectoryContext.Provider>
  );
}

export function useDirectoryStore() {
  const context = useContext(DirectoryContext);
  if (!context) {
    throw new Error("useDirectoryStore must be used within DirectoryProvider");
  }
  return context;
}
