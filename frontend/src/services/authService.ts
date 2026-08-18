import type { User } from '@/types';
import { mockUser } from '@/utils/mockData';

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
}

export const authService = {
  login: async (_input: LoginInput): Promise<{ user: User; token: string }> => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return { user: mockUser, token: 'mock-jwt-token' };
  },

  register: async (input: RegisterInput): Promise<{ user: User; token: string }> => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      user: { ...mockUser, name: input.name, email: input.email },
      token: 'mock-jwt-token',
    };
  },

  getCurrentUser: async (): Promise<User | null> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const token = localStorage.getItem('token');
    return token ? mockUser : null;
  },

  logout: (): void => {
    localStorage.removeItem('token');
  },
};
