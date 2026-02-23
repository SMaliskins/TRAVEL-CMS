import { NextRequest, NextResponse } from "next/server";
import { getCurrentCmsUser, getCompanyIdForCmsUser } from "@/lib/hotels/cmsAuth";
import { searchHotelsByRegion, getHotelContentsBatch } from "@/lib/ratehawk/client";

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentCmsUser(request);
    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized", message: "Auth required" }, { status: 401 });
    }

    const companyId = await getCompanyIdForCmsUser(user.id);
    if (!companyId) {
      return NextResponse.json({ data: null, error: "Company not found", message: "User has no company" }, { status: 404 });
    }

    const body = await request.json();
    const regionId = Number(body.regionId);
    const checkIn = String(body.checkIn || "");
    const checkOut = String(body.checkOut || "");
    const adults = Math.max(1, Number(body.adults || body.guests || 2));
    const childrenAges: number[] = Array.isArray(body.childrenAges)
      ? body.childrenAges.map((a: unknown) => Math.min(17, Math.max(0, Number(a) || 0)))
      : [];
    const currency = String(body.currency || "EUR");
    const hotelHid = body.hotelHid ? Number(body.hotelHid) : null;

    if (!regionId || !checkIn || !checkOut) {
      return NextResponse.json(
        { data: null, error: "Validation error", message: "regionId, checkIn and checkOut are required" },
        { status: 400 }
      );
    }

    const keyId = process.env.RATEHAWK_KEY_ID;
    const apiKey = process.env.RATEHAWK_API_KEY;
    if (!keyId || !apiKey) {
      return NextResponse.json(
        { data: null, error: "RateHawk not configured", message: "Missing RATEHAWK credentials" },
        { status: 500 }
      );
    }

    let hotels = await searchHotelsByRegion(regionId, checkIn, checkOut, adults, keyId, apiKey, currency, 25, childrenAges);

    if (hotelHid) {
      hotels = hotels.filter((h) => h.hid === hotelHid);
    }

    const hids = [...new Set(hotels.map((h) => h.hid))];
    const hotelContents = await getHotelContentsBatch(hids.slice(0, 5), "en", keyId, apiKey).catch(() => []);
    const contentMap = new Map(hotelContents.map((c) => [c.hid, c]));

    const mapped = hotels.flatMap((h) => {
      const content = contentMap.get(h.hid);
      const hotelName = h.name || content?.name || `Hotel #${h.hid}`;
      const address = h.address || content?.address || null;
      const stars = h.star_rating || content?.star_rating || null;
      const hotelImages = content?.images ?? [];

      return (h.rates || []).slice(0, 3).map((r) => {
        const payment = r.payment_options?.payment_types?.[0];
        const baseAmount = Number(payment?.show_amount ?? payment?.amount ?? 0);

        const ci = r.cancellation_info;
        let freeBefore = ci?.free_cancellation_before || null;
        const penalties: { from: string; amount: string; currency: string }[] = [];
        if (ci?.penalties) {
          for (const [dt, pen] of Object.entries(ci.penalties)) {
            penalties.push({
              from: dt,
              amount: pen.amount ?? "100%",
              currency: pen.currency_code ?? currency,
            });
          }
          penalties.sort((a, b) => a.from.localeCompare(b.from));
        }
        if (!freeBefore && penalties.length > 0) {
          freeBefore = penalties[0].from;
        }
        const isNonRef = !freeBefore && penalties.length === 0
          ? String(r.meal || "").toLowerCase().includes("nonref")
          : !freeBefore;

        const beddingType = r.room_data_trans?.bedding_type || null;

        return {
          hid: h.hid,
          hotelName,
          address,
          stars,
          hotelImages,
          roomName: r.room_name || null,
          beddingType,
          meal: r.meal || null,
          ratehawkAmount: baseAmount,
          currency: String(payment?.show_currency_code ?? payment?.currency_code ?? (currency || "EUR")).toUpperCase(),
          tariffType: isNonRef ? "non_refundable" : "refundable",
          freeCancellationBefore: freeBefore,
          cancellationPenalties: penalties,
          checkIn,
          checkOut,
          guests: adults + childrenAges.length,
          matchHash: r.match_hash || null,
          bookHash: r.book_hash || null,
          searchHash: r.match_hash || null,
        };
      });
    });

    return NextResponse.json({
      data: mapped,
      error: null,
      message: `Found ${mapped.length} rates`,
    });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: "Internal error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
