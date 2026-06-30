// supabase/functions/wallet-purchase/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, json } from "../_shared/ashtech.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);
  const buyer = userData.user;

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const { product_id, discount_code } = body;
  if (!product_id) return json({ error: "bad_request", message: "product_id is required" }, 400);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: buyerRow } = await admin.from("users").select("balance,name,email,phone,role").eq("id", buyer.id).maybeSingle();
  if (!buyerRow) return json({ error: "not_found" }, 404);
  if (buyerRow.role !== "buyer") return json({ error: "forbidden", message: "Only buyer accounts can purchase." }, 403);

  const { data: product, error: prodErr } = await admin.from("products")
    .select("id,title,price,discount_percent,discount_until,cover_url,delivery_link,seller_id,seller_name,status,type")
    .eq("id", product_id).maybeSingle();
  if (prodErr || !product) return json({ error: "not_found", message: "Product not found" }, 404);
  if (product.status !== "approved") return json({ error: "unprocessable", message: "Product not available" }, 422);

  if (product.type === "account") {
    const { count } = await admin.from("account_slots").select("id", { count: "exact", head: true })
      .eq("product_id", product.id).eq("status", "available");
    if (!count || count <= 0) return json({ error: "unprocessable", message: "Out of stock" }, 422);
  }

  const baseFinalPrice = product.discount_percent && product.discount_until && new Date(product.discount_until) > new Date()
    ? Math.round(product.price * (1 - product.discount_percent / 100))
    : product.price;

  let finalPrice = baseFinalPrice;
  let discountAmt = 0;
  let appliedCode: string | null = null;
  let discountRow: any = null;

  if (discount_code) {
    const code = String(discount_code).trim().toUpperCase();
    const { data: dc } = await admin.from("discount_codes").select("*").eq("code", code).eq("is_active", true).maybeSingle();
    if (dc && (!dc.valid_until || new Date(dc.valid_until) >= new Date())
        && dc.used_count < dc.max_uses
        && (!dc.product_id || dc.product_id === product_id)) {
      discountAmt = Math.round(baseFinalPrice * dc.discount_percent / 100);
      finalPrice = baseFinalPrice - discountAmt;
      appliedCode = dc.code;
      discountRow = dc;
    }
  }

  if (buyerRow.balance < finalPrice) return json({ error: "insufficient_balance", message: "Insufficient wallet balance" }, 400);

  const newBalance = buyerRow.balance - finalPrice;
  await admin.from("users").update({ balance: newBalance }).eq("id", buyer.id);

  const orderRef = "DS-" + Math.random().toString(36).substring(2, 10).toUpperCase();
  const sellerCredit = Math.round(finalPrice * 0.85);

  const { data: order, error: insErr } = await admin.from("orders").insert({
    order_ref: orderRef, product_id: product.id, product_title: product.title,
    product_cover: product.cover_url, product_price: product.price, final_price: finalPrice,
    discount_code: appliedCode, discount_amount: discountAmt,
    buyer_id: buyer.id, buyer_name: buyerRow.name, buyer_email: buyerRow.email, buyer_phone: buyerRow.phone,
    seller_id: product.seller_id, seller_name: product.seller_name,
    seller_credit: sellerCredit, payment_method: "wallet", status: "confirmed",
    delivery_link: product.delivery_link,
  }).select().single();

  if (insErr) {
    await admin.from("users").update({ balance: buyerRow.balance }).eq("id", buyer.id);
    return json({ error: "server_error", message: insErr.message }, 500);
  }

  if (discountRow) {
    await admin.from("discount_codes").update({ used_count: discountRow.used_count + 1 }).eq("id", discountRow.id);
  }

  await admin.from("wallet_transactions").insert({
    user_id: buyer.id, type: "purchase", amount: finalPrice,
    balance_after: newBalance, description: "Purchase: " + product.title,
  });

  if (product.seller_id) {
    const { data: sellerRow } = await admin.from("users").select("balance").eq("id", product.seller_id).maybeSingle();
    const newSellerBal = (sellerRow?.balance || 0) + sellerCredit;
    await admin.from("users").update({ balance: newSellerBal }).eq("id", product.seller_id);
    await admin.from("wallet_transactions").insert({
      user_id: product.seller_id, type: "credit", amount: sellerCredit,
      balance_after: newSellerBal, description: "Sale: " + product.title,
    });
  }

  if (product.type === "account") {
    const { data: slot } = await admin.from("account_slots")
      .select("id").eq("product_id", product.id).eq("status", "available").limit(1).maybeSingle();
    if (slot) {
      await admin.from("account_slots").update({ status: "assigned", order_id: order.id }).eq("id", slot.id);
      await admin.from("orders").update({ account_slot_id: slot.id }).eq("id", order.id);
      const { data: p } = await admin.from("products").select("available_slots").eq("id", product.id).maybeSingle();
      await admin.from("products").update({ available_slots: Math.max(0, (p?.available_slots || 1) - 1) }).eq("id", product.id);
    }
  }

  return json({ success: true, order_ref: orderRef, final_price: finalPrice, balance: newBalance });
});
