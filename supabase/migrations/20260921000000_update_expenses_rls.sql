-- Update Expenses RLS Policies
-- This migration updates the expenses table RLS policies to allow:
-- - Managers: Full CRUD access (create, read, update, delete)
-- - Employees: Read and create access only
-- - Admins: Read access only

-- Drop existing policies
DROP POLICY IF EXISTS "Managers can manage expenses" ON public.expenses;
DROP POLICY IF EXISTS "Employees can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Employees can add expenses" ON public.expenses;

-- Create new policies
CREATE POLICY "Managers can fully manage expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Employees can view expenses" ON public.expenses
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'employee'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Employees can add expenses" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'employee'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admins can view expenses" ON public.expenses
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));
