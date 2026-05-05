"use client";

import { createContext, useContext, useState } from "react";

export type CurrentUser = {
  id: string;
  email: string;
  timezone?: string;
  clock_format?: "12h" | "24h";
  email_verified: boolean;
  has_password: boolean;
};

type AuthContextType = {
  user: CurrentUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  updateUserPreferences: (preferences: { timezone: string; clock_format: "12h" | "24h" }) => void;
  logoutUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const WORKSPACE_USER: CurrentUser = {
  id: "workspace-owner",
  email: "workspace@lensically.local",
  timezone: "America/New_York",
  clock_format: "12h",
  email_verified: true,
  has_password: true,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(WORKSPACE_USER);
  const [loading, setLoading] = useState(false);

  async function refreshUser() {
    setLoading(false);
    setUser(WORKSPACE_USER);
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
    setUser(WORKSPACE_USER);
  }

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
