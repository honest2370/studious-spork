import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Card } from "@/components/ui";

export default function BuyerAccount() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="p-4">
      <h1 className="text-2xl font-extrabold text-slate-900 mb-4">My Account</h1>
      <Card className="mb-4">
        <p className="font-bold text-slate-900">{user?.name}</p>
        <p className="text-sm text-slate-500">{user?.email}</p>
      </Card>
      <Card className="mb-4">
        <p className="text-xs text-slate-500 mb-1">Wallet balance</p>
        <p className="text-2xl font-extrabold text-emerald-600">{user?.balance?.toLocaleString()} {user?.currency}</p>
        <Button fullWidth className="mt-3" onClick={() => navigate("/buyer/deposit")}>Add Funds</Button>
      </Card>
      <Button fullWidth variant="secondary" onClick={async () => { await signOut(); navigate("/buyer/login"); }}>Sign Out</Button>
    </div>
  );
}
