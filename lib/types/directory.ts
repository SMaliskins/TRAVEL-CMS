// Helper types
export type DirectoryType = 'person' | 'company';
export type DirectoryRole = 'client' | 'supplier' | 'subagent';
export type DirectoryStatus = 'active' | 'inactive' | 'blocked';
export type BusinessCategory = 'TO' | 'Hotel' | 'Rent a car' | 'Airline' | 'DMC' | 'Other';
export type CommissionType = 'percent' | 'fixed';
export type CommissionScheme = 'revenue' | 'profit';
// Legacy alias for backward compatibility (should be replaced with CommissionScheme in DirectoryForm)
export type SubagentCommissionType = CommissionScheme;

// Supplier details structure
export interface SupplierDetails {
  business_category?: BusinessCategory;
  commission_type?: CommissionType;
  commission_value?: number;
  commission_currency?: string;
  commission_valid_from?: string;
  commission_valid_to?: string;
  commission_notes?: string;
}

// Subagent details structure
export interface SubagentDetails {
  commission_scheme?: CommissionScheme;
  commission_tiers?: any; // JSON structure for progressive tiers
  payout_details?: string;
}

// Main DirectoryRecord interface per full architecture specification
export interface DirectoryRecord {
  // Core
  id: string;
  display_name: string;
  party_type: DirectoryType;
  roles: DirectoryRole[];
  status: DirectoryStatus;
  rating?: number; // 1-10
  notes?: string;
  company_id: string; // Tenant isolation
  
  // Contacts (not duplicated)
  email?: string;
  phone?: string;
  email_marketing_consent?: boolean;
  phone_marketing_consent?: boolean;
  
  // Person fields
  title?: string; // Mr/Mrs/Chd
  first_name?: string; // Required if person
  last_name?: string; // Required if person
  dob?: string; // NOT required
  personal_code?: string; // NOT required
  citizenship?: string;
  address?: string;
  
  // Company fields
  company_name?: string; // Required if company
  reg_number?: string; // NOT required
  legal_address?: string; // NOT required
  actual_address?: string;
  bank_details?: string;
  
  // Supplier add-on
  supplier_details?: SupplierDetails;
  
  // Subagent add-on
  subagent_details?: SubagentDetails;
  
  // Statistics (computed, not stored)
  total_spent?: number;
  last_trip_date?: string;
  next_trip_date?: string;
  debt?: number;
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string;
}
