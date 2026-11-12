'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/landing/lib/supabase';
import { useAuth } from '@/landing/context/AuthContext';
import { Link } from '@/landing/shims/router';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { Printer, CheckCircle2, AlertCircle, Search, ShieldCheck, X, ChevronDown, ChevronUp, LogIn, User, FileText } from 'lucide-react';

interface Employee {
  employee_id: string;
  full_name: string;
  department: string;
  role: string;
  tenure: string;
  status: string;
}

const DEFAULT_EMPLOYEES: Employee[] = [
  {
    employee_id: 'GENZ-EMP-0000',
    full_name: 'Raj Singh',
    department: 'Programming',
    role: 'Educator',
    tenure: '25/09/2025 - Present',
    status: 'ACTIVE'
  },
  {
    employee_id: 'GENZ-EMP-0001',
    full_name: 'Vaibhav',
    department: 'Academics',
    role: 'Educator',
    tenure: 'June 2025 - Present',
    status: 'ACTIVE'
  },
  {
    employee_id: 'GENZ-EMP-0002',
    full_name: 'Ayush',
    department: 'Academics',
    role: 'Educator',
    tenure: 'July 2025 - Present',
    status: 'ACTIVE'
  },
  {
    employee_id: 'GENZ-EMP-0003',
    full_name: 'Ankit K.',
    department: 'Academics',
    role: 'Educator',
    tenure: 'August 2025 - May 2026',
    status: 'INACTIVE'
  },
  {
    employee_id: 'GENZ-INT-0000N',
    full_name: 'Neha Sharma',
    department: 'Operations',
    role: 'Intern',
    tenure: 'May 2025 - November 2025',
    status: 'RESIGNED'
  }
];

