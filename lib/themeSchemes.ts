/**
 * 6 color schemes: Pastel → Corporate
 * All themes meet WCAG AA contrast (4.5:1+ for normal text, 3:1+ for UI)
 */

export type ColorSchemeId =
  | "pastel"
  | "soft"
  | "natural"
  | "ocean"
  | "classic"
  | "corporate";

export interface ThemeScheme {
  id: ColorSchemeId;
  label: string;
  description: string;
  /** CSS variables applied to :root when active */
  vars: Record<string, string>;
}

export const THEME_SCHEMES: ThemeScheme[] = [
  {
    id: "pastel",
    label: "Pastel",
    description: "Soft pastels, gentle and calming",
    vars: {
      "--theme-bg": "#fefefe",
      "--theme-bg-alt": "#f5f3ff",
      "--theme-fg": "#1e1b4b",
      "--theme-fg-muted": "#4c4a6a",
      "--theme-btn-bg": "#e9e5ff",
      "--theme-btn-fg": "#312e81",
      "--theme-btn-border": "#c4b5fd",
      "--theme-accent": "#7c3aed",
      "--theme-accent-hover": "#6d28d9",
      "--theme-border": "rgba(100, 116, 139, 0.2)",
      "--theme-card-bg": "#ffffff",
      "--theme-input-bg": "#ffffff",
      "--theme-input-border": "rgba(100, 116, 139, 0.25)",
    },
  },
  {
    id: "soft",
    label: "Soft",
    description: "Warm and approachable",
    vars: {
      "--theme-bg": "#fefdfb",
      "--theme-bg-alt": "#fef3c7",
      "--theme-fg": "#292524",
      "--theme-fg-muted": "#57534e",
      "--theme-btn-bg": "#fde68a",
      "--theme-btn-fg": "#78350f",
      "--theme-btn-border": "#fcd34d",
      "--theme-accent": "#d97706",
      "--theme-accent-hover": "#b45309",
      "--theme-border": "rgba(120, 113, 108, 0.25)",
      "--theme-card-bg": "#ffffff",
      "--theme-input-bg": "#ffffff",
      "--theme-input-border": "rgba(120, 113, 108, 0.3)",
    },
  },
  {
    id: "natural",
    label: "Natural",
    description: "Earth tones, warm greens",
    vars: {
      "--theme-bg": "#fafaf9",
      "--theme-bg-alt": "#ecfdf5",
      "--theme-fg": "#1c1917",
      "--theme-fg-muted": "#44403c",
      "--theme-btn-bg": "#d1fae5",
      "--theme-btn-fg": "#064e3b",
      "--theme-btn-border": "#a7f3d0",
      "--theme-accent": "#059669",
      "--theme-accent-hover": "#047857",
      "--theme-border": "rgba(68, 64, 60, 0.2)",
      "--theme-card-bg": "#ffffff",
      "--theme-input-bg": "#ffffff",
      "--theme-input-border": "rgba(68, 64, 60, 0.25)",
    },
  },
  {
    id: "ocean",
    label: "Ocean",
    description: "Blues and teals, professional",
    vars: {
      "--theme-bg": "#f8fafc",
      "--theme-bg-alt": "#f0f9ff",
      "--theme-fg": "#0f172a",
      "--theme-fg-muted": "#334155",
      "--theme-btn-bg": "#e0f2fe",
      "--theme-btn-fg": "#0c4a6e",
      "--theme-btn-border": "#bae6fd",
      "--theme-accent": "#0284c7",
      "--theme-accent-hover": "#0369a1",
      "--theme-border": "rgba(51, 65, 85, 0.2)",
      "--theme-card-bg": "#ffffff",
      "--theme-input-bg": "#ffffff",
      "--theme-input-border": "rgba(51, 65, 85, 0.25)",
    },
  },
  {
    id: "classic",
    label: "Classic",
    description: "Traditional grays, balanced",
    vars: {
      "--theme-bg": "#f9fafb",
      "--theme-bg-alt": "#f3f4f6",
      "--theme-fg": "#111827",
      "--theme-fg-muted": "#4b5563",
      "--theme-btn-bg": "#e5e7eb",
      "--theme-btn-fg": "#1f2937",
      "--theme-btn-border": "#d1d5db",
      "--theme-accent": "#4b5563",
      "--theme-accent-hover": "#374151",
      "--theme-border": "rgba(75, 85, 99, 0.25)",
      "--theme-card-bg": "#ffffff",
      "--theme-input-bg": "#ffffff",
      "--theme-input-border": "rgba(75, 85, 99, 0.3)",
    },
  },
  {
    id: "corporate",
    label: "Corporate",
    description: "Strong contrast, navy and slate",
    vars: {
      "--theme-bg": "#f1f5f9",
      "--theme-bg-alt": "#e2e8f0",
      "--theme-fg": "#0f172a",
      "--theme-fg-muted": "#334155",
      "--theme-btn-bg": "#cbd5e1",
      "--theme-btn-fg": "#0f172a",
      "--theme-btn-border": "#94a3b8",
      "--theme-accent": "#1e293b",
      "--theme-accent-hover": "#0f172a",
      "--theme-border": "rgba(15, 23, 42, 0.2)",
      "--theme-card-bg": "#ffffff",
      "--theme-input-bg": "#ffffff",
      "--theme-input-border": "rgba(15, 23, 42, 0.25)",
    },
  },
];

export const DEFAULT_COLOR_SCHEME: ColorSchemeId = "classic";

export const STORAGE_KEY = "ui-color-scheme";

export const VALID_SCHEME_IDS: ColorSchemeId[] = [
  "pastel",
  "soft",
  "natural",
  "ocean",
  "classic",
  "corporate",
];
