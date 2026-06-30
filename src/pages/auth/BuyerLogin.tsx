import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Input } from "@/components/ui";

export default function BuyerLogin() {
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
    const { error } = await signIn(email, password, "buyer");
    setLoading(false);
    if (error) setError(error);
    else navigate("/buyer");
  }

  return (
    <div className="min-h-screen flex flex-col bg-white px-6 pt-16">
      <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Buyer Sign In</h1>
      <p className="text-slate-500 mb-8">Access your purchases, courses, and orders.</p>

      <form onSubmit={handleSubmit}>
        <Input label="Email" value={email} onChange={setEmail} type="email" required />
        <Input label="Password" value={password} onChange={setPassword} type="password" required error={error} />
        <Button type="submit" fullWidth disabled={loading}>{loading ? "Signing in…" : "Sign In"}</Button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        New here? <Link to="/buyer/signup" className="text-blue-600 font-semibold">Create a buyer account</Link>
      </p>
      <p className="text-center text-sm text-slate-400 mt-2">
        <Link to="/seller/login">Selling instead? →</Link>
      </p>
    </div>
  );
}
