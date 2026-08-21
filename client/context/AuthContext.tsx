import { createContext, ReactNode, useContext, useMemo, useState } from "react";

export type UserRole = "admin" | "bidder";

export interface DemoUser {
  role: UserRole;
  name: string;
  email: string;
  password: string;
}

export const DEMO_USERS: DemoUser[] = [
  { role: "admin", name: "Alex Morgan", email: "admin@bidora.demo", password: "admin123" },
  { role: "bidder", name: "Jordan Lee", email: "bidder@bidora.demo", password: "bidder123" },
];

const STORAGE_KEY = "bidora:session";

interface AuthContextValue {
  user: DemoUser | null;
  login: (email: string, password: string) => boolean;
  loginAsDemo: (role: UserRole) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getStoredUser(): DemoUser | null {
  if (typeof window === "undefined") return null;
  const storedEmail = window.localStorage.getItem(STORAGE_KEY);
  return DEMO_USERS.find((demoUser) => demoUser.email === storedEmail) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(getStoredUser);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      login: (email, password) => {
        const matchedUser = DEMO_USERS.find(
          (demoUser) => demoUser.email === email.trim().toLowerCase() && demoUser.password === password,
        );
        if (!matchedUser) return false;
        window.localStorage.setItem(STORAGE_KEY, matchedUser.email);
        setUser(matchedUser);
        return true;
      },
      loginAsDemo: (role) => {
        const matchedUser = DEMO_USERS.find((demoUser) => demoUser.role === role);
        if (!matchedUser) return;
        window.localStorage.setItem(STORAGE_KEY, matchedUser.email);
        setUser(matchedUser);
      },
      logout: () => {
        window.localStorage.removeItem(STORAGE_KEY);
        setUser(null);
      },
    }),
    [user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
