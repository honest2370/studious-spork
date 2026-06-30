import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui";

export default function SellerSignup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [storeName, setStoreName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signUp(email, password, "seller", { name, phone, country_code: "CM", currency: "XAF" });
    setLoading(false);
    if (error) { setError(error); return; }
    navigate("/seller");
  }

  const field = (label: string, value: string, onChange: (v: string) => void, type = "text") => (
    <div className="mb-4">
      <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required
        className="w-full rounded-xl border border-slate-700 bg-slate-800 text-white px-4 py-3 text-sm outline-none focus:border-blue-500" />
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-900 px-6 pt-16 pb-10">
      <h1 className="text-2xl font-extrabold text-white mb-1">Become a Seller</h1>
      <p className="text-slate-400 mb-8">Start selling digital products today.</p>

      <form onSubmit={handleSubmit}>
        {field("Full name", name, setName)}
        {field("Store name", storeName, setStoreName)}
        {field("Email", email, setEmail, "email")}
        {field("Phone", phone, setPhone, "tel")}
        {field("Password", password, setPassword, "password")}
        {error && <p className="text-xs text-red-400 -mt-3 mb-4">{error}</p>}
        <Button type="submit" fullWidth disabled={loading}>{loading ? "Creating account…" : "Create Seller Account"}</Button>
      </form>

      <p className="text-center text-sm text-slate-400 mt-6">
        Already selling? <Link to="/seller/login" className="text-blue-400 font-semibold">Sign in</Link>
      </p>
    </div>
  );
}
