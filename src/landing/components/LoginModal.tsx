'use client';
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/landing/context/AuthContext';
import { X, LogIn, ShieldCheck } from 'lucide-react';

export default function LoginModal() {
  const { isLoginModalOpen, closeLoginModal, signIn } = useAuth();

  return (
    <AnimatePresence>
      {isLoginModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 text-[#0b1120]">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeLoginModal}
            className="absolute inset-0 bg-[#0b1120]/60 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border-[4px] border-[#0b1120] rounded-xl w-full max-w-md p-5 lg:p-6 relative shadow-[10px_10px_0px_#0b1120] overflow-hidden"
          >
            {/* Close Button */}
            <button
              onClick={closeLoginModal}
              className="absolute top-4 right-4 p-2 hover:bg-gray-100 rounded-xl transition-colors border-2 border-transparent hover:border-[#0b1120]"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content */}
            <div className="text-center">
              <motion.div
                initial={{ rotate: -10 }}
                animate={{ rotate: 10 }}
                transition={{ repeat: Infinity, duration: 2, repeatType: "reverse" }}
                className="w-12 h-12 bg-blue-100 rounded-2xl border-[3px] border-[#0b1120] flex items-center justify-center mx-auto mb-3 shadow-[3px_3px_0px_#3b82f6]"
              >
                <LogIn className="w-6 h-6 text-blue-600" />
              </motion.div>

              <h2 className="text-xl md:text-2xl font-black mb-1.5 leading-tight">
                Welcome to <br />
                <span className="text-blue-600">GenZ IITIAN</span>
              </h2>
              <p className="text-gray-500 font-bold text-xs mb-5 max-w-[220px] mx-auto">
                Sign in or create an account to start your journey.
              </p>

              <div className="space-y-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    signIn();
                    closeLoginModal();
                  }}
                  className="w-full flex items-center justify-center gap-2.5 py-2.5 bg-[#0b1120] text-white rounded-xl font-black text-base border-[3px] border-[#0b1120] hover:bg-gray-900 transition-colors shadow-[4px_4px_0px_#3b82f6]"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" className="fill-current">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  Continue to login
                </motion.button>

                <div className="flex items-center justify-center gap-2 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  <ShieldCheck className="w-4 h-4" /> Secure sign in
                </div>
              </div>
            </div>

            {/* Design accents */}
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-red-400/10 rounded-full blur-3xl -z-10"></div>
            <div className="absolute -top-10 -left-10 w-32 h-32 bg-blue-400/10 rounded-full blur-3xl -z-10"></div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
