/**
 * Safely extracts a human-readable message from any error thrown by an API call.
 * Handles Axios response errors, plain Error objects, strings, and unknown shapes.
 */
export function extractApiError(e: unknown, fallback: string): string {
  if (!e) return fallback;
  if (typeof e === 'string') return e || fallback;
  if (typeof e === 'object') {
    const obj = e as Record<string, unknown>;
    const responseData = (obj?.response as Record<string, unknown> | undefined)?.data as Record<string, unknown> | undefined;
    const fromData =
      (responseData?.error as Record<string, unknown> | undefined)?.message as string | undefined ??
      (responseData?.message as string | undefined);
    if (fromData) return fromData;
    if (typeof obj?.message === 'string' && obj.message) return obj.message;
  }
  return fallback;
}
