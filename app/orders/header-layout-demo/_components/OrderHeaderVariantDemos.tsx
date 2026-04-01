"use client";

import { Calendar, Info, Trash2, User } from "lucide-react";

const DEMO_TAGS_LEISURE = ["Leisure", "Business", "Lifestyle"] as const;
const DEMO_TAGS_SOURCE = ["TA", "TO", "CORP", "NON"] as const;

/** Static copy for layout preview only */
export const DEMO = {
  orderCode: "0111/26-SM",
  status: "Active",
  createdLabel: "Created on 17.03.2026 by Sergej Malickins",
  clientName: "Grigorijs Gluskins",
  dateRange: "02.04.2026 – 13.04.2026",
  /** ISO dates for scoreboard-style blocks in variant E */
  dateFromIso: "2026-04-02",
  dateToIso: "2026-04-13",
  destinationLine: "Thailand (Bangkok) / KO (Samui, Thailand)",
  /** Compact route like variant D — flag + city → city */
  destinationCompact: "Bangkok → Samui",
  duration: "(12 days / 11 nights)",
  countdown: "2 days before trip",
  tagsLeisure: DEMO_TAGS_LEISURE,
  tagsSource: DEMO_TAGS_SOURCE,
  tags: [...DEMO_TAGS_LEISURE, ...DEMO_TAGS_SOURCE] as readonly string[],
  amount: "€29,260.00",
  payStatus: "Partially paid",
  payDetail: "Total (active services) €25,310.00 paid, €3,950.00 remaining",
};

function StatusBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
      {DEMO.status}
    </span>
  );
}

function PayBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900 ring-1 ring-inset ring-amber-500/30">
      {DEMO.payStatus}
    </span>
  );
}

