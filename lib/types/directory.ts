export type DirectoryType = "person" | "company";
export type DirectoryRole = "client" | "supplier" | "subagent";
export type SubagentCommissionType = "percentage" | "fixed";

export interface SupplierCommission {
  name: string;
  rate: number; // percentage
  isActive: boolean;
}

export interface SupplierDetails {
  serviceAreas?: string[]; // Categories from travel_service_categories (e.g., ["Hotel", "Transfer"])
  commissions?: SupplierCommission[];
}

export interface SubagentDetails {
  commissionType?: SubagentCommissionType;
  commissionValue?: number;
  commissionCurrency?: string;
}

export interface DirectoryRecord {
  id: string;
  displayId?: number; // Sequential ID (00001, 00002, ...)
  type: DirectoryType;
  roles: DirectoryRole[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  
  // Person fields
  firstName?: string;
  lastName?: string;
  title?: string;
  gender?: string; // male | female
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
  avatarUrl?: string; // Photo extracted from passport
  /** Estonia/Latvia Alien's passport – document says "Alien's passport". Show red icon next to passport. */
  isAlienPassport?: boolean;
  
  // Company fields
  companyName?: string;
  regNumber?: string;
  legalAddress?: string;
  actualAddress?: string;
  
  // Common fields
  phone?: string;
  email?: string;
  country?: string;
  
  // Supplier-specific
  supplierExtras?: SupplierDetails;
  
  // Subagent-specific
  subagentExtras?: SubagentDetails;

  // Audit (who created / last updated)
  createdById?: string;
  updatedById?: string;
  createdByDisplayName?: string;
  updatedByDisplayName?: string;
}
