import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getApiUser } from "@/lib/auth/getApiUser";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { refreshEmailTemplateTranslations } from "@/lib/email/refreshEmailTemplateTranslations";

export async function GET(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("email_templates")
    .select("*")
    .eq("company_id", user.companyId)
    .order("category")
    .order("name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ templates: data || [] });
}

export async function POST(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, category, subject, bodyHtml, is_default, email_signature_source } = body;

  if (!name || !category) {
    return NextResponse.json({ error: "Name and category are required" }, { status: 400 });
  }

  if (is_default) {
    await supabaseAdmin
      .from("email_templates")
      .update({ is_default: false })
      .eq("company_id", user.companyId)
      .eq("category", category);
  }

  const sigSrc =
    email_signature_source === "company" || email_signature_source === "personal"
      ? email_signature_source
      : "personal";

  const { data, error } = await supabaseAdmin
    .from("email_templates")
    .insert({
      company_id: user.companyId,
      created_by: user.userId,
      name,
      category,
      subject: subject || "",
      body: bodyHtml || "",
      is_default: is_default || false,
      email_signature_source: sigSrc,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = data as { id: string; subject?: string; body?: string };
  after(async () => {
    await refreshEmailTemplateTranslations(row.id, row.subject ?? "", row.body ?? "");
  });

  return NextResponse.json({ template: data });
}

export async function PATCH(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, name, category, subject, bodyHtml, is_default, is_active, email_signature_source } = body;

  if (!id) {
    return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from("email_templates")
    .select("id, company_id")
    .eq("id", id)
    .eq("company_id", user.companyId)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Template not found" }, { status: 404 });
  }

  if (is_default && category) {
    await supabaseAdmin
      .from("email_templates")
      .update({ is_default: false })
      .eq("company_id", user.companyId)
      .eq("category", category);
  }

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (name !== undefined) updateData.name = name;
  if (category !== undefined) updateData.category = category;
  if (subject !== undefined) updateData.subject = subject;
  if (bodyHtml !== undefined) updateData.body = bodyHtml;
  if (is_default !== undefined) updateData.is_default = is_default;
  if (is_active !== undefined) updateData.is_active = is_active;
  if (email_signature_source === "company" || email_signature_source === "personal") {
    updateData.email_signature_source = email_signature_source;
  }

  const { data, error } = await supabaseAdmin
    .from("email_templates")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const row = data as { id: string; subject?: string; body?: string };
  after(async () => {
    await refreshEmailTemplateTranslations(row.id, row.subject ?? "", row.body ?? "");
  });

  return NextResponse.json({ template: data });
}

export async function DELETE(request: NextRequest) {
  const user = await getApiUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("email_templates")
    .delete()
    .eq("id", id)
    .eq("company_id", user.companyId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deleted: true });
}
