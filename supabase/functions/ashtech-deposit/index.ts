// supabase/functions/ashtech-deposit/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, ASHTECH_BASE, json, getCurrencyForCountry } from "../_shared/ashtech.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MIN_DEPOSIT = 500;
const MAX_DEPOSIT = 1000000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const apiKey = Deno.env.get("ASHTECH_API_KEY");
  if (!apiKey) return json({ error: "server_misconfigured" }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
  const userId = userData.user.id;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }

  const { amount, phone, operator, country_code, currency: clientCurrency, otp, reference: existingReference } = body;
  if (!phone || !operator || !country_code) {
    return json({ error: "bad_request", message: "phone, operator and country_code are required" }, 400);
  }
  const currency = clientCurrency || await getCurrencyForCountry(apiKey, country_code);
  if (!currency) return json({ error: "unprocessable", message: "Country not supported." }, 422);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  let reference = existingReference;
  let depositAmount: number;

  if (existingReference) {
    const { data: dep } = await admin.from("wallet_deposits").select("amount").eq("reference", existingReference).eq("user_id", userId).maybeSingle();
    if (!dep) return json({ error: "not_found" }, 404);
    depositAmount = dep.amount;
  } else {
    depositAmount = Number(amount);
    if (!Number.isFinite(depositAmount) || depositAmount < MIN_DEPOSIT || depositAmount > MAX_DEPOSIT) {
      return json({ error: "bad_request", message: `Amount must be between ${MIN_DEPOSIT} and ${MAX_DEPOSIT}` }, 400);
    }
    reference = `dep_${userId}_${Date.now()}`;
    const { error: insErr } = await admin.from("wallet_deposits").insert({
      reference, user_id: userId, amount: depositAmount, currency, status: "pending",
    });
    if (insErr) return json({ error: "server_error", message: insErr.message }, 500);
  }

  const collectBody: Record<string, unknown> = {
    amount: depositAmount, currency, phone, operator, country_code, reference,
    notify_url: `${SUPABASE_URL}/functions/v1/ashtech-webhook`,
  };
  if (otp) collectBody.otp = otp;

  try {
    const res = await fetch(`${ASHTECH_BASE}/v1/collect`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(collectBody),
    });
    const data = await res.json();
    if (data?.transaction_id) {
      await admin.from("wallet_deposits").update({ transaction_id: data.transaction_id }).eq("reference", reference);
    }
    return json({ ...data, reference }, res.status);
  } catch (e) {
    return json({ error: "upstream_error", message: String(e) }, 502);
  }
});