function TagChips({ compact }: { compact?: boolean }) {
  const size = compact ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-xs";
  return (
    <div className="flex flex-wrap items-center gap-1">
      {DEMO.tags.map((t) => (
        <span
          key={t}
          className={`rounded-full font-medium ${size} ${
            t === "TA"
              ? "bg-blue-100 text-blue-800"
              : "bg-gray-100 text-gray-700"
          }`}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

/** Variant A — two compact rows */
export function HeaderVariantA() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 truncate">{DEMO.orderCode}</h1>
          <StatusBadge />
          <button
            type="button"
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600"
            aria-label="Delete (demo)"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="text-right min-w-0">
          <div className="text-xl font-bold text-gray-900">{DEMO.amount}</div>
          <div className="flex flex-wrap items-center justify-end gap-2 mt-0.5">
            <PayBadge />
          </div>
          <p className="text-[11px] text-gray-500 mt-1 max-w-md ml-auto leading-snug">{DEMO.payDetail}</p>
        </div>
      </div>
      <p className="text-xs text-gray-500">{DEMO.createdLabel}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-800 border-t border-gray-100 pt-2">
        <span className="inline-flex items-center gap-1 shrink-0" title="Lead passenger">
          <User className="h-4 w-4 text-gray-400" aria-hidden />
          <span className="font-semibold text-blue-600">{DEMO.clientName}</span>
        </span>
        <span className="text-gray-300 hidden sm:inline">·</span>
        <span className="inline-flex items-center gap-1 min-w-0">
          <Calendar className="h-4 w-4 text-gray-400 shrink-0" aria-hidden />
          <span className="truncate">{DEMO.dateRange}</span>
        </span>
        <span className="text-gray-300 hidden sm:inline">·</span>
        <span className="inline-flex items-center gap-1 min-w-0">
          <span
            className="fi fi-th inline-block h-4 w-5 shrink-0 rounded-sm bg-cover bg-center"
            title="Thailand"
            aria-hidden
          />
          <span className="font-medium truncate">{DEMO.destinationLine}</span>
          <span className="text-gray-500 whitespace-nowrap">{DEMO.duration}</span>
        </span>
        <span className="sm:ml-auto">
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800">
            {DEMO.countdown}
          </span>
        </span>
      </div>
      <div className="pt-1">
        <TagChips compact />
      </div>
    </div>
  );
}

/** Variant B — left stack + right money column */
export function HeaderVariantB() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-start gap-4">
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{DEMO.orderCode}</h1>
            <StatusBadge />
            <button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-100" aria-label="Delete (demo)">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-gray-500">{DEMO.createdLabel}</p>
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 shrink-0 rounded-full bg-blue-100 text-sm font-semibold text-blue-800 flex items-center justify-center">
              GG
            </div>
            <div className="min-w-0 space-y-1">
              <div className="text-[10px] text-gray-400 uppercase tracking-wider">Lead passenger</div>
              <div className="font-semibold text-blue-600">{DEMO.clientName}</div>
              <div className="text-sm text-gray-600 inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {DEMO.dateRange}
              </div>
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-0.5">Destination</div>
            <div className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-gray-900">
              <span className="fi fi-th inline-block h-4 w-5 rounded-sm bg-cover bg-center" aria-hidden />
              <span>{DEMO.destinationLine}</span>
              <span className="text-gray-500 font-normal text-xs">{DEMO.duration}</span>
            </div>
            <p className="text-xs text-sky-700 mt-1">{DEMO.countdown}</p>
          </div>
          <TagChips />
        </div>
        <div className="w-full lg:w-56 shrink-0 rounded-lg border border-gray-100 bg-gray-50/80 p-3 space-y-2">
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Totals</div>
          <div className="text-2xl font-bold text-gray-900">{DEMO.amount}</div>
          <PayBadge />
          <p className="text-[11px] text-gray-600 leading-snug">{DEMO.payDetail}</p>
        </div>
      </div>
    </div>
  );
}

/** Variant C — title row + 2×2 grid */
export function HeaderVariantC() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg sm:text-xl font-bold text-gray-900">{DEMO.orderCode}</h1>
          <StatusBadge />
          <button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-100" aria-label="Delete (demo)">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
        >
          <Info className="h-3.5 w-3.5" />
          Details
        </button>
      </div>
      <p className="text-xs text-gray-500 -mt-1">{DEMO.createdLabel}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-gray-100 p-3 space-y-1">
          <div className="text-[10px] text-gray-400 uppercase">Client & dates</div>
          <div className="font-semibold text-blue-600">{DEMO.clientName}</div>
          <div className="text-sm text-gray-600">{DEMO.dateRange}</div>
        </div>
        <div className="rounded-lg border border-gray-100 p-3 space-y-1">
          <div className="text-[10px] text-gray-400 uppercase">Destination</div>
          <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <span className="fi fi-th inline-block h-4 w-5 rounded-sm bg-cover bg-center" aria-hidden />
            {DEMO.destinationLine}
          </div>
          <div className="text-xs text-gray-500">{DEMO.duration} · {DEMO.countdown}</div>
        </div>
        <div className="rounded-lg border border-gray-100 p-3 space-y-1">
          <div className="text-[10px] text-gray-400 uppercase">Payment</div>
          <div className="text-lg font-bold">{DEMO.amount}</div>
          <PayBadge />
          <p className="text-[11px] text-gray-600">{DEMO.payDetail}</p>
        </div>
        <div className="rounded-lg border border-gray-100 p-3 space-y-1">
          <div className="text-[10px] text-gray-400 uppercase">Tags</div>
          <TagChips compact />
        </div>
      </div>
    </div>
  );
}

/** Variant D — single dense row (desktop) + note */
export function HeaderVariantD() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm space-y-2">
      <div className="flex flex-col xl:flex-row xl:items-center xl:flex-wrap gap-2 xl:gap-x-3 text-sm">
        <span className="font-bold text-gray-900 text-base xl:text-sm xl:font-semibold">{DEMO.orderCode}</span>
        <StatusBadge />
        <span className="text-gray-300 hidden xl:inline">·</span>
        <span className="text-blue-600 font-medium truncate max-w-[10rem] sm:max-w-none">{DEMO.clientName}</span>
        <span className="text-gray-300 hidden xl:inline">·</span>
        <span className="inline-flex items-center gap-1 text-gray-700 truncate min-w-0">
          <span className="fi fi-th shrink-0 h-3.5 w-4 rounded-sm bg-cover bg-center" aria-hidden />
          <span className="truncate">{DEMO.destinationCompact}</span>
        </span>
        <span className="text-gray-300 hidden xl:inline">·</span>
        <span className="font-semibold text-gray-900">{DEMO.amount}</span>
        <PayBadge />
        <span className="text-gray-300 hidden xl:inline">·</span>
        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800 whitespace-nowrap">
          {DEMO.countdown}
        </span>
        <button
          type="button"
          className="xl:ml-auto inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
        >
          <Info className="h-3.5 w-3.5" />
          Full header
        </button>
      </div>
      <p className="text-[11px] text-gray-500">
        On narrow screens this stacks; on xl+ it becomes one scannable row. Created, tags, and long destination stay behind “Full header” in a real build.
      </p>
    </div>
  );
}

