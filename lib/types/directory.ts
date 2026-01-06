export type DirectoryType = "person" | "company";
export type DirectoryRole = "client" | "supplier" | "subagent";
export type SubagentCommissionType = "percentage" | "fixed";

export interface SupplierDetails {
  // No additional fields needed for Supplier role
}

export interface SubagentDetails {
  commissionType?: SubagentCommissionType;
  commissionValue?: number;
  commissionCurrency?: string;
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
  
  // Passport fields
  passportNumber?: string;
  passportIssueDate?: string;
  passportExpiryDate?: string;
  passportIssuingCountry?: string;
  passportFullName?: string;
  nationality?: string;
  
  // Company fields
  companyName?: string;
  regNumber?: string;
  legalAddress?: string;
  actualAddress?: string;
  
  // Common fields
  phone?: string;
  email?: string;
  
  // Supplier-specific
  supplierExtras?: SupplierDetails;
  
  // Subagent-specific
  subagentExtras?: SubagentDetails;
}
