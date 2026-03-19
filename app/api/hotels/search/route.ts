import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { searchAll } from "@/lib/providers/aggregator";
import { createRateHawkProvider } from "@/lib/providers/ratehawk/adapter";
import { createGoGlobalProvider } from "@/lib/providers/goglobal/adapter";
import type { HotelProvider, HotelSearchParams, ProviderName } from "@/lib/providers/types";

const PROVIDER_FACTORIES: Record<ProviderName, { create: () => HotelProvider; envCheck: () => boolean }> = {
  ratehawk: {
    create: createRateHawkProvider,
    envCheck: () => !!process.env.RATEHAWK_KEY_ID && !!process.env.RATEHAWK_API_KEY,
  },
  goglobal: {
    create: createGoGlobalProvider,
    envCheck: () => !!process.env.GOGLOBAL_AGENCY_ID,
  },
  booking: {
    create: () => { throw new Error("Booking.com provider not implemented"); },
    envCheck: () => false,
  },
};

export async function POST(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { companyId } = apiUser;

    const body = await request.json();
    const regionId = body.regionId ? Number(body.regionId) : undefined;
    const checkIn = String(body.checkIn || "");
    const checkOut = String(body.checkOut || "");
    const adults = Math.max(1, Number(body.adults || body.guests || 2));
    const childrenAges: number[] = Array.isArray(body.childrenAges)
      ? body.childrenAges.map((a: unknown) => Math.min(17, Math.max(0, Number(a) || 0)))
      : [];
    const currency = String(body.currency || "EUR");
    const nationality = String(body.nationality || "GB");
    const cityCode = body.cityCode ? String(body.cityCode) : undefined;
    const hotelHid = body.hotelHid ? String(body.hotelHid) : undefined;
    const maxResults = body.maxResults ? Number(body.maxResults) : undefined;

    if (!checkIn || !checkOut) {
      return NextResponse.json(
        { data: null, error: "Validation error", message: "checkIn and checkOut are required" },
        { status: 400 }
      );
    }

    if (!regionId && !cityCode) {
      return NextResponse.json(
        { data: null, error: "Validation error", message: "regionId or cityCode is required" },
        { status: 400 }
      );
    }

    const requestedProviders: ProviderName[] = Array.isArray(body.providers) && body.providers.length > 0
      ? body.providers
      : (["ratehawk", "goglobal"] as ProviderName[]);

    const providers: HotelProvider[] = [];
    for (const name of requestedProviders) {
      const factory = PROVIDER_FACTORIES[name];
      if (!factory) continue;
      if (!factory.envCheck()) continue;

      if (name === "ratehawk" && !regionId) continue;
      if (name === "goglobal" && !cityCode) continue;

      providers.push(factory.create());
    }

    if (providers.length === 0) {
      return NextResponse.json(
        { data: null, error: "No providers available", message: "No providers configured or matching criteria" },
        { status: 400 }
      );
    }

    const params: HotelSearchParams = {
      regionId,
      cityCode,
      hotelId: hotelHid,
      checkIn,
      checkOut,
      adults,
      childrenAges,
      currency,
      nationality,
      maxResults,
    };

    const result = await searchAll(providers, params);

    return NextResponse.json({
      data: result.hotels,
      errors: result.errors,
      timing: result.timing,
      message: `Found ${result.hotels.length} hotels from ${providers.map((p) => p.name).join(", ")}`,
    });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: "Internal error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
