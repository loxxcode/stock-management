-- Customer credit tables used by the app for split payments and credit tracking.
-- These tables were being queried by the frontend but were not present in the database.

CREATE TABLE IF NOT EXISTS public.customer_credits (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    user_id UUID NOT NULL,
    customer_name TEXT NOT NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    amount_due NUMERIC NOT NULL DEFAULT 0,
    paid_amount NUMERIC NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open',
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    employee_name TEXT,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_credit_payments (
    id UUID NOT NULL DEFAULT gen_random_uuid () PRIMARY KEY,
    user_id UUID NOT NULL,
    credit_id UUID NOT NULL REFERENCES public.customer_credits (id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL DEFAULT 0,
    paid_on DATE NOT NULL DEFAULT CURRENT_DATE,
    employee_name TEXT,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.customer_credit_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Customers can manage all credit records" ON public.customer_credits;

CREATE POLICY "Customers can manage all credit records" ON public.customer_credits FOR ALL TO authenticated USING (true)
WITH
    CHECK (true);

DROP POLICY IF EXISTS "Customers can manage all credit payments" ON public.customer_credit_payments;

CREATE POLICY "Customers can manage all credit payments" ON public.customer_credit_payments FOR ALL TO authenticated USING (true)
WITH
    CHECK (true);

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT
SELECT,
INSERT
,
UPDATE,
DELETE ON
TABLE public.customer_credits TO authenticated;

GRANT
SELECT,
INSERT
,
UPDATE,
DELETE ON
TABLE public.customer_credit_payments TO authenticated;