import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { createRateHawkProvider } from "@/lib/providers/ratehawk/adapter";
import { createGoGlobalProvider } from "@/lib/providers/goglobal/adapter";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { HotelProvider, ProviderName, BookingParams } from "@/lib/providers/types";

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
    const {
      provider,
      rateId,
      checkIn,
      checkOut,
      rooms,
      nationality,
      agentReference,
      providerMetadata,
    } = body;

    if (!provider || !rateId || !checkIn || !checkOut || !rooms?.length) {
      return NextResponse.json(
        { data: null, error: "Validation error", message: "provider, rateId, checkIn, checkOut, and rooms are required" },
        { status: 400 }
      );
    }

    const providerInstance = getProvider(provider as ProviderName);

    const bookingParams: BookingParams = {
      rateId,
      provider: provider as ProviderName,
      checkIn,
      checkOut,
      rooms,
      nationality: nationality || "GB",
      agentReference,
      providerMetadata,
    };

    const result = await providerInstance.book(bookingParams);

    if (result.success) {
      await supabaseAdmin.from("hotel_offers").upsert(
        {
          company_id: companyId,
          provider: provider,
          booking_code: result.bookingCode,
          provider_booking_code: result.providerBookingCode,
          status: result.status,
          total_price: result.totalPrice,
          currency: result.currency,
          hotel_confirmation: result.hotelConfirmation || null,
          check_in: checkIn,
          check_out: checkOut,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "booking_code" }
      );
    }

    return NextResponse.json({
      data: result,
      error: result.success ? null : (result.errorMessage || "Booking failed"),
      message: result.success ? "Booking created successfully" : "Booking failed",
    });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: "Internal error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
