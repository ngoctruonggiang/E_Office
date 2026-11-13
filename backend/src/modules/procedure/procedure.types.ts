export type ProcedureStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type ActorAssigneeType = 'DIRECT_USER' | 'DYNAMIC_RULE';
export type VariableMappingType = 'NUMBER' | 'STRING' | 'BOOLEAN';

export interface ValidationErrorItem {
  code: string;
  field: string;
  message: string;
}

export interface ValidationWarningItem {
  code: string;
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationErrorItem[];
  warnings: ValidationWarningItem[];
}

export interface UserDirectoryItem {
  id: string;
  displayName: string | null;
  email: string;
  department: string | null;
  title: string | null;
  role: string;
  isActive: boolean;
  signatureImage: string | null;
}

