import React, { createContext, useContext, useState, useCallback } from "react";
import { authApi } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // Check persistent login first
    const localUser = localStorage.getItem("dia_user");

    // Then check session login
    const sessionUser = sessionStorage.getItem("dia_user");

    const raw = localUser || sessionUser;

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      localStorage.removeItem("dia_user");
      sessionStorage.removeItem("dia_user");
      return null;
    }
  });

  // Login
  const login = useCallback(
    async (email, password, rememberMe = false) => {
      const { data } = await authApi.login(email, password);

      const storage = rememberMe ? localStorage : sessionStorage;

      // Save login according to Remember Me
      storage.setItem("dia_token", data.access_token);
      storage.setItem("dia_user", JSON.stringify(data.user));

      // Remove old login from the other storage
      if (rememberMe) {
        sessionStorage.removeItem("dia_token");
        sessionStorage.removeItem("dia_user");
      } else {
        localStorage.removeItem("dia_token");
        localStorage.removeItem("dia_user");
      }

      setUser(data.user);

      return data;
    },
    []
  );

  // Existing signup function
  const signup = useCallback(async (name, email, password) => {
    const { data } = await authApi.signup({
      name,
      email,
      password,
    });

    localStorage.setItem("dia_token", data.access_token);
    localStorage.setItem("dia_user", JSON.stringify(data.user));

    setUser(data.user);

    return data;
  }, []);

  // Send OTP to email
  const sendSignupOtp = useCallback(
    async (name, email, password) => {
      const { data } = await authApi.sendSignupOtp({
        name,
        email,
        password,
      });

      return data;
    },
    []
  );

  // Verify OTP and complete signup
  const verifySignupOtp = useCallback(async (email, otp) => {
    const { data } = await authApi.verifySignupOtp({
      email,
      otp,
    });

    localStorage.setItem("dia_token", data.access_token);
    localStorage.setItem("dia_user", JSON.stringify(data.user));

    setUser(data.user);

    return data;
  }, []);

  // Logout
  const logout = useCallback(() => {
    localStorage.removeItem("dia_token");
    localStorage.removeItem("dia_user");

    sessionStorage.removeItem("dia_token");
    sessionStorage.removeItem("dia_user");

    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        signup,
        sendSignupOtp,
        verifySignupOtp,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}