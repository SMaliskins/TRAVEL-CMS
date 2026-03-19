import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { goGlobalClient } from "@/lib/goglobal/client";

export async function POST(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { companyId } = apiUser;

    const body = await request.json();
    const { cityCode, checkIn, checkOut, adults, nationality } = body;

    if (!cityCode || !checkIn || !checkOut) {
      return NextResponse.json(
        { data: null, error: "Validation error", message: "cityCode, checkIn, and checkOut are required" },
        { status: 400 }
      );
    }

    const msPerDay = 86400000;
    const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / msPerDay));

    const result = await goGlobalClient.searchHotels({
      cityCode: String(cityCode),
      arrivalDate: checkIn,
      nights,
      rooms: [{ adults: adults || 2, children: [] }],
      nationality: nationality || "GB",
      currency: body.currency || "EUR",
    });

    return NextResponse.json({
      data: result,
      error: null,
      message: `GoGlobal raw search completed`,
    });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: "Internal error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
