import { createContext, useContext } from "react";

export type User = {
  userName: string;
};

export type AuthState = {
  user: User | null;
  refresh: () => Promise<void>;
};

export const AuthContext = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const state = useContext(AuthContext);
  if (state === null) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return state;
}
