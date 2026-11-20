import React, { useState, useEffect } from 'react';
import { 
  Briefcase, 
  Search, 
  RefreshCw, 
  Download, 
  Phone, 
  Mail, 
  User, 
  ExternalLink, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Star, 
  FileText, 
  MessageCircle, 
  Check, 
  Copy, 
  Trash2, 
  Database, 
  X, 
  Filter, 
  GraduationCap, 
  Users, 
  Globe, 
  Award, 
  Loader2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../../lib/supabase';
import { ConfirmDialog, type ConfirmOptions } from './ConfirmDialog';

// Auth is the class app session cookie; no bearer token is sent.
const getAuthHeaders = async (): Promise<Record<string, string>> => ({});
import { useAuth } from '../../context/AuthContext';

export interface JobApplication {
  id: string;
  role: 'tutor' | 'campus-leader';
  role_title: string;
  full_name: string;
  email: string;
  phone: string;
  
  // Personal & academic profile
  age?: string | number;
  gender?: string;
  student_type?: string;
  degree_level?: string;

  // Tutor specific
  is_iitm?: string;
  level?: string;
  subject?: string;
  courses?: string[];
  has_tablet?: string;
  experience_and_why?: string;
  language?: string;
  cgpa?: string;
  resume_link?: string;

  // Campus Leader specific
  official_email?: string;
  is_bs_student?: string;
  is_group_owner?: string;
  group_link?: string;
  group_members?: string;
  inquiries?: string;

  metadata?: any;
  status: 'PENDING' | 'REVIEWED' | 'SHORTLISTED' | 'HIRED' | 'REJECTED';
  manager_notes?: string;
  created_at: string;
  updated_at?: string;
}

const DEFAULT_DEMO_APPLICATIONS: JobApplication[] = [
  {
    id: 'app-demo-1',
    role: 'tutor',
    role_title: 'Subject Tutor (Faculty)',
    full_name: 'Aditya Verma',
    email: 'aditya.verma@example.com',
    phone: '9876543210',
    age: '21',
    gender: 'Male',
    student_type: 'Standalone',
    degree_level: 'Diploma',
    is_iitm: 'Yes',
    level: 'Diploma',
    subject: 'Mathematics for Data Science I, Statistics for Data Science I',
    courses: ['Mathematics for Data Science I', 'Statistics for Data Science I'],
    has_tablet: 'Yes',
    experience_and_why: '2 terms of peer teaching in IITM BS community with 9.2 CGPA.',
    language: 'English',
    cgpa: '9.2',
    resume_link: 'https://drive.google.com/file/d/demo-resume/view',
    status: 'PENDING',
    manager_notes: 'Strong academic profile, S Grade in Maths 1.',
    created_at: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'app-demo-2',
    role: 'campus-leader',
    role_title: 'Campus Leaders',
    full_name: 'Ananya Sharma',
    email: 'ananya.s@example.com',
    official_email: '22f1002345@ds.study.iitm.ac.in',
    phone: '9812345678',
    is_bs_student: 'Yes',
    is_group_owner: 'Yes',
    group_link: 'https://chat.whatsapp.com/demo-iitm-group',
    group_members: '500+',
    inquiries: 'Excited to coordinate study marathons for qualifier students!',
    status: 'SHORTLISTED',
    manager_notes: 'Active group owner with 500+ members in Delhi study circle.',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString()
  }
];

const SQL_MIGRATION = `-- SQL SETUP FOR JOB APPLICATIONS
CREATE TABLE IF NOT EXISTS public.job_applications (
    id TEXT PRIMARY KEY,
    role TEXT NOT NULL,
    role_title TEXT NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    age TEXT,
    gender TEXT,
    student_type TEXT,
    degree_level TEXT,
    is_iitm TEXT,
    level TEXT,
    subject TEXT,
    courses JSONB DEFAULT '[]'::jsonb,
    has_tablet TEXT,
    experience_and_why TEXT,
    language TEXT,
    cgpa TEXT,
    resume_link TEXT,
    official_email TEXT,
    is_bs_student TEXT,
    is_group_owner TEXT,
    group_link TEXT,
    group_members TEXT,
    inquiries TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'PENDING',
    manager_notes TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can submit job applications" ON public.job_applications FOR INSERT WITH CHECK (true);
CREATE POLICY "Managers can manage job applications" ON public.job_applications FOR ALL USING (true);
`;

export default function JobApplicationsManager() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'tutor' | 'campus-leader'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [selectedApp, setSelectedApp] = useState<JobApplication | null>(null);
  const [managerNotesInput, setManagerNotesInput] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [actionSuccessToast, setActionSuccessToast] = useState<string | null>(null);
  const [showSqlTip, setShowSqlTip] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      // 1. Try local server or Vercel API
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/storefront/job-applications', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.applications)) {
          setApplications(data.applications);
          setIsDemoMode(false);
          setLoading(false);
          return;
        }
      }

      // 2. Direct Supabase query fallback
      if (supabase) {
        let directApps: JobApplication[] = [];
        const { data, error } = await supabase
          .from('job_applications')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          directApps = data;
        }

        try {
          const { data: logs } = await supabase
            .from('activity_logs')
            .select('*')
            .eq('action', 'JOB_APPLICATION_SUBMITTED')
            .order('created_at', { ascending: false });

          if (Array.isArray(logs) && logs.length > 0) {
            const existingIds = new Set(directApps.map(a => a.id));
            for (const log of logs) {
              const meta = log.metadata || {};
              const id = meta.id || `log-${log.id}`;
              if (!existingIds.has(id)) {
                directApps.push({
                  id,
                  role: meta.role || 'tutor',
                  role_title: meta.role_title || 'Subject Tutor (Faculty)',
                  full_name: meta.full_name || 'Candidate',
                  email: log.email || meta.email || '',
                  phone: meta.phone || '',
                  is_iitm: meta.is_iitm,
                  level: meta.level,
                  subject: meta.subject,
                  language: meta.language,
                  cgpa: meta.cgpa,
                  resume_link: meta.resume_link,
                  official_email: meta.official_email,
                  is_bs_student: meta.is_bs_student,
                  is_group_owner: meta.is_group_owner,
                  group_link: meta.group_link,
                  group_members: meta.group_members,
                  inquiries: meta.inquiries,
                  metadata: meta,
                  status: meta.status || 'PENDING',
                  manager_notes: meta.manager_notes || '',
                  created_at: log.created_at || meta.created_at || new Date().toISOString(),
                  updated_at: log.created_at || meta.updated_at || new Date().toISOString()
                });
                existingIds.add(id);
              }
            }
          }
        } catch (e) {}

        if (directApps.length > 0) {
          setApplications(directApps);
          setIsDemoMode(false);
          setLoading(false);
          return;
        }
      }

      // 3. Fallback to localStorage or demo
      loadLocalApplications();
    } catch (err) {
      console.warn('API query error, loading fallback:', err);
      loadLocalApplications();
    } finally {
      setLoading(false);
    }
  };

  const loadLocalApplications = () => {
    setIsDemoMode(true);
    try {
      const stored = localStorage.getItem('gzi_job_applications');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setApplications(parsed);
          return;
        }
      }
      setApplications(DEFAULT_DEMO_APPLICATIONS);
      localStorage.setItem('gzi_job_applications', JSON.stringify(DEFAULT_DEMO_APPLICATIONS));
    } catch (e) {
      setApplications(DEFAULT_DEMO_APPLICATIONS);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const openAppDetails = (app: JobApplication) => {
    setSelectedApp(app);
    setManagerNotesInput(app.manager_notes || '');
  };

  const handleUpdateStatus = async (id: string, newStatus: JobApplication['status']) => {
    try {
      const authHeaders = await getAuthHeaders();
      await fetch('/api/storefront/job-applications/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...authHeaders },
        body: JSON.stringify({ id, status: newStatus })
      });

      if (supabase) {
        await supabase.from('job_applications').update({ status: newStatus }).eq('id', id);
      }

      setApplications(prev => prev.map(a => a.id === id ? { ...a, status: newStatus } : a));
      if (selectedApp && selectedApp.id === id) {
        setSelectedApp(prev => prev ? { ...prev, status: newStatus } : null);
      }

      showToast(`Status updated to ${newStatus}`);
    } catch (err) {
      console.error('Update status error:', err);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedApp) return;
    setSavingNotes(true);
    try {
      const authHeaders = await getAuthHeaders();
      await fetch('/api/storefront/job-applications/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...authHeaders },
        body: JSON.stringify({ id: selectedApp.id, manager_notes: managerNotesInput })
      });

      if (supabase) {
        await supabase.from('job_applications').update({ manager_notes: managerNotesInput }).eq('id', selectedApp.id);
      }

      setApplications(prev => prev.map(a => a.id === selectedApp.id ? { ...a, manager_notes: managerNotesInput } : a));
      setSelectedApp(prev => prev ? { ...prev, manager_notes: managerNotesInput } : null);
      showToast('Manager notes saved!');
    } catch (err) {
      console.error('Save notes error:', err);
      alert('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const [confirmDialog, setConfirmDialog] = useState<ConfirmOptions | null>(null);

  const handleDelete = (id: string, name: string) =>
    setConfirmDialog({
      title: 'Delete this application?',
      message: `The application from “${name}” will be permanently removed. This can’t be undone.`,
      confirmLabel: 'Delete application',
      onConfirm: () => performDelete(id),
    });

  const performDelete = async (id: string) => {
    try {
      const authHeaders = await getAuthHeaders();
      await fetch('/api/storefront/job-applications/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', ...authHeaders },
        body: JSON.stringify({ id })
      });

      if (supabase) {
        await supabase.from('job_applications').delete().eq('id', id);
      }

      setApplications(prev => prev.filter(a => a.id !== id));
      if (selectedApp && selectedApp.id === id) setSelectedApp(null);
      showToast('Application deleted');
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const showToast = (msg: string) => {
    setActionSuccessToast(msg);
    setTimeout(() => setActionSuccessToast(null), 3000);
  };

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const copySql = () => {
    navigator.clipboard.writeText(SQL_MIGRATION);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const exportCSV = () => {
    if (applications.length === 0) return alert('No applications to export');

    const headers = [
      'ID',
      'Role',
      'Full Name',
      'Email',
      'Phone',
      'Age',
      'Gender',
      'Student Status',
      'Degree Level',
      'IITM BS Student',
      'Level',
      'Subject',
      'Courses Selected',
      'Has Tablet & Stylus',
      'Teaching Experience & Why',
      'Language',
      'CGPA',
      'Resume Link',
      'Official Email',
      'Group Owner',
      'Group Link',
      'Group Members',
      'Inquiries',
      'Status',
      'Manager Notes',
      'Date Submitted'
    ];

    const rows = filteredApplications.map(app => [
      `"${app.id}"`,
      `"${app.role_title || app.role}"`,
      `"${(app.full_name || '').replace(/"/g, '""')}"`,
      `"${app.email}"`,
      `"${app.phone}"`,
      `"${app.age || ''}"`,
      `"${app.gender || ''}"`,
      `"${app.student_type || ''}"`,
      `"${app.degree_level || ''}"`,
      `"${app.is_iitm || app.is_bs_student || ''}"`,
      `"${app.level || ''}"`,
      `"${(app.subject || '').replace(/"/g, '""')}"`,
      `"${(Array.isArray(app.courses) ? app.courses.join(', ') : (app.courses || '')).replace(/"/g, '""')}"`,
      `"${app.has_tablet || ''}"`,
      `"${(app.experience_and_why || '').replace(/"/g, '""')}"`,
      `"${app.language || ''}"`,
      `"${app.cgpa || ''}"`,
      `"${app.resume_link || ''}"`,
      `"${app.official_email || ''}"`,
      `"${app.is_group_owner || ''}"`,
      `"${app.group_link || ''}"`,
      `"${app.group_members || ''}"`,
      `"${(app.inquiries || '').replace(/"/g, '""')}"`,
      `"${app.status}"`,
      `"${(app.manager_notes || '').replace(/"/g, '""')}"`,
      `"${app.created_at ? new Date(app.created_at).toLocaleString('en-IN') : ''}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `genz_job_applications_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Filter calculations
  const totalCount = applications.length;
  const tutorCount = applications.filter(a => a.role === 'tutor').length;
  const leaderCount = applications.filter(a => a.role === 'campus-leader').length;
  const pendingCount = applications.filter(a => a.status === 'PENDING').length;
  const shortlistedCount = applications.filter(a => a.status === 'SHORTLISTED').length;
  const hiredCount = applications.filter(a => a.status === 'HIRED').length;
  const rejectedCount = applications.filter(a => a.status === 'REJECTED').length;

  const filteredApplications = applications.filter(app => {
    // Role filter
    if (roleFilter !== 'ALL' && app.role !== roleFilter) return false;

    // Status filter
    if (statusFilter !== 'ALL' && app.status !== statusFilter) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = (app.full_name || '').toLowerCase().includes(q);
      const matchEmail = (app.email || '').toLowerCase().includes(q);
      const matchOfficialEmail = (app.official_email || '').toLowerCase().includes(q);
      const matchPhone = (app.phone || '').includes(q);
      const matchSubject = (app.subject || '').toLowerCase().includes(q);
      const matchGroup = (app.group_link || '').toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchOfficialEmail && !matchPhone && !matchSubject && !matchGroup) {
        return false;
      }
    }
    return true;
  });

  const getStatusBadge = (status: JobApplication['status']) => {
    switch (status) {
      case 'PENDING':
        return { label: 'Pending', bg: 'bg-amber-50', text: 'text-amber-800', border: 'border-amber-200', dot: 'bg-amber-500' };
      case 'REVIEWED':
        return { label: 'Reviewed', bg: 'bg-blue-50', text: 'text-blue-800', border: 'border-blue-200', dot: 'bg-blue-500' };
      case 'SHORTLISTED':
        return { label: 'Shortlisted', bg: 'bg-purple-50', text: 'text-purple-800', border: 'border-purple-200', dot: 'bg-purple-500' };
      case 'HIRED':
        return { label: 'Hired / Selected', bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-200', dot: 'bg-emerald-500' };
      case 'REJECTED':
        return { label: 'Rejected', bg: 'bg-rose-50', text: 'text-rose-800', border: 'border-rose-200', dot: 'bg-rose-500' };
      default:
        return { label: status, bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', dot: 'bg-slate-400' };
    }
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog options={confirmDialog} onClose={() => setConfirmDialog(null)} />
      {/* Toast Feedback */}
      <AnimatePresence>
        {actionSuccessToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 right-5 z-[200] bg-slate-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-xs font-bold flex items-center gap-2 border border-slate-700"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{actionSuccessToast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Demo / SQL Migration Notice */}
      {isDemoMode && showSqlTip && (
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-5 relative text-left">
          <button 
            onClick={() => setShowSqlTip(false)}
            className="absolute top-4 right-4 text-yellow-600 hover:text-yellow-900 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-start gap-4">
            <div className="p-3 bg-yellow-100 rounded-xl text-yellow-700 shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div className="space-y-3 flex-grow">
              <h4 className="font-black text-yellow-900 text-base">Running with Local / Backup Applications</h4>
              <p className="text-xs text-yellow-800 font-medium max-w-3xl leading-relaxed">
                The database table <code className="bg-yellow-100 px-1.5 py-0.5 rounded font-mono font-bold">job_applications</code> is not configured in Supabase yet. 
                All applications are safely stored in <code className="bg-yellow-100 px-1.5 py-0.5 rounded font-mono font-bold">server/data/job_applications.json</code> and <code className="bg-yellow-100 px-1.5 py-0.5 rounded font-mono font-bold">localStorage</code>.
                To sync to Supabase, run this script in your Supabase SQL Editor:
              </p>
              
              <div className="relative bg-gray-900 text-gray-100 font-mono text-xs p-3.5 rounded-xl max-h-36 overflow-y-auto max-w-2xl">
                <button 
                  onClick={copySql}
                  className="absolute top-2.5 right-2.5 px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-white flex items-center gap-1.5 transition-colors font-sans font-bold cursor-pointer text-xs"
                >
                  {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedSql ? 'Copied!' : 'Copy SQL'}
                </button>
                <pre>{SQL_MIGRATION}</pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Controls Bar */}
      <div className="flex justify-end items-center gap-2">
        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-2 px-3.5 py-2 bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs active:scale-95"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export CSV</span>
        </button>

        <button
          onClick={fetchApplications}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer disabled:opacity-50 shadow-xs active:scale-95"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Metric Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 sm:gap-3">
        <div 
          onClick={() => { setRoleFilter('ALL'); setStatusFilter('ALL'); }}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            roleFilter === 'ALL' && statusFilter === 'ALL' 
              ? 'ring-2 ring-slate-900 bg-white shadow-md' 
              : 'bg-white hover:bg-slate-50 border-slate-200'
          }`}
        >
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total</div>
          <div className="text-2xl font-black text-slate-900 mt-1">{totalCount}</div>
        </div>

        <div 
          onClick={() => setRoleFilter(roleFilter === 'tutor' ? 'ALL' : 'tutor')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            roleFilter === 'tutor' 
              ? 'ring-2 ring-emerald-600 bg-emerald-50/80 shadow-md' 
              : 'bg-emerald-50/40 hover:bg-emerald-50 border-emerald-200'
          }`}
        >
          <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Tutors</div>
          <div className="text-2xl font-black text-emerald-800 mt-1">{tutorCount}</div>
        </div>

        <div 
          onClick={() => setRoleFilter(roleFilter === 'campus-leader' ? 'ALL' : 'campus-leader')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            roleFilter === 'campus-leader' 
              ? 'ring-2 ring-blue-600 bg-blue-50/80 shadow-md' 
              : 'bg-blue-50/40 hover:bg-blue-50 border-blue-200'
          }`}
        >
          <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Ambassadors</div>
          <div className="text-2xl font-black text-blue-800 mt-1">{leaderCount}</div>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === 'PENDING' ? 'ALL' : 'PENDING')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'PENDING' 
              ? 'ring-2 ring-amber-600 bg-amber-50/80 shadow-md' 
              : 'bg-amber-50/40 hover:bg-amber-50 border-amber-200'
          }`}
        >
          <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Pending</div>
          <div className="text-2xl font-black text-amber-800 mt-1">{pendingCount}</div>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === 'SHORTLISTED' ? 'ALL' : 'SHORTLISTED')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'SHORTLISTED' 
              ? 'ring-2 ring-purple-600 bg-purple-50/80 shadow-md' 
              : 'bg-purple-50/40 hover:bg-purple-50 border-purple-200'
          }`}
        >
          <div className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Shortlisted</div>
          <div className="text-2xl font-black text-purple-800 mt-1">{shortlistedCount}</div>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === 'HIRED' ? 'ALL' : 'HIRED')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'HIRED' 
              ? 'ring-2 ring-teal-600 bg-teal-50/80 shadow-md' 
              : 'bg-teal-50/40 hover:bg-teal-50 border-teal-200'
          }`}
        >
          <div className="text-[11px] font-bold text-teal-700 uppercase tracking-wider">Hired</div>
          <div className="text-2xl font-black text-teal-800 mt-1">{hiredCount}</div>
        </div>

        <div 
          onClick={() => setStatusFilter(statusFilter === 'REJECTED' ? 'ALL' : 'REJECTED')}
          className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
            statusFilter === 'REJECTED' 
              ? 'ring-2 ring-rose-600 bg-rose-50/80 shadow-md' 
              : 'bg-rose-50/40 hover:bg-rose-50 border-rose-200'
          }`}
        >
          <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Rejected</div>
          <div className="text-2xl font-black text-rose-800 mt-1">{rejectedCount}</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search candidate, email, phone, subject..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 sm:py-2 bg-slate-50 border border-slate-200 rounded-xl text-base sm:text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-slate-400"
          />
        </div>

        {/* Role Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 no-scrollbar">
          <button
            onClick={() => setRoleFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
              roleFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Roles ({totalCount})
          </button>
          <button
            onClick={() => setRoleFilter('tutor')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
              roleFilter === 'tutor'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Subject Tutors ({tutorCount})
          </button>
          <button
            onClick={() => setRoleFilter('campus-leader')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
              roleFilter === 'campus-leader'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Campus Leaders ({leaderCount})
          </button>
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-slate-400 font-bold flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading applications...
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="p-16 text-center text-slate-400 font-bold space-y-2">
            <Briefcase className="w-8 h-8 mx-auto text-slate-300" />
            <p className="text-sm">No applications found matching your filters.</p>
          </div>
        ) : (
          <>
            {/* Mobile Card Feed (shown on screens < md) */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredApplications.map(app => {
                const statusConf = getStatusBadge(app.status);
                const isTutor = app.role === 'tutor';

                return (
                  <div
                    key={app.id}
                    className="p-4 space-y-3 hover:bg-slate-50/80 transition-colors"
                  >
                    {/* Top Row: Avatar + Name + Status */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                          isTutor ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {app.full_name?.charAt(0)?.toUpperCase() || 'C'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-sm truncate">
                            {app.full_name}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono truncate">
                            {app.email}
                          </div>
                        </div>
                      </div>

                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0 ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
                        <span>{statusConf.label}</span>
                      </span>
                    </div>

                    {/* Middle Row: Role badge and info */}
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${
                          isTutor 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {isTutor ? 'Subject Tutor' : 'Campus Leader'}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {app.created_at ? new Date(app.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short'
                          }) : ''}
                        </span>
                      </div>

                      <div className="text-slate-800 font-medium text-[11px] pt-0.5">
                        {isTutor ? (
                          <span>{app.subject || 'All subjects'} • {app.level} (CGPA: {app.cgpa || 'N/A'})</span>
                        ) : (
                          <span>Owner: {app.is_group_owner || 'Yes'} • Members: {app.group_members || '100+'}</span>
                        )}
                      </div>
                    </div>

                    {/* Bottom Actions Row */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        {app.phone && (
                          <a
                            href={`https://wa.me/91${app.phone.replace(/\D/g, '').slice(-10)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </a>
                        )}
                        <a
                          href={`mailto:${app.email}`}
                          className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                        >
                          <Mail className="w-3.5 h-3.5" />
                          <span>Email</span>
                        </a>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => openAppDetails(app)}
                          className="px-3 py-1.5 bg-slate-900 text-white rounded-lg font-bold text-xs hover:bg-slate-800 transition-colors"
                        >
                          Details
                        </button>
                        <button
                          onClick={() => handleDelete(app.id, app.full_name)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (shown on screens >= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-black uppercase tracking-wider">
                  <tr>
                  <th className="p-4">Candidate</th>
                  <th className="p-4">Role & Domain</th>
                  <th className="p-4">Key Qualifications</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4">Applied</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredApplications.map(app => {
                  const statusConf = getStatusBadge(app.status);
                  const isTutor = app.role === 'tutor';

                  return (
                    <tr 
                      key={app.id} 
                      className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                      onClick={() => openAppDetails(app)}
                    >
                      {/* Candidate */}
                      <td className="p-4">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${
                            isTutor ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {app.full_name?.charAt(0)?.toUpperCase() || 'C'}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                              {app.full_name}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {app.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Role & Domain */}
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                          isTutor 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-blue-50 text-blue-700 border-blue-200'
                        }`}>
                          {isTutor ? 'Subject Tutor' : 'Campus Leader'}
                        </span>
                        <div className="text-[11px] font-semibold text-slate-700 mt-1 truncate max-w-[180px]">
                          {isTutor ? (app.subject || 'All subjects') : `BS Student: ${app.is_bs_student || 'Yes'}`}
                        </div>
                      </td>

                      {/* Key Qualifications */}
                      <td className="p-4">
                        {isTutor ? (
                          <div className="space-y-0.5">
                            <div className="text-slate-800 font-bold text-[11px]">
                              {app.level} • CGPA: {app.cgpa || 'N/A'}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Language: {app.language || 'English'}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <div className="text-slate-800 font-bold text-[11px]">
                              Owner: {app.is_group_owner || 'Yes'} • Members: {app.group_members || '100+'}
                            </div>
                            <div className="text-[11px] text-slate-500 truncate max-w-[200px]" title={app.group_link}>
                              {app.group_link ? 'Community group linked' : 'No link'}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Contact */}
                      <td className="p-4" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1.5">
                          {app.phone && (
                            <a
                              href={`https://wa.me/91${app.phone.replace(/\D/g, '').slice(-10)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors"
                              title="Chat on WhatsApp"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <a
                            href={`mailto:${app.email}`}
                            className="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors"
                            title="Send Email"
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </a>
                          <span className="font-mono text-slate-600 text-[11px] ml-1">
                            +91 {app.phone?.slice(-10)}
                          </span>
                        </div>
                      </td>

                      {/* Applied Date */}
                      <td className="p-4 text-slate-500 text-[11px] whitespace-nowrap">
                        {app.created_at ? new Date(app.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        }) : '—'}
                      </td>

                      {/* Status */}
                      <td className="p-4" onClick={e => e.stopPropagation()}>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusConf.bg} ${statusConf.text} ${statusConf.border}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${statusConf.dot}`} />
                          <span>{statusConf.label}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openAppDetails(app)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-bold text-[11px] transition-colors cursor-pointer"
                          >
                            View
                          </button>
                          <button
                            onClick={() => handleDelete(app.id, app.full_name)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>

      {/* DETAIL MODAL / SHEET */}
      <AnimatePresence>
        {selectedApp && (
          <div className="fixed inset-0 z-[160] flex items-start sm:items-center justify-center p-0 sm:p-5 bg-black/60 backdrop-blur-sm overflow-y-auto overscroll-contain">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 15 }}
              className="bg-white rounded-none sm:rounded-2xl border-0 sm:border-2 border-slate-900 shadow-2xl p-4 sm:p-6 max-w-2xl w-full min-h-[100dvh] sm:min-h-0 sm:max-h-[92vh] overflow-y-auto space-y-4 sm:space-y-5 text-left sm:my-auto"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b pb-3 sm:pb-4 sticky top-0 bg-white z-10 -mx-4 px-4 sm:mx-0 sm:px-0 sm:static">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ${
                      selectedApp.role === 'tutor' 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {selectedApp.role_title}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      ID: {selectedApp.id}
                    </span>
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-slate-900">
                    {selectedApp.full_name}
                  </h3>
                  <div className="text-xs text-slate-500">
                    Submitted: {new Date(selectedApp.created_at).toLocaleString('en-IN')}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedApp(null)}
                  className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status Selector Bar */}
              <div className="bg-slate-50 p-3 sm:p-3.5 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
                <div className="text-xs font-bold text-slate-700">Application Pipeline Status:</div>
                <div className="grid grid-cols-3 sm:flex sm:flex-wrap items-center gap-1.5 w-full sm:w-auto">
                  {(['PENDING', 'REVIEWED', 'SHORTLISTED', 'HIRED', 'REJECTED'] as const).map(st => (
                    <button
                      key={st}
                      onClick={() => handleUpdateStatus(selectedApp.id, st)}
                      className={`px-2 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-center ${
                        selectedApp.status === st
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Candidate Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-slate-400 font-bold uppercase text-[10px]">Email Address</div>
                  <div className="font-bold text-slate-800 mt-1 flex items-center justify-between">
                    <span>{selectedApp.email}</span>
                    <button
                      onClick={() => copyToClipboard(selectedApp.email, 'email')}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                      title="Copy"
                    >
                      {copiedField === 'email' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-slate-400 font-bold uppercase text-[10px]">Contact Number / WhatsApp</div>
                  <div className="font-bold text-slate-800 mt-1 flex items-center justify-between">
                    <span>+91 {selectedApp.phone}</span>
                    <button
                      onClick={() => copyToClipboard(selectedApp.phone, 'phone')}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                      title="Copy"
                    >
                      {copiedField === 'phone' ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* PERSONAL & ACADEMIC BACKGROUND */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-slate-400 font-bold uppercase text-[10px]">Age & Gender</div>
                  <div className="font-bold text-slate-800 mt-1">
                    {selectedApp.age ? `${selectedApp.age} yrs` : 'N/A'} • {selectedApp.gender || 'Not specified'}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-slate-400 font-bold uppercase text-[10px]">Student Status & Level</div>
                  <div className="font-bold text-slate-800 mt-1">
                    {selectedApp.student_type || 'Standalone'} • {selectedApp.degree_level || selectedApp.level || 'Degree'}
                  </div>
                </div>

                {/* ROLE SPECIFIC FIELDS */}
                {selectedApp.role === 'tutor' ? (
                  <>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">Has Tablet & Stylus?</div>
                      <div className="font-bold text-slate-800 mt-1 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${
                          selectedApp.has_tablet === 'Yes' ? 'bg-emerald-500' : 'bg-amber-500'
                        }`} />
                        <span>{selectedApp.has_tablet || 'Yes'}</span>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">Teaching Language</div>
                      <div className="font-bold text-slate-800 mt-1">{selectedApp.language || 'English'}</div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">Subject CGPA / Grade</div>
                      <div className="font-bold text-slate-800 mt-1">{selectedApp.cgpa || 'N/A'}</div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">IITM BS Student</div>
                      <div className="font-bold text-slate-800 mt-1">{selectedApp.is_iitm || 'Yes'}</div>
                    </div>

                    {/* Selected Courses Chips */}
                    <div className="sm:col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-slate-400 font-bold uppercase text-[10px] mb-1.5">Selected Courses to Teach</div>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.isArray(selectedApp.courses) && selectedApp.courses.length > 0 ? (
                          selectedApp.courses.map((course, idx) => (
                            <span 
                              key={idx} 
                              className="px-2.5 py-1 bg-emerald-100/80 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold"
                            >
                              {course}
                            </span>
                          ))
                        ) : selectedApp.subject ? (
                          selectedApp.subject.split(',').map((s, idx) => (
                            <span 
                              key={idx} 
                              className="px-2.5 py-1 bg-emerald-100/80 text-emerald-900 border border-emerald-300 rounded-lg text-xs font-bold"
                            >
                              {s.trim()}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 font-medium">None specified</span>
                        )}
                      </div>
                    </div>

                    {/* Teaching Experience & Motivation */}
                    {selectedApp.experience_and_why && (
                      <div className="sm:col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="text-slate-400 font-bold uppercase text-[10px] mb-1">
                          Teaching Experience & Why GenZ IITian
                        </div>
                        <p className="text-slate-800 text-xs font-medium whitespace-pre-wrap leading-relaxed">
                          {selectedApp.experience_and_why}
                        </p>
                      </div>
                    )}

                    <div className="sm:col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">Resume / CV Link</div>
                      <div className="font-bold text-slate-800 mt-1 flex items-center justify-between">
                        <span className="truncate max-w-md text-blue-600">{selectedApp.resume_link || 'Not provided'}</span>
                        {selectedApp.resume_link && (
                          <a
                            href={selectedApp.resume_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                          >
                            <span>Open Resume</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">Official / Student Email</div>
                      <div className="font-bold text-slate-800 mt-1">{selectedApp.official_email || 'Not provided'}</div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">BS Student?</div>
                      <div className="font-bold text-slate-800 mt-1">{selectedApp.is_bs_student || 'Yes'}</div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">Community Owner?</div>
                      <div className="font-bold text-slate-800 mt-1">{selectedApp.is_group_owner || 'Yes'}</div>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">Group Members Count</div>
                      <div className="font-bold text-slate-800 mt-1">{selectedApp.group_members || '100-500'}</div>
                    </div>

                    <div className="sm:col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <div className="text-slate-400 font-bold uppercase text-[10px]">Group Link (URL)</div>
                      <div className="font-bold text-slate-800 mt-1 flex items-center justify-between">
                        <span className="truncate max-w-md text-blue-600">{selectedApp.group_link || 'Not provided'}</span>
                        {selectedApp.group_link && (
                          <a
                            href={selectedApp.group_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                          >
                            <span>Open Link</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>

                    {selectedApp.inquiries && (
                      <div className="sm:col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <div className="text-slate-400 font-bold uppercase text-[10px]">Candidate Inquiries / Notes</div>
                        <div className="font-medium text-slate-700 mt-1 leading-relaxed">{selectedApp.inquiries}</div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Applicant-added information (read only) */}
              {Array.isArray(selectedApp.metadata?.user_additions) && selectedApp.metadata.user_additions.length > 0 && (
                <div className="p-3.5 bg-indigo-50/60 rounded-xl border border-indigo-100 space-y-2.5">
                  <div className="text-[11px] font-black uppercase tracking-wider text-indigo-800">
                    Added by applicant ({selectedApp.metadata.user_additions.length})
                  </div>
                  <ul className="space-y-2">
                    {selectedApp.metadata.user_additions.map((a: any) => (
                      <li key={a.id} className="text-xs text-slate-700">
                        <span className="inline-block mr-2 px-1.5 py-0.5 rounded bg-white border border-indigo-100 text-[10px] font-bold uppercase text-indigo-700">{a.type}</span>
                        {a.type === 'link' ? (
                          <a href={a.value} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">{a.label || a.value}</a>
                        ) : (
                          <span className="whitespace-pre-wrap break-words">{a.value}</span>
                        )}
                        <span className="ml-2 text-[10px] text-slate-400">{new Date(a.added_at).toLocaleString('en-IN')}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Manager Notes */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                  Manager Review Notes
                </label>
                <textarea
                  rows={3}
                  value={managerNotesInput}
                  onChange={e => setManagerNotesInput(e.target.value)}
                  placeholder="e.g. Cleared round 1, high communication skills, schedule demo lecture on Wednesday..."
                  className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-base sm:text-xs font-medium text-slate-800 focus:outline-none focus:border-slate-500 min-h-[70px]"
                />
                <div className="flex justify-end mt-2">
                  <button
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                    className="w-full sm:w-auto justify-center px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {savingNotes && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>Save Notes</span>
                  </button>
                </div>
              </div>

              {/* Quick Communication Links */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t pb-6 sm:pb-0">
                <div className="flex flex-wrap items-center gap-2">
                  {selectedApp.phone && (
                    <a
                      href={`https://wa.me/91${selectedApp.phone.replace(/\D/g, '').slice(-10)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>WhatsApp</span>
                    </a>
                  )}
                  <a
                    href={`mailto:${selectedApp.email}`}
                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Email</span>
                  </a>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedApp(null)}
                  className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer text-center"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
