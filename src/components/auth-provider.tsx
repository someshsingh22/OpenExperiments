"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";

export interface AuthUser {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  profileCompleted: boolean;
}

export function reconcileAuthUser(
  previous: AuthUser | null,
  next: AuthUser | null,
): AuthUser | null {
  if (
    previous === next ||
    (previous !== null &&
      next !== null &&
      previous.id === next.id &&
      previous.name === next.name &&
      previous.email === next.email &&
      previous.avatarUrl === next.avatarUrl &&
      previous.profileCompleted === next.profileCompleted)
  ) {
    return previous;
  }
  return next;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  showAuthModal: boolean;
  setShowAuthModal: (v: boolean) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  signOut: async () => {},
  refresh: async () => {},
  showAuthModal: false,
  setShowAuthModal: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = (await res.json()) as { user: AuthUser | null };
      setUser((previous) => reconcileAuthUser(previous, data.user || null));
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, signOut, refresh, showAuthModal, setShowAuthModal }),
    [user, loading, signOut, refresh, showAuthModal, setShowAuthModal],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
