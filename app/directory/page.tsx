"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DirectoryRecord } from "@/lib/types/directory";

export default function DirectoryPage() {
  const router = useRouter();
  const [records, setRecords] = useState<DirectoryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Load records from API
    setLoading(false);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Directory</h1>
          <button
            onClick={() => router.push("/directory/new")}
            className="rounded-lg bg-black px-6 py-2 text-white transition-colors hover:bg-gray-800"
          >
            New Record
          </button>
        </div>

        {loading ? (
          <p className="text-gray-600">Loading...</p>
        ) : (
          <div className="rounded-lg bg-white shadow-sm">
            <p className="p-4 text-gray-600">No records found.</p>
          </div>
        )}
      </div>
    </div>
  );
}

