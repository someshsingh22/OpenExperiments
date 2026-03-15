"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

export interface AuthUser {
  id: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
  profileCompleted: boolean;
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
      setUser(data.user || null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const signOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, signOut, refresh, showAuthModal, setShowAuthModal }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
