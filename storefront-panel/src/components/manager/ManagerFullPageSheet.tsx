import { type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowLeft, Loader2, Save } from 'lucide-react';

type ManagerFullPageSheetProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onSave?: () => void;
  saveLabel?: string;
  saving?: boolean;
  maxWidthClass?: string;
  children: ReactNode;
};

/** Full-page editor sheet used across Manager forms (replaces cramped modals). */
export default function ManagerFullPageSheet({
  open,
  title,
  subtitle,
  onClose,
  onSave,
  saveLabel = 'Save changes',
  saving = false,
  maxWidthClass = 'max-w-7xl',
  children,
}: ManagerFullPageSheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-slate-100 flex flex-col"
        >
          <header className="shrink-0 bg-white border-b border-slate-200 px-4 sm:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-20 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
              <div className="h-6 w-px bg-slate-200 hidden sm:block" />
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-semibold text-slate-900 truncate">{title}</h2>
                {subtitle && <p className="text-xs text-slate-500 truncate">{subtitle}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50"
              >
                Cancel
              </button>
              {onSave && (
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saveLabel}
                </button>
              )}
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full px-4 sm:px-8 py-6 sm:py-8 pb-10" style={{ maxWidth: 'min(100%, 1760px)' }} data-width-hint={maxWidthClass}>
              {children}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const managerFieldLabel = 'block text-xs font-semibold text-slate-600 mb-1.5';
export const managerInputCls =
  'w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400 bg-white';
export const managerSectionCls =
  'bg-white border border-slate-200 rounded-2xl p-5 sm:p-7 shadow-sm space-y-5';
