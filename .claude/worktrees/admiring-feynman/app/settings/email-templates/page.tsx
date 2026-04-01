"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, Plus, Mail, FileText, Bell, Hotel, Users, Heart,
  Link2, Pencil, Trash2, X, Check, Star, Loader2,
} from "lucide-react";
import dynamic from "next/dynamic";

const RichTextEditor = dynamic(() => import("@/components/RichTextEditor"), { ssr: false });

interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { slug: "invoice", label: "Invoices", icon: FileText, description: "Send invoices to clients" },
  { slug: "payment_reminder", label: "Payment Reminders", icon: Bell, description: "Remind clients about pending payments" },
  { slug: "hotel", label: "Hotel Confirmations", icon: Hotel, description: "Send booking confirmations to hotels" },
  { slug: "client_reminder", label: "Client Reminders", icon: Users, description: "Reminders for check-in, documents, etc." },
  { slug: "self_reminder", label: "Internal Reminders", icon: Bell, description: "Notes and reminders for your team" },
  { slug: "birthday", label: "Greetings", icon: Heart, description: "Birthdays, holidays, special occasions" },
  { slug: "partner_notification", label: "Partner Notifications", icon: Link2, description: "Notify partners about service changes" },
  { slug: "custom", label: "Custom", icon: Mail, description: "Any other email template" },
];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.slug, c]));

const VARIABLES_HELP = [
  { var: "{{client_name}}", desc: "Client full name" },
  { var: "{{order_code}}", desc: "Order code" },
  { var: "{{invoice_number}}", desc: "Invoice number" },
  { var: "{{total_amount}}", desc: "Total amount" },
  { var: "{{due_date}}", desc: "Payment due date" },
  { var: "{{service_name}}", desc: "Service name" },
  { var: "{{dates}}", desc: "Service dates" },
  { var: "{{hotel_name}}", desc: "Hotel name" },
  { var: "{{company_name}}", desc: "Your company name" },
  { var: "{{agent_name}}", desc: "Agent name" },
];

