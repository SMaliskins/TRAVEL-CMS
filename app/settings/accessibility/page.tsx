"use client";

import { useFontScale, SCALE_PRESETS, FONT_PRESETS } from "@/hooks/useFontScale";
import Link from "next/link";

export default function AccessibilityPage() {
  const {
    scale,
    setScalePreset,
    getCurrentPresetIndex,
    fontFamily,
    setFontFamily,
    resetFont,
    isClient,
  } = useFontScale();

  const currentPresetIndex = getCurrentPresetIndex();
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
        <div className="bg-white border-b border-gray-200 rounded-t-lg px-6 py-4 shadow-sm flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Accessibility</h1>
            <p className="text-sm text-gray-500 mt-1">Customize font size and font family for better readability</p>
          </div>
          <Link
            href="/settings"
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            ← Back to Settings
          </Link>
        </div>

        {/* Accessibility Section */}
        <div className="rounded-lg bg-white shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Accessibility Settings
            </h2>
            <button
              onClick={resetFont}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Reset to defaults
            </button>
          </div>

          <div className="px-6 py-6 space-y-8">
            {/* Font Scale - 5 presets */}
            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Font Size
                </label>
                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                  {scalePercentage}%
                </span>
              </div>
              
              {/* Preset buttons */}
              <div className="grid grid-cols-5 gap-2">
                {SCALE_PRESETS.map((preset, index) => (
                  <button
                    key={preset.value}
                    onClick={() => setScalePreset(index)}
                    className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                      currentPresetIndex === index
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    <span 
                      className="font-medium mb-1"
                      style={{ fontSize: `${preset.value * 14}px` }}
                    >
                      Aa
                    </span>
                    <span className="text-xs">{preset.label}</span>
                  </button>
                ))}
              </div>
              
              <p className="mt-3 text-xs text-gray-500">
                Adjust the font size across the application. This setting is saved in your browser.
              </p>
            </div>

            {/* Font Family */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Font Family
              </label>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {FONT_PRESETS.map((font) => (
                  <button
                    key={font.value}
                    onClick={() => setFontFamily(font.value)}
                    className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                      fontFamily === font.value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                    style={{ fontFamily: font.css }}
                  >
                    <span className="text-lg font-medium mb-1">Aa</span>
                    <span className="text-xs">{font.label}</span>
                  </button>
                ))}
              </div>
              
              <p className="mt-3 text-xs text-gray-500">
                Choose your preferred font. Some fonts require Google Fonts to be loaded.
              </p>
            </div>

            {/* Preview */}
            <div className="border-t border-gray-200 pt-6">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Preview
              </label>
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200">
                <h3 className="text-lg font-semibold mb-2">Sample Heading</h3>
                <p className="text-sm text-gray-600 mb-2">
                  This is how your text will look with the current settings. 
                  The quick brown fox jumps over the lazy dog.
                </p>
                <div className="flex gap-2 text-xs">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">Tag</span>
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded">Status</span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded">Label</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
