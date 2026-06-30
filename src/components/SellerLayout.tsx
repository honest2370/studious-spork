import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LayoutGrid, Package, ShoppingCart, Wallet, User } from "lucide-react";

export default function SellerLayout() {
  const navItem = (to: string, icon: React.ReactNode, label: string) => (
    <NavLink to={to} end className={({ isActive }) => `flex flex-col items-center gap-1 py-2 flex-1 ${isActive ? "text-blue-400" : "text-slate-500"}`}>
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </NavLink>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      <main className="flex-1 pb-20">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 flex">
        {navItem("/seller", <LayoutGrid size={20} />, "Dashboard")}
        {navItem("/seller/products", <Package size={20} />, "Products")}
        {navItem("/seller/orders", <ShoppingCart size={20} />, "Orders")}
        {navItem("/seller/wallet", <Wallet size={20} />, "Wallet")}
        {navItem("/seller/account", <User size={20} />, "Account")}
      </nav>
    </div>
  );
}
