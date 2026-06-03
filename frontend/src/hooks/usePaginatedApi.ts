import { useState, useEffect, useCallback, useRef } from 'react';
import { ApiPaginatedResponse, PaginationParams } from '@/types/api.types';

/**
 * Generic hook for any paginated GET endpoint.
 *
 * Usage:
 *   const { data, meta, loading, error, setParams, refetch } =
 *     usePaginatedApi(productApi.getAll, { page: 1, limit: 25 });
 *
 * NOTE: `fetchFn` must be stable (e.g. a module-level function or wrapped in
 * useCallback). `initialParams` / setParams values are deep-compared so inline
 * object literals are safe to pass.
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

  // Stable serialisation key — prevents object-reference churn from causing
  // infinite re-fetch loops when callers pass inline object literals.
  const paramsKey = JSON.stringify(params);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFn(paramsRef.current);
      setData(res.data);
      setMeta(res.meta);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error?.message ?? 'Failed to load data';
      setError(message);
    } finally {
      setLoading(false);
    }
  // fetchFn is the only true dependency; paramsRef.current is read inside.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchFn]);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);
    fetchFn(paramsRef.current)
      .then((res) => {
        if (!cancelled) {
          setData(res.data);
          setMeta(res.meta);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = (err as { response?: { data?: { error?: { message?: string } } } })
            ?.response?.data?.error?.message ?? 'Failed to load data';
          setError(message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  // Re-run when fetchFn identity changes OR when serialised params change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetch, paramsKey]);

  return { data, meta, loading, error, setParams, refetch: fetch };
}