export default function EmailTemplatesPage() {
  const role = useCurrentUserRole();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("custom");
  const [formSubject, setFormSubject] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formDefault, setFormDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  useEffect(() => {
    if (role && role !== "supervisor" && role !== "admin" && role !== "director" && role !== "manager") {
      router.push("/settings");
    }
  }, [role, router]);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/settings/email-templates", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setTemplates(data.templates || []);
      }
    } catch {
      setError("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const openNewForm = (category?: string) => {
    setIsNew(true);
    setEditingTemplate(null);
    setFormName("");
    setFormCategory(category || "custom");
    setFormSubject("");
    setFormBody("");
    setFormDefault(false);
  };

  const openEditForm = (t: EmailTemplate) => {
    setIsNew(false);
    setEditingTemplate(t);
    setFormName(t.name);
    setFormCategory(t.category);
    setFormSubject(t.subject);
    setFormBody(t.body);
    setFormDefault(t.is_default);
  };

  const closeForm = () => {
    setEditingTemplate(null);
    setIsNew(false);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      setError("Template name is required");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const payload = {
        id: editingTemplate?.id,
        name: formName.trim(),
        category: formCategory,
        subject: formSubject,
        bodyHtml: formBody,
        is_default: formDefault,
      };

      const res = await fetch("/api/settings/email-templates", {
        method: isNew ? "POST" : "PATCH",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      setSuccessMsg(isNew ? "Template created" : "Template updated");
      closeForm();
      fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this template?")) return;

    try {
      setDeletingId(id);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`/api/settings/email-templates?id=${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }

      setSuccessMsg("Template deleted");
      if (editingTemplate?.id === id) closeForm();
      fetchTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const handleEditorImageUpload = async (): Promise<string | null> => {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) { resolve(null); return; }
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) { resolve(null); return; }
          const fd = new FormData();
          fd.append("file", file);
          const res = await fetch("/api/upload-avatar", {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: fd,
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          resolve(data.url);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Image upload failed");
          resolve(null);
        }
      };
      input.click();
    });
  };

  const filteredTemplates = filterCategory
    ? templates.filter((t) => t.category === filterCategory)
    : templates;

  const groupedTemplates = filteredTemplates.reduce<Record<string, EmailTemplate[]>>((groups, t) => {
    const cat = t.category || "custom";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(t);
    return groups;
  }, {});

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  const isFormOpen = isNew || editingTemplate !== null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/settings" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
              <Mail size={24} className="text-blue-600" />
              Email Templates
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Create reusable templates for invoices, reminders, hotel emails, and more
            </p>
          </div>
        </div>
        <button
          onClick={() => openNewForm()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
          New Template
        </button>
      </div>

      {successMsg && (
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700 flex items-center gap-2">
          <Check size={14} />
          {successMsg}
          <button onClick={() => setSuccessMsg(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-center gap-2">
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterCategory(null)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
            !filterCategory ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          All ({templates.length})
        </button>
        {CATEGORIES.map((cat) => {
          const count = templates.filter((t) => t.category === cat.slug).length;
          return (
            <button
              key={cat.slug}
              onClick={() => setFilterCategory(filterCategory === cat.slug ? null : cat.slug)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filterCategory === cat.slug
                  ? "bg-blue-100 text-blue-700"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      <div className={`grid gap-6 ${isFormOpen ? "lg:grid-cols-2" : "lg:grid-cols-1"}`}>
        {/* Templates List */}
        <div className="space-y-4">
          {templates.length === 0 && (
            <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
              <Mail size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No templates yet</p>
              <p className="text-sm text-gray-400 mt-1 mb-4">Create your first email template to speed up communication</p>
              <div className="flex flex-wrap justify-center gap-2">
                {CATEGORIES.slice(0, 4).map((cat) => (
                  <button
                    key={cat.slug}
                    onClick={() => openNewForm(cat.slug)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-sm text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    <cat.icon size={14} />
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {Object.entries(groupedTemplates).map(([category, catTemplates]) => {
            const catMeta = CATEGORY_MAP[category] || { label: category, icon: Mail };
            const CatIcon = catMeta.icon;
            return (
              <div key={category}>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <CatIcon size={12} />
                  {catMeta.label}
                </h3>
                <div className="space-y-2">
                  {catTemplates.map((t) => (
                    <div
                      key={t.id}
                      className={`rounded-lg border bg-white p-4 shadow-sm cursor-pointer transition-all hover:border-blue-200 ${
                        editingTemplate?.id === t.id ? "border-blue-400 ring-1 ring-blue-100" : "border-gray-200"
                      }`}
                      onClick={() => openEditForm(t)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-gray-900 truncate">{t.name}</span>
                          {t.is_default && (
                            <span className="shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-700">
                              <Star size={9} /> DEFAULT
                            </span>
                          )}
                          {!t.is_active && (
                            <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
                              DISABLED
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={(e) => { e.stopPropagation(); openEditForm(t); }}
                            className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(t.id); }}
                            disabled={deletingId === t.id}
                            className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          >
                            {deletingId === t.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </button>
                        </div>
                      </div>
                      {t.subject && (
                        <p className="text-sm text-gray-500 mt-1 truncate">Subject: {t.subject}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Edit / Create Form */}
        {isFormOpen && (
          <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm h-fit sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">
                {isNew ? "New Template" : "Edit Template"}
              </h3>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Template Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Hotel Booking Confirmation"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.slug} value={cat.slug}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subject Line</label>
                <input
                  type="text"
                  value={formSubject}
                  onChange={(e) => setFormSubject(e.target.value)}
                  placeholder="e.g. Invoice {{invoice_number}} — {{company_name}}"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Body</label>
                <RichTextEditor
                  content={formBody}
                  onChange={setFormBody}
                  placeholder="Start typing your email template..."
                  onImageUpload={handleEditorImageUpload}
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formDefault}
                  onChange={(e) => setFormDefault(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Set as default for this category</span>
              </label>

              {/* Variables Help */}
              <details className="rounded-lg border border-gray-100 bg-gray-50">
                <summary className="px-3 py-2 text-xs font-medium text-gray-600 cursor-pointer">
                  Available variables
                </summary>
                <div className="px-3 pb-3 grid grid-cols-2 gap-1">
                  {VARIABLES_HELP.map((v) => (
                    <div key={v.var} className="flex items-start gap-1.5 text-xs">
                      <code className="bg-white px-1 py-0.5 rounded text-blue-700 font-mono shrink-0">{v.var}</code>
                      <span className="text-gray-500">{v.desc}</span>
                    </div>
                  ))}
                </div>
              </details>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving..." : isNew ? "Create Template" : "Save Changes"}
                </button>
                <button
                  onClick={closeForm}
                  className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