/** Airport-style date cell: day, month, year (ISO from demo / order) */
function ScoreboardDateCell({ iso }: { iso: string }) {
  const d = new Date(`${iso}T12:00:00`);
  const day = String(d.getDate()).padStart(2, "0");
  const year = d.getFullYear();
  const rawMonth = d.toLocaleDateString("en-GB", { month: "short" }).replace(/\.$/, "");
  const month = rawMonth.slice(0, 3).toUpperCase();
  return (
    <div
      className="flex w-[2.55rem] shrink-0 flex-col items-stretch rounded-md border border-sky-200/90 bg-gradient-to-b from-sky-50 to-slate-100 px-0.5 pb-0.5 pt-0.5 shadow-sm ring-1 ring-sky-100 sm:w-[2.85rem]"
      aria-label={iso}
    >
      <div className="w-full text-center text-[1.12rem] font-black tabular-nums leading-none tracking-tight text-slate-800 sm:text-[1.28rem]">
        {day}
      </div>
      <div className="mt-0.5 w-full text-center text-[0.54rem] font-bold uppercase leading-none tracking-[0.14em] text-sky-800/90">
        {month}
      </div>
      <div className="mt-0.5 w-full text-center text-[0.5rem] font-semibold tabular-nums leading-none text-slate-600 sm:text-[0.52rem]">
        {year}
      </div>
    </div>
  );
}

