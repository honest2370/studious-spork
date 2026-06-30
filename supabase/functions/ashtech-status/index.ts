// supabase/functions/ashtech-status/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, ASHTECH_BASE, json } from "../_shared/ashtech.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const apiKey = Deno.env.get("ASHTECH_API_KEY");
  if (!apiKey) return json({ error: "server_misconfigured" }, 500);

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

  const url = new URL(req.url);
  const reference = url.searchParams.get("reference");
  if (!reference) return json({ error: "bad_request", message: "reference is required" }, 400);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (reference.startsWith("dep_")) {
    const { data: dep } = await admin.from("wallet_deposits")
      .select("user_id,status,transaction_id").eq("reference", reference).maybeSingle();
    if (!dep || dep.user_id !== userData.user.id) return json({ error: "forbidden" }, 403);

    if (dep.status === "completed") return json({ status: "success" });
    if (dep.status === "failed" || dep.status === "amount_mismatch") return json({ status: "failed" });
    if (!dep.transaction_id) return json({ status: "pending" });

    try {
      const res = await fetch(`${ASHTECH_BASE}/v1/transaction/${encodeURIComponent(dep.transaction_id)}`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      return json(await res.json(), res.status);
    } catch (e) {
      return json({ error: "upstream_error", message: String(e) }, 502);
    }
  }

  const { data: order } = await admin.from("orders")
    .select("buyer_id,buyer_email,status,ashtech_transaction_id,delivery_link,product_title")
    .eq("order_ref", reference).maybeSingle();
  if (!order) return json({ error: "not_found" }, 404);
  if (order.buyer_id && order.buyer_id !== userData.user.id) return json({ error: "forbidden" }, 403);

  if (order.status === "confirmed") {
    return json({ status: "success", order_status: "confirmed", delivery_link: order.delivery_link, product_title: order.product_title });
  }
  if (order.status === "failed" || order.status === "amount_mismatch") return json({ status: "failed" });
  if (!order.ashtech_transaction_id) return json({ status: "pending" });

  try {
    const res = await fetch(`${ASHTECH_BASE}/v1/transaction/${encodeURIComponent(order.ashtech_transaction_id)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return json(await res.json(), res.status);
  } catch (e) {
    return json({ error: "upstream_error", message: String(e) }, 502);
  }
});
