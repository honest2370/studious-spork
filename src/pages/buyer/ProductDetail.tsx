import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Badge, Spinner, showToast } from "@/components/ui";
import { buyWithWallet } from "@/lib/ashtech";
import type { Product } from "@/types";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [discountCode, setDiscountCode] = useState("");
  const [finalPrice, setFinalPrice] = useState<number | null>(null);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    if (!id) return;
    sb.from("products").select("*").eq("id", id).maybeSingle().then(({ data }) => {
      setProduct(data as Product);
      setFinalPrice((data as Product)?.price ?? null);
    });
  }, [id]);

  if (!product) return <div className="flex justify-center py-20"><Spinner className="text-blue-600" /></div>;

  const outOfStock = product.type === "account" && (product.available_slots ?? 0) <= 0;

  async function handleBuyWithWallet() {
    if (!product) return;
    setBuying(true);
    const { data } = await buyWithWallet({ product_id: product.id, discount_code: discountCode || null });
    setBuying(false);
    if (!data.success) {
      showToast(data.message || "Purchase failed", "error");
      return;
    }
    showToast("Purchase successful!", "success");
    await refreshUser();
    navigate("/buyer/orders");
  }

  return (
    <div className="p-4 pb-28">
      {product.cover_url && <img src={product.cover_url} className="w-full h-48 object-cover rounded-2xl mb-4" />}
      <h1 className="text-xl font-extrabold text-slate-900 mb-1">{product.title}</h1>
      <div className="flex items-center gap-2 mb-3">
        {product.type === "course" && <Badge color="green">Course</Badge>}
        {product.type === "account" && <Badge color={outOfStock ? "red" : "amber"}>{outOfStock ? "Out of stock" : `${product.available_slots} available`}</Badge>}
      </div>
      <p className="text-2xl font-extrabold text-blue-600 mb-4">{finalPrice?.toLocaleString()} {user?.currency || "XAF"}</p>
      <p className="text-sm text-slate-600 whitespace-pre-wrap mb-6">{product.description}</p>

      <input
        value={discountCode} onChange={(e) => setDiscountCode(e.target.value)} placeholder="Discount code (optional)"
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm mb-3 outline-none focus:border-blue-500"
      />

      <Button
        fullWidth disabled={outOfStock}
        onClick={() => navigate(`/buyer/checkout/${product.id}`, { state: { discountCode } })}
      >
        Pay with Mobile Money
      </Button>
      <div className="mt-3">
        <Button fullWidth variant="secondary" disabled={outOfStock || buying} onClick={handleBuyWithWallet}>
          {buying ? "Processing…" : `Buy with wallet (${user?.balance?.toLocaleString() ?? 0} ${user?.currency || "XAF"})`}
        </Button>
      </div>
    </div>
  );
}
