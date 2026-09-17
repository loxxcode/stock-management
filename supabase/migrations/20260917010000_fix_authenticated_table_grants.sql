-- Ensure the authenticated role can read/write the app tables when RLS is enabled.
-- The app relies on row-level policies, so these grants are required for Supabase REST calls
-- to succeed for signed-in users.

GRANT USAGE ON SCHEMA public TO authenticated;

GRANT
SELECT,
INSERT
,
UPDATE,
DELETE ON
TABLE public.profiles TO authenticated;

GRANT
SELECT,
INSERT
,
UPDATE,
DELETE ON
TABLE public.user_roles TO authenticated;

GRANT
SELECT,
INSERT
,
UPDATE,
DELETE ON
TABLE public.employee_permissions TO authenticated;

GRANT
SELECT,
INSERT
,
UPDATE,
DELETE ON
TABLE public.categories TO authenticated;

GRANT
SELECT,
INSERT
,
UPDATE,
DELETE ON
TABLE public.products TO authenticated;

GRANT
SELECT,
INSERT
,
UPDATE,
DELETE ON
TABLE public.expenses TO authenticated;

GRANT
SELECT,
INSERT
,
UPDATE,
DELETE ON
TABLE public.sales TO authenticated;

GRANT
SELECT,
INSERT
,
UPDATE,
DELETE ON
TABLE public.stock_entries TO authenticated;

GRANT
SELECT,
INSERT
,
UPDATE,
DELETE ON
TABLE public.notifications TO authenticated;

GRANT
SELECT,
INSERT
,
UPDATE,
DELETE ON
TABLE public.activity_log TO authenticated;

-- Allow admin-role checks and trigger helpers to be called by authenticated users.
GRANT
EXECUTE ON FUNCTION public.has_role (UUID, public.app_role) TO authenticated;

GRANT
EXECUTE ON FUNCTION public.update_updated_at_column () TO authenticated;

GRANT EXECUTE ON FUNCTION public.handle_new_user () TO authenticated;