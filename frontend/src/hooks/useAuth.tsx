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

// ─── Auth Provider ────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser]       = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: restore session from localStorage
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    // Set token header then verify by fetching profile
    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    authApi.getProfile()
      .then((res) => {
        if (res.success) setUser(res.data);
        else clearSession();
      })
      .catch(() => clearSession())
      .finally(() => setLoading(false));
  }, []);

  const clearSession = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    delete axiosInstance.defaults.headers.common['Authorization'];
    setUser(null);
  };

  /**
   * Call after a successful login API response.
   */
  const login = (userData: AuthUser, accessToken: string, refreshToken: string) => {
    localStorage.setItem('token', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
    setUser(userData);
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
