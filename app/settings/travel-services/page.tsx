"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";

// Functional types that determine which features are available for a category
// These are internal types - the "name" can be anything user wants
type CategoryType = 'flight' | 'hotel' | 'transfer' | 'tour' | 'insurance' | 'visa' | 'rent_a_car' | 'cruise' | 'other';

const CATEGORY_TYPES: { value: CategoryType; label: string }[] = [
  { value: 'flight', label: 'Flight (with parsing, boarding passes)' },
  { value: 'hotel', label: 'Hotel (with room details, preferences)' },
  { value: 'transfer', label: 'Transfer (with pickup/dropoff)' },
  { value: 'tour', label: 'Tour' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'visa', label: 'Visa' },
  { value: 'rent_a_car', label: 'Rent a Car' },
  { value: 'cruise', label: 'Cruise' },
  { value: 'other', label: 'Other' },
];

interface TravelServiceCategory {
  id: string;
  name: string;
  type: CategoryType;
  vat_rate: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function TravelServicesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<TravelServiceCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState<TravelServiceCategory | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryType, setNewCategoryType] = useState<CategoryType>('other');
  const [newCategoryVat, setNewCategoryVat] = useState<number>(0);

  const fetchCategories = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push("/login");
        return;
      }

      const response = await fetch("/api/travel-service-categories", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      } else {
        const err = await response.json();
        setError(err.error || "Failed to load categories");
      }
    } catch (err) {
      console.error("Load categories error:", err);
      setError("Network error");
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleStartEdit = (category: TravelServiceCategory) => {
    setEditingId(category.id);
    setEditingCategory({ ...category });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingCategory(null);
    fetchCategories(); // Reload to reset any changes
  };

  const handleSave = async () => {
    if (!editingCategory) {
      console.error("No editingCategory to save");
      return;
    }

    console.log("Saving category:", editingCategory);

    try {
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError("Not authenticated");
        return;
      }

      const categoryId = encodeURIComponent(editingCategory.id);
      const url = `/api/travel-service-categories/${categoryId}`;
      console.log("Saving to URL:", url, "Category:", editingCategory);

      const response = await fetch(url, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          name: editingCategory.name,
          type: editingCategory.type,
          vat_rate: editingCategory.vat_rate,
          is_active: editingCategory.is_active,
        }),
      });

      if (response.ok) {
        setEditingId(null);
        setEditingCategory(null);
        setSuccess("Category updated successfully");
        setTimeout(() => setSuccess(null), 3000);
        await fetchCategories();
      } else {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Save failed:", err, "Status:", response.status);
        const errorMessage = err.error || `Failed to update category (${response.status})`;
        setError(errorMessage);
        setTimeout(() => setError(null), 5000);
      }
    } catch (err) {
      console.error("Save error:", err);
      setError("Network error");
    }
  };

  const handleToggleActive = async (category: TravelServiceCategory) => {
    try {
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(`/api/travel-service-categories/${category.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          is_active: !category.is_active,
        }),
      });

      if (response.ok) {
        setSuccess(`Category ${!category.is_active ? 'activated' : 'deactivated'} successfully`);
        setTimeout(() => setSuccess(null), 3000);
        fetchCategories();
      } else {
        const err = await response.json();
        setError(err.error || "Failed to update category");
      }
    } catch (err) {
      console.error("Toggle active error:", err);
      setError("Network error");
    }
  };

  const handleAdd = async () => {
    if (!newCategoryName.trim()) {
      setError("Category name is required");
      return;
    }

    try {
      setError(null);
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch("/api/travel-service-categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          name: newCategoryName.trim(),
          type: newCategoryType,
          vat_rate: newCategoryVat,
        }),
      });

      if (response.ok) {
        setNewCategoryName("");
        setNewCategoryType('other');
        setNewCategoryVat(0);
        setSuccess("Category added successfully");
        setTimeout(() => setSuccess(null), 3000);
        fetchCategories();
      } else {
        const err = await response.json();
        setError(err.error || "Failed to add category");
      }
    } catch (err) {
      console.error("Add error:", err);
      setError("Network error");
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 rounded-t-lg px-6 py-4 shadow-sm flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Travel Services</h1>
            <p className="text-sm text-gray-500 mt-1">Manage travel service categories and VAT rates</p>
          </div>
          <Link
            href="/settings"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            ← Back to Settings
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-400 rounded-lg p-4 text-red-800 text-sm font-medium shadow-sm">
            <div className="flex items-center justify-between">
              <span>⚠️ {error}</span>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800 font-bold text-lg"
                aria-label="Close error"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 text-sm">
            {success}
          </div>
        )}

        {/* Main Content - Two Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Categories List - Left Column (2/3) */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Service Categories</h2>
          {categories.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No categories found. Add your first category above.
            </div>
          ) : (
            <div className="max-w-2xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Category</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">Type</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-700">VAT Rate (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr
                      key={category.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                        editingId === category.id ? "bg-blue-50/50" : ""
                      } ${!category.is_active ? "opacity-60" : ""}`}
                      onDoubleClick={() => editingId !== category.id && handleStartEdit(category)}
                      title="Double-click row to edit"
                    >
                      <td className="py-2 px-3">
                        {editingId === category.id && editingCategory ? (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="text"
                              value={editingCategory.name}
                              onChange={(e) => setEditingCategory(prev => prev ? { ...prev, name: e.target.value } : null)}
                              className="flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                              autoFocus
                              aria-label="Category Name"
                            />
                            <label className="flex items-center gap-1.5 text-xs text-gray-600 whitespace-nowrap">
                              <input
                                type="checkbox"
                                checked={editingCategory.is_active}
                                onChange={(e) => setEditingCategory(prev => prev ? { ...prev, is_active: e.target.checked } : null)}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                              />
                              Active
                            </label>
                            <button
                              type="button"
                              onClick={async (e) => { 
                                e.stopPropagation();
                                e.preventDefault();
                                if (editingCategory) {
                                  await handleSave();
                                }
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-blue-700"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={(e) => { 
                                e.stopPropagation();
                                e.preventDefault();
                                handleCancelEdit();
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className={`font-medium ${category.is_active ? "text-gray-900" : "text-gray-400"}`}>
                            {category.name}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {editingId === category.id && editingCategory ? (
                          <select
                            value={editingCategory.type || 'other'}
                            onChange={(e) => setEditingCategory(prev => prev ? { ...prev, type: e.target.value as CategoryType } : null)}
                            className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            onClick={(e) => e.stopPropagation()}
                            title="Category Type"
                          >
                            {CATEGORY_TYPES.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`text-xs px-2 py-1 rounded-full ${category.is_active ? "bg-gray-100 text-gray-700" : "bg-gray-50 text-gray-400"}`}>
                            {CATEGORY_TYPES.find(t => t.value === category.type)?.label.split(' ')[0] || category.type || 'other'}
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        {editingId === category.id && editingCategory ? (
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={editingCategory.vat_rate}
                            onChange={(e) => setEditingCategory(prev => prev ? { ...prev, vat_rate: parseFloat(e.target.value) || 0 } : null)}
                            className="w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            aria-label="VAT Rate"
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className={category.is_active ? "text-gray-600" : "text-gray-400"}>
                            {category.vat_rate}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          </div>

          {/* Add New Category - Right Column (1/3) */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Category</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category Name</label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="e.g., Авиабилеты, Hotels"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Functional Type</label>
                <select
                  value={newCategoryType}
                  onChange={(e) => setNewCategoryType(e.target.value as CategoryType)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  title="Functional Type"
                >
                  {CATEGORY_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Determines which features are available (parsing, special fields, etc.)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">VAT Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={newCategoryVat}
                  onChange={(e) => setNewCategoryVat(parseFloat(e.target.value) || 0)}
                  placeholder="21"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <button
                onClick={handleAdd}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
              >
                Add Category
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