function VariantETagChip({ label, variant }: { label: string; variant: "leisure" | "source" }) {
  const isHighlight = variant === "source" && (label === "TA" || label === "TO");
  return (
    <span
      className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
        isHighlight ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-700"
      }`}
    >
      {label}
    </span>
  );
}

/** Variant E — exactly 2 rows: identity + scoreboard dates + money (row1), trip + stacked tag blocks (row2) */
export function HeaderVariantE() {
  const paidRatio = 25310 / 29260;
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-2">
          <h1 className="text-lg font-bold leading-tight text-gray-900">{DEMO.orderCode}</h1>
          <StatusBadge />
          <button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-100" aria-label="Delete (demo)">
            <Trash2 className="h-4 w-4" />
          </button>
          <div className="flex items-end gap-1.5 sm:gap-2" aria-label={DEMO.dateRange}>
            <ScoreboardDateCell iso={DEMO.dateFromIso} />
            <span className="mb-2 text-base font-light text-gray-400 select-none sm:mb-2.5" aria-hidden>
              –
            </span>
            <ScoreboardDateCell iso={DEMO.dateToIso} />
          </div>
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-3">
          <div className="text-right">
            <div className="text-lg font-bold leading-tight text-gray-900">{DEMO.amount}</div>
            <PayBadge />
          </div>
          <div className="hidden w-24 shrink-0 sm:block" title="Paid share (demo)">
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${Math.min(100, paidRatio * 100)}%` }}
              />
            </div>
            <div className="mt-0.5 text-right text-[10px] tabular-nums text-gray-400">€25.3k / €29.3k</div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-t border-gray-100 pt-2 text-xs text-gray-800 sm:text-sm">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-semibold text-blue-800">
          GG
        </div>
        <span className="font-semibold text-blue-600">{DEMO.clientName}</span>
        <span className="text-gray-300">·</span>
        <span
          className="inline-flex min-w-0 max-w-[min(100%,14rem)] items-center gap-1 text-gray-700 sm:max-w-md"
          title={DEMO.destinationLine}
        >
          <span className="fi fi-th h-3.5 w-4 shrink-0 rounded-sm bg-cover bg-center" aria-hidden />
          <span className="truncate text-sm">{DEMO.destinationCompact}</span>
        </span>
        <span className="text-gray-300">·</span>
        <span className="whitespace-nowrap rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-800">
          {DEMO.countdown}
        </span>
        <div className="flex w-full flex-col items-stretch gap-1.5 sm:ml-auto sm:w-auto sm:flex-1 sm:items-end">
          <div className="flex flex-wrap justify-end gap-1">
            {DEMO.tagsLeisure.map((t) => (
              <VariantETagChip key={t} label={t} variant="leisure" />
            ))}
          </div>
          <div className="flex flex-wrap justify-end gap-1">
            {DEMO.tagsSource.map((t) => (
              <VariantETagChip key={t} label={t} variant="source" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Variant F — row1 = one scan line; row2 = meta (created + payment line) only */
export function HeaderVariantF() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm space-y-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-bold text-gray-900">{DEMO.orderCode}</span>
        <StatusBadge />
        <button type="button" className="rounded p-0.5 text-gray-400 hover:bg-gray-100" aria-label="Delete (demo)">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
        <span className="text-gray-300">|</span>
        <User className="h-3.5 w-3.5 text-gray-400 shrink-0" aria-hidden />
        <span className="font-medium text-blue-600 truncate max-w-[9rem] sm:max-w-none">{DEMO.clientName}</span>
        <span className="text-gray-300">|</span>
        <span className="fi fi-th shrink-0 h-3.5 w-4 rounded-sm bg-cover bg-center" aria-hidden />
        <span className="text-gray-800 truncate max-w-[10rem] md:max-w-xl">{DEMO.destinationLine}</span>
        <span className="text-gray-300">|</span>
        <span className="font-semibold tabular-nums">{DEMO.amount}</span>
        <PayBadge />
        <span className="text-gray-300">|</span>
        <span className="text-xs text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full whitespace-nowrap">{DEMO.countdown}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500 border-t border-gray-100 pt-2">
        <span>{DEMO.createdLabel}</span>
        <span className="hidden sm:inline text-gray-200">|</span>
        <span className="text-gray-600">{DEMO.payDetail}</span>
        <span className="hidden md:inline text-gray-200">|</span>
        <span className="hidden md:flex flex-wrap gap-1 items-center">
          {DEMO.tags.slice(0, 4).map((t) => (
            <span key={t} className="rounded bg-gray-100 px-1.5 py-0 text-[10px] text-gray-600">
              {t}
            </span>
          ))}
          {DEMO.tags.length > 4 ? (
            <span className="text-gray-400">+{DEMO.tags.length - 4}</span>
          ) : null}
        </span>
        <button type="button" className="ml-auto inline-flex items-center gap-0.5 text-blue-600 hover:underline">
          <Info className="h-3 w-3" />
          More
        </button>
      </div>
    </div>
  );
}

/** Variant G — two horizontal bands: (1) trip + money side-by-side, (2) meta only */
export function HeaderVariantG() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm space-y-2">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 lg:gap-6">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0 text-sm">
          <h1 className="text-lg font-bold text-gray-900">{DEMO.orderCode}</h1>
          <StatusBadge />
          <button type="button" className="rounded p-1 text-gray-400 hover:bg-gray-100" aria-label="Delete (demo)">
            <Trash2 className="h-4 w-4" />
          </button>
          <span className="text-gray-200 hidden sm:inline">|</span>
          <div className="h-8 w-8 shrink-0 rounded-full bg-blue-100 text-[11px] font-semibold text-blue-800 flex items-center justify-center">
            GG
          </div>
          <span className="font-semibold text-blue-600">{DEMO.clientName}</span>
          <span className="text-gray-300">·</span>
          <span className="inline-flex items-center gap-1 text-gray-600">
            <Calendar className="h-3.5 w-3.5 text-gray-400" />
            {DEMO.dateRange}
          </span>
          <span className="text-gray-300">·</span>
          <span className="inline-flex items-center gap-1 min-w-0 max-w-[14rem] lg:max-w-md">
            <span className="fi fi-th h-3.5 w-4 shrink-0 rounded-sm bg-cover bg-center" aria-hidden />
            <span className="truncate">{DEMO.destinationLine}</span>
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-xs font-medium text-sky-800 bg-sky-50 px-2 py-0.5 rounded-full whitespace-nowrap">
            {DEMO.countdown}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 lg:shrink-0 lg:justify-end">
          <div className="text-left lg:text-right">
            <div className="text-xl font-bold text-gray-900 leading-tight">{DEMO.amount}</div>
            <PayBadge />
          </div>
          <div className="hidden lg:flex flex-wrap gap-1 justify-end max-w-[220px]">
            <TagChips compact />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-500 border-t border-gray-100 pt-2">
        <span>{DEMO.createdLabel}</span>
        <span className="text-gray-200">|</span>
        <span className="text-gray-600">{DEMO.payDetail}</span>
        <div className="flex lg:hidden flex-wrap gap-1 w-full sm:w-auto">
          <TagChips compact />
        </div>
        <button type="button" className="text-blue-600 hover:underline ml-auto">
          Details
        </button>
      </div>
    </div>
  );
}
