-- Optional: Create database function to query table columns
-- This function allows the API to discover which columns exist in the orders table
-- Run this in your Supabase SQL editor if you want column discovery to work

CREATE OR REPLACE FUNCTION get_table_columns(table_name text)
RETURNS text[] AS $$
  SELECT array_agg(column_name::text)
  FROM information_schema.columns
  WHERE table_schema = 'public' 
    AND table_name = $1
    AND table_catalog = current_database();
$$ LANGUAGE sql SECURITY DEFINER;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_columns(text) TO anon;

-- Note: If you don't create this function, the API will use a fallback approach
-- that tries common column names and handles errors gracefully.

