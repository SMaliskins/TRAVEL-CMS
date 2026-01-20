"use client";

import { useFontScale } from "@/hooks/useFontScale";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useClock } from "@/hooks/useClock";
import { getGmtOffsetLabel } from "@/utils/timezone";

// City/Timezone options
const TIMEZONE_OPTIONS = [
  { cityLabel: "Riga", timezone: "Europe/Riga" },
  { cityLabel: "London", timezone: "Europe/London" },
  { cityLabel: "Berlin", timezone: "Europe/Berlin" },
  { cityLabel: "Paris", timezone: "Europe/Paris" },
  { cityLabel: "Rome", timezone: "Europe/Rome" },
  { cityLabel: "Madrid", timezone: "Europe/Madrid" },
  { cityLabel: "Dubai", timezone: "Asia/Dubai" },
  { cityLabel: "New York", timezone: "America/New_York" },
  { cityLabel: "Los Angeles", timezone: "America/Los_Angeles" },
];

// Currency options
const CURRENCY_OPTIONS = [
  { code: "EUR", name: "EUR" },
  { code: "USD", name: "USD" },
  { code: "GBP", name: "GBP" },
  { code: "SEPARATOR", name: "────────" },
  { code: "AED", name: "AED" },
  { code: "CAD", name: "CAD" },
  { code: "CHF", name: "CHF" },
  { code: "CNY", name: "CNY" },
  { code: "DKK", name: "DKK" },
  { code: "JPY", name: "JPY" },
  { code: "NOK", name: "NOK" },
  { code: "PLN", name: "PLN" },
  { code: "SEK", name: "SEK" },
  { code: "TRY", name: "TRY" },
];

