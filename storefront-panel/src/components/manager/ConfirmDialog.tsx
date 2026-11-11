import { AlertTriangle, Loader2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

export type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
};

/** Centered confirmation modal for destructive actions. */
export function ConfirmDialog({ options, onClose }: { options: ConfirmOptions | null; onClose: () => void }) {
  return (
    <AnimatePresence>
      {options && (
        <motion.div
          key="confirm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          onClick={onClose}
          role="alertdialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6"
          >
            <div className="flex items-start gap-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900">{options.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500 break-words">{options.message}</p>
              </div>
            </div>
            <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => {
                  const run = options.onConfirm;
                  onClose();
                  void run();
                }}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-sm font-semibold text-white cursor-pointer"
              >
                {options.confirmLabel || 'Delete'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Blocking "please wait" modal shown while something is saving. */
export function BusyModal({ message }: { message: string | null }) {
  return (
    <AnimatePresence>
      {message && (
        <motion.div
          key="busy"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-2xl shadow-2xl px-8 py-7 flex flex-col items-center gap-3 text-center"
          >
            <Loader2 className="h-8 w-8 animate-spin text-slate-900" />
            <div className="text-sm font-semibold text-slate-900">{message}</div>
            <div className="text-xs text-slate-500">This may take a moment. Please don't close the page.</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
