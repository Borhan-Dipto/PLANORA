-- Activation codes (admin-issued, e.g. for promotions or manual sales)
CREATE TABLE public.activation_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  code text NOT NULL UNIQUE,
  duration_days integer NOT NULL,
  max_uses integer NOT NULL DEFAULT 1,
  used_count integer NOT NULL DEFAULT 0,
  note text,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.activation_codes ENABLE ROW LEVEL SECURITY;
CREATE POLICY activation_codes_admin_all ON public.activation_codes FOR ALL USING (is_admin()) WITH CHECK (is_admin());

-- bKash manual payment submissions
CREATE TYPE public.payment_status AS ENUM ('pending','approved','rejected');
CREATE TABLE public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_label text NOT NULL,
  amount_bdt integer NOT NULL,
  duration_days integer NOT NULL,
  sender_bkash_number text NOT NULL,
  transaction_id text NOT NULL,
  status public.payment_status NOT NULL DEFAULT 'pending',
  review_note text,
  reviewed_by uuid REFERENCES public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payment_requests_user ON public.payment_requests(user_id);
CREATE INDEX idx_payment_requests_status ON public.payment_requests(status);
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY payment_requests_owner_select ON public.payment_requests FOR SELECT USING (user_id = (select auth.uid()) OR is_admin());
CREATE POLICY payment_requests_owner_insert ON public.payment_requests FOR INSERT WITH CHECK (user_id = (select auth.uid()));
CREATE POLICY payment_requests_admin_update ON public.payment_requests FOR UPDATE USING (is_admin());

-- Subscriptions: a user is premium while any row's expires_at is in the future.
CREATE TYPE public.subscription_source AS ENUM ('bkash','activation_code','admin_grant');
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source public.subscription_source NOT NULL,
  duration_days integer NOT NULL,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  payment_request_id uuid REFERENCES public.payment_requests(id),
  activation_code_id uuid REFERENCES public.activation_codes(id),
  granted_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_user_expires ON public.subscriptions(user_id, expires_at);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_select ON public.subscriptions FOR SELECT USING (user_id = (select auth.uid()) OR is_admin());
CREATE POLICY subscriptions_insert ON public.subscriptions FOR INSERT WITH CHECK (user_id = (select auth.uid()) OR is_admin());
