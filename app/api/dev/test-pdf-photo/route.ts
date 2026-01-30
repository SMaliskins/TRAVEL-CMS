/**
 * Dev-only: test PDF photo extraction
 * POST with PDF file - returns { ok, avatarUrl?, error? }
 */

import { NextRequest, NextResponse } from "next/server";
import { extractAndUploadPassportPhoto } from "@/lib/passport/extractPassportPhoto";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || file.type !== "application/pdf") {
      return NextResponse.json({ ok: false, error: "Need PDF file" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const avatarUrl = await extractAndUploadPassportPhoto(buffer);

    if (avatarUrl) {
      return NextResponse.json({ ok: true, avatarUrl });
    }
    return NextResponse.json({ ok: false, error: "No image extracted" });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[test-pdf-photo]", err);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
