import axios, { type InternalAxiosRequestConfig, type AxiosResponse } from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// In-flight GET request cache.
// React StrictMode in development can double-invoke mount effects, which would
// otherwise issue the same GET twice. Reusing the same pending promise for
// identical concurrent GETs makes the network layer idempotent without changing
// the component fetch logic or removing StrictMode.
const inFlight = new Map<string, Promise<AxiosResponse<unknown>>>();

const getCacheKey = (
  url: string,
  token: string | null,
  params?: unknown
): string => `get:${url}:${token ?? ''}:${JSON.stringify(params ?? {})}`;

const originalGet = (api as any).get as (
  url: string,
  config?: any
) => Promise<AxiosResponse<unknown>>;

(api as any).get = async (
  url: string,
  config?: any
): Promise<AxiosResponse<unknown>> => {
  // When the caller provides an AbortSignal we must not share the request,
  // because the shared promise cannot be cancelled independently.
  if (config?.signal) {
    return originalGet(url, config);
  }

  const token = localStorage.getItem('token');
  const key = getCacheKey(url, token, config?.params);

  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = originalGet(url, config).finally(() => {
    inFlight.delete(key);
  });

  inFlight.set(key, promise);
  return promise;
};

export default api;
