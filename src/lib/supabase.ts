import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Set these in your .env file locally, " +
    "and in Vercel → Project Settings → Environment Variables for production."
  );
}

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const FN_BASE = `${SUPABASE_URL}/functions/v1`;

/**
 * Standard headers for calling edge functions directly via fetch
 * (needed because some of our functions are called by guests with no
 * Supabase Auth session, where supabase.functions.invoke() would not work
 * the same way).
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await sb.auth.getSession();
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
  };
}
