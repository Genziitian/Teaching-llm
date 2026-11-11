import { useEffect, useRef, useState } from 'react';
import { Plus, Edit, Trash2, Save, X, Loader2, Search, AlertCircle, Copy, Check, Database, Camera, UserRound, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import ManagerFullPageSheet from './ManagerFullPageSheet';
import PhotoCropDialog from '../employee/PhotoCropDialog';

interface Employee {
  id?: string;
  employee_id: string;
  full_name: string;
  email?: string;
  phone?: string;
  secondary_email?: string;
  secondary_phone?: string;
  department: string;
  role: string;
  tenure: string;
  status: string;
  date_of_birth?: string;
  government_id_type?: string;
  government_id_number?: string;
}

const DEFAULT_EMPLOYEES: Employee[] = [
  {
    employee_id: 'GENZ-EMP-0000',
    full_name: 'Raj Singh',
    email: 'raj@genziitian.in',
    phone: '+91 98765 43210',
    department: 'Programming',
    role: 'Educator',
    tenure: '25/09/2025 - Present',
    status: 'ACTIVE'
  },
  {
    employee_id: 'GENZ-EMP-0001',
    full_name: 'Vaibhav',
    email: 'vaibhav@genziitian.in',
    phone: '+91 99887 76655',
    department: 'Academic',
    role: 'Educator',
    tenure: '01/06/2025 - Present',
    status: 'ACTIVE'
  },
  {
    employee_id: 'GENZ-EMP-0002',
    full_name: 'Ayush',
    email: 'ayush@genziitian.in',
    phone: '+91 88776 65544',
    department: 'Academic',
    role: 'Educator',
    tenure: '01/07/2025 - Present',
    status: 'ACTIVE'
  },
  {
    employee_id: 'GENZ-EMP-0003',
    full_name: 'Ankit K.',
    email: 'ankit@genziitian.in',
    phone: '+91 77665 54433',
    department: 'Academic',
    role: 'Educator',
    tenure: '01/08/2025 - 15/05/2026',
    status: 'INACTIVE'
  },
  {
    employee_id: 'GENZ-INT-0000N',
    full_name: 'Neha Sharma',
    email: 'neha@genziitian.in',
    phone: '+91 66554 43322',
    department: 'Operations',
    role: 'Intern',
    tenure: '15/05/2025 - 15/11/2025',
    status: 'RESIGNED'
  }
];

const AVAILABLE_ROLES = [
  'Manager',
  'Owner',
  'Founder',
  'CEO',
  'CTO',
  'Educator',
  'Intern',
  'Campus Leader'
];

const AVAILABLE_STATUSES = [
  'ACTIVE',
  'INACTIVE',
  'RESIGNED',
  'REMOVED'
];

const AVAILABLE_DEPARTMENTS = ['Academic', 'Support', 'Marketing', 'Programming', 'Core'];
const GOVERNMENT_ID_TYPES = ['PAN', 'Aadhaar'];
type TenurePeriod = { startDate: string; endDate: string; isPresent: boolean };

const normalizeDepartment = (department: string) => {
  const normalized = (department || '').trim().toLowerCase();
  if (['academic', 'academics', 'temporary teacher', 'temporary teaching', 'fixed teacher', 'permanent teacher', 'permanent teaching'].includes(normalized)) return 'Academic';
  return AVAILABLE_DEPARTMENTS.find((option) => option.toLowerCase() === normalized) || 'Core';
};

const SQL_MIGRATION_CODE = `CREATE TABLE IF NOT EXISTS employees (
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

export default function EmployeesManager() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeePhotos, setEmployeePhotos] = useState<Record<string, string>>({});
  const [editingPhoto, setEditingPhoto] = useState('');
  const [photoCropFile, setPhotoCropFile] = useState<File | null>(null);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const managerPhotoInput = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [showSqlTip, setShowSqlTip] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Edit / Create Modal State
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Employee | null>(null);

  // Date picker states
  const [tenurePeriods, setTenurePeriods] = useState<TenurePeriod[]>([{ startDate: '', endDate: '', isPresent: true }]);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [governmentIdType, setGovernmentIdType] = useState('');
  const [governmentIdNumber, setGovernmentIdNumber] = useState('');
  const [showGovernmentIdNumber, setShowGovernmentIdNumber] = useState(false);

  // Date parsing helpers
  const parseDateToYmd = (dateStr: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      // DD/MM/YYYY -> YYYY-MM-DD
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return '';
  };

  const formatYmdToDdMmYyyy = (ymd: string) => {
    if (!ymd) return '';
    const parts = ymd.split('-');
    if (parts.length === 3) {
      // YYYY-MM-DD -> DD/MM/YYYY
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return '';
  };

  const parseTenurePeriods = (tenure: string): TenurePeriod[] => {
    const periods = String(tenure || '').split(';').map((period) => period.trim()).filter(Boolean).map((period) => {
      const [start, end] = period.split(' - ');
      const isPresent = (end || '').trim().toLowerCase() === 'present';
      return { startDate: parseDateToYmd(start || ''), endDate: isPresent ? '' : parseDateToYmd(end || ''), isPresent };
    });
    return periods.length ? periods : [{ startDate: '', endDate: '', isPresent: true }];
  };

  const getNextEmployeeId = (role: string, name: string) => {
    const initial = name ? name.trim().charAt(0).toUpperCase() : 'X';
    const roleLower = (role || '').toLowerCase();
    
    let prefix = 'GENZ-EMP';
    let suffix = '';
    
    if (roleLower === 'intern') {
      prefix = 'GENZ-INT';
      suffix = initial;
    } else if (roleLower === 'campus leader') {
      prefix = 'GENZ-CLS';
      suffix = initial;
    }

    let maxNum = -1;
    const pattern = new RegExp(`^${prefix}-(\\d{4})`, 'i');
    
    (Array.isArray(employees) ? employees : []).forEach(emp => {
      if (!emp?.employee_id) return;
      const match = emp.employee_id.match(pattern);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    });

    const nextNum = maxNum + 1;
    const padded = String(nextNum).padStart(4, '0');
    return `${prefix}-${padded}${suffix}`;
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === 'PGRST116' || error.message?.includes('does not exist') || error.code === '42P01') {
          loadLocalEmployees();
        } else {
          console.error('Failed to load employees from DB:', error);
          loadLocalEmployees();
        }
      } else {
        const loadedEmployees = Array.isArray(data) ? data.filter(Boolean) : [];
        setEmployees(loadedEmployees);
        setIsDemoMode(false);
        const { data: photos, error: photosError } = await supabase
          .from('employee_photos')
          .select('employee_id, photo_url');
        if (!photosError) {
          setEmployeePhotos(Object.fromEntries((photos || []).map((photo) => [photo.employee_id, photo.photo_url])));
        }
      }
    } catch (err) {
      console.error('Database query catch block:', err);
      loadLocalEmployees();
    } finally {
      setLoading(false);
    }
  };

  const loadLocalEmployees = () => {
    setIsDemoMode(true);
    setShowSqlTip(true);
    setEmployeePhotos({});
    const stored = localStorage.getItem('gzi_mock_employees');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setEmployees(Array.isArray(parsed) ? parsed.filter(Boolean) : DEFAULT_EMPLOYEES);
      } catch (e) {
        setEmployees(DEFAULT_EMPLOYEES);
      }
    } else {
      localStorage.setItem('gzi_mock_employees', JSON.stringify(DEFAULT_EMPLOYEES));
      setEmployees(DEFAULT_EMPLOYEES);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Audit log helper
  const insertAuditLog = async (action: string, empId: string, empName: string, details: string) => {
    const actorEmail = user?.email || 'unknown';
    try {
      await supabase.from('employee_logs').insert([{
        action_type: action,
        actor_email: actorEmail,
        employee_id: empId,
        employee_name: empName,
        details
      }]);
    } catch (err) {
      console.warn('Audit log insert failed:', err);
    }
    // Also save to local storage
    try {
      const existing = JSON.parse(localStorage.getItem('gzi_employee_logs') || '[]');
      existing.unshift({
        id: 'log-' + Math.random().toString(36).substr(2, 9),
        action_type: action,
        actor_email: actorEmail,
        employee_id: empId,
        employee_name: empName,
        details,
        created_at: new Date().toISOString()
      });
      localStorage.setItem('gzi_employee_logs', JSON.stringify(existing));
    } catch (e) { /* ignore */ }
  };

  const copySql = () => {
    navigator.clipboard.writeText(SQL_MIGRATION_CODE);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  const openCreate = () => {
    setErrorMsg('');
    setTenurePeriods([{ startDate: '', endDate: '', isPresent: true }]);
    setDateOfBirth('');
    setGovernmentIdType('');
    setGovernmentIdNumber('');
    setShowGovernmentIdNumber(false);
    setEditingPhoto('');
    setPhotoCropFile(null);
    setEditingEmployee({
      employee_id: '',
      full_name: '',
      email: '',
      phone: '',
      department: 'Core',
      role: 'Educator',
      tenure: '',
      status: 'ACTIVE'
    });
  };

  const openEdit = async (emp: Employee) => {
    setErrorMsg('');
    setTenurePeriods(parseTenurePeriods(emp.tenure));
    setShowGovernmentIdNumber(false);

    setEditingEmployee({ ...emp, department: normalizeDepartment(emp.department), status: emp.status || 'ACTIVE' });
    setEditingPhoto(employeePhotos[emp.employee_id] || '');
    setDateOfBirth(emp.date_of_birth || '');
    setGovernmentIdType(emp.government_id_type || '');
    setGovernmentIdNumber(emp.government_id_number || '');
    if (!isDemoMode) {
      const [birth, document] = await Promise.all([
        supabase.from('employee_birth_dates').select('date_of_birth').eq('employee_id', emp.employee_id).maybeSingle(),
        supabase.from('employee_identity_documents').select('document_type, document_number').eq('employee_id', emp.employee_id).maybeSingle()
      ]);
      setDateOfBirth(birth.data?.date_of_birth || '');
      setGovernmentIdType(document.data?.document_type || '');
      setGovernmentIdNumber(document.data?.document_number || '');
      const { data: photo } = await supabase.from('employee_photos').select('photo_url').eq('employee_id', emp.employee_id).maybeSingle();
      setEditingPhoto(photo?.photo_url || employeePhotos[emp.employee_id] || '');
    }
  };

  const handlePhotoUpload = async (file?: File) => {
    if (!file || !editingEmployee?.id) return;
    if (!file.type.startsWith('image/')) {
      setErrorMsg('Choose an image file for the employee photo.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Choose an image smaller than 2 MB.');
      return;
    }
    if (isDemoMode) {
      setErrorMsg('Employee photos require the connected Supabase database. Apply the employee database setup first.');
      return;
    }
    setErrorMsg('');
    setPhotoCropFile(file);
  };

  const saveCroppedPhoto = async (photoUrl: string) => {
    if (!editingEmployee?.id) return;
    setPhotoCropFile(null);
    setSavingPhoto(true);
    setErrorMsg('');
    try {
      const { data: existingPhoto, error: lookupError } = await supabase.from('employee_photos')
        .select('employee_id').eq('employee_id', editingEmployee.employee_id).maybeSingle();
      if (lookupError) throw lookupError;
      const result = existingPhoto
        ? await supabase.from('employee_photos').update({ photo_url: photoUrl }).eq('employee_id', editingEmployee.employee_id)
        : await supabase.from('employee_photos').insert({ employee_id: editingEmployee.employee_id, photo_url: photoUrl });
      if (result.error) throw result.error;
      setEditingPhoto(photoUrl);
      setEmployeePhotos((current) => ({ ...current, [editingEmployee.employee_id]: photoUrl }));
    } catch (error: any) {
      setErrorMsg(error.message || 'The employee photo could not be saved.');
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    const isNew = !editingEmployee.id;
    const empId = isNew ? getNextEmployeeId(editingEmployee.role, editingEmployee.full_name) : editingEmployee.employee_id.trim();
    const fullName = editingEmployee.full_name.trim();
    const dept = editingEmployee.department.trim();
    
    if (tenurePeriods.some((period) => !period.startDate)) {
      setErrorMsg('A start date is required for every tenure period.');
      return;
    }
    if (tenurePeriods.some((period) => !period.isPresent && !period.endDate)) {
      setErrorMsg('Add an end date for each tenure period that is not marked present.');
      return;
    }

    const tenureStr = tenurePeriods.map((period) => `${formatYmdToDdMmYyyy(period.startDate)} - ${period.isPresent ? 'Present' : formatYmdToDdMmYyyy(period.endDate)}`).join('; ');

    if (!empId || !fullName || !dept) {
      setErrorMsg('All marked fields are required.');
      return;
    }

    setSaving(true);
    setErrorMsg('');

    const payload = {
      employee_id: empId,
      full_name: fullName,
      email: editingEmployee.email?.trim() || '',
      phone: editingEmployee.phone?.trim() || '',
      secondary_email: editingEmployee.secondary_email?.trim() || '',
      secondary_phone: editingEmployee.secondary_phone?.trim() || '',
      department: dept,
      role: editingEmployee.role,
      tenure: tenureStr,
      status: (editingEmployee.status || 'ACTIVE').toUpperCase()
    };

    if (!dateOfBirth || !governmentIdType || !governmentIdNumber.trim()) {
      setErrorMsg('Date of birth and government ID details are required.');
      setSaving(false);
      return;
    }
    if (isDemoMode) {
      setErrorMsg('Secure employee records are unavailable in demo mode. Apply the employee database setup before saving DOB or PAN/Aadhaar details.');
      setSaving(false);
      return;
    }

    try {
      if (isDemoMode) {
        // Save in LocalStorage
        const currentList = [...employees];
        
        // ID uniqueness check
        const duplicate = currentList.find(
          (emp) => 
            emp.employee_id.toLowerCase() === empId.toLowerCase() && 
            emp.id !== editingEmployee.id
        );

        if (duplicate) {
          setErrorMsg('An employee with this ID already exists in the records.');
          setSaving(false);
          return;
        }

        if (editingEmployee.id) {
          // Edit — compute diff for logging
          const oldEmp = employees.find(e => e.id === editingEmployee.id);
          const idx = currentList.findIndex((emp) => emp.id === editingEmployee.id);
          if (idx !== -1) {
            currentList[idx] = { ...editingEmployee, ...payload };
          }
          // Build diff description
          if (oldEmp) {
            const changes: string[] = [];
            if (oldEmp.full_name !== payload.full_name) changes.push(`Name: ${oldEmp.full_name} → ${payload.full_name}`);
            if (oldEmp.department !== payload.department) changes.push(`Dept: ${oldEmp.department} → ${payload.department}`);
            if (oldEmp.role !== payload.role) changes.push(`Role: ${oldEmp.role} → ${payload.role}`);
            if (oldEmp.status !== payload.status) changes.push(`Status: ${oldEmp.status} → ${payload.status}`);
            if (oldEmp.tenure !== payload.tenure) changes.push(`Tenure: ${oldEmp.tenure} → ${payload.tenure}`);
            if (oldEmp.email !== payload.email) changes.push(`Email: ${oldEmp.email || 'N/A'} → ${payload.email || 'N/A'}`);
            if (oldEmp.phone !== payload.phone) changes.push(`Phone: ${oldEmp.phone || 'N/A'} → ${payload.phone || 'N/A'}`);
            if (oldEmp.secondary_email !== payload.secondary_email) changes.push('Secondary email updated');
            if (oldEmp.secondary_phone !== payload.secondary_phone) changes.push('Secondary phone updated');
            await insertAuditLog('UPDATE', payload.employee_id, payload.full_name, changes.length > 0 ? changes.join(', ') : 'No field changes');
          }
        } else {
          // Create
          const newEmp: Employee = {
            id: 'mock-' + Math.random().toString(36).substr(2, 9),
            ...payload
          };
          currentList.unshift(newEmp);
          await insertAuditLog('CREATE', payload.employee_id, payload.full_name, `Created new record — Role: ${payload.role}, Dept: ${payload.department}, Status: ${payload.status}`);
        }

        localStorage.setItem('gzi_mock_employees', JSON.stringify(currentList));
        setEmployees(currentList);
        setEditingEmployee(null);
      } else {
        // Save in Supabase
        if (editingEmployee.id) {
          // Compute diff for update logging
          const oldEmp = employees.find(e => e.id === editingEmployee.id);
          const { error } = await supabase
            .from('employees')
            .update(payload)
            .eq('id', editingEmployee.id);
          if (error) throw error;
          // Build diff description
          if (oldEmp) {
            const changes: string[] = [];
            if (oldEmp.full_name !== payload.full_name) changes.push(`Name: ${oldEmp.full_name} → ${payload.full_name}`);
            if (oldEmp.department !== payload.department) changes.push(`Dept: ${oldEmp.department} → ${payload.department}`);
            if (oldEmp.role !== payload.role) changes.push(`Role: ${oldEmp.role} → ${payload.role}`);
            if (oldEmp.status !== payload.status) changes.push(`Status: ${oldEmp.status} → ${payload.status}`);
            if (oldEmp.tenure !== payload.tenure) changes.push(`Tenure: ${oldEmp.tenure} → ${payload.tenure}`);
            if (oldEmp.email !== payload.email) changes.push(`Email: ${oldEmp.email || 'N/A'} → ${payload.email || 'N/A'}`);
            if (oldEmp.phone !== payload.phone) changes.push(`Phone: ${oldEmp.phone || 'N/A'} → ${payload.phone || 'N/A'}`);
            if (oldEmp.secondary_email !== payload.secondary_email) changes.push('Secondary email updated');
            if (oldEmp.secondary_phone !== payload.secondary_phone) changes.push('Secondary phone updated');
            await insertAuditLog('UPDATE', payload.employee_id, payload.full_name, changes.length > 0 ? changes.join(', ') : 'No field changes');
          }
        } else {
          const { data: insertedEmployee, error } = await supabase
            .from('employees')
            .insert([payload])
            .select('id')
            .single();
          if (error) {
            if (error.code === '23505') {
              setErrorMsg('An employee with this ID already exists in the database.');
              setSaving(false);
              return;
            }
            throw error;
          }
          if (insertedEmployee?.id) setEditingEmployee({ ...editingEmployee, id: insertedEmployee.id });
          await insertAuditLog('CREATE', payload.employee_id, payload.full_name, `Created new record — Role: ${payload.role}, Dept: ${payload.department}, Status: ${payload.status}`);
        }
        const { error: birthError } = await supabase.from('employee_birth_dates').upsert({ employee_id: empId, date_of_birth: dateOfBirth }, { onConflict: 'employee_id' });
        if (birthError) throw birthError;
        const { error: documentError } = await supabase.from('employee_identity_documents').upsert({ employee_id: empId, document_type: governmentIdType, document_number: governmentIdNumber.trim() }, { onConflict: 'employee_id' });
        if (documentError) throw documentError;
        setEditingEmployee(null);
        fetchEmployees();
      }
    } catch (err: any) {
      console.error('Save error:', err);
      setErrorMsg(err.message || 'An error occurred while saving the record.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      if (isDemoMode) {
        const currentList = employees.filter((emp) => emp.id !== deleteTarget.id);
        localStorage.setItem('gzi_mock_employees', JSON.stringify(currentList));
        setEmployees(currentList);
        await insertAuditLog('DELETE', deleteTarget.employee_id, deleteTarget.full_name, `Deleted record — Role: ${deleteTarget.role}, Status: ${deleteTarget.status}`);
      } else {
        const { error } = await supabase
          .from('employees')
          .delete()
          .eq('id', deleteTarget.id);
        if (error) throw error;
        await insertAuditLog('DELETE', deleteTarget.employee_id, deleteTarget.full_name, `Deleted record — Role: ${deleteTarget.role}, Status: ${deleteTarget.status}`);
        fetchEmployees();
      }
      setDeleteTarget(null);
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete employee record.');
    }
  };

  const filtered = (Array.isArray(employees) ? employees : []).filter((emp) => {
    if (!emp || typeof emp !== 'object') return false;
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (emp.full_name || '').toLowerCase().includes(q) ||
      (emp.employee_id || '').toLowerCase().includes(q) ||
      (emp.department || '').toLowerCase().includes(q) ||
      (emp.role || '').toLowerCase().includes(q) ||
      (emp.email && emp.email.toLowerCase().includes(q)) ||
      (emp.phone && emp.phone.includes(q)) ||
      (emp.status || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8 text-left">
      {/* Demo / Database Warning Banner */}
      {showSqlTip && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6 relative">
          <button
            onClick={() => setShowSqlTip(false)}
            className="absolute top-4 right-4 text-yellow-600 hover:text-yellow-900"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-start gap-4">
            <div className="p-3 bg-yellow-100 rounded-xl text-yellow-700">
              <Database className="w-6 h-6" />
            </div>
            <div className="space-y-3 flex-grow">
              <h4 className="font-black text-yellow-900 text-lg">Employee ID card database setup</h4>
              <p className="text-sm text-yellow-800 font-medium max-w-3xl leading-relaxed">
                {isDemoMode ? <>The database table <code className="bg-yellow-100 px-1.5 py-0.5 rounded font-mono font-bold">employees</code> was not found. Basic directory data is falling back to local storage. DOB and PAN/Aadhaar details require the secure Supabase tables below and are not saved in demo mode.</> : <>This migration adds employee DOB, private PAN/Aadhaar storage, employee photo permissions, and the fixed department list.</>} Run the SQL in your Supabase SQL Editor:
              </p>
              
              <div className="relative bg-gray-900 text-gray-100 font-mono text-xs p-4 rounded-xl max-h-48 overflow-y-auto max-w-3xl">
                <button 
                  onClick={copySql}
                  className="absolute top-2.5 right-2.5 px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-white flex items-center gap-1.5 transition-colors font-sans font-bold"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedSql ? 'Copied!' : 'Copy SQL'}
                </button>
                <pre>{SQL_MIGRATION_CODE}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Control Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
          <input 
            type="text"
            placeholder="Search employees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border-2 border-gray-200 focus:border-blue-500 rounded-xl font-semibold outline-none text-sm transition-all"
          />
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            onClick={() => setShowSqlTip((shown) => !shown)}
            className="w-full px-4 py-2.5 bg-white text-slate-700 border border-slate-200 font-medium rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-2 text-sm sm:w-auto"
          >
            <Database className="w-4 h-4" /> Database setup
          </button>
          <button
            onClick={openCreate}
            className="w-full px-4 py-2.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 text-sm sm:w-auto"
          >
            <Plus className="w-4 h-4" /> Add Employee Record
          </button>
        </div>
      </div>

      {/* Employee List Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border-2 border-gray-200 rounded-2xl p-16 text-center text-gray-500 font-bold">
          No employee records found matching your search.
        </div>
      ) : (
        <div className="bg-white border-2 border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50">
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">EMPLOYEE</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">DEPARTMENT</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">ROLE</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">TENURE</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider">STATUS</th>
                  <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-wider text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                {filtered.map((emp) => (
                  <tr key={emp.id || emp.employee_id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4.5 font-mono text-xs font-bold text-gray-500">{emp.employee_id}</td>
                    <td className="px-6 py-4.5 text-[#0b1120] font-black">
                      <span className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-slate-100 text-slate-400">
                          {employeePhotos[emp.employee_id] ? <img src={employeePhotos[emp.employee_id]} alt={`${emp.full_name}`} className="h-full w-full object-cover" /> : <UserRound className="h-5 w-5" />}
                        </span>
                        {emp.full_name}
                      </span>
                    </td>
                    <td className="px-6 py-4.5 text-gray-800">{emp.department}</td>
                    <td className="px-6 py-4.5 text-gray-800 capitalize">{emp.role}</td>
                    <td className="px-6 py-4.5 text-gray-600 font-mono text-xs">{emp.tenure}</td>
                    <td className="px-6 py-4.5">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                        (emp.status || '').toUpperCase() === 'ACTIVE' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : (emp.status || '').toUpperCase() === 'RESIGNED'
                          ? 'bg-orange-50 text-orange-700 border border-orange-100'
                          : (emp.status || '').toUpperCase() === 'REMOVED'
                          ? 'bg-red-50 text-red-700 border border-red-100'
                          : 'bg-gray-100 text-gray-700 border border-gray-200'
                      }`}>
                        {emp.status || 'UNKNOWN'}
                      </span>
                    </td>
                    <td className="px-6 py-4.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => { void openEdit(emp); }}
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                          title="Edit Record"
                        >
                          <Edit className="w-5 h-5" />
                        </button>
                        <button 
                          onClick={() => setDeleteTarget(emp)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                          title="Delete Record"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Form — full page */}
      <ManagerFullPageSheet
        open={!!editingEmployee}
        title={editingEmployee?.id ? 'Edit employee' : 'Add employee'}
        subtitle={editingEmployee?.full_name || 'Create or update an employee record'}
        onClose={() => setEditingEmployee(null)}
        onSave={() => (document.getElementById('employee-editor-form') as HTMLFormElement | null)?.requestSubmit()}
        saveLabel="Save record"
        saving={saving}
        maxWidthClass="max-w-4xl"
      >
        {editingEmployee && (
          <form id="employee-editor-form" onSubmit={handleSave} className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-sm space-y-6">
            {errorMsg && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800 font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white shadow-sm">
                {editingPhoto ? <img src={editingPhoto} alt={`${editingEmployee.full_name || 'Employee'} photo`} className="h-full w-full object-cover" /> : <UserRound className="h-8 w-8 text-slate-300" />}
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-800">Employee photo</p>
                <p className="mt-1 text-xs text-slate-500">Managers can upload a photo or view the photo the employee added to their ID card. Images must be under 2 MB.</p>
              </div>
              <input
                ref={managerPhotoInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => { void handlePhotoUpload(event.target.files?.[0]); event.currentTarget.value = ''; }}
              />
              <button
                type="button"
                disabled={!editingEmployee.id || savingPhoto}
                onClick={() => managerPhotoInput.current?.click()}
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingPhoto ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                {editingEmployee.id ? (savingPhoto ? 'Saving photo…' : 'Upload photo') : 'Save record first'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              {/* Left Column */}
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Full name *
                  </label>
                  <input 
                    required 
                    type="text" 
                    value={editingEmployee.full_name || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, full_name: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 outline-none font-medium text-sm transition-all text-slate-900 placeholder-slate-400" 
                    placeholder="e.g. Raj Singh"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Email address
                  </label>
                  <input 
                    type="email" 
                    value={editingEmployee.email || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 outline-none font-medium text-sm transition-all text-slate-900 placeholder-slate-400" 
                    placeholder="e.g. raj@genziitian.in"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Secondary email (optional)</label>
                  <input
                    type="email"
                    value={editingEmployee.secondary_email || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, secondary_email: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 outline-none font-medium text-sm text-slate-900 placeholder-slate-400"
                    placeholder="e.g. personal@email.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Department *
                  </label>
                  <select
                    required
                    value={normalizeDepartment(editingEmployee.department)}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, department: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 outline-none font-medium text-sm transition-all text-slate-900 bg-white"
                  >
                    {AVAILABLE_DEPARTMENTS.map((department) => <option key={department} value={department}>{department}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Current status *
                  </label>
                  <select 
                    value={(editingEmployee.status || 'ACTIVE').toUpperCase()}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, status: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 outline-none font-medium text-sm transition-all text-slate-900 bg-white"
                  >
                    {AVAILABLE_STATUSES.map(status => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Employee ID
                  </label>
                  <input 
                    disabled 
                    type="text" 
                    value={editingEmployee.id ? editingEmployee.employee_id : getNextEmployeeId(editingEmployee.role, editingEmployee.full_name)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 outline-none font-mono font-semibold text-sm text-slate-400" 
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Phone number
                  </label>
                  <input 
                    type="text" 
                    value={editingEmployee.phone || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 outline-none font-medium text-sm transition-all text-slate-900 placeholder-slate-400" 
                    placeholder="e.g. +91 98765 43210"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Secondary phone number (optional)</label>
                  <input
                    type="tel"
                    value={editingEmployee.secondary_phone || ''}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, secondary_phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 outline-none font-medium text-sm text-slate-900 placeholder-slate-400"
                    placeholder="Optional alternate number"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Date of birth *</label>
                  <input
                    required
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 outline-none font-medium text-sm text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-[0.8fr_1.2fr] gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">ID document *</label>
                    <select
                      required
                      value={governmentIdType}
                      onChange={(e) => setGovernmentIdType(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 outline-none font-medium text-sm text-slate-900 bg-white"
                    >
                      <option value="">Select</option>
                      {GOVERNMENT_ID_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">ID number *</label>
                    <div className="flex">
                    <input
                      required
                      type={showGovernmentIdNumber ? 'text' : 'password'}
                      autoComplete="off"
                      value={governmentIdNumber}
                      onChange={(e) => setGovernmentIdNumber(e.target.value)}
                      className="min-w-0 flex-1 rounded-l-xl border border-r-0 border-slate-200 px-3.5 py-2.5 font-medium text-sm text-slate-900 outline-none focus:border-slate-400"
                      placeholder="PAN or Aadhaar number"
                    />
                    <button
                      type="button"
                      onClick={() => setShowGovernmentIdNumber((shown) => !shown)}
                      aria-label={showGovernmentIdNumber ? 'Hide ID number' : 'Show ID number'}
                      className="flex items-center justify-center rounded-r-xl border border-slate-200 px-3 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                    >
                      {showGovernmentIdNumber ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                    Role *
                  </label>
                  <select 
                    value={editingEmployee.role || 'Educator'}
                    onChange={(e) => setEditingEmployee({ ...editingEmployee, role: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 outline-none font-medium text-sm transition-all text-slate-900 bg-white"
                  >
                    {AVAILABLE_ROLES.map(role => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Multiple employment periods allow breaks and returns. */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-slate-700">Tenure / duration</div>
                      <p className="mt-1 text-[11px] text-slate-500">Add a period each time they return to work.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTenurePeriods((periods) => [
                        ...periods.map((period) => ({ ...period, isPresent: false })),
                        { startDate: '', endDate: '', isPresent: true },
                      ])}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add period
                    </button>
                  </div>
                  {tenurePeriods.map((period, index) => (
                    <div key={index} className="rounded-xl border border-slate-200 bg-white p-3.5">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Period {index + 1}</span>
                        {tenurePeriods.length > 1 && <button type="button" onClick={() => setTenurePeriods((periods) => periods.filter((_, periodIndex) => periodIndex !== index))} className="text-[11px] font-bold text-red-600 hover:text-red-700">Remove</button>}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="mb-1.5 block text-[11px] font-semibold text-slate-500">Start date *</label>
                          <input
                            required
                            type="date"
                            value={period.startDate}
                            onChange={(e) => setTenurePeriods((periods) => periods.map((item, periodIndex) => periodIndex === index ? { ...item, startDate: e.target.value } : item))}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-400"
                          />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-[11px] font-semibold text-slate-500">End date</label>
                          <input
                            disabled={period.isPresent}
                            required={!period.isPresent}
                            type="date"
                            value={period.endDate}
                            onChange={(e) => setTenurePeriods((periods) => periods.map((item, periodIndex) => periodIndex === index ? { ...item, endDate: e.target.value } : item))}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:border-slate-400 disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`is-present-checkbox-${index}`}
                          checked={period.isPresent}
                          disabled={index < tenurePeriods.length - 1}
                          onChange={(e) => setTenurePeriods((periods) => periods.map((item, periodIndex) => periodIndex === index ? { ...item, isPresent: e.target.checked, endDate: e.target.checked ? '' : item.endDate } : item))}
                          className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-500 disabled:opacity-50"
                        />
                        <label htmlFor={`is-present-checkbox-${index}`} className="cursor-pointer select-none text-xs font-medium text-slate-700">
                          Currently working here (Present)
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Action buttons moved to full-page footer */}
          </form>
        )}
      </ManagerFullPageSheet>

      {photoCropFile && <PhotoCropDialog file={photoCropFile} onCancel={() => setPhotoCropFile(null)} onSave={(photo) => { void saveCroppedPhoto(photo); }} />}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border-2 border-[#0b1120] max-w-sm w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 space-y-4">
              <h3 className="text-lg font-black text-[#0b1120]">Delete Record?</h3>
              <p className="text-sm text-gray-500 font-bold leading-relaxed">
                Are you sure you want to delete the employee record for <strong className="text-gray-800">{deleteTarget.full_name}</strong> ({deleteTarget.employee_id})? This action cannot be undone.
              </p>
              
              <div className="flex items-center justify-end gap-3 pt-2">
                <button 
                  onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 border-2 border-gray-200 hover:border-gray-300 text-gray-500 font-black text-xs rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-600 border-2 border-red-600 text-white font-black text-xs rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
