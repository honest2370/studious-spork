import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { UserRole } from "@/types";

export default function RequireRole({ role, children }: { role: UserRole; children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Loading…</div>;
  if (!user) return <Navigate to={role === "seller" ? "/seller/login" : "/buyer/login"} replace />;
  if (user.role !== role && user.role !== "admin") {
    // Signed in, but on the wrong side of the fence — send them home instead
    // of showing tools that don't belong to their role.
    return <Navigate to={user.role === "seller" ? "/seller" : "/buyer"} replace />;
  }
  return <>{children}</>;
}
