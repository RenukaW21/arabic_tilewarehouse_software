import { useState, useEffect, createContext, useContext } from 'react';
import axiosInstance from '@/api/axios';
import { authApi } from '@/api/authApi';
import { AuthUser } from '@/types/auth.types';

// ─── Context Types ────────────────────────────────────────────────────────────

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: () => {},
  signOut: async () => {},
});

const AUTH_USER_STORAGE_KEY = 'authUser';

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return JSON.parse(window.atob(padded));
  } catch {
    return null;
  }
};

const buildUserFromToken = (token: string): AuthUser | null => {
  const payload = decodeJwtPayload(token);
  if (!payload) return null;

  const id = payload.sub;
  const tenantId = payload.tenantId;
  const role = payload.role;
  const email = payload.email;
  const name = payload.name;

  if (
    typeof id !== 'string' ||
    typeof tenantId !== 'string' ||
    typeof role !== 'string' ||
    typeof email !== 'string' ||
    typeof name !== 'string'
  ) {
    return null;
  }

  return {
    id,
    tenantId,
    role: role as AuthUser['role'],
    email,
    name,
    tenantSlug: '',
    isActive: true,
  };
};

// ─── Auth Provider ────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const persistUser = (userData: AuthUser | null) => {
    if (userData) {
      localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(userData));
    } else {
      localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    }
    setUser(userData);
  };

  const clearSession = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
    delete axiosInstance.defaults.headers.common['Authorization'];
    setUser(null);
  };

  // On mount: restore session from localStorage
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    const cachedUser = localStorage.getItem(AUTH_USER_STORAGE_KEY);

    if (cachedUser) {
      try {
        persistUser(JSON.parse(cachedUser) as AuthUser);
        setLoading(false);
      } catch {
        localStorage.removeItem(AUTH_USER_STORAGE_KEY);
      }
    } else {
      const tokenUser = buildUserFromToken(token);
      if (tokenUser) {
        persistUser(tokenUser);
        setLoading(false);
      }
    }

    // Refresh the profile in the background so route rendering does not block
    // on this request after every page reload.
    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    authApi.getProfile()
      .then((res) => {
        if (res.success) {
          persistUser(res.data);
          return;
        }

        clearSession();
      })
      .catch(() => {
        if (!cachedUser) {
          clearSession();
        }
      })
      .finally(() => {
        if (!cachedUser) {
          setLoading(false);
        }
      });
  }, []);

  /**
   * Call after a successful login API response.
   */
  const login = (userData: AuthUser, accessToken: string, refreshToken: string) => {
    localStorage.setItem('token', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    persistUser(userData);
  };

  /**
   * Logout — clears local state and invalidates the server-side refresh token.
   */
  const signOut = async () => {
    const refreshToken = localStorage.getItem('refreshToken') || '';
    try {
      await authApi.logout(refreshToken);
    } catch {
      // Ignore — clear local state regardless
    }
    clearSession();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
