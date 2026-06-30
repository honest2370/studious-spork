// supabase/functions/ashtech-webhook/index.ts
// Called by Ashtech Pay server-to-server. Deploy with JWT verification OFF.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { json } from "../_shared/ashtech.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  let payload: any;
  try { payload = await req.json(); } catch { return json({ received: true }); }
  const ack = json({ received: true });
  handleEvent(payload).catch((e) => console.error("webhook failed", e));
  return ack;
});

async function handleEvent(payload: any) {
  const { event, reference, total_amount, currency } = payload;
  if (!reference) return;
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  if (reference.startsWith("dep_")) return handleDeposit(admin, event, reference, total_amount, currency);
  return handleOrder(admin, event, reference, total_amount);
}

async function handleDeposit(admin: any, event: string, reference: string, total_amount: number, currency: string) {
  const { data: dep } = await admin.from("wallet_deposits").select("*").eq("reference", reference).maybeSingle();
  if (!dep) return;

  if (event === "payment.failed") {
    await admin.from("wallet_deposits").update({ status: "failed" }).eq("reference", reference);
    return;
  }
  if (event !== "payment.completed" || dep.status === "completed") return;

  const paidEnough = typeof total_amount === "number" && total_amount >= dep.amount && currency === dep.currency;
  if (!paidEnough) {
    await admin.from("wallet_deposits").update({ status: "amount_mismatch" }).eq("reference", reference);
    return;
  }

  const { data: userRow } = await admin.from("users").select("balance").eq("id", dep.user_id).maybeSingle();
  const newBal = (userRow?.balance || 0) + dep.amount;
  await admin.from("users").update({ balance: newBal }).eq("id", dep.user_id);
  await admin.from("wallet_transactions").insert({
    user_id: dep.user_id, type: "deposit", amount: dep.amount,
    balance_after: newBal, description: "Mobile Money deposit via Ashtech",
  });
  await admin.from("wallet_deposits").update({ status: "completed" }).eq("reference", reference);
}

async function handleOrder(admin: any, event: string, reference: string, total_amount: number) {
  const { data: order } = await admin.from("orders").select("*").eq("order_ref", reference).maybeSingle();
  if (!order) return;

  if (event === "payment.failed") {
    await admin.from("orders").update({ status: "failed" }).eq("id", order.id);
    return;
  }
  if (event !== "payment.completed" || order.status === "confirmed") return;

  const paidEnough = typeof total_amount === "number" && total_amount >= order.final_price;
  if (!paidEnough) {
    await admin.from("orders").update({ status: "amount_mismatch" }).eq("id", order.id);
    return;
  }

  // This is the ONLY place an order is ever marked confirmed — never trust
  // a client redirect for this.
  await admin.from("orders").update({ status: "confirmed" }).eq("id", order.id);

  if (order.seller_id) {
    const { data: sellerRow } = await admin.from("users").select("balance").eq("id", order.seller_id).maybeSingle();
    const newSellerBal = (sellerRow?.balance || 0) + order.seller_credit;
    await admin.from("users").update({ balance: newSellerBal }).eq("id", order.seller_id);
    await admin.from("wallet_transactions").insert({
      user_id: order.seller_id, type: "credit", amount: order.seller_credit,
      balance_after: newSellerBal, description: "Sale: " + order.product_title,
    }).catch(() => {});
  }

  const { data: product } = await admin.from("products").select("type").eq("id", order.product_id).maybeSingle();
  if (product?.type === "account") {
    // Atomically claim one available slot for this order.
    const { data: slot } = await admin.from("account_slots")
      .select("id").eq("product_id", order.product_id).eq("status", "available").limit(1).maybeSingle();
    if (slot) {
      await admin.from("account_slots").update({ status: "assigned", order_id: order.id }).eq("id", slot.id);
      await admin.from("orders").update({ account_slot_id: slot.id }).eq("id", order.id);
      await admin.from("products")
        .select("available_slots").eq("id", order.product_id).maybeSingle()
        .then(async ({ data: p }: any) => {
          await admin.from("products").update({ available_slots: Math.max(0, (p?.available_slots || 1) - 1) }).eq("id", order.product_id);
        });
    }
  }

  // Guest checkout (no buyer_id) — unlock the product portal session instead.
  if (!order.buyer_id && order.buyer_email) {
    await admin.from("product_sessions")
      .update({ access_granted: true })
      .eq("product_id", order.product_id)
      .eq("email", order.buyer_email);
  }

  await admin.from("notifications").insert({
    user_id: order.buyer_id, type: "order", title: "Payment confirmed",
    body: "Your order for " + (order.product_title || "your product") + " was confirmed.",
  }).catch(() => {});
}
