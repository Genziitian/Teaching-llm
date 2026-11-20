'use client';
import { Link, useLocation } from '@/landing/shims/router';
import { Home as HomeIcon, FolderOpen, GraduationCap, Boxes, Menu as MenuIcon } from 'lucide-react';

type Tab = {
  id: string;
  label: string;
  to: string;
  Icon: typeof HomeIcon;
  center?: boolean;
  /** extra path prefixes that keep this tab highlighted */
  match?: string[];
};

const TABS: Tab[] = [
  { id: 'home', label: 'Home', to: '/', Icon: HomeIcon },
  { id: 'resources', label: 'Resources', to: '/resources', Icon: FolderOpen, match: ['/resources', '/syllabus', '/graded-assignment', '/blog', '/docs'] },
  { id: 'courses', label: 'Courses', to: '/explore/courses', Icon: GraduationCap, center: true, match: ['/explore/courses', '/checkout'] },
  { id: 'ecosystem', label: 'Ecosystem', to: '/ecosystem', Icon: Boxes },
  { id: 'menu', label: 'Menu', to: '/explore/menu', Icon: MenuIcon, match: ['/explore/menu', '/about', '/contact', '/newsletter', '/explore/profile', '/privacy', '/terms', '/refund', '/refer'] },
];

function isActive(tab: Tab, pathname: string): boolean {
  if (tab.to === '/') return pathname === '/';
  const prefixes = tab.match ?? [tab.to];
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p));
}

/**
 * Fixed bottom tab bar (mobile only). Five tabs with an elevated, highlighted
 * center "Courses" button: Home · Resources · [Courses] · Ecosystem · Menu.
 */
export default function MobileNav() {
  const { pathname } = useLocation();

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-[90] bg-white border-t-[2.5px] border-[#0b1120]"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 12px)' }}
    >
      <div className="relative max-w-md mx-auto grid grid-cols-5 items-end px-1 pt-2">
        {TABS.map((tab) => {
          const on = isActive(tab, pathname);
          const { Icon } = tab;

          if (tab.center) {
            return (
              <Link key={tab.id} to={tab.to} aria-current={on ? 'page' : undefined} className="flex flex-col items-center justify-end gap-1">
                <span
                  className={`-mt-9 w-14 h-14 rounded-full border-[3px] border-[#0b1120] flex items-center justify-center text-white shadow-[3px_3px_0px_#0b1120] active:translate-y-0.5 transition-all ${
                    on ? 'bg-blue-600 ring-4 ring-blue-200' : 'bg-blue-600'
                  }`}
                >
                  <Icon className="w-7 h-7" strokeWidth={2.2} />
                </span>
                <span className={`text-[9px] tracking-tight ${on ? 'font-black text-blue-600' : 'font-black text-[#0b1120]'}`}>{tab.label}</span>
              </Link>
            );
          }

          return (
            <Link
              key={tab.id}
              to={tab.to}
              aria-current={on ? 'page' : undefined}
              className="flex flex-col items-center justify-end gap-1 px-0.5 py-1.5 min-h-[48px]"
            >
              <span
                className={`flex items-center justify-center w-11 h-7 rounded-[9px] border-2 transition-colors ${
                  on ? 'bg-blue-600 text-white border-[#0b1120] shadow-[2px_2px_0px_#0b1120]' : 'bg-transparent text-gray-400 border-transparent'
                }`}
              >
                <Icon className="w-[18px] h-[18px]" strokeWidth={on ? 2.4 : 2} />
              </span>
              <span className={`text-[9px] tracking-tight leading-none ${on ? 'font-black text-[#0b1120]' : 'font-bold text-gray-400'}`}>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
