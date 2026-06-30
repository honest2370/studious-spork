import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sb } from "@/lib/supabase";
import { Card, Badge, Spinner } from "@/components/ui";
import type { Product } from "@/types";

export default function BuyerHome() {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    sb.from("products").select("*").eq("status", "approved").order("created_at", { ascending: false })
      .then(({ data }) => { setProducts((data as Product[]) || []); setLoading(false); });
  }, []);

  const filtered = products.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-4">
      <h1 className="text-2xl font-extrabold text-slate-900 mb-4">Browse Products</h1>
      <input
        value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products…"
        className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm mb-5 outline-none focus:border-blue-500"
      />

      {loading ? (
        <div className="flex justify-center py-20"><Spinner className="text-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-slate-400 py-20">No products found.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((p) => (
            <Card key={p.id} className="cursor-pointer" >
              <div onClick={() => navigate(`/buyer/product/${p.id}`)}>
                {p.cover_url ? (
                  <img src={p.cover_url} className="w-full h-28 object-cover rounded-xl mb-2" />
                ) : (
                  <div className="w-full h-28 bg-slate-100 rounded-xl mb-2 flex items-center justify-center text-3xl">📦</div>
                )}
                <p className="font-semibold text-sm line-clamp-2 mb-1">{p.title}</p>
                <p className="text-blue-600 font-bold">{p.price.toLocaleString()} {/* currency suffix added by formatter later */}</p>
                {p.type === "course" && <Badge color="green">Course</Badge>}
                {p.type === "account" && <Badge color="amber">{(p.available_slots ?? 0) > 0 ? `${p.available_slots} left` : "Out of stock"}</Badge>}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
