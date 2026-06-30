import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Input } from "@/components/ui";

export default function SellerLogin() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password, "seller");
    setLoading(false);
    if (error) setError(error);
    else navigate("/seller");
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 px-6 pt-16">
      <h1 className="text-2xl font-extrabold text-white mb-1">Seller Sign In</h1>
      <p className="text-slate-400 mb-8">Manage your products, orders, and payouts.</p>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
            className="w-full rounded-xl border border-slate-700 bg-slate-800 text-white px-4 py-3 text-sm outline-none focus:border-blue-500" />
        </div>
        <div className="mb-4">
          <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
            className="w-full rounded-xl border border-slate-700 bg-slate-800 text-white px-4 py-3 text-sm outline-none focus:border-blue-500" />
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>
        <Button type="submit" fullWidth disabled={loading}>{loading ? "Signing in…" : "Sign In"}</Button>
      </form>

      <p className="text-center text-sm text-slate-400 mt-6">
        New seller? <Link to="/seller/signup" className="text-blue-400 font-semibold">Create a seller account</Link>
      </p>
      <p className="text-center text-sm text-slate-500 mt-2">
        <Link to="/buyer/login">Buying instead? →</Link>
      </p>
    </div>
  );
}
