/**
 * Document Intake — file loading, type detection, strategy selection.
 *
 * Replaces the duplicated file-handling code in all 6 parsers.
 * Accepts raw file input, determines what it is, extracts content,
 * and chooses the best processing strategy (text vs vision vs hybrid).
 */

import { createHash } from "crypto";
import { NextRequest } from "next/server";
import type { DocumentType } from "./parseSchemas";
import {
  inferMimeFromBytes,
  inferMimeFromFilename,
  normalizeImageMime,
} from "@/lib/files/inferUploadMime";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContentMode = "text" | "vision" | "hybrid";

export interface IntakeResult {
  documentType: DocumentType;
  contentMode: ContentMode;
  extractedText: string | null;
  pageImages: string[];
  pdfBase64: string | null;
  mimeType: string;
  fileHash: string;
  pageCount: number;
  layoutRisk: "low" | "medium" | "high";
  sourceMeta: {
    originalFilename?: string;
    fileSizeBytes: number;
    inputType: "pdf" | "image" | "text";
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Process a file/text into an IntakeResult ready for AI parsing.
 */
export async function processFile(
  options: {
    file?: Buffer;
    text?: string;
    filename?: string;
    mimeType?: string;
    documentType: DocumentType;
  }
): Promise<IntakeResult> {
  const { documentType } = options;

  // Text input (pasted text, no file)
  if (options.text && !options.file) {
    return {
      documentType,
      contentMode: "text",
      extractedText: options.text,
      pageImages: [],
      pdfBase64: null,
      mimeType: "text/plain",
      fileHash: computeHash(Buffer.from(options.text, "utf-8")),
      pageCount: 0,
      layoutRisk: "low",
      sourceMeta: {
        originalFilename: undefined,
        fileSizeBytes: Buffer.byteLength(options.text, "utf-8"),
        inputType: "text",
      },
    };
  }

  if (!options.file) {
    throw new Error("Either file or text must be provided");
  }

  const buffer = options.file;
  const fileHash = computeHash(buffer);

  // Detect MIME type
  let mime = options.mimeType || "";
  if (!mime || mime === "application/octet-stream") {
    mime =
      inferMimeFromBytes(new Uint8Array(buffer.subarray(0, 64))) ||
      (options.filename ? inferMimeFromFilename(options.filename) || "" : "");
  }
  mime = normalizeImageMime(mime);

  const isPdf = mime === "application/pdf";
  const isImage = mime.startsWith("image/");

  if (!isPdf && !isImage) {
    throw new Error(`Unsupported file type: ${mime}. Use PDF or image (PNG, JPG, WebP).`);
  }

  // ---------------------------------------------------------------------------
  // Image files
  // ---------------------------------------------------------------------------
  if (isImage) {
    return {
      documentType,
      contentMode: "vision",
      extractedText: null,
      pageImages: [buffer.toString("base64")],
      pdfBase64: null,
      mimeType: mime,
      fileHash,
      pageCount: 1,
      layoutRisk: "low",
      sourceMeta: {
        originalFilename: options.filename,
        fileSizeBytes: buffer.length,
        inputType: "image",
      },
    };
  }

  // ---------------------------------------------------------------------------
  // PDF files
  // ---------------------------------------------------------------------------
  const pdfBase64 = buffer.toString("base64");

  // Try text extraction
  const textResult = await extractTextFromPdf(buffer);

  // Determine strategy based on document type and text quality
  const contentMode = selectContentMode(documentType, textResult);
  const layoutRisk = selectLayoutRisk(documentType, textResult);

  return {
    documentType,
    contentMode,
    extractedText: textResult.text || null,
    pageImages: [], // populated lazily if needed
    pdfBase64,
    mimeType: "application/pdf",
    fileHash,
    pageCount: 1, // could be enhanced with pdf-to-img page count
    layoutRisk,
    sourceMeta: {
      originalFilename: options.filename,
      fileSizeBytes: buffer.length,
      inputType: "pdf",
    },
  };
}

/**
 * Process a NextRequest (FormData or JSON body) into an IntakeResult.
 */
export async function processRequest(
  request: NextRequest,
  documentType: DocumentType
): Promise<IntakeResult> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      throw new Error("File is required");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    return processFile({
      file: buffer,
      filename: file.name,
      mimeType: file.type,
      documentType,
    });
  }

  // JSON body
  const body = await request.json();

  if (body.text) {
    return processFile({ text: body.text, documentType });
  }

  if (body.image) {
    const buffer = Buffer.from(body.image, "base64");
    return processFile({
      file: buffer,
      mimeType: body.mimeType || "image/png",
      documentType,
    });
  }

  throw new Error("Provide file (PDF/image) or text. For text: { \"text\": \"...\" }");
}

// ---------------------------------------------------------------------------
// PDF text extraction with quality assessment
// ---------------------------------------------------------------------------

async function extractTextFromPdf(
  buffer: Buffer
): Promise<{ text: string; quality: "good" | "poor" | "empty" }> {
  try {
    const { extractText } = await import("unpdf");
    const result = await extractText(new Uint8Array(buffer));
    const raw = Array.isArray(result?.text) ? result.text.join("\n") : (result?.text || "");
    const text = (typeof raw === "string" ? raw : "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!text || text.length < 10) return { text: "", quality: "empty" };

    // Check for garbled text (common with table-heavy PDFs)
    const wordCount = text.split(/\s+/).length;
    const avgWordLen = text.replace(/\s/g, "").length / (wordCount || 1);
    if (avgWordLen > 20 || wordCount < 5) return { text, quality: "poor" };

    return { text, quality: "good" };
  } catch (err) {
    console.error("[documentIntake] unpdf extraction failed:", err);
    return { text: "", quality: "empty" };
  }
}

// ---------------------------------------------------------------------------
// Strategy selection
// ---------------------------------------------------------------------------

function selectContentMode(
  documentType: DocumentType,
  textResult: { text: string; quality: "good" | "poor" | "empty" }
): ContentMode {
  // Passports — always vision (image-heavy)
  if (documentType === "passport") return "vision";

  // Package tours — prefer vision for table-heavy layouts
  if (documentType === "package_tour") {
    if (textResult.quality === "good" && textResult.text.length > 200) return "hybrid";
    return "vision";
  }

  // Flight tickets — text if quality is good
  if (documentType === "flight_ticket") {
    if (textResult.quality === "good" && textResult.text.length > 100) return "text";
    return "vision";
  }

  // Simple docs (invoice, expense, company_doc) — text if available
  if (textResult.quality === "good" && textResult.text.length > 50) return "text";
  return "vision";
}

function selectLayoutRisk(
  documentType: DocumentType,
  textResult: { quality: "good" | "poor" | "empty" }
): "low" | "medium" | "high" {
  if (documentType === "package_tour") return "high";
  if (documentType === "flight_ticket") return "medium";
  if (textResult.quality === "poor") return "medium";
  return "low";
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function computeHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
