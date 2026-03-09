import api from "@/lib/api";
import type { Vendor, CreateVendorDto, UpdateVendorDto } from "@/types/vendor.types";
import type { ApiResponse, ApiPaginatedResponse, PaginationParams } from "@/types/api.types";

const BASE = "/vendors";

export interface VendorListParams extends PaginationParams {
  is_active?: boolean | string;
}

/** Get paginated list with search and sort */
export async function getVendors(
  params?: VendorListParams
): Promise<ApiPaginatedResponse<Vendor>> {
  const res = await api.get<ApiPaginatedResponse<Vendor>>(BASE, { params });
  return res.data;
}

/** Get single vendor by ID */
export async function getVendorById(id: string): Promise<Vendor> {
  const res = await api.get<ApiResponse<Vendor>>(`${BASE}/${id}`);
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.message ?? "Vendor not found");
  }
  return res.data.data;
}

/** Create vendor */
export async function createVendor(payload: CreateVendorDto): Promise<Vendor> {
  const res = await api.post<ApiResponse<Vendor>>(BASE, payload);
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.message ?? "Create failed");
  }
  return res.data.data;
}

/** Update vendor */
export async function updateVendor(
  id: string,
  payload: UpdateVendorDto
): Promise<Vendor> {
  const res = await api.put<ApiResponse<Vendor>>(`${BASE}/${id}`, payload);
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.message ?? "Update failed");
  }
  return res.data.data;
}

/** Soft delete vendor (sets is_active = 0) */
export async function deleteVendor(id: string): Promise<void> {
  await api.delete(`${BASE}/${id}`);
}

export const vendorApi = {
  getAll: getVendors,
  getById: getVendorById,
  create: createVendor,
  update: updateVendor,
  delete: deleteVendor,
};
