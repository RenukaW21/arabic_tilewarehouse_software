// ─── Warehouse Types ──────────────────────────────────────────────────────────

export interface Warehouse {
  id: string;
  tenant_id: string;
  name: string;
  code: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CreateWarehouseDto {
  name: string;
  code: string;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
}

export interface UpdateWarehouseDto extends Partial<CreateWarehouseDto> {
  is_active?: boolean;
}

// ─── Rack Types ───────────────────────────────────────────────────────────────

export interface Rack {
  id: string;
  tenant_id: string;
  warehouse_id: string;
  name: string;
  aisle?: string | null;
  row?: string | null;
  level?: string | null;
  capacity_boxes?: number | null;
  qr_code?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface CreateRackDto {
  warehouse_id: string;
  name: string;
  aisle?: string | null;
  row?: string | null;
  level?: string | null;
  capacity_boxes?: number | null;
  qr_code?: string | null;
}

export interface UpdateRackDto extends Partial<CreateRackDto> {
  is_active?: boolean;
  warehouse_id?: string;
}

// ─── Category Types ───────────────────────────────────────────────────────────

export interface Category {
  id: string;
  tenant_id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCategoryDto {
  name: string;
  description?: string;
}

export interface UpdateCategoryDto extends Partial<CreateCategoryDto> {
  is_active?: boolean;
}

// ─── Shade Types ──────────────────────────────────────────────────────────────

export interface Shade {
  id: string;
  tenant_id: string;
  product_id: string;
  shade_code: string;
  shade_name?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Batch Types ──────────────────────────────────────────────────────────────

export interface Batch {
  id: string;
  tenant_id: string;
  product_id: string;
  shade_id?: string | null;
  batch_number: string;
  manufacture_date?: string | null;
  expiry_date?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
