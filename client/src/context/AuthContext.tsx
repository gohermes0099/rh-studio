import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api } from '../api/client';

interface AuthState {
  isAuthenticated: boolean;
  user: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const handleAuthExpired = () => {
    localStorage.removeItem('auth_token');
    setIsAuthenticated(false);
    setUser(null);
    // Redirect to login if not already there
    if (location.pathname !== '/login') {
      navigate('/login', { state: { from: location }, replace: true });
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      api.me()
        .then((res) => {
          if (res && res.authenticated) {
            setIsAuthenticated(true);
            setUser(res.user);
          } else {
            handleAuthExpired();
          }
        })
        .catch(() => {
          handleAuthExpired();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    window.addEventListener('auth-expired', handleAuthExpired);
    return () => window.removeEventListener('auth-expired', handleAuthExpired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.login(username, password);
    localStorage.setItem('auth_token', res.token);
    setIsAuthenticated(true);
    setUser(res.user);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) { /* ignore */ }
    localStorage.removeItem('auth_token');
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}