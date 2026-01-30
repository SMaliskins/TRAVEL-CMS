"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Registration {
  id: string;
  status: string;
  companyData: {
    name: string;
    legal_name?: string;
    email?: string;
    country?: string;
    phone?: string;
  };
  usersData: Array<{
    email: string;
    name: string;
    role: string;
  }>;
  planName: string;
  submittedAt: string;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

export default function RegistrationsPage() {
  const router = useRouter();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [selectedRegistration, setSelectedRegistration] = useState<Registration | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    loadRegistrations();
  }, [activeTab]);

  const loadRegistrations = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/superadmin/registrations?status=${activeTab}`);
      if (!response.ok) {
        if (response.status === 401) {
          router.push("/superadmin/login");
          return;
        }
        throw new Error("Failed to load");
      }
      const data = await response.json();
      setRegistrations(data.registrations);
    } catch (error) {
      console.error("Failed to load registrations:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!confirm("Approve this registration? This will create the company and all users.")) {
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch(`/api/superadmin/registrations/${id}/approve`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to approve");
        return;
      }

      const passwordsText = data.users?.length
        ? data.users
            .map((u: { email: string; tempPassword: string }) => `  ${u.email} → ${u.tempPassword}`)
            .join("\n")
        : "";
      alert(
        `Company created successfully!\n\nUsers created: ${data.usersCreated}\n\n` +
          (passwordsText
            ? `Temporary passwords (save these - they won't be shown again):\n${passwordsText}`
            : "Temporary passwords have been generated. In production, these would be sent via email.")
      );
      
      setSelectedRegistration(null);
      loadRegistrations();
    } catch (error) {
      console.error("Approve error:", error);
      alert("Failed to approve registration");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (id: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch(`/api/superadmin/registrations/${id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });

      if (!response.ok) {
        const data = await response.json();
        alert(data.error || "Failed to reject");
        return;
      }

      setSelectedRegistration(null);
      setRejectReason("");
      loadRegistrations();
    } catch (error) {
      console.error("Reject error:", error);
      alert("Failed to reject registration");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Registrations</h1>
        <p className="text-slate-600">Review and approve company registration requests</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(["pending", "approved", "rejected"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === tab
                ? "bg-purple-600 text-white"
                : "bg-white text-slate-700 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            {tab === "pending" && registrations.length > 0 && activeTab === "pending" && (
              <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
                {registrations.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        ) : registrations.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No {activeTab} registrations
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {registrations.map((reg) => (
              <div
                key={reg.id}
                className="p-6 hover:bg-slate-50 cursor-pointer"
                onClick={() => setSelectedRegistration(reg)}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-slate-900">
                      {reg.companyData.name}
                    </h3>
                    <p className="text-sm text-slate-600">
                      {reg.companyData.email} • {reg.companyData.country || "No country"}
                    </p>
                    <p className="text-sm text-slate-500 mt-1">
                      {reg.usersData.length} user(s) • Plan: {reg.planName}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">
                      {new Date(reg.submittedAt).toLocaleDateString()}
                    </p>
                    {activeTab === "pending" && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRegistration(reg);
                        }}
                        className="mt-2 text-purple-600 hover:text-purple-700 text-sm font-medium"
                      >
                        Review →
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedRegistration && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">
                  Registration Details
                </h2>
                <button
                  onClick={() => setSelectedRegistration(null)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Company Info */}
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Company Information
                </h3>
                <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                  <p><span className="text-slate-500">Name:</span> <span className="font-medium">{selectedRegistration.companyData.name}</span></p>
                  {selectedRegistration.companyData.legal_name && (
                    <p><span className="text-slate-500">Legal Name:</span> {selectedRegistration.companyData.legal_name}</p>
                  )}
                  <p><span className="text-slate-500">Email:</span> {selectedRegistration.companyData.email}</p>
                  {selectedRegistration.companyData.phone && (
                    <p><span className="text-slate-500">Phone:</span> {selectedRegistration.companyData.phone}</p>
                  )}
                  {selectedRegistration.companyData.country && (
                    <p><span className="text-slate-500">Country:</span> {selectedRegistration.companyData.country}</p>
                  )}
                  <p><span className="text-slate-500">Plan:</span> {selectedRegistration.planName}</p>
                </div>
              </div>

              {/* Users */}
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                  Users ({selectedRegistration.usersData.length})
                </h3>
                <div className="bg-slate-50 rounded-lg divide-y divide-slate-200">
                  {selectedRegistration.usersData.map((user, i) => (
                    <div key={i} className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{user.name}</p>
                        <p className="text-sm text-slate-600">{user.email}</p>
                      </div>
                      <span className="px-2 py-1 bg-slate-200 text-slate-700 text-xs font-medium rounded capitalize">
                        {user.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Rejection Reason (if rejected) */}
              {selectedRegistration.status === "rejected" && selectedRegistration.rejectionReason && (
                <div>
                  <h3 className="text-sm font-semibold text-red-500 uppercase tracking-wider mb-3">
                    Rejection Reason
                  </h3>
                  <p className="bg-red-50 p-4 rounded-lg text-red-700">
                    {selectedRegistration.rejectionReason}
                  </p>
                </div>
              )}

              {/* Actions */}
              {selectedRegistration.status === "pending" && (
                <div className="space-y-4 pt-4 border-t border-slate-200">
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleApprove(selectedRegistration.id)}
                      disabled={isProcessing}
                      className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-medium rounded-lg transition"
                    >
                      {isProcessing ? "Processing..." : "Approve & Create Company"}
                    </button>
                  </div>

                  <div className="space-y-2">
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection (optional)"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                      rows={2}
                    />
                    <button
                      onClick={() => handleReject(selectedRegistration.id)}
                      disabled={isProcessing}
                      className="w-full py-2 bg-red-100 hover:bg-red-200 disabled:bg-red-50 text-red-700 font-medium rounded-lg transition"
                    >
                      Reject Registration
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
