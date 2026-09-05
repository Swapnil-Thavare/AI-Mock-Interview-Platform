import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService } from '@/services/authService';
import type { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = 'token';
const USER_KEY = 'user';

const storedUser = (): User | null => {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(STORAGE_KEY);
    if (!token) {
      setLoading(false);
      return;
    }

    let ignore = false;
    const init = async () => {
      let current = storedUser();
      try {
        const fromApi = await authService.getCurrentUser();
        if (fromApi) current = fromApi;
      } catch {
        /* keep stored user if /auth/me is not available */
      }
      if (ignore) return;
      setUser(current);
      setLoading(false);
    };

    init();
    return () => {
      ignore = true;
    };
  }, []);

  const persist = (token: string, next: User) => {
    localStorage.setItem(STORAGE_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(next));
    setUser(next);
  };

  const login = async (email: string, password: string) => {
    const res = await authService.login({ email, password });
    persist(res.token, res.user);
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await authService.register({ name, email, password });
    persist(res.token, res.user);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
