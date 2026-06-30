import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Card } from "@/components/ui";

export default function SellerAccount() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="p-4">
      <h1 className="text-2xl font-extrabold text-white mb-4">My Account</h1>
      <Card className="bg-slate-800 border-slate-700 mb-4">
        <p className="font-bold text-white">{user?.name}</p>
        <p className="text-sm text-slate-400">{user?.email}</p>
        <p className="text-sm text-slate-400">{user?.store_name}</p>
      </Card>
      <Button fullWidth variant="secondary" onClick={async () => { await signOut(); navigate("/seller/login"); }}>Sign Out</Button>
    </div>
  );
}
