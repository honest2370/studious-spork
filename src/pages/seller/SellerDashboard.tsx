import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { sb } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { Card, Spinner } from "@/components/ui";
import type { Product, Order } from "@/types";

export default function SellerDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      sb.from("products").select("*").eq("seller_id", user.id),
      sb.from("orders").select("*").eq("seller_id", user.id).eq("status", "confirmed"),
    ]).then(([{ data: p }, { data: o }]) => {
      setProducts((p as Product[]) || []);
      setOrders((o as Order[]) || []);
      setLoading(false);
    });
  }, [user]);

  if (loading) return <div className="flex justify-center py-20"><Spinner className="text-blue-400" /></div>;

  const totalSales = orders.reduce((sum, o) => sum + o.seller_credit, 0);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-extrabold text-white mb-4">Seller Dashboard</h1>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="bg-slate-800 border-slate-700">
          <p className="text-xs text-slate-400 mb-1">Total earnings</p>
          <p className="text-xl font-extrabold text-emerald-400">{totalSales.toLocaleString()} {user?.currency}</p>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <p className="text-xs text-slate-400 mb-1">Products</p>
          <p className="text-xl font-extrabold text-white">{products.length}</p>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <p className="text-xs text-slate-400 mb-1">Sales</p>
          <p className="text-xl font-extrabold text-white">{orders.length}</p>
        </Card>
        <Card className="bg-slate-800 border-slate-700">
          <p className="text-xs text-slate-400 mb-1">Wallet balance</p>
          <p className="text-xl font-extrabold text-white">{user?.balance?.toLocaleString()} {user?.currency}</p>
        </Card>
      </div>
      <button onClick={() => navigate("/seller/products/new")} className="w-full bg-blue-600 text-white rounded-xl py-3 font-bold">
        + Add New Product
      </button>
    </div>
  );
}
