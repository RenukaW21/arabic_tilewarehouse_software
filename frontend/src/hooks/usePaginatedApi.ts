import { useState, useEffect, useCallback } from 'react';
import { ApiPaginatedResponse, PaginationParams } from '@/types/api.types';

/**
 * Generic hook for any paginated GET endpoint.
 *
 * Usage:
 *   const { data, meta, loading, error, setParams, refetch } =
 *     usePaginatedApi(productApi.getAll, { page: 1, limit: 25 });
 */
export function usePaginatedApi<T>(
  fetchFn: (params?: PaginationParams & Record<string, unknown>) => Promise<ApiPaginatedResponse<T>>,
  initialParams: PaginationParams & Record<string, unknown> = {}
) {
  const [data,    setData]    = useState<T[]>([]);
  const [meta,    setMeta]    = useState<ApiPaginatedResponse<T>['meta'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [params,  setParams]  = useState(initialParams);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFn(params);
      setData(res.data);
      setMeta(res.meta);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Failed to load data';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [fetchFn, params]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, meta, loading, error, setParams, refetch: fetch };
}
