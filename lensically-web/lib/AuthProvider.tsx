"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getCurrentUser, logout, type CurrentUser } from "./authClient";

type AuthContextType = {
  user: CurrentUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  updateUserPreferences: (preferences: { timezone: string; clock_format: "12h" | "24h" }) => void;
  logoutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    setLoading(true);
    try {
      const data = await getCurrentUser();

      if (data?.id) {
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  function updateUserPreferences(preferences: { timezone: string; clock_format: "12h" | "24h" }) {
    setUser((previousUser) => {
      if (!previousUser) {
        return previousUser;
      }
      return {
        ...previousUser,
        timezone: preferences.timezone,
        clock_format: preferences.clock_format,
      };
    });
  }

  async function logoutUser() {
    try {
      await logout();
    } finally {
      setUser(null);
    }
  }

  useEffect(() => {
    void refreshUser();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        refreshUser,
        updateUserPreferences,
        logoutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
