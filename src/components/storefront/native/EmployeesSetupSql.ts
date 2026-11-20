// Supabase setup for the employee directory tables (run in the storefront project's SQL editor).
// Ported verbatim from storefront-panel EmployeesManager.
export const EMPLOYEES_SETUP_SQL = `CREATE TABLE IF NOT EXISTS employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    employee_id TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    secondary_email TEXT,
    secondary_phone TEXT,
    department TEXT NOT NULL,
    role TEXT NOT NULL,
    tenure TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access" ON public.employees;
DROP POLICY IF EXISTS employees_self_read ON public.employees;
REVOKE ALL ON public.employees FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
CREATE POLICY employees_self_read ON public.employees FOR SELECT TO authenticated
  USING (lower(email) = lower(auth.jwt()->>'email'));

-- Only managers may create, edit, or delete directory records.
DROP POLICY IF EXISTS "Allow all access to authenticated users" ON employees;
DROP POLICY IF EXISTS "Allow manager access to employees" ON employees;
CREATE POLICY "Allow manager access to employees" ON employees FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MANAGER') OR lower(auth.jwt()->>'email') IN ('laxmikant.p@genziitian.com', 'genziitian@gmail.com', 'lkiitmng2424@gmail.com'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MANAGER') OR lower(auth.jwt()->>'email') IN ('laxmikant.p@genziitian.com', 'genziitian@gmail.com', 'lkiitmng2424@gmail.com'));

-- IF THE TABLE ALREADY EXISTS: Run these ALTER statements to add missing columns:
ALTER TABLE employees ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS secondary_email TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS secondary_phone TEXT;
UPDATE public.employees SET department = 'Academic' WHERE lower(trim(department)) IN ('academics', 'academic', 'temporary teacher', 'temporary teaching', 'fixed teacher', 'permanent teacher', 'permanent teaching');
UPDATE public.employees SET department = 'Support' WHERE lower(trim(department)) IN ('operations', 'support');
UPDATE public.employees SET department = 'Marketing' WHERE lower(trim(department)) = 'marketing';
UPDATE public.employees SET department = 'Programming' WHERE lower(trim(department)) = 'programming';
UPDATE public.employees SET department = 'Core' WHERE lower(trim(department)) = 'core';

-- Private employee details: managers can read/write ID documents; employees can read their own DOB.
CREATE TABLE IF NOT EXISTS public.employee_birth_dates (
  employee_id TEXT PRIMARY KEY REFERENCES public.employees(employee_id) ON DELETE CASCADE,
  date_of_birth DATE NOT NULL
);
ALTER TABLE public.employee_birth_dates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employee_birth_dates_manager_access ON public.employee_birth_dates;
CREATE POLICY employee_birth_dates_manager_access ON public.employee_birth_dates FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MANAGER') OR lower(auth.jwt()->>'email') IN ('laxmikant.p@genziitian.com', 'genziitian@gmail.com', 'lkiitmng2424@gmail.com'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MANAGER') OR lower(auth.jwt()->>'email') IN ('laxmikant.p@genziitian.com', 'genziitian@gmail.com', 'lkiitmng2424@gmail.com'));
DROP POLICY IF EXISTS employee_birth_dates_self_read ON public.employee_birth_dates;
CREATE POLICY employee_birth_dates_self_read ON public.employee_birth_dates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.employee_id = employee_birth_dates.employee_id AND lower(e.email) = lower(auth.jwt()->>'email')));

CREATE TABLE IF NOT EXISTS public.employee_identity_documents (
  employee_id TEXT PRIMARY KEY REFERENCES public.employees(employee_id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('PAN', 'Aadhaar')),
  document_number TEXT NOT NULL
);
ALTER TABLE public.employee_identity_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employee_identity_documents_manager_access ON public.employee_identity_documents;
CREATE POLICY employee_identity_documents_manager_access ON public.employee_identity_documents FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MANAGER') OR lower(auth.jwt()->>'email') IN ('laxmikant.p@genziitian.com', 'genziitian@gmail.com', 'lkiitmng2424@gmail.com'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MANAGER') OR lower(auth.jwt()->>'email') IN ('laxmikant.p@genziitian.com', 'genziitian@gmail.com', 'lkiitmng2424@gmail.com'));

-- Employees can update only the photo stored in this separate table.
CREATE TABLE IF NOT EXISTS public.employee_photos (
  employee_id TEXT PRIMARY KEY REFERENCES public.employees(employee_id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL
);
ALTER TABLE public.employee_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS employee_photos_read_self_or_manager ON public.employee_photos;
CREATE POLICY employee_photos_read_self_or_manager ON public.employee_photos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.employee_id = employee_photos.employee_id AND lower(e.email) = lower(auth.jwt()->>'email')) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MANAGER') OR lower(auth.jwt()->>'email') IN ('laxmikant.p@genziitian.com', 'genziitian@gmail.com', 'lkiitmng2424@gmail.com'));
DROP POLICY IF EXISTS employee_photos_insert_self_or_manager ON public.employee_photos;
CREATE POLICY employee_photos_insert_self_or_manager ON public.employee_photos FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.employees e WHERE e.employee_id = employee_photos.employee_id AND lower(e.email) = lower(auth.jwt()->>'email')) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MANAGER') OR lower(auth.jwt()->>'email') IN ('laxmikant.p@genziitian.com', 'genziitian@gmail.com', 'lkiitmng2424@gmail.com'));
DROP POLICY IF EXISTS employee_photos_update_self_or_manager ON public.employee_photos;
CREATE POLICY employee_photos_update_self_or_manager ON public.employee_photos FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.employees e WHERE e.employee_id = employee_photos.employee_id AND lower(e.email) = lower(auth.jwt()->>'email')) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MANAGER') OR lower(auth.jwt()->>'email') IN ('laxmikant.p@genziitian.com', 'genziitian@gmail.com', 'lkiitmng2424@gmail.com'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.employees e WHERE e.employee_id = employee_photos.employee_id AND lower(e.email) = lower(auth.jwt()->>'email')) OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'MANAGER') OR lower(auth.jwt()->>'email') IN ('laxmikant.p@genziitian.com', 'genziitian@gmail.com', 'lkiitmng2424@gmail.com'));
GRANT SELECT, INSERT ON public.employee_photos TO authenticated;
REVOKE UPDATE ON public.employee_photos FROM anon, authenticated;
GRANT UPDATE (photo_url) ON public.employee_photos TO authenticated;
GRANT SELECT ON public.employee_birth_dates TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.employee_birth_dates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_identity_documents TO authenticated;`;
