import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Button, showToast, Spinner } from "@/components/ui";
import type { Product } from "@/types";

function parseSlotLine(line: string): { cred1: string; cred2: string } {
  const parts = line.split(":").map((s) => s.trim());
  if (parts.length === 2) return { cred1: parts[0], cred2: parts[1] };
  if (parts.length === 4) return { cred1: `${parts[0]}:${parts[1]}`, cred2: `${parts[2]}:${parts[3]}` };
  return { cred1: line.trim(), cred2: "" };
}

export default function ProductDetailSeller() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [bulk, setBulk] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    sb.from("products").select("*").eq("id", id).maybeSingle().then(({ data }) => setProduct(data as Product));
  }, [id]);

  if (!product) return <div className="flex justify-center py-20"><Spinner className="text-blue-400" /></div>;

  async function addSlots() {
    if (!product || !user) return;
    const lines = bulk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) { showToast("Add at least one account", "error"); return; }
    setSubmitting(true);

    const slotRows = lines.map((line) => {
      const { cred1, cred2 } = parseSlotLine(line);
      return {
        product_id: product.id, seller_id: user.id, platform: product.account_platform || "",
        cred1_label: product.cred1_label || "Email", cred2_label: product.cred2_label || "Password",
        cred1_value: cred1, cred2_value: cred2, status: "available",
      };
    });

    const { error } = await sb.from("account_slots").insert(slotRows);
    if (error) { setSubmitting(false); showToast(error.message, "error"); return; }

    await sb.from("products").update({
      total_slots: (product.total_slots || 0) + slotRows.length,
      available_slots: (product.available_slots || 0) + slotRows.length,
    }).eq("id", product.id);

    setSubmitting(false);
    showToast(`${slotRows.length} slot(s) added!`, "success");
    navigate("/seller/products");
  }

  return (
    <div className="p-4 bg-slate-950 min-h-screen">
      <button onClick={() => navigate(-1)} className="text-blue-400 text-sm font-semibold mb-4">← Back</button>
      <h1 className="text-xl font-extrabold text-white mb-1">{product.title}</h1>
      <p className="text-sm text-slate-400 mb-6">📊 {product.available_slots ?? 0}/{product.total_slots ?? 0} slots available</p>

      {product.type === "account" && (
        <>
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase">
            Add more accounts (one per line) — {product.cred1_label}:{product.cred2_label}
          </label>
          <textarea
            className="w-full rounded-xl border border-slate-700 bg-slate-800 text-white px-4 py-3 text-sm mb-4"
            rows={6} value={bulk} onChange={(e) => setBulk(e.target.value)}
            placeholder={"user1:pass1\nuser2:pass2"}
          />
          <Button fullWidth disabled={submitting} onClick={addSlots}>{submitting ? "Adding…" : "Add Slots"}</Button>
        </>
      )}
    </div>
  );
}
