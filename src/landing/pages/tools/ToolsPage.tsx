'use client';

import { useNavigate, useLocation } from '@/landing/shims/router';
import { LogIn, Calculator, TrendingUp, BookOpen } from 'lucide-react';
import Tabs, { TabDef } from '@/landing/components/tools/Tabs';
import LedgerPanel from '@/landing/components/tools/Ledger/LedgerPanel';
import PredictorPanel from '@/landing/components/tools/Predictor/PredictorPanel';
import GradingScale from '@/landing/components/tools/GradingScale';
import { useAuth } from '@/landing/context/AuthContext';

type TabKey = 'ledger' | 'predictor' | 'scale';

const ROUTE_FOR_TAB: Record<TabKey, string> = {
  ledger: '/tools/cgpa-calculator',
  predictor: '/tools/grade-predictor',
  scale: '/tools/grading-scale',
};

const TABS: TabDef<TabKey>[] = [
  { key: 'ledger', label: 'CGPA / SGPA Ledger', icon: Calculator, activeColor: '#10b981' },
  { key: 'predictor', label: 'Grade Predictor', icon: TrendingUp, activeColor: '#f59e0b' },
  { key: 'scale', label: 'Grading Scale', icon: BookOpen, activeColor: '#3b82f6' },
];

function tabForPath(pathname: string): TabKey {
  if (pathname.startsWith('/tools/grade-predictor')) return 'predictor';
  if (pathname.startsWith('/tools/grading-scale')) return 'scale';
  return 'ledger';
}

export default function ToolsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, openLoginModal } = useAuth();
  const activeTab = tabForPath(location.pathname);

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-blue-100">
      <div className="max-w-5xl mx-auto px-6 pt-10 pb-6">
        <h1 className="text-3xl md:text-4xl font-black text-[#0b1120] tracking-tight">
          CGPA LEDGER &amp; GRADE PREDICTOR
        </h1>
        <p className="text-gray-500 font-medium mt-2 max-w-xl">
          Track your marksheet, predict a course grade before the Final, and check the official cutoffs — all
          computed locally in your browser.
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-6">
        <Tabs tabs={TABS} active={activeTab} onChange={(key) => navigate(ROUTE_FOR_TAB[key])} />

        <div className="pb-16">
          {activeTab === 'ledger' &&
            (user ? (
              <LedgerPanel />
            ) : (
              <div className="text-center py-16 px-6 bg-gray-50 border-[3px] border-dashed border-gray-200 rounded-2xl max-w-md mx-auto">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#eef2ff] border-[3px] border-[#0b1120] mb-4 shadow-[3px_3px_0px_#0b1120]">
                  <LogIn className="w-5 h-5 text-[#0b1120]" />
                </div>
                <h3 className="text-lg font-black text-[#0b1120] mb-2">Sign in to continue</h3>
                <p className="text-gray-500 font-medium text-sm mb-6">
                  Your grades are stored only in your own browser, never on our servers — sign in to save your ledger.
                </p>
                <button
                  type="button"
                  onClick={openLoginModal}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0b1120] text-white border-[3px] border-[#0b1120] rounded-xl font-black text-xs hover:-translate-y-1 hover:-translate-x-1 shadow-[3px_3px_0px_#10b981] transition-all"
                >
                  <LogIn className="w-3.5 h-3.5" /> Sign in to continue
                </button>
              </div>
            ))}

          {activeTab === 'predictor' && <PredictorPanel />}
          {activeTab === 'scale' && <GradingScale />}
        </div>
      </div>
    </div>
  );
}
