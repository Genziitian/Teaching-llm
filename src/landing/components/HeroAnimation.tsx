import { motion } from 'motion/react';

export default function HeroAnimation() {
  return (
    <div className="relative w-full aspect-square max-w-[320px] sm:max-w-[450px] lg:max-w-[600px] mx-auto">
      {/* Background Circle */}
      <div className="absolute inset-0 bg-[#eef2ff] rounded-full border-[2px] sm:border-[3px] border-[#0b1120] shadow-[6px_6px_0px_#0b1120] sm:shadow-[12px_12px_0px_#0b1120]"></div>

      {/* Main SVG Animation - Online Degree Scene */}
      <motion.div
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[75%] h-[75%]"
      >
        <svg viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
          {/* Laptop Body */}
          <motion.rect
            x="80" y="120" width="340" height="220" rx="16"
            fill="#0b1120"
            stroke="#0b1120"
            strokeWidth="4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          />
          {/* Laptop Screen */}
          <motion.rect
            x="96" y="136" width="308" height="188" rx="8"
            fill="#10b981"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
          />

          {/* Screen Content - Welcome Text */}
          <motion.text
            x="250" y="185"
            textAnchor="middle"
            fontFamily="Arial, sans-serif"
            fontWeight="900"
            fontSize="22"
            fill="white"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            Welcome to
          </motion.text>
          <motion.text
            x="250" y="225"
            textAnchor="middle"
            fontFamily="Arial, sans-serif"
            fontWeight="900"
            fontSize="30"
            fill="white"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
          >
            Gen-Z IITian
          </motion.text>

          {/* Screen - decorative underline */}
          <motion.rect
            x="175" y="235" width="150" height="4" rx="2"
            fill="#f59e0b"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.5, delay: 1.2 }}
            style={{ originX: 0.5 }}
          />

          {/* Screen - Tagline */}
          <motion.text
            x="250" y="265"
            textAnchor="middle"
            fontFamily="Arial, sans-serif"
            fontWeight="600"
            fontSize="12"
            fill="rgba(255,255,255,0.75)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4 }}
          >
            Master IIT-Level Courses Online
          </motion.text>

          {/* Screen - Progress bar */}
          <motion.rect
            x="160" y="285" width="180" height="8" rx="4"
            fill="rgba(255,255,255,0.2)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5 }}
          />
          <motion.rect
            x="160" y="285" width="180" height="8" rx="4"
            fill="rgba(255,255,255,0.6)"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: [0, 0.7, 0.7, 0.7] }}
            transition={{ duration: 3, delay: 1.7, repeat: Infinity, repeatDelay: 2 }}
            style={{ originX: 0 }}
          />

          {/* Screen - Play icon small */}
          <motion.circle
            cx="250" cy="310" r="10"
            fill="rgba(255,255,255,0.2)"
            stroke="white"
            strokeWidth="1.5"
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1, 1, 1.15, 1] }}
            transition={{ duration: 1.2, delay: 1.8 }}
          />
          <motion.path
            d="M247 305 L255 310 L247 315Z"
            fill="white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.0 }}
          />

          {/* Laptop Base */}
          <motion.path
            d="M50 340 L80 340 L96 360 L404 360 L420 340 L450 340 L430 370 Q425 380 415 380 L85 380 Q75 380 70 370 Z"
            fill="#0b1120"
            stroke="#0b1120"
            strokeWidth="2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          />
          {/* Laptop touchpad line */}
          <motion.rect
            x="220" y="345" width="60" height="4" rx="2"
            fill="#1e293b"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          />

          {/* Graduation Cap - floating above laptop */}
          <motion.g
            animate={{ y: [-6, 6, -6], rotate: [-3, 3, -3] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/* Cap top */}
            <motion.path
              d="M250 55 L310 80 L250 105 L190 80 Z"
              fill="#0b1120"
              stroke="#0b1120"
              strokeWidth="2"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 1.5 }}
            />
            {/* Cap base */}
            <motion.rect
              x="230" y="80" width="40" height="15" rx="2"
              fill="#1e293b"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.7 }}
            />
            {/* Tassel */}
            <motion.path
              d="M310 80 L310 100 L305 105"
              stroke="#f59e0b"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.5, delay: 1.9 }}
            />
            <motion.circle
              cx="305" cy="108" r="4"
              fill="#f59e0b"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 2.2 }}
            />
          </motion.g>

          {/* Wi-Fi Signal Arcs */}
          <motion.g
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <motion.path
              d="M430 130 Q445 115 460 130"
              stroke="#10b981"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, delay: 2.0 }}
            />
            <motion.path
              d="M423 120 Q445 98 467 120"
              stroke="#10b981"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, delay: 2.3 }}
            />
            <motion.path
              d="M416 110 Q445 82 474 110"
              stroke="#10b981"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.4, delay: 2.6 }}
            />
            <motion.circle cx="445" cy="137" r="4" fill="#10b981" />
          </motion.g>

          {/* Certificate / Degree Document - left side */}
          <motion.g
            animate={{ y: [5, -5, 5], rotate: [-2, 2, -2] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          >
            <motion.rect
              x="15" y="180" width="55" height="70" rx="6"
              fill="white"
              stroke="#0b1120"
              strokeWidth="2.5"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 1.8 }}
            />
            {/* Certificate lines */}
            <motion.rect x="24" y="196" width="37" height="3" rx="1.5" fill="#d1d5db"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.1 }} />
            <motion.rect x="24" y="204" width="28" height="3" rx="1.5" fill="#d1d5db"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2 }} />
            <motion.rect x="24" y="212" width="33" height="3" rx="1.5" fill="#d1d5db"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.3 }} />
            {/* Seal */}
            <motion.circle cx="42" cy="232" r="8" fill="#f59e0b" opacity={0.8}
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 2.5, type: 'spring' }} />
            <motion.path d="M38 232 L41 235 L47 228" stroke="white" strokeWidth="2" strokeLinecap="round" fill="none"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 2.7, duration: 0.3 }} />
          </motion.g>

          {/* Book icon - right side */}
          <motion.g
            animate={{ y: [-4, 8, -4], rotate: [3, -3, 3] }}
            transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
          >
            <motion.rect
              x="435" y="230" width="45" height="55" rx="4"
              fill="#3b82f6"
              stroke="#0b1120"
              strokeWidth="2.5"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 2.0 }}
            />
            <motion.rect
              x="440" y="230" width="4" height="55" rx="1"
              fill="#2563eb"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 2.3 }}
            />
            {/* Book lines */}
            <motion.rect x="450" y="245" width="22" height="3" rx="1.5" fill="rgba(255,255,255,0.5)"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.4 }} />
            <motion.rect x="450" y="253" width="16" height="3" rx="1.5" fill="rgba(255,255,255,0.5)"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.5 }} />
            <motion.rect x="450" y="261" width="19" height="3" rx="1.5" fill="rgba(255,255,255,0.5)"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.6 }} />
          </motion.g>

          {/* Floating particles / dots */}
          {[
            { cx: 60, cy: 130, r: 4, color: '#10b981', delay: 0 },
            { cx: 440, cy: 180, r: 3, color: '#f59e0b', delay: 0.5 },
            { cx: 120, cy: 400, r: 5, color: '#3b82f6', delay: 1 },
            { cx: 390, cy: 400, r: 4, color: '#ef4444', delay: 1.5 },
            { cx: 170, cy: 80, r: 3, color: '#8b5cf6', delay: 0.8 },
            { cx: 340, cy: 60, r: 4, color: '#10b981', delay: 1.2 },
          ].map((dot, i) => (
            <motion.circle
              key={`dot-${i}`}
              cx={dot.cx}
              cy={dot.cy}
              r={dot.r}
              fill={dot.color}
              animate={{
                y: [-8, 8, -8],
                opacity: [0.4, 1, 0.4],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: dot.delay,
              }}
            />
          ))}

          {/* Data stream dots - flowing from wifi to laptop */}
          {[0, 1, 2].map((i) => (
            <motion.circle
              key={`stream-${i}`}
              r="3"
              fill="#10b981"
              animate={{
                cx: [430, 400, 370],
                cy: [140, 135, 130],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                ease: 'linear',
                delay: i * 0.5,
              }}
            />
          ))}
        </svg>
      </motion.div>

      {/* Floating "S Grade" Badge - top right */}
      <motion.div
        animate={{ y: [-10, 10, -10], rotate: [-5, 5, -5] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-4 right-2 sm:top-8 sm:right-8 bg-white px-2 py-1.5 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl border-2 sm:border-[3px] border-[#0b1120] shadow-[3px_3px_0px_#0b1120] sm:shadow-[6px_6px_0px_#0b1120] z-10"
      >
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-[#10b981] flex items-center justify-center">
            <span className="text-white font-black text-[10px] sm:text-sm">S</span>
          </div>
          <span className="font-black text-[#0b1120] text-[10px] sm:text-sm">S Grade</span>
        </div>
      </motion.div>

      {/* Floating "9+ CGPA" Badge - bottom left */}
      <motion.div
        animate={{ y: [10, -10, 10], rotate: [5, -5, 5] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute bottom-14 -left-2 sm:bottom-20 sm:left-0 bg-white px-2 py-1.5 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl border-2 sm:border-[3px] border-[#0b1120] shadow-[3px_3px_0px_#0b1120] sm:shadow-[6px_6px_0px_#0b1120] z-10"
      >
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-[#f59e0b] flex items-center justify-center">
            <span className="text-white font-black text-[8px] sm:text-xs">9+</span>
          </div>
          <span className="font-black text-[#0b1120] text-[10px] sm:text-sm">CGPA</span>
        </div>
      </motion.div>

      {/* Floating "Data Scientists" Badge - bottom right */}
      <motion.div
        animate={{ y: [-8, 8, -8], rotate: [3, -3, 3] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="absolute bottom-4 right-0 sm:bottom-6 sm:right-12 bg-white px-2 py-1.5 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl border-2 sm:border-[3px] border-[#0b1120] shadow-[3px_3px_0px_#0b1120] sm:shadow-[6px_6px_0px_#0b1120] z-10"
      >
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-[#3b82f6] flex items-center justify-center">
            <svg className="w-3 h-3 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="white"><path d="M3 3v18h18V3H3zm16 16H5V5h14v14zM7 7h4v4H7V7zm6 0h4v4h-4V7zm-6 6h4v4H7v-4zm6 0h4v4h-4v-4z"/></svg>
          </div>
          <span className="font-black text-[#0b1120] text-[10px] sm:text-sm">Data Scientists</span>
        </div>
      </motion.div>

      {/* Floating "ML Engineer" Badge - top left area */}
      <motion.div
        animate={{ y: [8, -8, 8], rotate: [-3, 3, -3] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        className="absolute top-12 -left-2 sm:top-16 sm:left-0 bg-white px-2 py-1.5 sm:px-4 sm:py-3 rounded-xl sm:rounded-2xl border-2 sm:border-[3px] border-[#0b1120] shadow-[3px_3px_0px_#0b1120] sm:shadow-[6px_6px_0px_#0b1120] z-10"
      >
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="w-5 h-5 sm:w-8 sm:h-8 rounded-md sm:rounded-lg bg-[#8b5cf6] flex items-center justify-center">
            <svg className="w-3 h-3 sm:w-4 sm:h-4" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
          </div>
          <span className="font-black text-[#0b1120] text-[10px] sm:text-sm">ML Engineer</span>
        </div>
      </motion.div>
    </div>
  );
}