// Language options
const LANGUAGE_OPTIONS = [
  { code: "en", name: "English" },
  { code: "SEPARATOR", name: "────────" },
  { code: "de", name: "German" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "it", name: "Italian" },
  { code: "lv", name: "Latvian" },
  { code: "ru", name: "Russian" },
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

  const { prefs, updatePrefs, isMounted: prefsMounted } = useUserPreferences();
  const now = useClock();

  const sliderValue = getSliderValue();
  const scalePercentage = Math.round(scale * 100);

  if (!isClient || !prefsMounted) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  const handleTimezoneChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    try {
      const timezone = e.target.value;
      const option = TIMEZONE_OPTIONS.find((opt) => opt.timezone === timezone);
      if (option) {
        updatePrefs({
          timezone: option.timezone,
          cityLabel: option.cityLabel,
        });
      }
    } catch (error: unknown) {
      console.error("ERROR: Failed to update timezone:", error);
      const errorMsg = error instanceof Error ? error.message : error ? String(error) : "Unknown error";
      alert(`Failed to update timezone: ${errorMsg || "Unknown error"}`);
    }
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    try {
      updatePrefs({ currency: e.target.value });
    } catch (error: unknown) {
      console.error("ERROR: Failed to update currency:", error);
      const errorMsg = error instanceof Error ? error.message : error ? String(error) : "Unknown error";
      alert(`Failed to update currency: ${errorMsg || "Unknown error"}`);
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    try {
      updatePrefs({ language: e.target.value });
    } catch (error: unknown) {
      console.error("ERROR: Failed to update language:", error);
      const errorMsg = error instanceof Error ? error.message : error ? String(error) : "Unknown error";
      alert(`Failed to update language: ${errorMsg || "Unknown error"}`);
    }
  };

  // Get current time in selected timezone for preview
  const timeFormatter = new Intl.DateTimeFormat(prefs.language, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: prefs.timezone,
  });
  
  const previewTime = timeFormatter.format(now);
  const gmtOffset = getGmtOffsetLabel(prefs.timezone, now);

  return (
    <div className="bg-gray-50 p-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 rounded-t-lg px-6 py-4 shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        </div>

        {/* Localization Section */}
        <div className="rounded-lg bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Localization
            </h2>
          </div>

          <div className="px-6 py-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* City / Timezone */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  City / Timezone
                </label>
                <select
                  value={prefs.timezone}
                  onChange={handleTimezoneChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                >
                  {TIMEZONE_OPTIONS.map((opt) => {
                    const offset = getGmtOffsetLabel(opt.timezone, now);
                    return (
                      <option key={opt.timezone} value={opt.timezone}>
                        {opt.cityLabel} — {offset}
                      </option>
                    );
                  })}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {previewTime} ({gmtOffset})
                </p>
              </div>

              {/* Base Currency */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  Base Currency
                </label>
                <select
                  value={prefs.currency}
                  onChange={handleCurrencyChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                >
                  {CURRENCY_OPTIONS.map((opt) => (
                    <option
                      key={opt.code}
                      value={opt.code}
                      disabled={opt.code === "SEPARATOR"}
                    >
                      {opt.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  Current: {prefs.currency}
                </p>
              </div>

              {/* System Language */}
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  System Language
                </label>
                <select
                  value={prefs.language}
                  onChange={handleLanguageChange}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
                >
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <option
                      key={opt.code}
                      value={opt.code}
                      disabled={opt.code === "SEPARATOR"}
                    >
                      {opt.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-400">
                  Current: {LANGUAGE_OPTIONS.find((l) => l.code === prefs.language)?.name || prefs.language}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Accessibility Section */}
        <div className="rounded-lg bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Accessibility
            </h2>
          </div>

          <div className="px-6 py-6">
            <div className="space-y-6">
              {/* Font Size Control */}
              <div>
                <label className="mb-3 block text-sm font-medium text-gray-700">
                  Font Size
                </label>
                <div className="space-y-4">
                  {/* Radio buttons */}
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="font-size"
                        value="0"
                        checked={sliderValue === 0}
                        onChange={(e) => setScaleFromSlider(Number(e.target.value))}
                        className="h-4 w-4 border-gray-300 text-gray-900 focus:ring-gray-900"
                      />
                      <span className="text-sm text-gray-700">Small</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="font-size"
                        value="1"
                        checked={sliderValue === 1}
                        onChange={(e) => setScaleFromSlider(Number(e.target.value))}
                        className="h-4 w-4 border-gray-300 text-gray-900 focus:ring-gray-900"
                      />
                      <span className="text-sm text-gray-700">Default</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="font-size"
                        value="2"
                        checked={sliderValue === 2}
                        onChange={(e) => setScaleFromSlider(Number(e.target.value))}
                        className="h-4 w-4 border-gray-300 text-gray-900 focus:ring-gray-900"
                      />
                      <span className="text-sm text-gray-700">Large</span>
                    </label>
                  </div>

                  {/* Slider */}
                  <div className="space-y-2">
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="1"
                      value={sliderValue}
                      onChange={(e) => setScaleFromSlider(Number(e.target.value))}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-gray-900"
                      style={{
                        background: `linear-gradient(to right, #111 0%, #111 ${(sliderValue / 2) * 100}%, #e5e7eb ${(sliderValue / 2) * 100}%, #e5e7eb 100%)`,
                      }}
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{Math.round(MIN_SCALE * 100)}%</span>
                      <span>{Math.round(DEFAULT_SCALE * 100)}%</span>
                      <span>{Math.round(MAX_SCALE * 100)}%</span>
                    </div>
                    <div className="text-center text-sm text-gray-600">
                      Current: {scalePercentage}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Section */}
        <div className="mt-6 rounded-lg bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-semibold text-gray-700">
            Preview
          </h3>
          <div className="space-y-2">
            <h4 className="text-lg font-semibold text-gray-900">
              Heading Example
            </h4>
            <p className="text-base text-gray-700">
              This is a paragraph of text that demonstrates how the font size
              affects readability. You can adjust the slider above to see the
              changes in real-time.
            </p>
            <p className="text-sm text-gray-600">
              This is smaller text, typically used for captions or secondary
              information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

