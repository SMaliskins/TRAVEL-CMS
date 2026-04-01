"use client";

import { Suspense, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DEMO,
  HeaderVariantA,
  HeaderVariantB,
  HeaderVariantC,
  HeaderVariantD,
  HeaderVariantE,
  HeaderVariantF,
  HeaderVariantG,
} from "./_components/OrderHeaderVariantDemos";

const VARIANTS = [
  { id: "a", label: "A — Two rows", desc: "Dense hero + client/destination line" },
  { id: "b", label: "B — Left + money column", desc: "Client stack + fixed totals card" },
  { id: "c", label: "C — 2×2 grid", desc: "Four tiles under title" },
  { id: "d", label: "D — One row (xl)", desc: "Maximum density + overflow to details" },
  {
    id: "e",
    label: "E — 2 lines strict",
    desc: "Row1: order + scoreboard dates + money · Row2: trip + leisure/source tags (stacked)",
  },
  { id: "f", label: "F — Scan + meta", desc: "Row1: full scan line · Row2: created + payment + tags" },
  { id: "g", label: "G — Split + footer", desc: "Row1: trip | totals · Row2: created + pay detail + tags" },
] as const;

type VariantId = (typeof VARIANTS)[number]["id"];

function isVariantId(s: string | null): s is VariantId {
  return s === "a" || s === "b" || s === "c" || s === "d" || s === "e" || s === "f" || s === "g";
}

function DemoPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const variantParam = searchParams.get("variant");
  const active: VariantId = isVariantId(variantParam) ? variantParam : "a";

  const setVariant = useCallback(
    (id: VariantId) => {
      const next = new URLSearchParams(searchParams.toString());
      next.set("variant", id);
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}${pathname}?variant=${active}`;
  }, [pathname, active]);

  const header = useMemo(() => {
    switch (active) {
      case "b":
        return <HeaderVariantB />;
      case "c":
        return <HeaderVariantC />;
      case "d":
        return <HeaderVariantD />;
      case "e":
        return <HeaderVariantE />;
      case "f":
        return <HeaderVariantF />;
      case "g":
        return <HeaderVariantG />;
      default:
        return <HeaderVariantA />;
    }
  }, [active]);

  return (
    <div className="min-h-screen bg-gray-50/80">
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <strong className="font-semibold">Layout demo only</strong> — static data, not a real order. Use the tabs
          below to compare header concepts ({DEMO.orderCode}).
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Order header layout lab</h1>
            <p className="text-sm text-gray-600 mt-1">
              Open each tab to see variant <span className="font-mono text-gray-800">A–G</span>.{" "}
              <strong className="font-medium text-gray-800">E–G</strong> target max two content rows. URL updates for
              bookmarks.
            </p>
          </div>
          <div className="text-xs text-gray-500 font-mono break-all sm:max-w-md sm:text-right">
            {shareUrl || `${pathname}?variant=${active}`}
          </div>
        </div>

        <div
          role="tablist"
          aria-label="Header layout variant"
          className="flex flex-wrap gap-1 border-b border-gray-200 pb-px"
        >
          {VARIANTS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={active === v.id}
              id={`tab-${v.id}`}
              aria-controls={`panel-${v.id}`}
              onClick={() => setVariant(v.id)}
              className={`rounded-t-md px-3 py-2 text-sm font-medium transition-colors border border-b-0 -mb-px ${
                active === v.id
                  ? "bg-white text-blue-700 border-gray-200 z-10"
                  : "bg-gray-100/80 text-gray-600 border-transparent hover:bg-gray-100"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>

        <p className="text-xs text-gray-500 -mt-2">
          {VARIANTS.find((v) => v.id === active)?.desc}
        </p>

        <div
          role="tabpanel"
          id={`panel-${active}`}
          aria-labelledby={`tab-${active}`}
          className="min-h-[200px]"
        >
          {header}
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-600 space-y-2">
          <p className="font-medium text-gray-800">Fake tab bar (like real order page)</p>
          <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-2">
            {["Client & Services", "Clients Data", "Invoices & Payments", "Finances"].map((t) => (
              <span
                key={t}
                className={`px-2 py-1 rounded text-xs ${
                  t === "Client & Services" ? "bg-blue-50 text-blue-800 font-medium" : "text-gray-500"
                }`}
              >
                {t}
              </span>
            ))}
          </div>
          <p className="text-xs text-gray-400">
            Placeholder content — shows how the header sits above tabs on the real order screen.
          </p>
        </div>

        <p className="text-center">
          <Link href="/orders" className="text-sm text-blue-600 hover:underline">
            ← Back to Orders list
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function HeaderLayoutDemoPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-500 text-sm">Loading demo…</div>}>
      <DemoPageInner />
    </Suspense>
  );
}
