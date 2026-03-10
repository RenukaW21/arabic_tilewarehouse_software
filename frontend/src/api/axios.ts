import axios, {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from 'axios';
import { toast } from 'sonner';

interface ApiErrorResponse {
  success: boolean;
  error: {
    code: string;
    message: string;
  };
}

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
    const code = error.response?.data?.error?.code;
    const msg =
      error.response?.data?.error?.message ||
      error.message ||
      'Something went wrong';

    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    switch (status) {
      case 400:
        toast.error(`Validation error: ${msg}`);
        break;

      case 401:
        if (code === 'TOKEN_EXPIRED' && !originalRequest._retry) {
          originalRequest._retry = true;

          const refreshToken = localStorage.getItem('refreshToken');

          if (refreshToken) {
            try {
              const refreshRes = await axios.post(
                `${import.meta.env.VITE_API_BASE_URL}/auth/refresh`,
                { refreshToken }
              );

              const { accessToken, refreshToken: newRefresh } =
                refreshRes.data.data;

              localStorage.setItem('token', accessToken);
              localStorage.setItem('refreshToken', newRefresh);

              originalRequest.headers.Authorization = `Bearer ${accessToken}`;

              return axiosInstance(originalRequest);
            } catch (refreshError) {
              toast.error('Session expired. Please log in again.');
            }
          }
        }

        // Logout fallback
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        window.location.href = '/auth';
        break;

      case 403:
        toast.error('Forbidden – no permission.');
        break;

      case 404:
        toast.error(`Not found: ${msg}`);
        break;

      case 409:
        toast.error(`Conflict: ${msg}`);
        break;

      case 422:
        toast.error(`Unprocessable: ${msg}`);
        break;

      case 429:
        toast.error('Too many requests.');
        break;

      case 500:
        toast.error('Server error. Try again later.');
        break;

      default:
        if (!error.response) {
          toast.error(
            'Network error – check backend or CORS configuration.'
          );
        } else {
          toast.error(msg);
        }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;