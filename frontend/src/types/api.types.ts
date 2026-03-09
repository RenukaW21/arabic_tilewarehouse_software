// ─── Generic API Types ────────────────────────────────────────────────────────

/** Standardised error payload from backend */
export interface ApiError {
  code: string;
  message: string;
}

/** Wrapper for single-resource success responses */
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
}

/** Pagination metadata returned in list responses */
export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** Wrapper for paginated list responses */
export interface ApiPaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  meta: PaginationMeta;
}

/** Common query params accepted by all paginated list endpoints */
export interface PaginationParams {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}
