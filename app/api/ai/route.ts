import { NextRequest, NextResponse } from "next/server";
import { parseFlightItinerary, parseFlightText } from "@/lib/ai/tasks/parseFlightItinerary";
import { parseDocument } from "@/lib/ai/tasks/parseDocument";
import { parseEmail, classifyEmail } from "@/lib/ai/tasks/parseEmail";
import { suggestServices, suggestTransferTime } from "@/lib/ai/tasks/suggestServices";
import {
  translateText,
  detectLanguage,
  translateEmailSubjectAndBody,
} from "@/lib/ai/tasks/translateText";
import { isAIAvailable } from "@/lib/ai/config";

/**
 * POST /api/ai
 *
 * Universal AI endpoint
 *
 * Body:
 * {
 *   task: string,
 *   ...params
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { task, ...params } = body;

    if (!task) {
      return NextResponse.json(
        { error: "Task is required" },
        { status: 400 }
      );
    }

    switch (task) {
      // ===== Flight Itinerary =====
      case "parse_flight_image": {
        if (!isAIAvailable("vision")) {
          return NextResponse.json({ error: "AI vision not configured" }, { status: 503 });
        }
        const result = await parseFlightItinerary(params.image, params.mimeType);
        return NextResponse.json(result);
      }

      case "parse_flight_text": {
        if (!isAIAvailable("fast")) {
          return NextResponse.json({ error: "AI not configured" }, { status: 503 });
        }
        const result = await parseFlightText(params.text);
        return NextResponse.json(result);
      }

      // ===== Document Parsing =====
      case "parse_document": {
        if (!isAIAvailable("vision")) {
          return NextResponse.json({ error: "AI vision not configured" }, { status: 503 });
        }
        const result = await parseDocument(params.image, params.mimeType);
        return NextResponse.json(result);
      }

      // ===== Email Parsing =====
      case "parse_email": {
        if (!isAIAvailable("fast")) {
          return NextResponse.json({ error: "AI not configured" }, { status: 503 });
        }
        const result = await parseEmail(params.content);
        return NextResponse.json(result);
      }

      case "classify_email": {
        if (!isAIAvailable("fast")) {
          return NextResponse.json({ error: "AI not configured" }, { status: 503 });
        }
        const result = await classifyEmail(params.subject, params.preview);
        return NextResponse.json(result);
      }

      // ===== Suggestions =====
      case "suggest_services": {
        if (!isAIAvailable("fast")) {
          return NextResponse.json({ error: "AI not configured" }, { status: 503 });
        }
        const result = await suggestServices({
          destinations: params.destinations || [],
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          existingServices: params.existingServices || [],
          travellersCount: params.travellersCount || 1,
        });
        return NextResponse.json(result);
      }

      case "suggest_transfer_time": {
        const result = await suggestTransferTime(
          {
            type: params.flightType,
            time: params.flightTime,
            airport: params.airport,
          },
          params.destination
        );
        return NextResponse.json(result);
      }

      // ===== Translation =====
      case "translate": {
        if (!isAIAvailable("fast")) {
          return NextResponse.json({ error: "AI not configured" }, { status: 503 });
        }
        const rawText = params.text;
        const targetRaw = params.targetLanguage;
        let emailPayload: { subject: string; message: string } | null = null;
        if (typeof rawText === "string") {
          try {
            const o = JSON.parse(rawText) as unknown;
            if (
              o &&
              typeof o === "object" &&
              typeof (o as { subject?: unknown }).subject === "string" &&
              typeof (o as { message?: unknown }).message === "string"
            ) {
              emailPayload = {
                subject: (o as { subject: string }).subject,
                message: (o as { message: string }).message,
              };
            }
          } catch {
            /* plain string — use translateText below */
          }
        }

        if (emailPayload && typeof targetRaw === "string" && targetRaw.trim() !== "") {
          const out = await translateEmailSubjectAndBody(
            emailPayload.subject,
            emailPayload.message,
            targetRaw
          );
          if (out) {
            return NextResponse.json({ result: JSON.stringify(out) });
          }
          return NextResponse.json({ error: "Translation failed" }, { status: 502 });
        }

        const result = await translateText(
          typeof rawText === "string" ? rawText : JSON.stringify(rawText ?? ""),
          typeof targetRaw === "string" ? targetRaw : "en",
          params.context
        );
        return NextResponse.json(result);
      }

      case "detect_language": {
        if (!isAIAvailable("fast")) {
          return NextResponse.json({ error: "AI not configured" }, { status: 503 });
        }
        const result = await detectLanguage(params.text);
        return NextResponse.json(result || { error: "Could not detect language" });
      }

      default:
        return NextResponse.json(
          { error: `Unknown task: ${task}` },
          { status: 400 }
        );
    }
  } catch (err) {
    console.error("AI API error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