export default function Verify() {
  const { user, openLoginModal } = useAuth();
  const [employeeId, setEmployeeId] = useState('');
  const [fullName, setFullName] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState<Employee | null>(null);
  const [searched, setSearched] = useState(false);
  const [verifyTime, setVerifyTime] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const reduce = useReducedMotion();

  // Guidelines Collapsible State
  const [dataIntegrityOpen, setDataIntegrityOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);

  // Print style injection
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden;
        }
        #print-area, #print-area * {
          visibility: visible;
        }
        #print-area {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          border: none !important;
          box-shadow: none !important;
        }
        .no-print {
          display: none !important;
        }
        .modal-backdrop {
          background: transparent !important;
          backdrop-filter: none !important;
          position: absolute !important;
          left: 0;
          top: 0;
          width: 100%;
          height: auto;
          display: block !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Insert audit log
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
      console.warn('Audit log insert failed (table may not exist):', err);
    }
    // Also save to local storage for demo/fallback
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId.trim() || !fullName.trim()) return;

    // Auth guard: require login before verification
    if (!user) {
      openLoginModal();
      return;
    }

    setSearching(true);
    setResult(null);
    setSearched(false);
    setErrorMsg('');

    try {
      // 1. Try to search from Supabase database
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('employee_id', employeeId.trim());

      let found: Employee | undefined = undefined;

      if (data && data.length > 0) {
        // Find matching name case-insensitively
        found = data.find(
          (emp) => emp.full_name.trim().toLowerCase() === fullName.trim().toLowerCase()
        );
      }

      // 2. If not found in DB, check mock local storage records
      if (!found) {
        try {
          const stored = localStorage.getItem('gzi_mock_employees');
          if (stored) {
            const mockList: Employee[] = JSON.parse(stored);
            found = mockList.find(
              (emp) =>
                emp.employee_id.trim().toLowerCase() === employeeId.trim().toLowerCase() &&
                emp.full_name.trim().toLowerCase() === fullName.trim().toLowerCase()
            );
          }
        } catch (err) {
          console.error('Error parsing mock storage:', err);
        }
      }

      // 3. Fallback to pre-populated hardcoded DEFAULT_EMPLOYEES
      if (!found) {
        found = DEFAULT_EMPLOYEES.find(
          (emp) =>
            emp.employee_id.trim().toLowerCase() === employeeId.trim().toLowerCase() &&
            emp.full_name.trim().toLowerCase() === fullName.trim().toLowerCase()
        );
      }

      if (found) {
        setResult(found);
        const now = new Date();
        setVerifyTime(
          now.toLocaleDateString('en-GB') + ', ' + now.toLocaleTimeString('en-US', { hour12: false })
        );
        // Log successful verification
        await insertAuditLog('VERIFY', found.employee_id, found.full_name, `Verified record — Status: ${found.status}`);
      } else {
        setErrorMsg('No official record found matching the details provided. Please check the ID and Name.');
        // Log failed verification attempt
        await insertAuditLog('VERIFY', employeeId.trim(), fullName.trim(), 'Verification failed — No matching record found');
      }
    } catch (err) {
      console.error('Search error:', err);
      setErrorMsg('An error occurred while querying the registry. Please try again.');
    } finally {
      setSearching(false);
      setSearched(true);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const closeModal = () => {
    setSearched(false);
    setResult(null);
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-[#fbfbfd] py-12 md:py-20 px-6">
      <div className="max-w-6xl mx-auto space-y-12">


        {/* Two Column Layout: Info and Form (Hidden when printing) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start no-print">
          
          {/* Left Column: Info Text */}
          <motion.div initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', bounce: 0, duration: 0.7 }} className="lg:col-span-6 space-y-6 text-left">
            <h1 className="text-4xl md:text-6xl font-bold text-[#1d1d1f] tracking-[-0.03em] leading-[1.05]">
              Employment Verification Portal
            </h1>
            <p className="text-gray-500 text-lg leading-relaxed">
              The trusted source for verifying employment and internship records issued by Gen-Z IITian. Results are generated directly from official company records.
            </p>

            {/* Policy acceptance notice — an issued Employee ID is documented acceptance */}
            <div className="bg-[#0b1120] text-white rounded-3xl p-6 space-y-3 shadow-[0_16px_40px_-12px_rgba(11,17,32,0.45)]">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wider uppercase text-emerald-300">
                <FileText className="w-4 h-4" /> Employee Policy
              </div>
              <p className="text-white/80 font-medium text-sm leading-relaxed">
                By generating an Employee ID, you agree to the Gen-Z IITian Employee Policy. Acceptance of your first
                payment from Gen-Z IITian constitutes legal acceptance of those terms.
              </p>
              <Link
                to="/employee/policy"
                className="inline-flex items-center gap-1.5 text-sm font-black text-emerald-300 hover:text-emerald-200 transition-colors"
              >
                Read the Employee Policy →
              </Link>
            </div>
          </motion.div>

          {/* Right Column: Verification Form */}
          <motion.div initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', bounce: 0, duration: 0.7, delay: 0.1 }} className="lg:col-span-6 bg-white border border-black/5 rounded-3xl p-8 shadow-[0_8px_40px_rgba(0,0,0,0.07)]">
            <h2 className="text-xs font-semibold text-gray-400 tracking-wider uppercase mb-6 text-left">
              SECURE RECORD LOOKUP
            </h2>
            <form onSubmit={handleSearch} className="space-y-6 text-left">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  EMPLOYEE ID
                </label>
                <input 
                  required 
                  type="text" 
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value.toUpperCase())}
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="w-full px-4 py-3.5 rounded-2xl border border-black/10 bg-slate-50 focus:bg-white focus:border-[#0b1120] focus:shadow-[0_0_0_4px_rgba(11,17,32,0.06)] transition-all font-semibold outline-none text-gray-800 placeholder-gray-400 placeholder:normal-case uppercase" 
                  placeholder="GENZ-EMP-0000"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  FULL LEGAL NAME
                </label>
                <input 
                  required 
                  type="text" 
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value.toUpperCase())}
                  autoCapitalize="characters"
                  spellCheck={false}
                  className="w-full px-4 py-3.5 rounded-2xl border border-black/10 bg-slate-50 focus:bg-white focus:border-[#0b1120] focus:shadow-[0_0_0_4px_rgba(11,17,32,0.06)] transition-all font-semibold outline-none text-gray-800 placeholder-gray-400 placeholder:normal-case uppercase" 
                  placeholder="As per records"
                />
              </div>

              <button 
                type="submit" 
                disabled={searching}
                className="w-full py-4 bg-[#0b1120] text-white font-semibold rounded-full hover:bg-gray-800 active:scale-[0.98] disabled:opacity-60 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {searching ? 'VERIFYING...' : 'VERIFY AUTHENTICITY'}
              </button>
            </form>
          </motion.div>
        </div>


        {/* Verification Result Modal */}
        {searched && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto modal-backdrop">
            <div className="bg-white rounded-3xl border border-black/5 max-w-2xl w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150 relative text-left" id="print-area">
              
              {/* Close Button (Hidden when printing) */}
              <button 
                onClick={closeModal}
                className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors no-print z-10"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>

              {result ? (
                <div>
                  {/* Heading */}
                  <div className="border-b border-gray-100 px-6 py-5 flex items-center justify-between bg-gray-50/50 pr-16">
                    <div className="flex items-center gap-2 text-xs font-black text-emerald-600 tracking-wider">
                      <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse"></span>
                      RECORD FOUND
                    </div>
                    <div className="text-xs font-bold text-gray-400 font-mono">
                      REF: {result.employee_id}
                    </div>
                  </div>

                  {/* Table Data */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse text-left">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="px-6 py-3 text-xs font-black text-gray-400 uppercase tracking-wider bg-gray-50/30">FIELD</th>
                          <th className="px-6 py-3 text-xs font-black text-gray-400 uppercase tracking-wider bg-gray-50/30">VALIDATED DETAIL</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                        <tr>
                          <td className="px-6 py-4.5 text-gray-500 font-bold">Full Name</td>
                          <td className="px-6 py-4.5 text-[#0b1120] font-black text-base">{result.full_name}</td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4.5 text-gray-500 font-bold">Department</td>
                          <td className="px-6 py-4.5 text-gray-800">{result.department}</td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4.5 text-gray-500 font-bold">Role / Position</td>
                          <td className="px-6 py-4.5 text-gray-800 capitalize">{result.role}</td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4.5 text-gray-500 font-bold">Tenure</td>
                          <td className="px-6 py-4.5 text-gray-800 font-mono text-xs">{result.tenure}</td>
                        </tr>
                        <tr>
                          <td className="px-6 py-4.5 text-gray-500 font-bold">Current Status</td>
                          <td className="px-6 py-4.5">
                            <span className={`inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                              result.status.toUpperCase() === 'ACTIVE' 
                                ? 'bg-emerald-50 text-emerald-700' 
                                : result.status.toUpperCase() === 'RESIGNED'
                                ? 'bg-orange-50 text-orange-700'
                                : result.status.toUpperCase() === 'REMOVED'
                                ? 'bg-red-50 text-red-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {result.status}
                            </span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Footer bar */}
                  <div className="border-t border-gray-100 px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/30">
                    <div className="text-xs text-gray-400 font-bold">
                      Verified at: {verifyTime}
                    </div>
                    <button 
                      onClick={handlePrint}
                      className="no-print flex items-center gap-2 px-5 py-2.5 bg-[#0b1120] text-white font-black text-xs rounded-xl hover:bg-gray-800 transition-colors shadow-sm"
                    >
                      <Printer className="w-4 h-4" /> PRINT OFFICIAL RECORD
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center space-y-4">
                  <div className="inline-flex p-3 bg-red-50 text-red-600 rounded-2xl border border-red-100">
                    <AlertCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-black text-[#0b1120]">Verification Failed</h3>
                  <p className="text-sm text-gray-500 font-bold max-w-sm mx-auto leading-relaxed">
                    {errorMsg || 'No record matching these credentials could be found in the registry.'}
                  </p>
                  <div className="pt-2">
                    <button 
                      onClick={closeModal}
                      className="px-6 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-black text-xs rounded-xl transition-colors"
                    >
                      Close & Search Again
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Verification Guidelines (Hidden when printing) */}
        <div className="max-w-4xl mx-auto pt-6 no-print text-left">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
            {/* Card 1: Data Integrity */}
            <div className="bg-white border border-black/5 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:border-black/10 transition-colors">
              <button 
                onClick={() => setDataIntegrityOpen(!dataIntegrityOpen)}
                className="w-full p-5 flex items-center justify-between font-bold text-gray-800 text-left hover:bg-gray-50/50 transition-colors"
              >
                <span className="text-xs font-semibold text-[#0b1120] uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> Data Integrity
                </span>
                {dataIntegrityOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {dataIntegrityOpen && (
                <div className="px-5 pb-5 text-sm text-gray-500 font-medium leading-relaxed border-t border-gray-100 pt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  Employment information displayed on this portal is sourced from official company records and reflects the individual's documented association with Gen-Z IITian.
                </div>
              )}
            </div>

            {/* Card 2: Support & Corrections */}
            <div className="bg-white border border-black/5 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:border-black/10 transition-colors">
              <button 
                onClick={() => setSupportOpen(!supportOpen)}
                className="w-full p-5 flex items-center justify-between font-bold text-gray-800 text-left hover:bg-gray-50/50 transition-colors"
              >
                <span className="text-xs font-semibold text-[#0b1120] uppercase tracking-wider flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-blue-500" /> Support & Corrections
                </span>
                {supportOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {supportOpen && (
                <div className="px-5 pb-5 text-sm text-gray-500 font-medium leading-relaxed border-t border-gray-100 pt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  Found an issue with the verification result? Email <a href="mailto:help@genziitian.in" className="text-blue-600 hover:underline">help@genziitian.in</a> with the relevant Employee ID and supporting documentation. Our HR team will investigate and respond accordingly.
                </div>
              )}
            </div>

            {/* Card 3: Employee Policy */}
            <div className="bg-white border border-black/5 rounded-2xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.04)] hover:border-black/10 transition-colors">
              <button
                onClick={() => setPolicyOpen(!policyOpen)}
                className="w-full p-5 flex items-center justify-between font-bold text-gray-800 text-left hover:bg-gray-50/50 transition-colors"
              >
                <span className="text-xs font-semibold text-[#0b1120] uppercase tracking-wider flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0b1120]" /> Employee Policy
                </span>
                {policyOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {policyOpen && (
                <div className="px-5 pb-5 text-sm text-gray-500 font-medium leading-relaxed border-t border-gray-100 pt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  Every Employee ID issued by Gen-Z IITian is governed by the Employee Policy. Generation of an Employee
                  ID, and acceptance of any payment from Gen-Z IITian, each constitute documented acceptance of that
                  policy.{' '}
                  <Link to="/employee/policy" className="text-blue-600 hover:underline">
                    Read the full policy
                  </Link>
                  .
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
