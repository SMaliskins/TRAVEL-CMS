/**
 * Parse passport from PDF - NO AI.
 * Uses regex patterns to extract passport data from PDF text.
 * Extracts photo from PDF and uploads to Storage.
 */

import { NextRequest, NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { parsePassportFromText } from "@/lib/passport/parsePassportText";
import { parseMrzToPassportData } from "@/lib/passport/parseMrz";
import { extractAndUploadPassportPhoto } from "@/lib/passport/extractPassportPhoto";

async function extractPdfText(buffer: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  return text || "";
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get("content-type") || "";
    let text: string | null = null;
    let pdfBuffer: Buffer | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (file?.type === "application/pdf") {
        try {
          pdfBuffer = Buffer.from(await file.arrayBuffer());
          text = await extractPdfText(pdfBuffer);
        } catch (pdfErr) {
          console.error("PDF extract error:", pdfErr);
          return NextResponse.json(
            { error: "Could not extract text from PDF. The file may be a scanned image.", passport: null },
            { status: 400 }
          );
        }
      } else {
        return NextResponse.json(
          { error: "Only PDF supported.", passport: null },
          { status: 400 }
        );
      }
    } else {
      const body = await request.json();
      text = body.text || null;
    }

    if (!text || typeof text !== "string" || text.trim().length < 10) {
      return NextResponse.json(
        { error: "Could not extract text from PDF.", passport: null },
        { status: 400 }
      );
    }

    // Try regex parsing first
    let passport = parsePassportFromText(text);

    // Fallback to MRZ parsing if regex failed
    if (!passport) {
      passport = parseMrzToPassportData(text);
    }

    if (!passport) {
      return NextResponse.json(
        { error: "Could not parse passport data from PDF. Please fill in manually.", passport: null },
        { status: 400 }
      );
    }

    // Extract photo from PDF and upload to Storage
    let photoError: string | undefined;
    if (pdfBuffer) {
      try {
        const avatarUrl = await extractAndUploadPassportPhoto(pdfBuffer);
        if (avatarUrl) {
          passport = { ...passport, avatarUrl };
        } else {
          photoError = "No image extracted";
        }
      } catch (photoErr) {
        const msg = photoErr instanceof Error ? photoErr.message : String(photoErr);
        console.error("Passport photo extract error:", photoErr);
        photoError = msg;
      }
    }

    return NextResponse.json({ passport, photoError });
  } catch (err) {
    console.error("Passport parse error:", err);
    return NextResponse.json(
      { error: "Failed to parse passport", passport: null },
      { status: 500 }
    );
  }
}
