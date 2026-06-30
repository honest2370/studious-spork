import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, Badge, Spinner } from "@/components/ui";
import type { Product } from "@/types";

export default function SellerProducts() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    sb.from("products").select("*").eq("seller_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => { setProducts((data as Product[]) || []); setLoading(false); });
  }, [user]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="text-blue-400" /></div>;

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-extrabold text-white">My Products</h1>
        <button onClick={() => navigate("/seller/products/new")} className="bg-blue-600 text-white rounded-lg px-3 py-2 text-sm font-bold">+ Add</button>
      </div>
      {products.length === 0 ? (
        <p className="text-center text-slate-500 py-20">No products yet.</p>
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <Card key={p.id} className="bg-slate-800 border-slate-700 cursor-pointer" >
              <div onClick={() => navigate(`/seller/products/${p.id}`)} className="flex justify-between items-start">
                <div>
                  <p className="font-bold text-white">{p.title}</p>
                  <p className="text-sm text-slate-400">{p.price.toLocaleString()} {user?.currency}</p>
                </div>
                <Badge color={p.status === "approved" ? "green" : p.status === "rejected" ? "red" : "amber"}>{p.status}</Badge>
              </div>
              {p.type === "account" && (
                <p className="text-xs text-slate-500 mt-2">📊 {p.available_slots ?? 0}/{p.total_slots ?? 0} slots</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
