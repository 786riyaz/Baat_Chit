"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getToken, getStoredUser, clearSession } from "../services/api";
import { fetchCurrentUser } from "../services/auth";
import { connectSocket, disconnectSocket } from "../services/socket";
import { useToast } from "./useToast";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { showToast } = useToast();

  const logout = useCallback(() => {
    clearSession();
    disconnectSocket();
    setUser(null);
    router.push("/login");
  }, [router]);

  // Restore session on first load.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    setUser(getStoredUser());
    fetchCurrentUser()
      .then((freshUser) => setUser(freshUser))
      .catch(() => {
        clearSession();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Once logged in, keep a live socket connection open and merge
  // approval/trial updates the backend pushes in real time.
  useEffect(() => {
    if (!user) return undefined;
    const socket = connectSocket();

    function handleTrialUpdate(trial) {
      setUser((prev) => (prev ? { ...prev, ...trial } : prev));
    }
    function handleApprovalUpdate(payload) {
      setUser((prev) => (prev ? { ...prev, approvalStatus: payload.approvalStatus, ...(payload.trial || {}) } : prev));
      if (payload.message) showToast(payload.message, "success");
    }
    function handleConnectError(error) {
      console.error("Socket connection error:", error.message);
    }

    socket.on("trial_update", handleTrialUpdate);
    socket.on("approval_updated", handleApprovalUpdate);
    socket.on("connect_error", handleConnectError);

    return () => {
      socket.off("trial_update", handleTrialUpdate);
      socket.off("approval_updated", handleApprovalUpdate);
      socket.off("connect_error", handleConnectError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  return (
    <AuthContext.Provider value={{ user, setUser, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
