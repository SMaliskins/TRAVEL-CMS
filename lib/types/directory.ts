export type DirectoryType = "person" | "company";
export type DirectoryRole = "client" | "supplier" | "subagent";
export type SubagentCommissionType = "percentage" | "fixed" | "revenue" | "profit";
export type SupplierCommissionType = "percent" | "fixed";
export type SubagentPeriodType = "year" | "month" | "quarter" | "custom";

// Basic supplier details (API compatible)
export interface SupplierExtras {
  activityArea?: string;
}

// Basic subagent details (API compatible)
export interface SubagentExtras {
  commissionType?: SubagentCommissionType;
  commissionValue?: number;
  commissionCurrency?: string;
}

// Extended supplier details (Form compatible)
export interface SupplierDetails {
  activityArea?: string;
  commissionType?: SupplierCommissionType;
  commissionValue?: number;
  commissionCurrency?: string;
  commissionValidFrom?: string;
  commissionValidTo?: string;
}

// Extended subagent details (Form compatible)
export interface SubagentDetails {
  commissionType?: SubagentCommissionType;
  commissionValue?: number;
  commissionCurrency?: string;
  periodType?: SubagentPeriodType;
  periodFrom?: string;
  periodTo?: string;
  paymentDetails?: string;
}

export interface DirectoryRecord {
  id: string;
  type: DirectoryType;
  roles: DirectoryRole[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  
  // Person fields
  firstName?: string;
  lastName?: string;
  title?: string;
  dob?: string;
  personalCode?: string;
  citizenship?: string;
  address?: string; // Person address (party_person.address)
  
  // Company fields
  companyName?: string;
  regNumber?: string;
  regNo?: string; // Alias for regNumber (form compatibility)
  legalAddress?: string;
  actualAddress?: string;
  contactPerson?: string; // Contact person for company
  
  // Common fields
  phone?: string;
  email?: string;
  
  // Supplier-specific (API compatible names)
  supplierExtras?: SupplierExtras;
  // Supplier-specific (Form compatible names)
  supplierDetails?: SupplierDetails;
  
  // Subagent-specific (API compatible names)
  subagentExtras?: SubagentExtras;
  // Subagent-specific (Form compatible names)
  subagentDetails?: SubagentDetails;
}
