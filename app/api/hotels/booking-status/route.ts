import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { createRateHawkProvider } from "@/lib/providers/ratehawk/adapter";
import { createGoGlobalProvider } from "@/lib/providers/goglobal/adapter";
import type { HotelProvider, ProviderName } from "@/lib/providers/types";

function getProvider(name: ProviderName): HotelProvider {
  switch (name) {
    case "ratehawk":
      return createRateHawkProvider();
    case "goglobal":
      return createGoGlobalProvider();
    default:
      throw new Error(`Unsupported provider: ${name}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { companyId } = apiUser;

    const body = await request.json();
    const { provider, bookingCode } = body;

    if (!provider || !bookingCode) {
      return NextResponse.json(
        { data: null, error: "Validation error", message: "provider and bookingCode are required" },
        { status: 400 }
      );
    }

    const providerInstance = getProvider(provider as ProviderName);
    const result = await providerInstance.checkStatus(bookingCode);

    return NextResponse.json({
      data: result,
      error: null,
      message: `Booking status: ${result.status}`,
    });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: "Internal error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
