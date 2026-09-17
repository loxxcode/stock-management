-- Ensure all permission columns exist and normalize naming across migrations.
DO $$
BEGIN
  -- Rename legacy plural columns to the current singular names if present.
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employee_permissions'
      AND column_name = 'can_add_products'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employee_permissions'
      AND column_name = 'can_add_product'
  ) THEN
    ALTER TABLE public.employee_permissions RENAME COLUMN can_add_products TO can_add_product;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employee_permissions'
      AND column_name = 'can_edit_products'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employee_permissions'
      AND column_name = 'can_edit_product'
  ) THEN
    ALTER TABLE public.employee_permissions RENAME COLUMN can_edit_products TO can_edit_product;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employee_permissions'
      AND column_name = 'can_delete_products'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'employee_permissions'
      AND column_name = 'can_delete_product'
  ) THEN
    ALTER TABLE public.employee_permissions RENAME COLUMN can_delete_products TO can_delete_product;
  END IF;

  -- Add any missing columns expected by the app.
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employee_permissions' AND column_name = 'can_view_stock') THEN
    ALTER TABLE public.employee_permissions ADD COLUMN can_view_stock BOOLEAN NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employee_permissions' AND column_name = 'can_view_expenses') THEN
    ALTER TABLE public.employee_permissions ADD COLUMN can_view_expenses BOOLEAN NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employee_permissions' AND column_name = 'can_add_product') THEN
    ALTER TABLE public.employee_permissions ADD COLUMN can_add_product BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employee_permissions' AND column_name = 'can_edit_product') THEN
    ALTER TABLE public.employee_permissions ADD COLUMN can_edit_product BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employee_permissions' AND column_name = 'can_delete_product') THEN
    ALTER TABLE public.employee_permissions ADD COLUMN can_delete_product BOOLEAN NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'employee_permissions' AND column_name = 'employee_name') THEN
    ALTER TABLE public.employee_permissions ADD COLUMN employee_name TEXT;
  END IF;
END $$;