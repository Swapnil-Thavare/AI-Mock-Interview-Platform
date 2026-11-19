import axios, { type InternalAxiosRequestConfig } from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL,
  // The session token lives in an HttpOnly cookie set by /auth/login —
  // it is never readable by JS, so every request must send credentials.
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Let the browser set the multipart boundary for file uploads.
  if (config.data instanceof FormData) {
    (config.headers as any).delete('Content-Type');
  }

  return config;
});

// On expired/invalid sessions, clear local state and return to login.
// Auth endpoints are excluded so login/register attempts and the
// anonymous /auth/me probe don't trigger a redirect loop.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url: string = error?.config?.url ?? '';
    const isAuthEndpoint = url.includes('/auth/');
    if (status === 401 && !isAuthEndpoint) {
      localStorage.removeItem('user');
      localStorage.removeItem('currentInterviewId');
      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);

export const getApiErrorMessage = (err: unknown, fallback: string): string => {
  const data = (err as { response?: { data?: { detail?: unknown; message?: unknown } } })
    ?.response?.data;
  const detail = data?.detail ?? data?.message;
  if (typeof detail === 'string' && detail) return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] as { msg?: string };
    if (first?.msg) return first.msg;
  }
  return fallback;
};

export default api;
