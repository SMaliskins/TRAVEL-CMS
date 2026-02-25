import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { SupplierDocument } from "@/lib/types/directory";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const BUCKET_NAME = "supplier-documents";
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const ALLOWED_EXT = ["pdf", "png", "jpg", "jpeg", "webp", "doc", "docx", "xls", "xlsx"];

async function getCurrentUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.substring(7);
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

async function getCompanyIdForUser(userId: string): Promise<string | null> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("company_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile?.company_id) return profile.company_id;
  const { data: userProfile } = await supabaseAdmin
    .from("user_profiles")
    .select("company_id")
    .eq("id", userId)
    .maybeSingle();
  return userProfile?.company_id ?? null;
}

async function verifyPartyAccess(partyId: string, userCompanyId: string | null) {
  let query = supabaseAdmin.from("party").select("id, company_id, supplier_documents").eq("id", partyId);
  if (userCompanyId) {
    query = query.eq("company_id", userCompanyId);
  }
  const { data: party, error } = await query.single();
  if (error || !party) return { party: null, error: "Party not found" };
  // is_supplier comes from partner_party, not party table
  const { data: supplierRow } = await supabaseAdmin
    .from("partner_party")
    .select("party_id")
    .eq("party_id", partyId)
    .maybeSingle();
  if (!supplierRow) return { party: null, error: "Party is not a supplier" };
  return { party };
}

// POST: Upload a document
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: partyId } = await params;

    const user = await getCurrentUser(request);
    const userCompanyId = user ? await getCompanyIdForUser(user.id) : null;

    const { party, error: accessError } = await verifyPartyAccess(partyId, userCompanyId);
    if (accessError || !party) {
      return NextResponse.json({ error: accessError || "Party not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXT.includes(ext || "")) {
      return NextResponse.json({
        error: "Invalid file type. Allowed: PDF, images, Word, Excel",
      }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum 15MB" }, { status: 400 });
    }

    const timestamp = Date.now();
    const fileExt = file.name.split(".").pop() || "pdf";
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const filePath = `${partyId}/${timestamp}_${sanitizedName}.${fileExt}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, { contentType: file.type, upsert: false });

    if (uploadError) {
      if (uploadError.message?.includes("not found")) {
        await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
          public: false,
          fileSizeLimit: MAX_FILE_SIZE,
        });
        const { error: retryError } = await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .upload(filePath, buffer, { contentType: file.type, upsert: false });
        if (retryError) {
          console.error("Retry upload error:", retryError);
          return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
        }
      } else {
        console.error("Upload error:", uploadError);
        return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
      }
    }

    const { data: urlData } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 60 * 60 * 24 * 365);

    const fileUrl = urlData?.signedUrl || "";

    const newDoc: SupplierDocument = {
      id: `sd_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
      fileName: file.name,
      fileUrl,
      uploadedAt: new Date().toISOString(),
    };

    const existingDocs = (party.supplier_documents as SupplierDocument[]) || [];
    const updatedDocs = [...existingDocs, newDoc];

    const { error: updateError } = await supabaseAdmin
      .from("party")
      .update({ supplier_documents: updatedDocs })
      .eq("id", partyId);

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json({ error: "Failed to save document" }, { status: 500 });
    }

    return NextResponse.json({ success: true, document: newDoc });
  } catch (err) {
    console.error("Error uploading supplier document:", err);
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
  }
}

// DELETE: Remove a document
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: partyId } = await params;
    const { searchParams } = new URL(request.url);
    const docId = searchParams.get("docId");

    if (!docId) {
      return NextResponse.json({ error: "docId is required" }, { status: 400 });
    }

    const user = await getCurrentUser(request);
    const userCompanyId = user ? await getCompanyIdForUser(user.id) : null;

    const { party, error: accessError } = await verifyPartyAccess(partyId, userCompanyId);
    if (accessError || !party) {
      return NextResponse.json({ error: accessError || "Party not found" }, { status: 404 });
    }

    const existingDocs = (party.supplier_documents as SupplierDocument[]) || [];
    if (!existingDocs.find((d) => d.id === docId)) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const updatedDocs = existingDocs.filter((d) => d.id !== docId);

    const { error: updateError } = await supabaseAdmin
      .from("party")
      .update({ supplier_documents: updatedDocs })
      .eq("id", partyId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
    }

    return NextResponse.json({ success: true, deletedDocId: docId });
  } catch (err) {
    console.error("Error deleting supplier document:", err);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
