import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '@/services/authService';
import type { User } from '@/types';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  updateUser: (next: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const USER_KEY = 'user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    const init = async () => {
      try {
        // The HttpOnly session cookie is sent automatically; /auth/me
        // returns the user when a session exists and 401s otherwise.
        const fromApi = await authService.getCurrentUser();
        if (!fromApi) {
          authService.clearSession();
        } else if (!ignore) {
          localStorage.setItem(USER_KEY, JSON.stringify(fromApi));
        }
        if (!ignore) {
          setUser(fromApi);
        }
      } catch {
        authService.clearSession();
        if (!ignore) {
          setUser(null);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    init();
    return () => {
      ignore = true;
    };
  }, []);

  const persist = (next: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(next));
    setUser(next);
  };

  const login = async (email: string, password: string) => {
    persist(await authService.login({ email, password }));
  };

  const register = async (name: string, email: string, password: string) => {
    persist(await authService.register({ name, email, password }));
  };

  const updateUser = (next: User) => {
    localStorage.setItem(USER_KEY, JSON.stringify(next));
    setUser(next);
  };

  const logout = () => {
    void authService.logout();
    setUser(null);
    navigate('/login', { replace: true });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
