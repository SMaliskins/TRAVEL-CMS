import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
});

const BUCKET_NAME = "boarding-passes";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for wallet files
const ALLOWED_TYPES = [
  "application/pdf", 
  "image/png", 
  "image/jpeg", 
  "image/jpg",
  "application/vnd.apple.pkpass", // Apple Wallet
  "application/octet-stream", // Some systems send pkpass as this
];

interface BoardingPass {
  id: string;
  fileName: string;
  fileUrl: string;
  clientId: string;
  clientName: string;
  flightNumber: string; // To link BP to specific flight segment
  uploadedAt: string;
  fileSize: number;
  mimeType: string;
}

// GET: List boarding passes for a service
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;

    // Get service with boarding passes
    const { data: service, error } = await supabaseAdmin
      .from("order_services")
      .select("id, boarding_passes")
      .eq("id", serviceId)
      .single();

    if (error || !service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    return NextResponse.json({
      serviceId,
      boardingPasses: service.boarding_passes || [],
    });
  } catch (error) {
    console.error("Error fetching boarding passes:", error);
    return NextResponse.json({ error: "Failed to fetch boarding passes" }, { status: 500 });
  }
}

// POST: Upload a boarding pass
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;

    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const clientId = formData.get("clientId") as string | null;
    const clientName = formData.get("clientName") as string | null;
    const flightNumber = formData.get("flightNumber") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!clientId || !clientName) {
      return NextResponse.json({ error: "clientId and clientName are required" }, { status: 400 });
    }

    if (!flightNumber) {
      return NextResponse.json({ error: "flightNumber is required" }, { status: 400 });
    }

    // Validate file type - check both MIME type and extension
    const ext = file.name.split(".").pop()?.toLowerCase();
    const allowedExtensions = ["pdf", "png", "jpg", "jpeg", "pkpass"];
    if (!ALLOWED_TYPES.includes(file.type) && !allowedExtensions.includes(ext || "")) {
      return NextResponse.json({ 
        error: "Invalid file type. Allowed: PDF, PNG, JPG, Apple Wallet (.pkpass)" 
      }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ 
        error: "File too large. Maximum size: 5MB" 
      }, { status: 400 });
    }

    // Get service to verify it exists
    const { data: service, error: serviceError } = await supabaseAdmin
      .from("order_services")
      .select("id, boarding_passes, order_id")
      .eq("id", serviceId)
      .single();

    if (serviceError || !service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    // Generate unique file path
    const timestamp = Date.now();
    const fileExt = file.name.split(".").pop() || "pdf";
    const sanitizedClientName = clientName.replace(/[^a-zA-Z0-9]/g, "_");
    const filePath = `${service.order_id}/${serviceId}/${sanitizedClientName}_${timestamp}.${fileExt}`;

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      
      // If bucket doesn't exist, try to create it
      if (uploadError.message?.includes("not found")) {
        // Create bucket
        await supabaseAdmin.storage.createBucket(BUCKET_NAME, {
          public: false,
          fileSizeLimit: MAX_FILE_SIZE,
        });
        
        // Retry upload
        const { error: retryError } = await supabaseAdmin.storage
          .from(BUCKET_NAME)
          .upload(filePath, buffer, {
            contentType: file.type,
            upsert: false,
          });
        
        if (retryError) {
          return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
        }
      } else {
        return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
      }
    }

    // Get public URL (or signed URL for private bucket)
    const { data: urlData } = await supabaseAdmin.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filePath, 60 * 60 * 24 * 365); // 1 year expiry

    const fileUrl = urlData?.signedUrl || "";

    // Create boarding pass record
    const newPass: BoardingPass = {
      id: `bp_${timestamp}_${Math.random().toString(36).substr(2, 9)}`,
      fileName: file.name,
      fileUrl,
      clientId,
      clientName,
      flightNumber,
      uploadedAt: new Date().toISOString(),
      fileSize: file.size,
      mimeType: file.type,
    };

    // Update service with new boarding pass
    const existingPasses = (service.boarding_passes as BoardingPass[]) || [];
    // Allow multiple files per client/flight - only replace if same filename
    const filteredPasses = existingPasses.filter(p => 
      !(p.clientId === clientId && p.flightNumber === flightNumber && p.fileName === file.name)
    );
    const updatedPasses = [...filteredPasses, newPass];

    const { error: updateError } = await supabaseAdmin
      .from("order_services")
      .update({ boarding_passes: updatedPasses })
      .eq("id", serviceId);

    if (updateError) {
      console.error("Update error:", updateError);
      return NextResponse.json({ error: "Failed to save boarding pass" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      boardingPass: newPass,
    });
  } catch (error) {
    console.error("Error uploading boarding pass:", error);
    return NextResponse.json({ error: "Failed to upload boarding pass" }, { status: 500 });
  }
}

// DELETE: Remove a boarding pass
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> }
) {
  try {
    const { serviceId } = await params;
    const { searchParams } = new URL(request.url);
    const passId = searchParams.get("passId");

    if (!passId) {
      return NextResponse.json({ error: "passId is required" }, { status: 400 });
    }

    // Get service
    const { data: service, error: serviceError } = await supabaseAdmin
      .from("order_services")
      .select("id, boarding_passes")
      .eq("id", serviceId)
      .single();

    if (serviceError || !service) {
      return NextResponse.json({ error: "Service not found" }, { status: 404 });
    }

    const existingPasses = (service.boarding_passes as BoardingPass[]) || [];
    const passToDelete = existingPasses.find(p => p.id === passId);

    if (!passToDelete) {
      return NextResponse.json({ error: "Boarding pass not found" }, { status: 404 });
    }

    // Remove from storage (extract path from URL)
    // Note: For signed URLs, we need to store the path separately or extract it
    // For now, we'll just remove from database

    // Update service
    const updatedPasses = existingPasses.filter(p => p.id !== passId);

    const { error: updateError } = await supabaseAdmin
      .from("order_services")
      .update({ boarding_passes: updatedPasses })
      .eq("id", serviceId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to delete boarding pass" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deletedPassId: passId,
    });
  } catch (error) {
    console.error("Error deleting boarding pass:", error);
    return NextResponse.json({ error: "Failed to delete boarding pass" }, { status: 500 });
  }
}
