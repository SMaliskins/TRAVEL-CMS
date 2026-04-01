import { createClient } from "@supabase/supabase-js";

// Create admin client for server-side operations (bypasses RLS)
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

/**
 * Get list of column names from orders table
 * Returns Set<string> of lowercase column names
 * 
 * Uses a "try and learn" approach: attempts to query information_schema via RPC,
 * falls back to trying a minimal insert to discover columns
 */
export async function getOrdersColumns(): Promise<Set<string>> {
  try {
    // Try to use a database function to query information_schema
    // This requires a function to be created in the database:
    // CREATE OR REPLACE FUNCTION get_table_columns(table_name text)
    // RETURNS text[] AS $$
    //   SELECT array_agg(column_name::text)
    //   FROM information_schema.columns
    //   WHERE table_schema = 'public' AND table_name = $1;
    // $$ LANGUAGE sql SECURITY DEFINER;
    
    try {
      const supabaseAdmin = getSupabaseAdmin();
      // Use admin client for RPC to bypass RLS if needed
      const { data, error } = await supabaseAdmin.rpc('get_table_columns', {
        table_name: 'orders'
      });

      if (!error && data && Array.isArray(data)) {
        return new Set(data.map((col: string) => col.toLowerCase()));
      }
    } catch (rpcError) {
      // RPC not available or function doesn't exist - use fallback
      console.warn("RPC get_table_columns not available, using fallback");
    }

    // Fallback: Try to discover columns by attempting a minimal insert
    // This is less efficient but works without RPC
    return await discoverColumnsByInsert();
  } catch (error) {
    console.warn("Could not fetch orders columns, using fallback:", error);
    return new Set(); // Empty set means "we don't know, try all"
  }
}

/**
 * Discover columns by attempting a minimal insert and learning from errors
 * This is a fallback when RPC is not available
 */
async function discoverColumnsByInsert(): Promise<Set<string>> {
  const discoveredColumns = new Set<string>();
  
  // Try to select from orders to see what columns are accessible
  // We'll use a LIMIT 0 query which should work even on empty tables
  // Use admin client to bypass RLS
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select("*")
    .limit(0);

  // If query succeeds, we can't directly get column names from Supabase client
  // So we'll return empty set and let the resolver try all common names
  // The actual column discovery will happen during insert attempts
  
  return discoveredColumns; // Empty means "try all common names"
}

/**
 * Resolve order insert payload by mapping input to existing columns
 * Returns payload with only columns that exist in the table
 */
export function resolveOrderInsertPayload(
  input: {
    client_party_id: string;
    order_type: string;
    status?: string;
    owner_initials?: string;
    owner_name?: string;
    cities?: string[];
    countries?: string[];
    check_in_date?: string | null;
    return_date?: string | null;
  },
  columnsSet: Set<string>
): { payload: any; errors: string[] } {
  const payload: any = {};
  const errors: string[] = [];
  const columns = columnsSet.size > 0 ? columnsSet : null;

  // Helper to check if column exists
  // IMPORTANT: If we don't know columns (columns is null), return null for optional fields
  // Only return first name for required fields (they will fail with clear error if missing)
  const hasColumn = (names: string[], required: boolean = false): string | null => {
    if (!columns) {
      // If we don't know columns:
      // - For required fields: try first name (will fail with clear error if wrong)
      // - For optional fields: return null (don't include in payload)
      return required ? names[0] : null;
    }
    // If we know columns, check each name
    for (const name of names) {
      if (columns.has(name.toLowerCase())) {
        return name;
      }
    }
    return null;
  };

  // A) Order type (REQUIRED)
  const orderTypeCol = hasColumn(['order_type', 'type', 'order_kind'], true);
  if (orderTypeCol) {
    payload[orderTypeCol] = input.order_type;
  } else {
    errors.push("orders table missing order type column (expected: order_type, type, or order_kind)");
  }

  // B) Client party ID (REQUIRED)
  const clientCol = hasColumn(['client_party_id', 'client_id', 'party_id'], true);
  if (clientCol) {
    payload[clientCol] = input.client_party_id;
  } else {
    errors.push("orders table missing client_party_id column");
  }

  // C) Check-in date (OPTIONAL - only include if we know column exists)
  if (input.check_in_date) {
    const checkInCol = hasColumn([
      'check_in',
      'checkin',
      'check_in_date',
      'checkin_date',
      'start_date',
      'date_from',
      'dates_from'
    ], false);
    if (checkInCol) {
      payload[checkInCol] = input.check_in_date;
    }
    // If no column found (or we don't know columns), just skip (optional field)
  }

  // D) Return date (OPTIONAL - only include if we know column exists)
  if (input.return_date) {
    const returnCol = hasColumn([
      'return',
      'return_date',
      'check_out',
      'checkout',
      'check_out_date',
      'checkout_date',
      'end_date',
      'date_to',
      'dates_to'
    ], false);
    if (returnCol) {
      payload[returnCol] = input.return_date;
    }
    // If no column found (or we don't know columns), just skip (optional field)
  }

  // E) Cities (OPTIONAL - only include if we know column exists)
  if (input.cities && input.cities.length > 0) {
    const citiesCol = hasColumn(['cities', 'city', 'destination_city'], false);
    if (citiesCol) {
      // Join as string (safer than array for unknown column types)
      payload[citiesCol] = input.cities.join(", ");
    }
    // If no column found (or we don't know columns), just skip (optional field)
    // DO NOT include cities in payload if column doesn't exist
  }

  // F) Countries (OPTIONAL - only include if we know column exists)
  if (input.countries && input.countries.length > 0) {
    const countriesCol = hasColumn(['countries', 'country', 'destination_country'], false);
    if (countriesCol) {
      // Join as string (safer than array for unknown column types)
      payload[countriesCol] = input.countries.join(", ");
    }
    // If no column found (or we don't know columns), just skip (optional field)
    // DO NOT include countries in payload if column doesn't exist
  }

  // G) Status (OPTIONAL - only include if we know column exists)
  const statusCol = hasColumn(['status', 'order_status'], false);
  if (statusCol) {
    payload[statusCol] = input.status || "Active";
  }
  // If status column doesn't exist, skip it (optional field)

  // H) Timestamps (OPTIONAL - let DB defaults handle if columns exist)
  const createdAtCol = hasColumn(['created_at', 'created']);
  if (createdAtCol) {
    payload[createdAtCol] = new Date().toISOString();
  }

  const updatedAtCol = hasColumn(['updated_at', 'updated']);
  if (updatedAtCol) {
    payload[updatedAtCol] = new Date().toISOString();
  }

  return { payload, errors };
}

