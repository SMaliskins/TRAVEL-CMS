import { NextRequest, NextResponse } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { goGlobalClient } from "@/lib/goglobal/client";

export async function GET(request: NextRequest) {
  try {
    const apiUser = await getApiUser(request);
    if (!apiUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { companyId } = apiUser;

    const hotelId = request.nextUrl.searchParams.get("hotelId");
    if (!hotelId) {
      return NextResponse.json(
        { data: null, error: "Validation error", message: "hotelId query parameter is required" },
        { status: 400 }
      );
    }

    const result = await goGlobalClient.getHotelInfo(hotelId);

    return NextResponse.json({
      data: result,
      error: null,
      message: `Hotel info retrieved for ${hotelId}`,
    });
  } catch (error) {
    return NextResponse.json(
      { data: null, error: "Internal error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
