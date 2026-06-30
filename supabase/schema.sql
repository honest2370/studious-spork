-- ════════════════════════════════════════════════════════════════
-- SELLIZI v2 — FRESH DATABASE SCHEMA
-- Run this on a clean Supabase project. Buyer/seller role separation
-- and correct RLS are built in from the start (no retrofitting).
-- ════════════════════════════════════════════════════════════════

-- ── USERS ──
CREATE TABLE public.users (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           text NOT NULL,
  name            text,
  phone           text,
  role            text NOT NULL DEFAULT 'buyer' CHECK (role IN ('buyer', 'seller', 'admin')),
  balance         numeric NOT NULL DEFAULT 0,
  currency        text NOT NULL DEFAULT 'XAF',
  country_code    text,
  store_name      text,
  store_slug      text UNIQUE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- A SECURITY DEFINER helper, NOT an inline subquery — inline EXISTS checks
-- on the users table's own policies cause infinite recursion in Postgres.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Public reads seller display info" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins manage all users" ON public.users FOR ALL USING (public.is_admin());

-- Balance and role can only change via an edge function (service_role) or
-- an existing admin — never directly from the client, regardless of what
-- the UPDATE statement requests.
CREATE OR REPLACE FUNCTION public.protect_user_columns()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() = 'service_role' OR current_setting('role', true) = 'service_role' THEN RETURN NEW; END IF;
  IF public.is_admin() THEN RETURN NEW; END IF;
  NEW.balance := OLD.balance;
  NEW.role := OLD.role;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER protect_user_columns_trigger
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.protect_user_columns();

CREATE OR REPLACE FUNCTION public.increment_balance(uid uuid, amount numeric)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.users SET balance = COALESCE(balance, 0) + amount WHERE id = uid;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.increment_balance(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_balance(uuid, numeric) TO service_role;

-- ── PRODUCTS ──
CREATE TABLE public.products (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id             uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  seller_name           text,
  title                 text NOT NULL,
  short_desc            text,
  description           text,
  price                 numeric NOT NULL,
  discount_percent      numeric,
  discount_until        timestamptz,
  cover_url             text,
  file_url              text,
  delivery_link         text,
  type                  text NOT NULL DEFAULT 'digital' CHECK (type IN ('digital', 'account', 'course', 'link')),
  status                text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  category              text,
  product_slug          text UNIQUE,
  total_slots           int DEFAULT 0,
  available_slots       int DEFAULT 0,
  account_platform      text,
  cred1_label           text,
  cred2_label           text,
  slot_instructions     text,
  curriculum            jsonb DEFAULT '[]'::jsonb,
  affiliate_enabled     boolean DEFAULT false,
  affiliate_commission  numeric DEFAULT 10,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads approved products" ON public.products FOR SELECT USING (status = 'approved' OR auth.uid() = seller_id OR public.is_admin());
CREATE POLICY "Sellers insert own products" ON public.products FOR INSERT WITH CHECK (
  auth.uid() = seller_id AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'seller')
);
CREATE POLICY "Sellers update own products" ON public.products FOR UPDATE USING (auth.uid() = seller_id);
CREATE POLICY "Sellers delete own products" ON public.products FOR DELETE USING (auth.uid() = seller_id);
CREATE POLICY "Admins manage all products" ON public.products FOR ALL USING (public.is_admin());

-- ── ACCOUNT SLOTS (credential inventory for type='account' products) ──
CREATE TABLE public.account_slots (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  seller_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  platform      text,
  cred1_label   text,
  cred2_label   text,
  cred1_value   text NOT NULL,
  cred2_value   text,
  status        text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'assigned')),
  order_id      uuid,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Sellers manage own slots" ON public.account_slots FOR ALL USING (auth.uid() = seller_id);
CREATE POLICY "Buyers read assigned slot" ON public.account_slots FOR SELECT USING (
  status = 'assigned' AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.buyer_id = auth.uid())
);
CREATE POLICY "Admins manage all slots" ON public.account_slots FOR ALL USING (public.is_admin());

