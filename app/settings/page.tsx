"use client";

import Link from "next/link";
import { useFontScale } from "@/hooks/useFontScale";

const SETTINGS_SECTIONS = [
  { name: "Company", href: "/settings/company", icon: "🏢", description: "Company profile, licenses, banking, regional settings" },
  { name: "Users", href: "/settings/users", icon: "👥", description: "User management and roles" },
  { name: "Profile", href: "/settings/profile", icon: "👤", description: "Your personal settings" },
];

export default function SettingsPage() {
  const {
    scale,
    setScaleFromSlider,
    getSliderValue,
    MIN_SCALE,
    MAX_SCALE,
    DEFAULT_SCALE,
    isClient,
  } = useFontScale();

  const sliderValue = getSliderValue();
  const scalePercentage = Math.round(scale * 100);

  if (!isClient) {
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
        <div className="bg-white border-b border-gray-200 rounded-t-lg px-6 py-4 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        </div>

        {/* Settings Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {SETTINGS_SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="flex items-center gap-4 rounded-lg bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
            >
              <span className="text-2xl">{section.icon}</span>
              <div>
                <h3 className="font-medium text-gray-900">{section.name}</h3>
                <p className="text-sm text-gray-500">{section.description}</p>
              </div>
            </Link>
          ))}
        </div>

        {/* Accessibility Section */}
        <div className="rounded-lg bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Accessibility
            </h2>
          </div>

          <div className="px-6 py-6">
            <div className="max-w-md">
              {/* Font Scale */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">
                    Font Scale
                  </label>
                  <span className="text-sm text-gray-500">
                    {scalePercentage}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliderValue}
                  onChange={(e) =>
                    setScaleFromSlider(parseInt(e.target.value, 10))
                  }
                  className="w-full accent-blue-600"
                />
                <div className="mt-1 flex justify-between text-xs text-gray-400">
                  <span>{Math.round(MIN_SCALE * 100)}%</span>
                  <span>{Math.round(DEFAULT_SCALE * 100)}% (default)</span>
                  <span>{Math.round(MAX_SCALE * 100)}%</span>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Adjust the font size across the application. This setting is
                  saved in your browser.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
