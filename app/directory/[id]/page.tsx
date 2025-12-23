"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { DirectoryRecord } from "@/lib/types/directory";
import DirectoryForm, { DirectoryFormHandle } from "@/components/DirectoryForm";
import { useDirectoryStore } from "@/lib/directory/directoryStore";

export default function DirectoryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { getRecordById, updateRecord } = useDirectoryStore();
  const [record, setRecord] = useState<DirectoryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const formRef = useRef<DirectoryFormHandle | null>(null);

  useEffect(() => {
    // TODO: Load record from API
    const found = getRecordById(id);
    if (found) {
      setRecord(found);
    }
    setLoading(false);
  }, [id, getRecordById]);

  const handleSubmit = async (data: Partial<DirectoryRecord>, closeAfterSave: boolean) => {
    if (!record) return;
    
    updateRecord(record.id, data);
    
    if (closeAfterSave) {
      router.push("/directory");
    }
  };

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!record) {
    return <div className="p-6">Record not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <DirectoryForm
          ref={formRef as any}
          record={record}
          mode="edit"
          onSubmit={handleSubmit}
          onCancel={() => router.push("/directory")}
        />
      </div>
    </div>
  );
}