-- ── ORDERS ──
CREATE TABLE public.orders (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_ref               text UNIQUE NOT NULL,
  product_id              uuid NOT NULL REFERENCES public.products(id),
  product_title           text,
  product_cover           text,
  product_price           numeric,
  final_price             numeric NOT NULL,
  discount_code           text,
  discount_amount         numeric DEFAULT 0,
  buyer_id                uuid REFERENCES public.users(id),
  buyer_name              text,
  buyer_email             text,
  buyer_phone             text,
  seller_id               uuid NOT NULL REFERENCES public.users(id),
  seller_name             text,
  seller_credit           numeric NOT NULL,
  payment_method          text NOT NULL CHECK (payment_method IN ('ashtech', 'wallet')),
  status                  text NOT NULL DEFAULT 'awaiting_payment'
                            CHECK (status IN ('awaiting_payment', 'confirmed', 'failed', 'amount_mismatch')),
  delivery_link           text,
  ashtech_transaction_id  text,
  account_slot_id         uuid REFERENCES public.account_slots(id),
  source                  text DEFAULT 'app',
  created_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyers read own orders" ON public.orders FOR SELECT USING (auth.uid() = buyer_id);
CREATE POLICY "Sellers read their sales" ON public.orders FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY "Admins manage all orders" ON public.orders FOR ALL USING (public.is_admin());
-- No client INSERT/UPDATE policy at all — every order is created and
-- confirmed exclusively through edge functions (service_role bypasses RLS).

-- ── WALLET DEPOSITS (Mobile Money top-ups) ──
CREATE TABLE public.wallet_deposits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       text UNIQUE NOT NULL,
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount          numeric NOT NULL,
  currency        text NOT NULL,
  transaction_id  text,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'amount_mismatch')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_deposits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own deposits" ON public.wallet_deposits FOR SELECT USING (auth.uid() = user_id);

-- ── WALLET TRANSACTIONS (immutable ledger) ──
CREATE TABLE public.wallet_transactions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type            text NOT NULL,
  amount          numeric NOT NULL,
  balance_after   numeric,
  description     text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own transactions" ON public.wallet_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage transactions" ON public.wallet_transactions FOR ALL USING (public.is_admin());

-- ── WITHDRAWALS ──
CREATE TABLE public.withdrawals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_name       text,
  amount          numeric NOT NULL,
  method          text NOT NULL CHECK (method IN ('mtn', 'orange', 'paypal', 'bitcoin')),
  account_number  text,
  account_name    text,
  paypal_email    text,
  btc_wallet      text,
  phone           text,
  status          text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'rejected')),
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own withdrawals" ON public.withdrawals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins manage withdrawals" ON public.withdrawals FOR ALL USING (public.is_admin());

-- ── DISCOUNT CODES ──
CREATE TABLE public.discount_codes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text UNIQUE NOT NULL,
  product_id        uuid REFERENCES public.products(id),
  discount_percent  numeric NOT NULL,
  max_uses          int NOT NULL DEFAULT 1,
  used_count        int NOT NULL DEFAULT 0,
  valid_until       timestamptz,
  is_active         boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads active codes" ON public.discount_codes FOR SELECT USING (true);
CREATE POLICY "Admins manage codes" ON public.discount_codes FOR ALL USING (public.is_admin());

-- ── GUEST CHECKOUT PORTAL (email + PIN identity, no Supabase Auth) ──
CREATE TABLE public.product_sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id      uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  email           text NOT NULL,
  pin_hash        text NOT NULL,
  access_granted  boolean NOT NULL DEFAULT false,
  last_seen       timestamptz DEFAULT now(),
  UNIQUE (product_id, email)
);
ALTER TABLE public.product_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can create/read sessions" ON public.product_sessions FOR SELECT USING (true);
CREATE POLICY "Public can create sessions" ON public.product_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "Public can update last_seen" ON public.product_sessions FOR UPDATE USING (true);

-- access_granted can only ever be flipped by the webhook (service_role) —
-- never by the guest's own browser.
CREATE OR REPLACE FUNCTION public.protect_access_granted()
RETURNS TRIGGER AS $$
BEGIN
  IF auth.role() <> 'service_role' AND current_setting('role', true) <> 'service_role' THEN
    NEW.access_granted := OLD.access_granted;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER protect_access_granted_trigger
  BEFORE UPDATE ON public.product_sessions
  FOR EACH ROW EXECUTE FUNCTION public.protect_access_granted();

-- ── NOTIFICATIONS ──
CREATE TABLE public.notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.users(id) ON DELETE CASCADE,
  type        text,
  title       text,
  body        text,
  read        boolean DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins manage notifications" ON public.notifications FOR ALL USING (public.is_admin());

-- ════════════════════════════════════════════════════════════════
-- SECRETS TO SET (Supabase Dashboard → Edge Functions → Secrets):
--   ASHTECH_API_KEY = your Ashtech Pay bearer key
-- (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY are
--  auto-provided to every edge function — no need to set manually.)
-- ════════════════════════════════════════════════════════════════
