import { NextRequest, NextResponse } from "next/server";
import { getHotelMealTypes } from "@/lib/ratehawk/client";

export async function POST(request: NextRequest) {
  try {
    const keyId = process.env.RATEHAWK_KEY_ID;
    const apiKey = process.env.RATEHAWK_API_KEY;
    if (!keyId || !apiKey) {
      return NextResponse.json(
        { error: "RateHawk API not configured", data: null },
        { status: 503 }
      );
    }
    const body = await request.json().catch(() => ({}));
    const { hid, checkin, checkout, language = "en", currency = "EUR" } = body;
    if (!hid || !checkin || !checkout) {
      return NextResponse.json(
        { error: "hid, checkin, checkout required", data: null },
        { status: 400 }
      );
    }
    const mealTypes = await getHotelMealTypes(hid, checkin, checkout, language, keyId, apiKey, currency);
    return NextResponse.json({ data: { mealTypes }, error: null });
  } catch (err) {
    console.error("[ratehawk/hotel-rates]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Hotel rates failed", data: null },
      { status: 500 }
    );
  }
}
