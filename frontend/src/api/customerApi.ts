import axiosInstance from "@/api/axios";
import type { Customer, CreateCustomerDto, UpdateCustomerDto } from "@/types/customer.types";
import type { ApiResponse, ApiPaginatedResponse, PaginationParams } from "@/types/api.types";

const BASE = "/customers";

export interface CustomerListParams extends PaginationParams {
  is_active?: boolean | string;
}

export async function getCustomers(
  params?: CustomerListParams
): Promise<ApiPaginatedResponse<Customer>> {
  const res = await axiosInstance.get<ApiPaginatedResponse<Customer>>(BASE, { params });
  return res.data;
}

export async function getCustomerById(id: string): Promise<Customer> {
  const res = await axiosInstance.get<ApiResponse<Customer>>(`${BASE}/${id}`);
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.message ?? "Customer not found");
  }
  return res.data.data;
}

export async function createCustomer(payload: CreateCustomerDto): Promise<Customer> {
  const res = await axiosInstance.post<ApiResponse<Customer>>(BASE, payload);
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.message ?? "Create failed");
  }
  return res.data.data;
}

export async function updateCustomer(
  id: string,
  payload: UpdateCustomerDto
): Promise<Customer> {
  const res = await axiosInstance.put<ApiResponse<Customer>>(`${BASE}/${id}`, payload);
  if (!res.data.success || !res.data.data) {
    throw new Error(res.data.message ?? "Update failed");
  }
  return res.data.data;
}

export async function deleteCustomer(id: string): Promise<void> {
  await axiosInstance.delete(`${BASE}/${id}`);
}

export const customerApi = {
  getAll: getCustomers,
  getById: getCustomerById,
  create: createCustomer,
  update: updateCustomer,
  delete: deleteCustomer,
};
