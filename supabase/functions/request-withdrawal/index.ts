// supabase/functions/request-withdrawal/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/ashtech.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MIN_WITHDRAWAL = 1000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
  const userId = userData.user.id;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const { amount, method, account_number, account_name, paypal_email, btc_wallet } = body;

  const withdrawAmount = Number(amount);
  if (!Number.isFinite(withdrawAmount) || withdrawAmount < MIN_WITHDRAWAL) {
    return json({ error: "bad_request", message: `Minimum withdrawal is ${MIN_WITHDRAWAL}` }, 400);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: user } = await admin.from("users").select("balance,name,role").eq("id", userId).maybeSingle();
  if (!user) return json({ error: "not_found" }, 404);
  if (user.role !== "seller") return json({ error: "forbidden", message: "Only seller accounts can withdraw." }, 403);
  if (user.balance < withdrawAmount) return json({ error: "insufficient_balance", message: "Insufficient balance" }, 400);

  if ((method === "mtn" || method === "orange") && (!account_number || !account_name)) {
    return json({ error: "bad_request", message: "Account number and name are required" }, 400);
  }
  if (method === "paypal" && (!paypal_email || !paypal_email.includes("@"))) {
    return json({ error: "bad_request", message: "Valid PayPal email is required" }, 400);
  }
  if (method === "bitcoin" && !btc_wallet) {
    return json({ error: "bad_request", message: "Bitcoin wallet address is required" }, 400);
  }

  const newBalance = user.balance - withdrawAmount;
  await admin.from("users").update({ balance: newBalance }).eq("id", userId);

  const insertPayload: Record<string, unknown> = {
    user_id: userId, user_name: user.name, amount: withdrawAmount, method, status: "pending",
  };
  if (method === "mtn" || method === "orange") {
    insertPayload.account_number = account_number;
    insertPayload.account_name = account_name;
    insertPayload.phone = account_number;
  } else if (method === "paypal") {
    insertPayload.paypal_email = paypal_email;
    insertPayload.phone = paypal_email;
  } else if (method === "bitcoin") {
    insertPayload.btc_wallet = btc_wallet;
    insertPayload.phone = btc_wallet;
  }

  const { error: insErr } = await admin.from("withdrawals").insert(insertPayload);
  if (insErr) {
    await admin.from("users").update({ balance: user.balance }).eq("id", userId);
    return json({ error: "server_error", message: insErr.message }, 500);
  }

  await admin.from("wallet_transactions").insert({
    user_id: userId, type: "withdrawal", amount: withdrawAmount,
    balance_after: newBalance, description: "Withdrawal via " + method,
  });

  return json({ success: true, balance: newBalance });
});
