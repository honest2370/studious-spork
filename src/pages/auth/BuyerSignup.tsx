import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button, Input } from "@/components/ui";

export default function BuyerSignup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signUp(email, password, "buyer", { name, phone, country_code: "CM", currency: "XAF" });
    setLoading(false);
    if (error) setError(error);
    else navigate("/buyer");
  }

  return (
    <div className="min-h-screen flex flex-col bg-white px-6 pt-16">
      <h1 className="text-2xl font-extrabold text-slate-900 mb-1">Create Buyer Account</h1>
      <p className="text-slate-500 mb-8">Buy digital products, courses, and accounts.</p>

      <form onSubmit={handleSubmit}>
        <Input label="Full name" value={name} onChange={setName} required />
        <Input label="Email" value={email} onChange={setEmail} type="email" required />
        <Input label="Phone" value={phone} onChange={setPhone} type="tel" required />
        <Input label="Password" value={password} onChange={setPassword} type="password" required error={error} />
        <Button type="submit" fullWidth disabled={loading}>{loading ? "Creating account…" : "Create Account"}</Button>
      </form>

      <p className="text-center text-sm text-slate-500 mt-6">
        Already have an account? <Link to="/buyer/login" className="text-blue-600 font-semibold">Sign in</Link>
      </p>
    </div>
  );
}
