'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { login as apiLogin, logout as apiLogout, getMe, switchOrg as apiSwitchOrg } from '../api/auth';
import type { AuthUser, OrgChoice } from '../types';

// ─── Context Shape ─────────────────────────────────────────────────────────────

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  pendingOrgSelection: OrgChoice[] | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  selectOrg: (organizationId: string) => Promise<void>;
  switchOrg: (organizationId: string) => Promise<void>;
}

// ─── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingOrgSelection, setPendingOrgSelection] = useState<OrgChoice[] | null>(null);

  useEffect(() => {
    async function restoreSession() {
      const token = typeof window !== 'undefined'
        ? localStorage.getItem('access_token')
        : null;

      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const me = await getMe();
        setUser(me);
      } catch {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
      } finally {
        setIsLoading(false);
      }
    }

    restoreSession();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await apiLogin(email, password);

    if ('requires_org_selection' in result && result.requires_org_selection) {
      if (typeof window !== 'undefined') {
        localStorage.setItem('selection_token', result.selection_token);
        // Store selection token as access_token so the API client can attach it
        localStorage.setItem('access_token', result.selection_token);
      }
      setPendingOrgSelection(result.organizations);
      router.replace('/select-org');
      return;
    }

    const tokens = result as import('../types').AuthTokens;
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', tokens.access_token);
      localStorage.setItem('refresh_token', tokens.refresh_token);
    }

    setUser(tokens.user);
  }, [router]);

  const selectOrg = useCallback(async (organizationId: string) => {
    const tokens = await apiSwitchOrg(organizationId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', tokens.access_token);
      localStorage.setItem('refresh_token', tokens.refresh_token);
      localStorage.removeItem('selection_token');
    }
    setPendingOrgSelection(null);
    setUser(tokens.user);
  }, []);

  const switchOrg = useCallback(async (organizationId: string) => {
    const tokens = await apiSwitchOrg(organizationId);
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', tokens.access_token);
      localStorage.setItem('refresh_token', tokens.refresh_token);
    }
    setUser(tokens.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {
      // Best-effort — proceed with local cleanup regardless
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('selection_token');
      }
      setUser(null);
      setPendingOrgSelection(null);
      router.push('/login');
    }
  }, [router]);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user,
    pendingOrgSelection,
    login,
    logout,
    selectOrg,
    switchOrg,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
