import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/currency-rate?from=CHF&to=EUR
 * Returns exchange rate: 1 unit of `from` = rate units of `to`.
 * Tries ECB daily XML, then Frankfurter API as fallback.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = (searchParams.get("from") || "").toUpperCase();
    const to = (searchParams.get("to") || "EUR").toUpperCase();

    if (!from || from === to) {
      return NextResponse.json({ error: "Missing or invalid 'from' currency", rate: null }, { status: 400 });
    }

    let rate: number | null = null;

    // 1) Try ECB eurofxref-daily.xml (1 EUR = X [FROM] => 1 FROM = 1/X EUR)
    try {
      const res = await fetch("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml", {
        next: { revalidate: 3600 },
        headers: { Accept: "application/xml" },
      });
      if (res.ok) {
        const xml = await res.text();
        const cubeMatch =
          xml.match(new RegExp(`currency="${from}"[^>]*rate="([^"]+)"`, "i")) ||
          xml.match(new RegExp(`rate="([^"]+)"[^>]*currency="${from}"`, "i"));
        if (cubeMatch) {
          const eurPerForeign = parseFloat(cubeMatch[1].replace(",", "."));
          if (Number.isFinite(eurPerForeign) && eurPerForeign > 0) {
            rate = 1 / eurPerForeign;
          }
        }
      }
    } catch (_) {}

    // 2) Fallback: Frankfurter (1 FROM = X EUR)
    if (rate == null) {
      try {
        const res = await fetch(
          `https://api.frankfurter.app/latest?from=${from}&to=${to}&amount=1`,
          { next: { revalidate: 3600 } }
        );
        if (res.ok) {
          const data = await res.json();
          const r = data.rates?.[to];
          if (Number.isFinite(r)) rate = r;
        }
      } catch (_) {}

      // Frankfurter sometimes returns base in response
      if (rate == null && to === "EUR") {
        try {
          const res = await fetch(
            `https://api.frankfurter.app/latest?from=${from}&to=EUR`,
            { next: { revalidate: 3600 } }
          );
          if (res.ok) {
            const data = await res.json();
            const r = data.rates?.EUR;
            if (Number.isFinite(r)) rate = r;
          }
        } catch (_) {}
      }
    }

    if (rate == null || !Number.isFinite(rate) || rate <= 0) {
      return NextResponse.json(
        { error: "Could not fetch rate (ECB and fallback failed)", rate: null },
        { status: 502 }
      );
    }

    const rounded = Math.round(rate * 10000) / 10000;
    return NextResponse.json({ rate: rounded, from, to });
  } catch (e) {
    console.error("[currency-rate]", e);
    return NextResponse.json(
      { error: "Internal error", rate: null },
      { status: 500 }
    );
  }
}
