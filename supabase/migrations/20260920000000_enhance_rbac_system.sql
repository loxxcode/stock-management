-- Enhanced RBAC System Migration
-- This migration implements comprehensive role-based access control with:
-- - Sales ownership tracking
-- - Enhanced audit logging
-- - Data-level security for Admin role
-- - Activity logging for all operations

-- Add sales ownership tracking
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS employee_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS customer_id UUID,
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'cash',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Create trigger for updated_at on sales
DROP TRIGGER IF EXISTS update_sales_updated_at ON public.sales;
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enhance activity_log table for comprehensive audit logging
ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS user_role app_role,
  ADD COLUMN IF NOT EXISTS entity TEXT,
  ADD COLUMN IF NOT EXISTS entity_id UUID,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- Create audit_log table for role changes and critical operations
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  user_role app_role NOT NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  old_value JSONB,
  new_value JSONB,
  description TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Admins can view all audit logs
CREATE POLICY "Admins can view audit logs" ON public.audit_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Auth users can insert audit logs (triggered by application)
CREATE POLICY "Auth users can insert audit logs" ON public.audit_log
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Create function to log audit events
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_user_id UUID,
  p_user_role app_role,
  p_action TEXT,
  p_entity TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_old_value JSONB DEFAULT NULL,
  p_new_value JSONB DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO public.audit_log (
    user_id, user_role, action, entity, entity_id,
    old_value, new_value, description, ip_address
  )
  VALUES (
    p_user_id, p_user_role, p_action, p_entity, p_entity_id,
    p_old_value, p_new_value, p_description, p_ip_address
  )
  RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$;

-- Create function to get user role safely
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = p_user_id LIMIT 1;
$$;

-- Update RLS policies to prevent Admin from accessing sensitive business data

-- Products: Admin can only see count, not detailed financial data
DROP POLICY IF EXISTS "Auth users can manage products" ON public.products;
CREATE POLICY "Managers can manage products" ON public.products
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Employees can view products" ON public.products
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'employee'::public.app_role));

-- Sales: Admin can only see operational summaries, not financial details
DROP POLICY IF EXISTS "Auth users can manage sales" ON public.sales;
CREATE POLICY "Managers can manage sales" ON public.sales
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Employees can view own sales" ON public.sales
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'employee'::public.app_role) AND employee_id = auth.uid());

CREATE POLICY "Employees can create sales" ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'employee'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

-- Expenses: Managers can fully manage, Employees can view and add
DROP POLICY IF EXISTS "Auth users can manage expenses" ON public.expenses;
CREATE POLICY "Managers can manage expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Employees can view expenses" ON public.expenses
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'employee'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Employees can add expenses" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'employee'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

-- Stock entries: Only Managers can access
DROP POLICY IF EXISTS "Auth users can manage stock entries" ON public.stock_entries;
CREATE POLICY "Managers can manage stock entries" ON public.stock_entries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'manager'::public.app_role));

-- Create view for Admin dashboard (aggregated data only)
CREATE OR REPLACE VIEW public.admin_dashboard_view AS
SELECT
  (SELECT COUNT(*) FROM public.user_roles WHERE role = 'manager') AS total_managers,
  (SELECT COUNT(*) FROM public.user_roles WHERE role = 'employee') AS total_employees,
  (SELECT COUNT(*) FROM public.profiles WHERE is_active = true) AS active_users,
  (SELECT COUNT(*) FROM public.products) AS total_products,
  (SELECT COUNT(*) FROM public.sales) AS total_sales,
  (SELECT COUNT(*) FROM public.activity_log WHERE created_at >= now() - interval '30 days') AS recent_activities;

-- Grant access to admin dashboard view
GRANT SELECT ON public.admin_dashboard_view TO authenticated;

-- Create view for sales activity by role (for Admin)
CREATE OR REPLACE VIEW public.sales_activity_summary AS
SELECT
  ur.role,
  p.full_name,
  COUNT(s.id) AS sales_count,
  MIN(s.created_at) AS first_sale,
  MAX(s.created_at) AS last_sale
FROM public.sales s
JOIN public.user_roles ur ON s.employee_id = ur.user_id
JOIN public.profiles p ON s.employee_id = p.user_id
GROUP BY ur.role, p.full_name;

GRANT SELECT ON public.sales_activity_summary TO authenticated;

-- Create view for recent system activity (for Admin)
CREATE OR REPLACE VIEW public.recent_system_activity AS
SELECT
  al.action,
  al.entity,
  al.description,
  p.full_name AS user_name,
  ur.role AS user_role,
  al.created_at
FROM public.activity_log al
JOIN public.profiles p ON al.user_id = p.user_id
JOIN public.user_roles ur ON al.user_id = ur.user_id
ORDER BY al.created_at DESC
LIMIT 50;

GRANT SELECT ON public.recent_system_activity TO authenticated;

-- Create customers table if not exists
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can manage customers" ON public.customers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Employees can view customers" ON public.customers
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'employee'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

-- Trigger for customers updated_at
DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create suppliers table if not exists
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers can manage suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'manager'::public.app_role));

-- Trigger for suppliers updated_at
DROP TRIGGER IF EXISTS update_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_sales_employee_id ON public.sales(employee_id);
CREATE INDEX IF NOT EXISTS idx_sales_manager_id ON public.sales(manager_id);
CREATE INDEX IF NOT EXISTS idx_sales_customer_id ON public.sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON public.audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON public.audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON public.activity_log(created_at DESC);
