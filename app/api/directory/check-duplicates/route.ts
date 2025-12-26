import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface DuplicateCheckRequest {
  email?: string;
  phone?: string;
  personal_code?: string;
  reg_number?: string;
  first_name?: string;
  last_name?: string;
  dob?: string;
}

interface DuplicateResult {
  id: string;
  display_name: string;
  similarity_score: number;
  match_fields: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const checkData = body as DuplicateCheckRequest;

    if (!checkData.email && !checkData.phone && !checkData.personal_code && 
        !checkData.reg_number && !(checkData.first_name && checkData.last_name)) {
      return NextResponse.json(
        { error: "At least one search field is required" },
        { status: 400 }
      );
    }

    const duplicates: DuplicateResult[] = [];

    // Check by exact matches
    if (checkData.email) {
      const { data: emailMatches } = await supabaseAdmin
        .from("party")
        .select("id, display_name, email")
        .eq("email", checkData.email);

      emailMatches?.forEach((match) => {
        duplicates.push({
          id: match.id,
          display_name: match.display_name || "",
          similarity_score: 1.0,
          match_fields: ["email"],
        });
      });
    }

    if (checkData.phone) {
      const { data: phoneMatches } = await supabaseAdmin
        .from("party")
        .select("id, display_name, phone")
        .eq("phone", checkData.phone);

      phoneMatches?.forEach((match) => {
        if (!duplicates.find((d) => d.id === match.id)) {
          duplicates.push({
            id: match.id,
            display_name: match.display_name || "",
            similarity_score: 1.0,
            match_fields: ["phone"],
          });
        } else {
          const existing = duplicates.find((d) => d.id === match.id);
          if (existing) {
            existing.match_fields.push("phone");
          }
        }
      });
    }

    // Check personal_code in party_person
    if (checkData.personal_code) {
      const { data: personMatches } = await supabaseAdmin
        .from("party_person")
        .select("party_id, personal_code, party!inner(id, display_name)")
        .eq("personal_code", checkData.personal_code);

      personMatches?.forEach((match: any) => {
        if (!duplicates.find((d) => d.id === match.party.id)) {
          duplicates.push({
            id: match.party.id,
            display_name: match.party.display_name || "",
            similarity_score: 1.0,
            match_fields: ["personal_code"],
          });
        } else {
          const existing = duplicates.find((d) => d.id === match.party.id);
          if (existing) {
            existing.match_fields.push("personal_code");
          }
        }
      });
    }

    // Check reg_number in party_company
    if (checkData.reg_number) {
      const { data: companyMatches } = await supabaseAdmin
        .from("party_company")
        .select("party_id, reg_number, party!inner(id, display_name)")
        .eq("reg_number", checkData.reg_number);

      companyMatches?.forEach((match: any) => {
        if (!duplicates.find((d) => d.id === match.party.id)) {
          duplicates.push({
            id: match.party.id,
            display_name: match.party.display_name || "",
            similarity_score: 1.0,
            match_fields: ["reg_number"],
          });
        } else {
          const existing = duplicates.find((d) => d.id === match.party.id);
          if (existing) {
            existing.match_fields.push("reg_number");
          }
        }
      });
    }

    // Fuzzy match by name + dob
    if (checkData.first_name && checkData.last_name) {
      const { data: nameMatches } = await supabaseAdmin
        .from("party_person")
        .select("party_id, first_name, last_name, dob, party!inner(id, display_name)")
        .ilike("first_name", `%${checkData.first_name}%`)
        .ilike("last_name", `%${checkData.last_name}%`);

      nameMatches?.forEach((match: any) => {
        let score = 0.7; // Base score for name match
        const matchFields = ["first_name", "last_name"];

        // Increase score if DOB matches
        if (checkData.dob && match.dob) {
          const checkDob = new Date(checkData.dob).toISOString().split("T")[0];
          const matchDob = new Date(match.dob).toISOString().split("T")[0];
          if (checkDob === matchDob) {
            score = 0.95;
            matchFields.push("dob");
          }
        }

        if (!duplicates.find((d) => d.id === match.party.id)) {
          duplicates.push({
            id: match.party.id,
            display_name: match.party.display_name || "",
            similarity_score: score,
            match_fields: matchFields,
          });
        } else {
          const existing = duplicates.find((d) => d.id === match.party.id);
          if (existing) {
            existing.similarity_score = Math.max(existing.similarity_score, score);
            matchFields.forEach((field) => {
              if (!existing.match_fields.includes(field)) {
                existing.match_fields.push(field);
              }
            });
          }
        }
      });
    }

    // Sort by similarity score (highest first)
    duplicates.sort((a, b) => b.similarity_score - a.similarity_score);

    return NextResponse.json({ duplicates });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Duplicate check error:", errorMsg);
    return NextResponse.json(
      { error: `Server error: ${errorMsg}` },
      { status: 500 }
    );
  }
}

