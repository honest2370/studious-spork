import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastHost } from "@/components/ui";
import RequireRole from "@/components/RequireRole";

import RoleSelect from "@/pages/RoleSelect";
import BuyerLogin from "@/pages/auth/BuyerLogin";
import BuyerSignup from "@/pages/auth/BuyerSignup";
import SellerLogin from "@/pages/auth/SellerLogin";
import SellerSignup from "@/pages/auth/SellerSignup";

import BuyerLayout from "@/components/BuyerLayout";
import BuyerHome from "@/pages/buyer/BuyerHome";
import ProductDetail from "@/pages/buyer/ProductDetail";
import Checkout from "@/pages/buyer/Checkout";
import MyOrders from "@/pages/buyer/MyOrders";
import MyCourses from "@/pages/buyer/MyCourses";
import Deposit from "@/pages/buyer/Deposit";
import BuyerAccount from "@/pages/buyer/BuyerAccount";

import SellerLayout from "@/components/SellerLayout";
import SellerDashboard from "@/pages/seller/SellerDashboard";
import SellerProducts from "@/pages/seller/SellerProducts";
import AddProduct from "@/pages/seller/AddProduct";
import ProductDetailSeller from "@/pages/seller/ProductDetailSeller";
import SellerOrders from "@/pages/seller/SellerOrders";
import SellerWallet from "@/pages/seller/SellerWallet";
import SellerAccount from "@/pages/seller/SellerAccount";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastHost />
        <Routes>
          <Route path="/" element={<RoleSelect />} />

          <Route path="/buyer/login" element={<BuyerLogin />} />
          <Route path="/buyer/signup" element={<BuyerSignup />} />
          <Route path="/seller/login" element={<SellerLogin />} />
          <Route path="/seller/signup" element={<SellerSignup />} />

          <Route path="/buyer" element={<RequireRole role="buyer"><BuyerLayout /></RequireRole>}>
            <Route index element={<BuyerHome />} />
            <Route path="product/:id" element={<ProductDetail />} />
            <Route path="checkout/:productId" element={<Checkout />} />
            <Route path="orders" element={<MyOrders />} />
            <Route path="courses" element={<MyCourses />} />
            <Route path="deposit" element={<Deposit />} />
            <Route path="account" element={<BuyerAccount />} />
          </Route>

          <Route path="/seller" element={<RequireRole role="seller"><SellerLayout /></RequireRole>}>
            <Route index element={<SellerDashboard />} />
            <Route path="products" element={<SellerProducts />} />
            <Route path="products/new" element={<AddProduct />} />
            <Route path="products/:id" element={<ProductDetailSeller />} />
            <Route path="orders" element={<SellerOrders />} />
            <Route path="wallet" element={<SellerWallet />} />
            <Route path="account" element={<SellerAccount />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
