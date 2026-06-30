import React, { createContext, useContext, useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import type { AppUser, UserRole } from "@/types";

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  signUp: (email: string, password: string, role: UserRole, extra: { name: string; phone: string; country_code: string; currency: string }) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string, expectedRole: UserRole) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data } = await sb.from("users").select("*").eq("id", userId).maybeSingle();
    setUser(data as AppUser | null);
  }

  async function refreshUser() {
    const { data } = await sb.auth.getSession();
    if (data.session?.user) await loadProfile(data.session.user.id);
  }

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => {
      if (data.session?.user) loadProfile(data.session.user.id).finally(() => setLoading(false));
      else setLoading(false);
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadProfile(session.user.id);
      else setUser(null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signUp(
    email: string, password: string, role: UserRole,
    extra: { name: string; phone: string; country_code: string; currency: string },
  ) {
    const { data, error } = await sb.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (!data.user) return { error: "Sign up failed — please try again." };

    const { error: insertErr } = await sb.from("users").insert({
      id: data.user.id, email, name: extra.name, phone: extra.phone,
      role, country_code: extra.country_code, currency: extra.currency,
    });
    if (insertErr) return { error: insertErr.message };

    await loadProfile(data.user.id);
    return { error: null };
  }

  async function signIn(email: string, password: string, expectedRole: UserRole) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (!data.user) return { error: "Sign in failed — please try again." };

    const { data: profile } = await sb.from("users").select("*").eq("id", data.user.id).maybeSingle();
    if (!profile) return { error: "No profile found for this account." };

    // A buyer account can't sign in through the seller door, and vice versa —
    // admins can sign in through either.
    if (profile.role !== expectedRole && profile.role !== "admin") {
      await sb.auth.signOut();
      return { error: `This account is registered as a ${profile.role}. Use the ${profile.role} sign-in page instead.` };
    }

    setUser(profile as AppUser);
    return { error: null };
  }

  async function signOut() {
    await sb.auth.signOut();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
