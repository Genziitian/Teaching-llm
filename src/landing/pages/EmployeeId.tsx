'use client';

import { useEffect, useRef, useState } from 'react';
import { Link } from '@/landing/shims/router';
import { BadgeCheck, Building2, CalendarDays, FileText, IdCard, Loader2, Pencil, ShieldCheck, UserRound } from 'lucide-react';
import { useAuth } from '@/landing/context/AuthContext';
import { supabase } from '@/landing/lib/supabase';
import PhotoCropDialog from '@/landing/components/employee/PhotoCropDialog';

type Employee = {
  employee_id: string;
  full_name: string;
  email: string;
  department: string;
  role: string;
  tenure: string;
  status: string;
};

function calculateAge(dateOfBirth: string) {
  const birth = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday = today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 ? age : null;
}

export default function EmployeeId() {
  const { user, profile, loading: authLoading, openLoginModal } = useAuth();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [photoCropFile, setPhotoCropFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      const email = user.email!.trim().toLowerCase();
      const { data: employeeData, error: employeeError } = await supabase
        .from('employees')
        .select('employee_id, full_name, email, department, role, tenure, status')
        .ilike('email', email)
        .maybeSingle();

      if (employeeError) {
        if (!cancelled) setError('Your employee record could not be loaded. Please try again later.');
        setLoading(false);
        return;
      }
      if (!employeeData) {
        if (!cancelled) setEmployee(null);
        setLoading(false);
        return;
      }

      const [photoResult, birthResult] = await Promise.all([
        supabase.from('employee_photos').select('photo_url').eq('employee_id', employeeData.employee_id).maybeSingle(),
        supabase.from('employee_birth_dates').select('date_of_birth').eq('employee_id', employeeData.employee_id).maybeSingle(),
      ]);
      if (!cancelled) {
        setEmployee(employeeData as Employee);
        setPhotoUrl(photoResult.data?.photo_url || '');
        setDateOfBirth(birthResult.data?.date_of_birth || '');
        if (photoResult.error || birthResult.error) setError('Your ID is ready, but some profile details are unavailable. Ask your manager to check the employee records setup.');
      }
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [user?.email]);

  const selectPhoto = (file?: File) => {
    if (!file || !employee) return;
    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('Choose an image smaller than 2 MB.');
      return;
    }
    setPhotoCropFile(file);
  };

  const savePhoto = async (nextPhoto: string) => {
    if (!employee) return;
    setPhotoCropFile(null);
    setSavingPhoto(true);
    setError('');
    try {
      const { data: existingPhoto, error: lookupError } = await supabase.from('employee_photos')
        .select('employee_id').eq('employee_id', employee.employee_id).maybeSingle();
      if (lookupError) throw lookupError;
      const saveResult = existingPhoto
        ? await supabase.from('employee_photos').update({ photo_url: nextPhoto }).eq('employee_id', employee.employee_id)
        : await supabase.from('employee_photos').insert({ employee_id: employee.employee_id, photo_url: nextPhoto });
      if (saveResult.error) throw saveResult.error;
      setPhotoUrl(nextPhoto);
    } catch {
      setError('Photo could not be saved. Ask your manager to apply the employee ID setup instructions.');
    } finally {
      setSavingPhoto(false);
    }
  };

  if (authLoading || loading) return <div className="min-h-[65vh] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-blue-600" /></div>;
  if (!user) return <section className="min-h-[65vh] flex items-center justify-center px-5"><div className="max-w-md text-center"><IdCard className="w-12 h-12 text-blue-600 mx-auto mb-4"/><h1 className="text-3xl font-black">Your employee ID</h1><p className="text-slate-600 mt-3">Log in with your employee email to view your digital ID card.</p><button onClick={openLoginModal} className="mt-6 rounded-xl bg-[#0b1120] px-6 py-3 font-bold text-white">Log in</button></div></section>;
  if (!employee) return <section className="min-h-[65vh] flex items-center justify-center px-5"><div className="max-w-md text-center"><IdCard className="w-12 h-12 text-blue-600 mx-auto mb-4"/><h1 className="text-3xl font-black">Your ID</h1><p className="text-slate-600 mt-3">We couldn’t find an employee directory record for <strong>{user.email}</strong>. Check that your manager used this email on your employee record.</p><Link to="/explore/profile" className="inline-flex mt-6 rounded-xl bg-[#0b1120] px-6 py-3 font-bold text-white">My profile</Link></div></section>;

  const age = dateOfBirth ? calculateAge(dateOfBirth) : null;
  const firstName = profile?.name?.trim().split(/\s+/)[0] || employee.full_name.trim().split(/\s+/)[0];

  return <main className="min-h-[75vh] bg-slate-50 px-4 py-10 sm:px-6 sm:py-16">
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 text-center sm:mb-10"><p className="text-sm font-black uppercase tracking-[0.22em] text-blue-600">Employee identity</p><h1 className="mt-2 text-3xl font-black tracking-tight text-[#0b1120] sm:text-4xl">Hey {firstName}</h1><p className="mt-2 text-slate-600">Here’s your Gen-Z IITian employee ID.</p></header>
      <section className="relative mx-auto max-w-3xl overflow-hidden rounded-[2rem] border-[3px] border-[#0b1120] bg-white shadow-[10px_10px_0px_#0b1120]">
        <div className="h-3 bg-blue-600" />
        <div className="grid md:grid-cols-[230px_1fr]">
          <div className="flex flex-col items-center justify-center bg-[#0b1120] px-6 py-8 text-center text-white sm:py-10">
            <div className="relative mb-5 h-36 w-36">
              <div className="absolute inset-0 overflow-hidden rounded-full border-4 border-white bg-blue-100 shadow-[5px_5px_0px_#2563eb]">
                {photoUrl ? <img src={photoUrl} alt={`${employee.full_name}`} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-blue-700"><UserRound className="h-16 w-16" /></div>}
              </div>
              <button type="button" disabled={savingPhoto} onClick={() => fileInput.current?.click()} aria-label="Change employee photo" className="absolute -bottom-1 -right-1 z-10 flex h-11 w-11 items-center justify-center rounded-full border-[3px] border-[#0b1120] bg-blue-500 text-white shadow-md hover:bg-blue-600 disabled:opacity-60"><Pencil className="h-5 w-5" /></button>
              <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => { selectPhoto(e.target.files?.[0]); e.currentTarget.value = ''; }} />
            </div>
            {savingPhoto ? <p className="text-xs font-semibold text-blue-200">Saving photo…</p> : <p className="text-xs font-semibold text-slate-300">Tap pencil to change photo</p>}
            <div className="mt-7 inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-black uppercase tracking-wide text-emerald-300"><BadgeCheck className="h-4 w-4" />{employee.status || 'ACTIVE'}</div>
          </div>
          <div className="p-6 sm:p-9">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-5"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Gen-Z IITian</p><h2 className="mt-2 text-2xl font-black leading-tight text-[#0b1120] sm:text-3xl">{employee.full_name}</h2></div><ShieldCheck className="h-8 w-8 shrink-0 text-blue-600" /></div>
            <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-6">
              <div className="col-span-2"><p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Employee ID</p><p className="mt-1 font-mono text-lg font-black tracking-wide text-blue-700">{employee.employee_id}</p></div>
              <div><p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Age</p><p className="mt-1 text-base font-bold text-slate-800">{age === null ? 'Not added' : `${age} years`}</p></div>
              <div><p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Role</p><p className="mt-1 text-base font-bold text-slate-800">{employee.role}</p></div>
              <div><p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Department</p><p className="mt-1 flex items-center gap-1.5 text-base font-bold text-slate-800"><Building2 className="h-4 w-4 text-blue-600" />{employee.department}</p></div>
              <div><p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Tenure</p><p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-slate-800"><CalendarDays className="h-4 w-4 shrink-0 text-blue-600" />{employee.tenure}</p></div>
            </div>
            <div className="mt-7 rounded-xl bg-slate-50 px-4 py-3 text-xs font-medium text-slate-500">Employee details are maintained by your manager. You can update your photo here.</div>
          </div>
        </div>
      </section>
      <div className="mx-auto mt-8 flex max-w-3xl flex-col gap-3 sm:flex-row">
        <Link to="/verify" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#0b1120] bg-blue-600 px-5 py-3 font-black text-white shadow-[4px_4px_0px_#0b1120] transition hover:bg-blue-700">
          <BadgeCheck className="h-5 w-5" /> Verify your employment
        </Link>
        <Link to="/employee/policy" className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[#0b1120] bg-white px-5 py-3 font-black text-[#0b1120] shadow-[4px_4px_0px_#0b1120] transition hover:bg-slate-100">
          <FileText className="h-5 w-5" /> Employee policy
        </Link>
      </div>
      {error && <div role="status" className="mx-auto mt-8 max-w-3xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{error}</div>}
    </div>
    {photoCropFile && <PhotoCropDialog file={photoCropFile} onCancel={() => setPhotoCropFile(null)} onSave={(photo) => { void savePhoto(photo); }} />}
  </main>;
}
