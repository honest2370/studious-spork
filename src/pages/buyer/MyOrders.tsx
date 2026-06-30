import React, { useEffect, useState } from "react";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, Badge, Spinner } from "@/components/ui";
import type { Order } from "@/types";

export default function MyOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    sb.from("orders").select("*").eq("buyer_id", user.id).order("created_at", { ascending: false })
      .then(({ data }) => { setOrders((data as Order[]) || []); setLoading(false); });
  }, [user]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="text-blue-600" /></div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-extrabold text-slate-900 mb-4">My Orders</h1>
      {orders.length === 0 ? (
        <p className="text-center text-slate-400 py-20">No orders yet.</p>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Card key={o.id}>
              <div className="flex justify-between items-start mb-2">
                <p className="font-bold text-slate-900">{o.product_title}</p>
                <Badge color={o.status === "confirmed" ? "green" : o.status === "failed" ? "red" : "amber"}>{o.status}</Badge>
              </div>
              <p className="text-sm text-slate-500 mb-2">{o.final_price.toLocaleString()} {user?.currency}</p>
              {o.status === "confirmed" && o.delivery_link && (
                <a href={o.delivery_link} target="_blank" rel="noreferrer" className="text-blue-600 text-sm font-semibold">
                  ↓ Access your product
                </a>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
