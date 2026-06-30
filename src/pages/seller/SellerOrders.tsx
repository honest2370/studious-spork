import React, { useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, Badge, Spinner } from "@/components/ui";
import type { Order } from "@/types";

export default function SellerOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    sb.from("orders").select("*").eq("seller_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => { setOrders((data as Order[]) || []); setLoading(false); });
  }, [user]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="text-blue-400" /></div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-extrabold text-white mb-4">Sales</h1>
      {orders.length === 0 ? (
        <p className="text-center text-slate-500 py-20">No sales yet.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Card key={o.id} className="bg-slate-800 border-slate-700">
              <div className="flex justify-between items-start mb-1">
                <p className="font-bold text-white">{o.product_title}</p>
                <Badge color={o.status === "confirmed" ? "green" : o.status === "failed" ? "red" : "amber"}>{o.status}</Badge>
              </div>
              <p className="text-sm text-slate-400">{o.buyer_name || o.buyer_email}</p>
              <p className="text-sm text-emerald-400 font-semibold mt-1">+{o.seller_credit.toLocaleString()} {user?.currency}</p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
