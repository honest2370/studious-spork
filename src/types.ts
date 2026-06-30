export type UserRole = "buyer" | "seller" | "admin";

export interface AppUser {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: UserRole;
  balance: number;
  currency: string;
  country_code: string | null;
  store_name?: string | null;
  store_slug?: string | null;
  product_slug?: string | null;
}

export type ProductType = "digital" | "account" | "course" | "link";

export interface Product {
  id: string;
  seller_id: string;
  seller_name: string;
  title: string;
  short_desc: string | null;
  description: string | null;
  price: number;
  discount_percent: number | null;
  discount_until: string | null;
  cover_url: string | null;
  file_url: string | null;
  delivery_link: string | null;
  type: ProductType;
  status: "pending" | "approved" | "rejected";
  category: string | null;
  product_slug: string | null;
  total_slots: number | null;
  available_slots: number | null;
  account_platform: string | null;
  cred1_label: string | null;
  cred2_label: string | null;
  slot_instructions: string | null;
  curriculum: CourseModule[] | null;
  affiliate_enabled: boolean | null;
  affiliate_commission: number | null;
  created_at: string;
}

export interface CourseModule {
  title: string;
  lessons: CourseLesson[];
}

export interface CourseLesson {
  title: string;
  duration: string;
  video_url: string;
  attachment_url: string;
  notes: string;
}

export interface Order {
  id: string;
  order_ref: string;
  product_id: string;
  product_title: string;
  product_cover: string | null;
  product_price: number;
  final_price: number;
  discount_code: string | null;
  discount_amount: number;
  buyer_id: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  seller_id: string;
  seller_name: string;
  seller_credit: number;
  payment_method: "ashtech" | "wallet";
  status: "awaiting_payment" | "confirmed" | "failed" | "amount_mismatch" | "pending_review";
  delivery_link: string | null;
  ashtech_transaction_id: string | null;
  account_slot_id: string | null;
  created_at: string;
}

export interface AccountSlot {
  id: string;
  product_id: string;
  seller_id: string;
  platform: string;
  cred1_label: string;
  cred2_label: string;
  cred1_value: string;
  cred2_value: string;
  status: "available" | "assigned";
  order_id: string | null;
}

export interface LiveCountry {
  code: string;
  name: string;
  currency: string;
  operators: string[];
}
