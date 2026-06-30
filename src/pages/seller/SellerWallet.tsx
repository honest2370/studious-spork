import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Card, showToast } from "@/components/ui";
import { requestWithdrawal } from "@/lib/ashtech";

type Method = "mtn" | "orange" | "paypal" | "bitcoin";

export default function SellerWallet() {
  const { user, refreshUser } = useAuth();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("mtn");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [paypalEmail, setPaypalEmail] = useState("");
  const [btcWallet, setBtcWallet] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n < 1000) { showToast("Minimum withdrawal is 1000", "error"); return; }
    setSubmitting(true);
    const { data } = await requestWithdrawal({
      amount: n, method,
      account_number: accountNumber, account_name: accountName,
      paypal_email: paypalEmail, btc_wallet: btcWallet,
    });
    setSubmitting(false);
    if (!data.success) { showToast(data.message || "Withdrawal failed", "error"); return; }
    showToast("Withdrawal request submitted!", "success");
    setAmount("");
    await refreshUser();
  }

  const fieldClass = "w-full rounded-xl border border-slate-700 bg-slate-800 text-white px-4 py-3 text-sm mb-3";

  return (
    <div className="p-4">
      <h1 className="text-2xl font-extrabold text-white mb-4">Wallet</h1>
      <Card className="bg-slate-800 border-slate-700 mb-6">
        <p className="text-xs text-slate-400 mb-1">Available balance</p>
        <p className="text-2xl font-extrabold text-emerald-400">{user?.balance?.toLocaleString()} {user?.currency}</p>
      </Card>

      <h2 className="text-white font-bold mb-3">Request Withdrawal</h2>
      <input className={fieldClass} type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <select className={fieldClass} value={method} onChange={(e) => setMethod(e.target.value as Method)}>
        <option value="mtn">MTN Mobile Money</option>
        <option value="orange">Orange Money</option>
        <option value="paypal">PayPal</option>
        <option value="bitcoin">Bitcoin</option>
      </select>

      {(method === "mtn" || method === "orange") && (
        <>
          <input className={fieldClass} placeholder="Phone number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
          <input className={fieldClass} placeholder="Account name" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
        </>
      )}
      {method === "paypal" && (
        <input className={fieldClass} placeholder="PayPal email" value={paypalEmail} onChange={(e) => setPaypalEmail(e.target.value)} />
      )}
      {method === "bitcoin" && (
        <input className={fieldClass} placeholder="Bitcoin wallet address" value={btcWallet} onChange={(e) => setBtcWallet(e.target.value)} />
      )}

      <Button fullWidth disabled={submitting} onClick={submit}>{submitting ? "Submitting…" : "Request Withdrawal"}</Button>
    </div>
  );
}
