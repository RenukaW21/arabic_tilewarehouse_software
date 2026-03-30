import axios, {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { toast } from 'sonner';

interface ApiErrorResponse {
  success: boolean;
  /** Flat format (new) */
  message?: string;
  code?: string;
  suggestion?: string;
  /** Legacy nested format (backward compat) */
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Extract the user-readable message from any API error shape.
 * Supports both the new flat format { message, code } and the old { error: { message } }.
 */
const extractApiError = (data?: ApiErrorResponse, fallback = 'Something went wrong') => {
  const message = data?.message || data?.error?.message || fallback;
  const suggestion = data?.suggestion ?? null;
  return { message, suggestion };
};

/**
 * Show a structured error toast:
 *   ❌ <title>
 *   Reason: <message>
 *   [Suggestion: <suggestion>]  ← only when present
 */
const showErrorToast = (title: string, message: string, suggestion?: string | null) => {
  const description = suggestion
    ? `Reason: ${message}\nSuggestion: ${suggestion}`
    : `Reason: ${message}`;
  toast.error(title, { description });
};

/**
 * Reusable Axios instance
 */
const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
  withCredentials: true,
});

// ─── Request Interceptor ─────────────────────────────────────
axiosInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor ────────────────────────────────────
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => response,

  async (error: AxiosError<ApiErrorResponse>) => {
    const status = error.response?.status;
    const data = error.response?.data;
    const apiCode = data?.code || data?.error?.code;
    const { message, suggestion } = extractApiError(data, error.message || 'Something went wrong');

    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    switch (status) {
      case 400:
        showErrorToast('Invalid Request', message, suggestion);
        break;

      case 401:
        if (apiCode === 'TOKEN_EXPIRED' && !originalRequest._retry) {
          originalRequest._retry = true;
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            try {
              const refreshRes = await axios.post(
                `${import.meta.env.VITE_API_BASE_URL}/auth/refresh`,
                { refreshToken }
              );
              const { accessToken, refreshToken: newRefresh } = refreshRes.data.data;
              localStorage.setItem('token', accessToken);
              localStorage.setItem('refreshToken', newRefresh);
              originalRequest.headers.Authorization = `Bearer ${accessToken}`;
              return axiosInstance(originalRequest);
            } catch {
              showErrorToast('Session Expired', 'Your session could not be refreshed.', 'Please log in again.');
            }
          }
        }
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/';
        break;

      case 403:
        showErrorToast('Access Denied', message || 'You do not have permission to perform this action.', 'Contact your administrator if you need access.');
        break;

      case 404:
        showErrorToast('Not Found', message, suggestion);
        break;

      case 409:
        showErrorToast('Duplicate Entry', message, suggestion || 'Use a different value or edit the existing record.');
        break;

      case 422:
        showErrorToast('Validation Failed', message, suggestion || 'Check all required fields and correct any errors.');
        break;

      case 429:
        showErrorToast('Too Many Requests', 'You are sending requests too quickly.', 'Wait a moment and try again.');
        break;

      case 500:
        showErrorToast('Server Error', message || 'An unexpected error occurred on the server.', 'Try again later. If the problem persists, contact support.');
        break;

      default:
        if (!error.response) {
          showErrorToast('Network Error', 'Unable to reach the server.', 'Check your internet connection or contact support if the backend is down.');
        } else {
          showErrorToast('Action Failed', message, suggestion);
        }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;