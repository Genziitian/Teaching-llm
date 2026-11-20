import React from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';

export default function OneOnOneScheduleCard({ className = '' }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className={`relative w-full max-w-sm sm:max-w-md mx-auto ${className}`}
    >
      {/* Floating Gentle Bobbing Container */}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
        className="relative"
      >
        {/* Floating Top Floating Micro-Badge */}
        <motion.div
          animate={{ y: [0, -6, 0], rotate: [-2, 2, -2] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-4 -left-3 sm:-left-5 z-20 bg-white border-2 border-[#0b1120] rounded-full px-3 py-1 shadow-[3px_3px_0px_#0b1120] flex items-center gap-1.5 text-[11px] font-black text-[#0b1120]"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400" />
          <span>ARNAB -Foundation student-</span>
        </motion.div>

        {/* Outer Emerald Container (Photo 1) */}
        <div className="bg-[#10b981] border-[3.5px] border-[#0b1120] rounded-[2rem] p-3 sm:p-4 shadow-[8px_8px_0px_#0b1120] relative">
          
          {/* Subtle Decorative Corner Glow */}
          <div className="absolute -top-6 -right-6 w-24 h-24 bg-white/25 rounded-full blur-xl pointer-events-none" />

          {/* Inner White Main Card */}
          <div className="bg-white border-[3px] border-[#0b1120] rounded-[1.75rem] p-4 sm:p-6 shadow-[3px_3px_0px_#0b1120] space-y-3 sm:space-y-4">
            
            {/* Card Header */}
            <div className="flex items-center justify-between pb-1">
              <div>
                <span className="block text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-gray-500 leading-tight">
                  THIS WEEK —
                </span>
                <span className="block text-xs sm:text-sm font-black uppercase tracking-wide text-[#0b1120]">
                  YOUR CLASSES
                </span>
              </div>

              {/* "You set these" Mint Pill with pulsing indicator */}
              <motion.div 
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d1fae5] border-2 border-[#10b981] text-[#059669] font-black text-[11px] sm:text-xs shadow-sm cursor-default"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>You set these</span>
              </motion.div>
            </div>

            {/* Row 1: MATH 1 */}
            <motion.div
              whileHover={{ scale: 1.025, x: 3 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="bg-white border-2 border-[#0b1120] rounded-2xl p-3 sm:p-3.5 flex items-center justify-between shadow-[2.5px_2.5px_0px_#0b1120] hover:shadow-[4px_4px_0px_#0b1120] transition-all cursor-pointer group"
            >
              <div>
                <span className="font-black text-[#0b1120] text-sm sm:text-base leading-snug block">
                  MATH 1
                </span>
              </div>
              <div className="text-right">
                <span className="block font-black text-xs sm:text-sm text-gray-800">
                  Tue 9
                </span>
                <span className="block font-black text-xs sm:text-sm text-gray-800">
                  PM
                </span>
              </div>
            </motion.div>

            {/* Row 2: STATS 1 - POINT BI-SERIAL CO. (Active Green Tint with Animated Pulse) */}
            <motion.div
              whileHover={{ scale: 1.025, x: 3 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="bg-[#ecfdf5] border-2 border-[#0b1120] rounded-2xl p-3 sm:p-3.5 flex items-center justify-between shadow-[2.5px_2.5px_0px_#0b1120] hover:shadow-[4px_4px_0px_#0b1120] transition-all cursor-pointer relative overflow-hidden group"
            >
              {/* Animated highlight shimmer sweep */}
              <motion.div 
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
                className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-12 pointer-events-none"
              />

              <div className="relative z-10">
                <span className="font-black text-[#0b1120] text-sm sm:text-base leading-snug block">
                  STATS 1 -
                </span>
                <span className="font-black text-[#0b1120] text-sm sm:text-base leading-snug block">
                  POINT BI-SERIAL CO.
                </span>
              </div>
              <div className="text-right relative z-10">
                <span className="block font-black text-xs sm:text-sm text-[#059669]">
                  Thu
                </span>
                <span className="block font-black text-xs sm:text-sm text-[#059669]">
                  8 PM
                </span>
              </div>
            </motion.div>

            {/* Row 3: RE-TEACH : DICT & PYQS (Dashed Border Card) */}
            <motion.div
              whileHover={{ scale: 1.025, x: 3 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="bg-white border-2 border-dashed border-gray-300 hover:border-[#0b1120] hover:bg-gray-50/70 rounded-2xl p-3 sm:p-3.5 flex items-center justify-between transition-all cursor-pointer"
            >
              <div>
                <span className="font-extrabold text-gray-500 text-sm sm:text-base leading-snug block">
                  RE-TEACH :
                </span>
                <span className="font-extrabold text-gray-500 text-sm sm:text-base leading-snug block">
                  DICT & PYQS
                </span>
              </div>
              <div className="text-right">
                <span className="block font-bold text-xs sm:text-sm text-gray-500">
                  You
                </span>
                <span className="block font-bold text-xs sm:text-sm text-gray-500">
                  pick
                </span>
              </div>
            </motion.div>

            {/* Spacer for overlapping bottom badges */}
            <div className="h-6 sm:h-8" />
          </div>

          {/* Overlapping Bottom Badges Container */}
          <div className="absolute -bottom-5 sm:-bottom-6 left-5 right-2 flex items-end justify-between gap-2 pointer-events-auto">
            
            {/* Badge 1: CLASS SIZE: 1 student (White Box) */}
            <motion.div
              animate={{ y: [0, -4, 0], rotate: [-1, 1, -1] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
              whileHover={{ scale: 1.08, y: -6 }}
              className="bg-white border-[3px] border-[#0b1120] rounded-2xl px-3.5 sm:px-4 py-2 sm:py-2.5 shadow-[4px_4px_0px_#0b1120] transition-transform cursor-pointer"
            >
              <span className="block text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-gray-500">
                CLASS SIZE
              </span>
              <span className="block text-xs sm:text-sm font-black text-[#0b1120] whitespace-nowrap">
                1 student
              </span>
            </motion.div>

            {/* Badge 2: PACE: Yours (Dark Navy Box with Emerald Shadow) */}
            <motion.div
              animate={{ y: [0, -5, 0], rotate: [1, -1, 1] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
              whileHover={{ scale: 1.08, y: -7 }}
              className="bg-[#0b1120] border-[3px] border-[#0b1120] rounded-2xl px-4 sm:px-5 py-2.5 sm:py-3 shadow-[4px_4px_0px_#10b981] transition-transform cursor-pointer"
            >
              <span className="block text-[9px] sm:text-[10px] font-black uppercase tracking-wider text-gray-400">
                PACE
              </span>
              <span className="block text-xs sm:text-sm font-black text-white whitespace-nowrap">
                Yours
              </span>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
