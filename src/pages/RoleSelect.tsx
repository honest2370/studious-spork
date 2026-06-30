import React from "react";
import { useNavigate } from "react-router-dom";

export default function RoleSelect() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white px-6">
      <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Sellizi</h1>
      <p className="text-slate-500 mb-10 text-center">Digital products & courses, paid for with Mobile Money.</p>

      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={() => navigate("/buyer/login")}
          className="w-full bg-blue-600 text-white rounded-2xl py-5 font-bold text-lg shadow-md active:scale-[0.98] transition"
        >
          I'm here to buy
        </button>
        <button
          onClick={() => navigate("/seller/login")}
          className="w-full bg-white border-2 border-slate-200 text-slate-800 rounded-2xl py-5 font-bold text-lg active:scale-[0.98] transition"
        >
          I'm here to sell
        </button>
      </div>
    </div>
  );
}
