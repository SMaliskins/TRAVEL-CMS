import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

interface DuplicateCheckRequest {
  email?: string;
  phone?: string;
  personalCode?: string;
  regNumber?: string;
  firstName?: string;
  lastName?: string;
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

    if (!checkData.email && !checkData.phone && !checkData.personalCode && 
        !checkData.regNumber && !(checkData.firstName && checkData.lastName)) {
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
        // Avoid duplicates
        if (!duplicates.find(d => d.id === match.id)) {
          duplicates.push({
            id: match.id,
            display_name: match.display_name || "",
            similarity_score: 1.0,
            match_fields: ["phone"],
          });
        } else {
          const existing = duplicates.find(d => d.id === match.id);
          if (existing) {
            existing.match_fields.push("phone");
          }
        }
      });
    }

    if (checkData.personalCode) {
      const { data: personalCodeMatches } = await supabaseAdmin
        .from("party_person")
        .select("party_id, personal_code")
        .eq("personal_code", checkData.personalCode);

      if (personalCodeMatches && personalCodeMatches.length > 0) {
        const partyIds = personalCodeMatches.map(m => m.party_id);
        const { data: parties } = await supabaseAdmin
          .from("party")
          .select("id, display_name")
          .in("id", partyIds);

        parties?.forEach((party) => {
          if (!duplicates.find(d => d.id === party.id)) {
            duplicates.push({
              id: party.id,
              display_name: party.display_name || "",
              similarity_score: 1.0,
              match_fields: ["personalCode"],
            });
          } else {
            const existing = duplicates.find(d => d.id === party.id);
            if (existing) {
              existing.match_fields.push("personalCode");
            }
          }
        });
      }
    }

    if (checkData.regNumber) {
      const { data: regNumberMatches } = await supabaseAdmin
        .from("party_company")
        .select("party_id, reg_number")
        .eq("reg_number", checkData.regNumber);

      if (regNumberMatches && regNumberMatches.length > 0) {
        const partyIds = regNumberMatches.map(m => m.party_id);
        const { data: parties } = await supabaseAdmin
          .from("party")
          .select("id, display_name")
          .in("id", partyIds);

        parties?.forEach((party) => {
          if (!duplicates.find(d => d.id === party.id)) {
            duplicates.push({
              id: party.id,
              display_name: party.display_name || "",
              similarity_score: 1.0,
              match_fields: ["regNumber"],
            });
          } else {
            const existing = duplicates.find(d => d.id === party.id);
            if (existing) {
              existing.match_fields.push("regNumber");
            }
          }
        });
      }
    }

    // Fuzzy name + DOB match (for person type)
    if (checkData.firstName && checkData.lastName && checkData.dob) {
      const { data: personMatches } = await supabaseAdmin
        .from("party_person")
        .select("party_id, first_name, last_name, dob")
        .ilike("first_name", `%${checkData.firstName}%`)
        .ilike("last_name", `%${checkData.lastName}%`)
        .eq("dob", checkData.dob);

      if (personMatches && personMatches.length > 0) {
        const partyIds = personMatches.map(m => m.party_id);
        const { data: parties } = await supabaseAdmin
          .from("party")
          .select("id, display_name")
          .in("id", partyIds);

        parties?.forEach((party) => {
          if (!duplicates.find(d => d.id === party.id)) {
            duplicates.push({
              id: party.id,
              display_name: party.display_name || "",
              similarity_score: 0.8, // Fuzzy match
              match_fields: ["firstName", "lastName", "dob"],
            });
          } else {
            const existing = duplicates.find(d => d.id === party.id);
            if (existing) {
              existing.match_fields.push("firstName", "lastName", "dob");
              existing.similarity_score = Math.max(existing.similarity_score, 0.8);
            }
          }
        });
      }
    }

    return NextResponse.json({
      duplicates: duplicates.sort((a, b) => b.similarity_score - a.similarity_score),
    });
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Duplicate check error:", errorMsg);
    return NextResponse.json(
      { error: `Server error: ${errorMsg}` },
      { status: 500 }
    );
  }
}
