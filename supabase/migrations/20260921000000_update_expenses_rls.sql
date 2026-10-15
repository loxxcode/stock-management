-- Update Expenses RLS Policies for Relationship-Based Access
-- This migration updates the expenses table to support manager-employee relationship-based access:
-- - Managers can only see expenses they created or their employees created
-- - Employees can only see expenses they created or their manager created
-- - Admins can view all expenses

-- Add manager_id column to track relationship
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES auth.users(id);

-- Drop existing policies
DROP POLICY IF EXISTS "Managers can fully manage expenses" ON public.expenses;
DROP POLICY IF EXISTS "Employees can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Employees can add expenses" ON public.expenses;
DROP POLICY IF EXISTS "Admins can view expenses" ON public.expenses;

-- Helper function to get manager for a user
CREATE OR REPLACE FUNCTION public.get_user_manager(p_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT manager_user_id FROM public.employee_permissions WHERE employee_user_id = p_user_id LIMIT 1;
$$;

-- Helper function to get employees for a manager
CREATE OR REPLACE FUNCTION public.get_manager_employees(p_manager_id UUID)
RETURNS TABLE (employee_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT employee_user_id FROM public.employee_permissions WHERE manager_user_id = p_manager_id;
$$;

-- Managers can view their own expenses and their employees' expenses
CREATE POLICY "Managers can view own and team expenses" ON public.expenses
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::public.app_role) AND (
      user_id = auth.uid() OR
      manager_id = auth.uid() OR
      user_id IN (SELECT employee_id FROM public.get_manager_employees(auth.uid()))
    )
  );

-- Managers can insert expenses (for themselves or on behalf of employees)
CREATE POLICY "Managers can insert expenses" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'manager'::public.app_role) AND (
      user_id = auth.uid() OR
      manager_id = auth.uid() OR
      user_id IN (SELECT employee_id FROM public.get_manager_employees(auth.uid()))
    )
  );

-- Managers can update their own expenses and their employees' expenses
CREATE POLICY "Managers can update own and team expenses" ON public.expenses
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::public.app_role) AND (
      user_id = auth.uid() OR
      manager_id = auth.uid() OR
      user_id IN (SELECT employee_id FROM public.get_manager_employees(auth.uid()))
    )
  );

-- Managers can delete their own expenses and their employees' expenses
CREATE POLICY "Managers can delete own and team expenses" ON public.expenses
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager'::public.app_role) AND (
      user_id = auth.uid() OR
      manager_id = auth.uid() OR
      user_id IN (SELECT employee_id FROM public.get_manager_employees(auth.uid()))
    )
  );

-- Employees can view their own expenses and their manager's expenses
CREATE POLICY "Employees can view own and manager expenses" ON public.expenses
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'employee'::public.app_role) AND (
      user_id = auth.uid() OR
      manager_id = auth.uid() OR
      user_id = (SELECT get_user_manager(auth.uid()))
    )
  );

-- Employees can insert expenses (for themselves)
CREATE POLICY "Employees can insert expenses" ON public.expenses
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'employee'::public.app_role) AND user_id = auth.uid()
  );

-- Admins can view all expenses
CREATE POLICY "Admins can view all expenses" ON public.expenses
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Trigger to automatically set manager_id when an employee creates an expense
CREATE OR REPLACE FUNCTION public.set_expense_manager_id()
RETURNS TRIGGER AS $$
BEGIN
  -- If the user is an employee, set manager_id from employee_permissions
  IF NEW.manager_id IS NULL THEN
    SELECT manager_user_id INTO NEW.manager_id
    FROM public.employee_permissions
    WHERE employee_user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS set_expense_manager_id_trigger ON public.expenses;
CREATE TRIGGER set_expense_manager_id_trigger
  BEFORE INSERT OR UPDATE ON public.expenses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_expense_manager_id();
