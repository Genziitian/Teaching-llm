import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  Home,
  Lock,
  RefreshCw,
  Search,
  ServerCrash,
  ShieldOff,
  WifiOff,
  type LucideIcon,
} from 'lucide-react';

export type ErrorCode = 401 | 403 | 404 | 500 | 503;

interface ErrorConfig {
  code: ErrorCode;
  title: string;
  description: string;
  accent: string;
  Icon: LucideIcon;
}

const ERROR_CONFIG: Record<ErrorCode, ErrorConfig> = {
  401: {
    code: 401,
    title: 'Unauthorized',
    description: 'You need to sign in before you can access this page.',
    accent: '#f59e0b',
    Icon: Lock,
  },
  403: {
    code: 403,
    title: 'Access Denied',
    description: "You don't have permission to view this page.",
    accent: '#ef4444',
    Icon: ShieldOff,
  },
  404: {
    code: 404,
    title: 'Page Not Found',
    description: "The page you're looking for doesn't exist or has been moved.",
    accent: '#3b82f6',
    Icon: Search,
  },
  500: {
    code: 500,
    title: 'Something Went Wrong',
    description: 'An unexpected error occurred on our side. Please try again.',
    accent: '#ef4444',
    Icon: ServerCrash,
  },
  503: {
    code: 503,
    title: 'Service Unavailable',
    description: "We're temporarily offline for maintenance. Please check back soon.",
    accent: '#8b5cf6',
    Icon: WifiOff,
  },
};

export interface ErrorPageProps {
  code?: ErrorCode;
  title?: string;
  description?: string;
  homeHref?: string;
  homeLabel?: string;
  showReload?: boolean;
  errorMessage?: string | null;
  onReload?: () => void;
}

export default function ErrorPage({
  code = 404,
  title,
  description,
  homeHref = '/',
  homeLabel = 'Back to Home',
  showReload = false,
  errorMessage,
  onReload,
}: ErrorPageProps) {
  const config = ERROR_CONFIG[code];
  const Icon = config.Icon;
  const accent = config.accent;
  const displayTitle = title ?? config.title;
  const displayDescription = description ?? config.description;

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 pt-24 pb-12 relative overflow-hidden bg-gray-50">
      {/* Ambient blobs */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-24 -left-24 w-72 h-72 rounded-full opacity-30 blur-3xl"
        style={{ backgroundColor: accent }}
        animate={{ scale: [1, 1.15, 1], x: [0, 20, 0], y: [0, 12, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -right-20 w-80 h-80 rounded-full opacity-20 blur-3xl bg-[#0b1120]"
        animate={{ scale: [1, 1.1, 1], x: [0, -16, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Floating code digits */}
      <motion.span
        aria-hidden
        className="absolute top-[18%] left-[12%] text-6xl md:text-8xl font-black text-[#0b1120]/5 select-none"
        animate={{ y: [0, -18, 0], rotate: [-6, -2, -6] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      >
        {String(code)[0]}
      </motion.span>
      <motion.span
        aria-hidden
        className="absolute bottom-[20%] right-[14%] text-6xl md:text-8xl font-black text-[#0b1120]/5 select-none"
        animate={{ y: [0, 14, 0], rotate: [8, 4, 8] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
      >
        {String(code).slice(-1)}
      </motion.span>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', damping: 18, stiffness: 160 }}
        className="relative z-10 max-w-lg w-full bg-white border-[4px] border-[#0b1120] rounded-3xl p-6 lg:p-10 text-center"
        style={{ boxShadow: `12px 12px 0px ${accent}` }}
      >
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 10, stiffness: 180, delay: 0.15 }}
          className="w-16 h-16 mx-auto mb-6 rounded-2xl border-[3px] border-[#0b1120] flex items-center justify-center shadow-[4px_4px_0px_#0b1120]"
          style={{ backgroundColor: `${accent}22` }}
        >
          <motion.div
            animate={
              code === 500 || code === 503
                ? { rotate: [0, -8, 8, -4, 0] }
                : code === 404
                  ? { y: [0, -4, 0] }
                  : { scale: [1, 1.08, 1] }
            }
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: 0.6 }}
          >
            <Icon className="w-8 h-8" style={{ color: accent }} />
          </motion.div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="text-xs font-black uppercase tracking-[0.25em] mb-3"
          style={{ color: accent }}
        >
          Error {code}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32 }}
          className="text-3xl lg:text-4xl font-black text-[#0b1120] mb-3 tracking-tight"
        >
          {displayTitle}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-gray-500 font-bold mb-6 leading-relaxed"
        >
          {displayDescription}
        </motion.p>

        {errorMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45 }}
            className="mb-6 p-3 bg-slate-50 border-2 border-slate-200 rounded-xl text-left flex gap-2"
          >
            <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs font-mono text-slate-700 break-words max-h-28 overflow-y-auto">
              {errorMessage}
            </p>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          {showReload && (
            <button
              type="button"
              onClick={onReload ?? (() => window.location.reload())}
              className="flex-1 inline-flex items-center justify-center gap-2 py-3.5 px-4 bg-[#0b1120] text-white rounded-2xl font-black border-[3px] border-[#0b1120] hover:translate-y-0.5 transition-all group"
              style={{ boxShadow: `5px 5px 0px ${accent}` }}
            >
              <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
              Try Again
            </button>
          )}
          <Link
            to={homeHref}
            className={`inline-flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl font-black border-[3px] border-[#0b1120] transition-all ${
              showReload
                ? 'flex-1 bg-white text-[#0b1120] hover:bg-gray-50'
                : 'w-full bg-[#0b1120] text-white hover:translate-y-0.5'
            }`}
            style={showReload ? undefined : { boxShadow: `5px 5px 0px ${accent}` }}
          >
            {homeHref === '/' ? (
              <Home className="w-4 h-4" />
            ) : (
              <ArrowLeft className="w-4 h-4" />
            )}
            {homeLabel}
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
