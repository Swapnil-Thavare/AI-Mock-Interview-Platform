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

export const authService = {
  login: async (input: LoginInput): Promise<{ token: string; user: User }> => {
    const { data } = await api.post('/auth/login', input);
    const token = (data.access_token as string) ?? (data.token as string) ?? '';

    let user: User | null = null;
    try {
      localStorage.setItem('token', token);
      user = await authService.getCurrentUser();
    } catch {
      /* /auth/me may not be available */
    }

    if (!user) {
      user = { id: '', email: input.email, name: input.email };
    }

    return { token, user };
  },

  register: async (input: RegisterInput): Promise<{ token: string; user: User }> => {
    const { data } = await api.post('/auth/register', {
      full_name: input.name,
      email: input.email,
      password: input.password,
    });

    const id = String(data.user_id ?? data.id ?? '');

    // The real backend only returns a message and user_id. Log in to get a token.
    const loginRes = await authService.login({ email: input.email, password: input.password });

    const user: User = {
      ...loginRes.user,
      id,
      name: input.name,
      full_name: input.name,
      email: input.email,
    };

    return { token: loginRes.token, user };
  },

  getCurrentUser: async (): Promise<User | null> => {
    try {
      const { data } = await api.get('/auth/me');
      return normalizeUser(data);
    } catch {
      return null;
    }
  },

  logout: (): void => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  updateMe: async (updates: Partial<User>): Promise<User> => {
    const { data } = await api.patch('/auth/me', updates);
    return normalizeUser(data);
  },
};
