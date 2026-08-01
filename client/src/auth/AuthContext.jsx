import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { apiRequest } from "../api/http.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const abortController = new AbortController();

    async function restoreSession() {
      try {
        const data = await apiRequest("/auth/me", {
          signal: abortController.signal,
        });

        setUser(data.user);
      } catch (error) {
        if (error.name === "AbortError") {
          return;
        }

        // A 401 simply means there is no active login session.
        if (error.status !== 401) {
          console.error("Session restoration failed:", error);
        }

        setUser(null);
      } finally {
        if (!abortController.signal.aborted) {
          setIsInitializing(false);
        }
      }
    }

    restoreSession();

    return () => {
      abortController.abort();
    };
  }, []);

  const register = useCallback(async ({ email, password }) => {
    const data = await apiRequest("/auth/register", {
      method: "POST",
      json: {
        email,
        password,
      },
    });

    setUser(data.user);

    return data.user;
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const data = await apiRequest("/auth/login", {
      method: "POST",
      json: {
        email,
        password,
      },
    });

    setUser(data.user);

    return data.user;
  }, []);

  const logout = useCallback(async () => {
    await apiRequest("/auth/logout", {
      method: "POST",
    });

    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isInitializing,
      register,
      login,
      logout,
    }),
    [user, isInitializing, register, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
