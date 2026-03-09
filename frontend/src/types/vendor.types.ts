// ─── Vendor Types (aligned with DB: vendors table) ───────────────────────────

export interface Vendor {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  gstin: string | null;
  pan: string | null;
  payment_terms_days: number | null;
  is_active: boolean;
  created_at: string;
}

export interface CreateVendorDto {
  name: string;
  code?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gstin?: string | null;
  pan?: string | null;
  payment_terms_days?: number;
  is_active?: boolean;
}

export interface UpdateVendorDto extends Partial<CreateVendorDto> {
  is_active?: boolean;
}
