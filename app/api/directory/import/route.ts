import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { createClient } from "@supabase/supabase-js";
import { normalizePhoneForSave } from "@/utils/phone";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

async function getCurrentUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const authClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await authClient.auth.getUser(token);
    if (!error && data?.user) return data.user;
  }
  return null;
}

async function getCompanyId(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("company_id")
    .eq("user_id", userId)
    .single();
  return data?.company_id || null;
}

// Simple CSV parser (handles quoted values with commas)
function parseCSV(csvText: string): Record<string, string>[] {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) return [];

  // Parse header - handle quoted values
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
  
  // Parse rows
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]).map(v => v.replace(/^"|"$/g, '').trim());
    if (values.length > 0) {
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header.toLowerCase()] = values[index] || '';
      });
      rows.push(row);
    }
  }
  
  return rows;
}

// Map CSV row to DirectoryRecord format
function mapCSVRowToRecord(row: Record<string, string>, companyId: string, userId: string): Partial<any> {
  const type = (row.type || row['type'] || 'person').toLowerCase();
  const rolesStr = (row.roles || row['roles'] || '').toLowerCase();
  const roles = rolesStr.split(/[,;]/).map(r => r.trim()).filter(r => ['client', 'supplier', 'subagent'].includes(r));
  
  const record: any = {
    type: type === 'company' ? 'company' : 'person',
    roles: roles.length > 0 ? roles : ['client'], // Default to client if no roles
    isActive: true,
    company_id: companyId,
    created_by: userId,
  };

  if (type === 'person') {
    record.firstName = row['first name'] || row['firstname'] || row['first_name'] || '';
    record.lastName = row['last name'] || row['lastname'] || row['last_name'] || '';
    record.personalCode = row['personal code'] || row['personalcode'] || row['personal_code'] || undefined;
    record.dob = row['date of birth'] || row['dob'] || row['birthdate'] || undefined;
  } else {
    record.companyName = row['company name'] || row['companyname'] || row['company_name'] || '';
    record.regNumber = row['reg number'] || row['regnumber'] || row['reg_number'] || undefined;
    record.legalAddress = row['legal address'] || row['legaladdress'] || row['legal_address'] || undefined;
    record.actualAddress = row['actual address'] || row['actualaddress'] || row['actual_address'] || undefined;
  }

  // Common fields
  record.email = row.email || undefined;
  record.phone = row.phone || undefined;
  record.country = row.country || undefined;
  record.nationality = row.nationality || undefined;

  // Supplier fields
  if (roles.includes('supplier')) {
    const serviceAreas = (row['service areas'] || row['serviceareas'] || row['service_areas'] || '').split(/[,;]/).map(s => s.trim()).filter(s => s);
    record.supplierExtras = {
      serviceAreas: serviceAreas.length > 0 ? serviceAreas : undefined,
    };
  }

  return record;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const companyId = await getCompanyId(user.id);
    if (!companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileText = await file.text();
    const rows = parseCSV(fileText);

    if (rows.length === 0) {
      return NextResponse.json({ error: "CSV file is empty or invalid" }, { status: 400 });
    }

    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        const recordData = mapCSVRowToRecord(row, companyId, user.id);

        // Validate required fields
        if (recordData.type === 'person') {
          if (!recordData.firstName || !recordData.lastName) {
            errors.push(`Row ${i + 2}: First Name and Last Name are required for person type`);
            failed++;
            continue;
          }
        } else {
          if (!recordData.companyName) {
            errors.push(`Row ${i + 2}: Company Name is required for company type`);
            failed++;
            continue;
          }
        }

        if (!recordData.roles || recordData.roles.length === 0) {
          errors.push(`Row ${i + 2}: At least one role is required`);
          failed++;
          continue;
        }

        // Generate display_name
        const displayName = recordData.type === 'person'
          ? `${recordData.firstName || ''} ${recordData.lastName || ''}`.trim()
          : recordData.companyName || '';

        // Create party record
        const partyData: any = {
          display_name: displayName,
          party_type: recordData.type,
          status: 'active',
          company_id: companyId,
          email: recordData.email || null,
          phone: recordData.phone ? normalizePhoneForSave(recordData.phone) || null : null,
          country: recordData.country || null,
          service_areas: recordData.supplierExtras?.serviceAreas || null,
          supplier_commissions: null,
          created_by: user.id,
        };

        const { data: party, error: partyError } = await supabaseAdmin
          .from("party")
          .insert(partyData)
          .select()
          .single();

        if (partyError || !party) {
          errors.push(`Row ${i + 2}: Failed to create party - ${partyError?.message || 'Unknown error'}`);
          failed++;
          continue;
        }

        const partyId = party.id;

        // Create person or company record
        if (recordData.type === 'person') {
          const personData: any = {
            party_id: partyId,
            first_name: recordData.firstName,
            last_name: recordData.lastName,
            personal_code: recordData.personalCode || null,
            dob: recordData.dob || null,
            nationality: recordData.nationality || null,
          };

          const { error: personError } = await supabaseAdmin
            .from("party_person")
            .insert(personData);

          if (personError) {
            await supabaseAdmin.from("party").delete().eq("id", partyId);
            errors.push(`Row ${i + 2}: Failed to create person - ${personError.message}`);
            failed++;
            continue;
          }
        } else {
          const companyData: any = {
            party_id: partyId,
            company_name: recordData.companyName,
            reg_number: recordData.regNumber || null,
            legal_address: recordData.legalAddress || null,
            actual_address: recordData.actualAddress || null,
          };

          const { error: companyError } = await supabaseAdmin
            .from("party_company")
            .insert(companyData);

          if (companyError) {
            await supabaseAdmin.from("party").delete().eq("id", partyId);
            errors.push(`Row ${i + 2}: Failed to create company - ${companyError.message}`);
            failed++;
            continue;
          }
        }

        // Create role records
        if (recordData.roles.includes('client')) {
          const clientType = recordData.type === 'company' ? 'company' : 'person';
          const { error: clientError } = await supabaseAdmin
            .from("client_party")
            .insert({ party_id: partyId, client_type: clientType });
          
          if (clientError) {
            console.error(`Row ${i + 2}: Failed to create client role:`, clientError);
          }
        }

        if (recordData.roles.includes('supplier')) {
          const { error: supplierError } = await supabaseAdmin
            .from("partner_party")
            .insert({ party_id: partyId, partner_role: 'supplier' });
          
          if (supplierError) {
            console.error(`Row ${i + 2}: Failed to create supplier role:`, supplierError);
          }
        }

        if (recordData.roles.includes('subagent')) {
          const { error: subagentError } = await supabaseAdmin
            .from("subagents")
            .insert({ party_id: partyId });
          
          if (subagentError) {
            console.error(`Row ${i + 2}: Failed to create subagent role:`, subagentError);
          }
        }

        imported++;
      } catch (error) {
        console.error(`Row ${i + 2} error:`, error);
        errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        failed++;
      }
    }

    return NextResponse.json({
      imported,
      failed,
      total: rows.length,
      errors: errors.slice(0, 10), // Return first 10 errors
    });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import contacts" },
      { status: 500 }
    );
  }
}
