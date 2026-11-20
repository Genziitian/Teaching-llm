'use client';
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '@/landing/context/AuthContext';
import { X, Sparkles, Ticket } from 'lucide-react';

export default function WelcomeModal() {
  const { isWelcomeModalOpen, closeWelcomeModal } = useAuth();

  return (
    <AnimatePresence>
      {isWelcomeModalOpen && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center p-6 text-[#0b1120]">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={closeWelcomeModal}
            className="absolute inset-0 bg-[#0b1120]/70 backdrop-blur-md"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, rotate: -2 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.9, opacity: 0, rotate: 2 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white border-[4px] border-[#0b1120] rounded-[2rem] w-full max-w-md p-8 relative shadow-[12px_12px_0px_#10b981] overflow-hidden"
          >
            {/* Close Button */}
            <button
              onClick={closeWelcomeModal}
              className="absolute top-6 right-6 p-2 bg-gray-50 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all border-2 border-[#0b1120] shadow-[2px_2px_0px_#0b1120] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px]"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Content */}
            <div className="text-center space-y-6">
              <motion.div
                initial={{ y: -10 }}
                animate={{ y: 0 }}
                transition={{ repeat: Infinity, duration: 1.5, repeatType: "reverse" }}
                className="w-20 h-20 bg-green-100 rounded-3xl border-[4px] border-[#0b1120] flex items-center justify-center mx-auto shadow-[6px_6px_0px_#10b981]"
              >
                <Sparkles className="w-10 h-10 text-green-600" />
              </motion.div>

              <div className="space-y-2">
                <h2 className="text-3xl font-black leading-tight">
                  Welcome to <br />
                  <span className="text-[#3b82f6]">GenZ IITIAN!</span>
                </h2>
	                <p className="text-gray-500 font-bold text-sm">
	                  Here's a welcome discount for your first purchase.
	                </p>
              </div>

              <div className="bg-blue-50 border-[3px] border-dashed border-[#3b82f6] rounded-2xl p-6 relative group">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white px-4 py-0.5 border-2 border-[#3b82f6] rounded-full text-[10px] font-black text-[#3b82f6] uppercase tracking-widest shadow-[2px_2px_0px_#3b82f6]">
                  Exclusive Offer
                </div>
                <p className="text-gray-600 font-bold text-sm mb-4">
                  Use this code at checkout to get <span className="text-[#3b82f6] font-black text-lg">10% OFF</span> on any other course!
                </p>
                <div className="flex items-center justify-center gap-3">
                  <div className="bg-white border-[3px] border-[#0b1120] px-6 py-3 rounded-xl font-black text-2xl tracking-[0.2em] shadow-[4px_4px_0px_#0b1120] text-[#0b1120] select-all cursor-copy active:scale-95 transition-transform">
                    WELCOME
                  </div>
                  <Ticket className="w-8 h-8 text-[#3b82f6]" />
                </div>
                <p className="text-[10px] font-black text-gray-400 mt-4 uppercase tracking-tighter">
                  Valid for new users • One time use only
                </p>
              </div>

              <button
                onClick={closeWelcomeModal}
                className="w-full py-4 bg-[#0b1120] text-white rounded-2xl font-black text-lg border-[3px] border-[#0b1120] hover:bg-[#10b981] hover:border-[#10b981] transition-all shadow-[6px_6px_0px_#3b82f6] active:shadow-none active:translate-x-[4px] active:translate-y-[4px]"
              >
                Let's Get Started!
              </button>
            </div>

            {/* Design accents */}
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-400/10 rounded-full blur-3xl -z-10"></div>
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-green-400/10 rounded-full blur-3xl -z-10"></div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
