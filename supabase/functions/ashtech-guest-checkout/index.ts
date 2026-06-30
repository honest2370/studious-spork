// supabase/functions/ashtech-guest-checkout/index.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, ASHTECH_BASE, json, getCurrencyForCountry } from "../_shared/ashtech.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const apiKey = Deno.env.get("ASHTECH_API_KEY");
  if (!apiKey) return json({ error: "server_misconfigured" }, 500);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }

  const { product_id, email, name, phone, operator, country_code, currency: clientCurrency, otp, reference: existingReference } = body;
  if (!phone || !operator || !country_code) {
    return json({ error: "bad_request", message: "phone, operator and country_code are required" }, 400);
  }
  const currency = clientCurrency || await getCurrencyForCountry(apiKey, country_code);
  if (!currency) return json({ error: "unprocessable", message: "Country not supported." }, 422);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  if (existingReference) {
    const { data: existingOrder } = await admin.from("orders")
      .select("final_price").eq("order_ref", existingReference).eq("buyer_email", (email || "").toLowerCase()).maybeSingle();
    if (!existingOrder) return json({ error: "not_found" }, 404);
    return collectAndRespond(admin, apiKey, existingReference, existingOrder.final_price, currency, phone, operator, country_code, otp);
  }

  if (!product_id || !email || !name) return json({ error: "bad_request", message: "product_id, email and name are required" }, 400);
  const emailLower = String(email).toLowerCase();

  const { data: session } = await admin.from("product_sessions")
    .select("id").eq("product_id", product_id).eq("email", emailLower).maybeSingle();
  if (!session) return json({ error: "forbidden", message: "Start checkout from the product page first." }, 403);

  const { data: product, error: prodErr } = await admin.from("products")
    .select("id,title,price,discount_percent,discount_until,seller_id,seller_name,status,delivery_link")
    .eq("id", product_id).maybeSingle();
  if (prodErr || !product) return json({ error: "not_found", message: "Product not found" }, 404);
  if (product.status !== "approved") return json({ error: "unprocessable", message: "Product not available" }, 422);

  const finalPrice = product.discount_percent && product.discount_until && new Date(product.discount_until) > new Date()
    ? Math.round(product.price * (1 - product.discount_percent / 100))
    : product.price;

  const orderRef = "DS-" + Math.random().toString(36).substring(2, 10).toUpperCase();
  const sellerCredit = Math.round(finalPrice * 0.85);

  const { error: insErr } = await admin.from("orders").insert({
    order_ref: orderRef, product_id: product.id, product_title: product.title,
    product_price: product.price, final_price: finalPrice,
    buyer_id: null, buyer_email: emailLower, buyer_name: name,
    seller_id: product.seller_id, seller_name: product.seller_name, seller_credit: sellerCredit,
    payment_method: "ashtech", status: "awaiting_payment", source: "store_product",
    delivery_link: product.delivery_link,
  });
  if (insErr) return json({ error: "server_error", message: insErr.message }, 500);

  return collectAndRespond(admin, apiKey, orderRef, finalPrice, currency, phone, operator, country_code, otp);
});

async function collectAndRespond(
  admin: any, apiKey: string, reference: string, amount: number, currency: string,
  phone: string, operator: string, country_code: string, otp?: string,
) {
  const collectBody: Record<string, unknown> = {
    amount, currency, phone, operator, country_code, reference,
    notify_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/ashtech-webhook`,
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
      await admin.from("orders").update({ ashtech_transaction_id: data.transaction_id }).eq("order_ref", reference);
    }
    return json({ ...data, reference }, res.status);
  } catch (e) {
    return json({ error: "upstream_error", message: String(e) }, 502);
  }
}
