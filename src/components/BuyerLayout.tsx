import React from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Home, ShoppingBag, GraduationCap, User } from "lucide-react";

export default function BuyerLayout() {
  const navItem = (to: string, icon: React.ReactNode, label: string) => (
    <NavLink to={to} className={({ isActive }) => `flex flex-col items-center gap-1 py-2 flex-1 ${isActive ? "text-blue-600" : "text-slate-400"}`}>
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </NavLink>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <main className="flex-1 pb-20">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex">
        {navItem("/buyer", <Home size={20} />, "Browse")}
        {navItem("/buyer/orders", <ShoppingBag size={20} />, "Orders")}
        {navItem("/buyer/courses", <GraduationCap size={20} />, "Courses")}
        {navItem("/buyer/account", <User size={20} />, "Account")}
      </nav>
    </div>
  );
}
