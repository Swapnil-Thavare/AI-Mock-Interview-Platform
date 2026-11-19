import api from '@/services/api';
import type { User } from '@/types';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

const normalizeUser = (data: Record<string, unknown>): User => ({
  id: String(data.id ?? ''),
  email: (data.email as string) ?? '',
  name: (data.name as string) ?? (data.full_name as string) ?? '',
  full_name: (data.full_name as string) ?? (data.name as string) ?? '',
  avatar: (data.avatar as string) ?? undefined,
  role: (data.role as 'candidate' | 'admin') ?? 'candidate',
  phone: (data.phone as string) ?? undefined,
  skills: Array.isArray(data.skills) ? (data.skills as string[]) : undefined,
  education: Array.isArray(data.education)
    ? (data.education as string[])
    : (data.education as string) ?? undefined,
  experience: Array.isArray(data.experience)
    ? (data.experience as string[])
    : (data.experience as string) ?? undefined,
  createdAt: (data.createdAt as string) ?? (data.created_at as string) ?? undefined,
});

// Cookie auth: there is a single session per browser, so in-flight
// /auth/me calls are deduped under one constant key.
const SESSION_KEY = 'session';
const getCurrentUserInFlight = new Map<string, Promise<User | null>>();

const clearSession = () => {
  localStorage.removeItem('user');
  localStorage.removeItem('currentInterviewId');
  getCurrentUserInFlight.clear();
};

export const authService = {
  login: async (input: LoginInput): Promise<User> => {
    // The backend sets an HttpOnly session cookie on success; the token
    // is never returned in the response body.
    await api.post('/auth/login', input);
    const user = await authService.getCurrentUser();
    if (!user) {
      throw new Error('Could not load user after login');
    }
    return user;
  },

  register: async (input: RegisterInput): Promise<User> => {
    await api.post('/auth/register', {
      full_name: input.name,
      email: input.email,
      password: input.password,
    });
    return authService.login({ email: input.email, password: input.password });
  },

  getCurrentUser: async (): Promise<User | null> => {
    const pending = getCurrentUserInFlight.get(SESSION_KEY);
    if (pending) return pending;

    const promise = api.get('/auth/me')
      .then(({ data }) => normalizeUser(data as Record<string, unknown>))
      .catch(() => null)
      .finally(() => {
        getCurrentUserInFlight.delete(SESSION_KEY);
      });

    getCurrentUserInFlight.set(SESSION_KEY, promise);
    return promise;
  },

  clearSession,

  logout: async (): Promise<void> => {
    try {
      await api.post('/auth/logout');
    } catch {
      // A failed revocation call must not keep the user signed in locally.
    } finally {
      clearSession();
    }
  },

  updateMe: async (updates: Partial<User>): Promise<User> => {
    const { data } = await api.patch('/auth/me', updates);
    return normalizeUser(data);
  },
};
