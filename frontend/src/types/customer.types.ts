// ─── Customer Types (aligned with DB: customers table) ─────────────────────────

export interface Customer {
  id: string;
  tenant_id: string;
  name: string;
  code: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  gstin: string | null;
  state_code: string | null;
  credit_limit: number | null;
  payment_terms_days: number | null;
  is_active: boolean;
  created_at: string;
}

export interface CreateCustomerDto {
  name: string;
  code?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  billing_address?: string | null;
  shipping_address?: string | null;
  gstin?: string | null;
  state_code?: string | null;
  credit_limit?: number | null;
  payment_terms_days?: number | null;
  is_active?: boolean;
}

export interface UpdateCustomerDto extends Partial<CreateCustomerDto> {
  is_active?: boolean;
}
