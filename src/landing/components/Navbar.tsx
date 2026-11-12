'use client';
import { Link, NavLink, useLocation } from '@/landing/shims/router';
import { useState, useRef, useEffect } from 'react';
import { User as UserIcon, LogOut, LayoutDashboard, Gift, ChevronDown } from 'lucide-react';
import { useAuth } from '@/landing/context/AuthContext';
import { useCart } from '@/landing/context/CartContext';
import { supabase } from '@/landing/lib/supabase';
import QuizLabNavPill from '@/landing/components/QuizLabNavPill';

const RESOURCE_LINKS = [
  { to: '/resources', label: 'PYQs & Notes' },
  { to: '/resources?tab=booklet', label: 'Booklet' },
  { to: '/syllabus', label: 'Syllabus' },
  { to: '/graded-assignment', label: 'Graded Assignment' },
  { to: '/tools/cgpa-calculator', label: 'CGPA Calculator' },
  { to: '/blog', label: 'Blog' },
];

const CONNECT_LINKS = [
  { to: '/about', label: 'About Us' },
  { to: '/contact', label: 'Contact Us' },
  { href: 'https://chat.whatsapp.com/Gi4D9yAd99p7q1XeVh0J1e', label: 'Community' },
  { to: '/newsletter', label: 'Newsletter' },
  { to: '/careers', label: 'Careers' },
];

type DesktopMenu = 'resources' | 'connect' | null;

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileResourcesOpen, setMobileResourcesOpen] = useState(false);
  const [mobileConnectOpen, setMobileConnectOpen] = useState(false);
  const [desktopMenu, setDesktopMenu] = useState<DesktopMenu>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const resourcesMenuRef = useRef<HTMLDivElement>(null);
  const connectMenuRef = useRef<HTMLDivElement>(null);
  const megaMenuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<number | null>(null);
  const location = useLocation();
  
  const { user, profile, signIn, signOut, isManager, openLoginModal } = useAuth();
  const { cart } = useCart();
  const [isEmployee, setIsEmployee] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user?.email) {
      setIsEmployee(false);
      return;
    }
    Promise.resolve(supabase.from('employees').select('employee_id').ilike('email', user.email).maybeSingle())
      .then(({ data }) => { if (!cancelled) setIsEmployee(Boolean(data)); })
      .catch(() => { if (!cancelled) setIsEmployee(false); });
    return () => { cancelled = true; };
  }, [user?.email]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (
        megaMenuRef.current &&
        !megaMenuRef.current.contains(e.target as Node) &&
        !resourcesMenuRef.current?.contains(e.target as Node) &&
        !connectMenuRef.current?.contains(e.target as Node)
      ) {
        setDesktopMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menus on route change
  useEffect(() => {
    setMobileResourcesOpen(false);
    setMobileConnectOpen(false);
    setDesktopMenu(null);
    setMobileOpen(false);
  }, [location.pathname]);

  const openDesktopMenu = (menu: DesktopMenu) => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    setDesktopMenu(menu);
  };

  const scheduleCloseDesktopMenu = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setDesktopMenu(null), 160);
  };

  const megaLinks = desktopMenu === 'resources' ? RESOURCE_LINKS : CONNECT_LINKS;

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `relative font-bold text-[15px] whitespace-nowrap transition-colors pb-1 ${
      isActive
        ? 'text-[#0b1120] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2.5px] after:bg-blue-600 after:rounded-full'
        : 'text-gray-600 hover:text-[#0b1120]'
    }`;

  const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `py-2 font-bold text-base transition-colors ${isActive ? 'text-blue-600' : 'text-gray-700 hover:text-[#0b1120]'}`;

  return (
    <nav className="relative border-b border-gray-200 bg-white sticky top-0 z-[100]">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-1 whitespace-nowrap shrink-0">
          <span className="font-black text-2xl tracking-tight text-[#0b1120]">Gen-Z</span>
          <span className="font-black text-2xl tracking-tight text-red-500">IITian</span>
        </Link>
        <div className="hidden md:flex items-center gap-4 lg:gap-8 whitespace-nowrap">
          <NavLink to="/" end className={navLinkClass}>Home</NavLink>
          <NavLink to="/explore/courses" className={navLinkClass}>Courses</NavLink>
          <QuizLabNavPill />
          <NavLink
            to="/one-to-one"
            className={({ isActive }) =>
              `px-3 py-1.5 rounded-lg border text-sm font-bold whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-[#0b1120] text-white border-[#0b1120]'
                  : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
              }`
            }
          >
            1:1 Teaching
          </NavLink>
          <div
            className="relative"
            ref={resourcesMenuRef}
            onMouseEnter={() => openDesktopMenu('resources')}
            onMouseLeave={scheduleCloseDesktopMenu}
          >
            <button 
              onClick={() => setDesktopMenu(desktopMenu === 'resources' ? null : 'resources')}
              className={`flex items-center gap-1 relative font-bold text-[15px] transition-colors pb-1 ${
                location.pathname.includes('/resources') || location.pathname.includes('/docs') || location.pathname.includes('/graded-assignment') || location.pathname.includes('/blog') || location.pathname.includes('/tools')
                  ? 'text-[#0b1120] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2.5px] after:bg-blue-600 after:rounded-full'
                  : 'text-gray-600 hover:text-[#0b1120]'
              }`}
            >
              Resources <ChevronDown className={`w-4 h-4 transition-transform ${desktopMenu === 'resources' ? 'rotate-180' : ''}`} />
            </button>
          </div>
          <div
            className="relative"
            ref={connectMenuRef}
            onMouseEnter={() => openDesktopMenu('connect')}
            onMouseLeave={scheduleCloseDesktopMenu}
          >
            <button 
              onClick={() => setDesktopMenu(desktopMenu === 'connect' ? null : 'connect')}
              className={`flex items-center gap-1 relative font-bold text-[15px] transition-colors pb-1 ${
                location.pathname.includes('/about') || location.pathname.includes('/contact') || location.pathname.includes('/newsletter') || location.pathname.includes('/careers')
                  ? 'text-[#0b1120] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2.5px] after:bg-blue-600 after:rounded-full'
                  : 'text-gray-600 hover:text-[#0b1120]'
              }`}
            >
              Connect <ChevronDown className={`w-4 h-4 transition-transform ${desktopMenu === 'connect' ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <Link 
                to="/refer"
                title="Refer & Earn" className="hidden sm:flex items-center gap-2 p-2.5 whitespace-nowrap shrink-0 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors border-2 border-transparent shadow-[4px_4px_0px_#0b1120]"
              >
                <Gift className="w-5 h-5" />
              </Link>
              <button 
                onClick={() => window.open('https://class.genziitian.in', '_blank', 'noopener,noreferrer')}
                title="Dashboard" className="hidden sm:flex items-center gap-2 px-3 xl:px-4 py-2 whitespace-nowrap shrink-0 bg-white text-blue-600 border-2 border-[#0b1120] rounded-xl font-bold hover:bg-blue-50 transition-colors shadow-[4px_4px_0px_#0b1120]"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden xl:inline">Dashboard</span>
              </button>
              <div className="relative" ref={userMenuRef}>
                <button 
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  aria-label="Account menu"
                  className="group flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 bg-[#0b1120] text-white rounded-full font-bold hover:bg-gray-800 active:scale-95 hover:shadow-lg transition-all duration-200 border-2 border-transparent"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-sm font-black uppercase border border-white/20 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                    {profile?.name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-300 transition-transform duration-300 ${userMenuOpen ? 'rotate-180' : 'group-hover:translate-y-0.5'}`} />
                </button>
                {userMenuOpen && (
                  <div className="absolute top-full right-0 mt-3 w-56 animate-[fadeSlide_0.18s_ease-out] bg-white border-[3px] border-[#0b1120] rounded-xl shadow-[6px_6px_0px_#0b1120] py-2 z-50">
                    <Link to="/explore/profile" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors">
                      <UserIcon className="w-4 h-4" /> My Profile
                    </Link>
                    {isEmployee && <Link to="/employee/id" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-blue-600 hover:bg-blue-50 transition-colors">
                      <UserIcon className="w-4 h-4" /> Your ID
                    </Link>}
                    {isManager && (
                      <Link to="/manager" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors">
                        <LayoutDashboard className="w-4 h-4" /> Manager Panel
                      </Link>
                    )}
                    <div className="h-0.5 bg-gray-100 my-2 mx-4" />
                    <button onClick={signOut} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-gray-500 hover:bg-gray-50 transition-colors">
                      <LogOut className="w-4 h-4" /> Log out
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <button onClick={openLoginModal} className="px-6 py-2.5 rounded-xl font-bold text-sm bg-[#0b1120] text-white hover:bg-gray-800 transition-colors">
              Log in
            </button>
          )}

          {/* Mobile menu button — hidden: the bottom tab bar + Menu page handle mobile nav now */}
          <button
            className="hidden w-10 h-10 items-center justify-center rounded-lg border-2 border-[#0b1120]"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
          </button>
        </div>
      </div>

      {desktopMenu && (
        <div
          ref={megaMenuRef}
          onMouseEnter={() => openDesktopMenu(desktopMenu)}
          onMouseLeave={scheduleCloseDesktopMenu}
          className="hidden md:block absolute inset-x-0 top-full z-[110] bg-white border-b-[3px] border-[#0b1120] shadow-[0_12px_28px_rgba(11,17,32,0.12)]"
        >
          <div className="max-w-7xl mx-auto px-6 py-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-3">
              {desktopMenu === 'resources' ? 'Resources' : 'Connect'}
            </p>
            <div className={`grid gap-3 ${desktopMenu === 'resources' ? 'grid-cols-3 lg:grid-cols-6' : 'grid-cols-3 lg:grid-cols-5'}`}>
              {megaLinks.map((item) => {
                const className = "flex items-center justify-center min-h-[72px] px-3 py-4 text-center text-sm font-black text-[#0b1120] bg-gray-50 border-[2.5px] border-[#0b1120] rounded-xl shadow-[3px_3px_0px_#0b1120] hover:bg-blue-50 hover:text-blue-600 transition-colors";
                return item.href ? (
                  <a key={item.label} href={item.href} target="_blank" rel="noopener noreferrer" className={className}>{item.label}</a>
                ) : (
                  <Link key={item.to} to={item.to!} className={className}>{item.label}</Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-gray-200 px-6 py-6 flex flex-col gap-4">
          <NavLink to="/" end onClick={() => setMobileOpen(false)} className={mobileNavLinkClass}>Home</NavLink>
          <NavLink to="/explore/courses" onClick={() => setMobileOpen(false)} className={mobileNavLinkClass}>Courses</NavLink>
          <QuizLabNavPill className="self-start" onClick={() => setMobileOpen(false)} />
          <NavLink to="/one-to-one" onClick={() => setMobileOpen(false)} className={mobileNavLinkClass}>
            <span className="flex items-center justify-between">
              <span>1:1 Teaching</span>
            </span>
          </NavLink>
          <div className="flex flex-col">
            <button 
              onClick={() => setMobileResourcesOpen(!mobileResourcesOpen)}
              className="flex items-center justify-between py-2 font-bold text-base text-gray-700 hover:text-[#0b1120]"
            >
              Resources <ChevronDown className={`w-5 h-5 transition-transform ${mobileResourcesOpen ? 'rotate-180' : ''}`} />
            </button>
            {mobileResourcesOpen && (
              <div className="flex flex-col gap-3 pl-4 pt-2 pb-2 border-l-2 border-gray-100 ml-2 mt-1">
                <Link to="/resources" className="text-sm font-bold text-gray-600 hover:text-blue-600">PYQs & Notes</Link>
                <Link to="/resources?tab=booklet" className="text-sm font-bold text-gray-600 hover:text-blue-600">Booklet</Link>
                <Link to="/syllabus" className="text-sm font-bold text-gray-600 hover:text-blue-600">Syllabus</Link>
                <Link to="/graded-assignment" className="text-sm font-bold text-gray-600 hover:text-blue-600">Graded Assignment</Link>
                <Link to="/tools/cgpa-calculator" className="text-sm font-bold text-gray-600 hover:text-blue-600">CGPA Calculator</Link>
                <Link to="/blog" className="text-sm font-bold text-gray-600 hover:text-blue-600">Blog</Link>
              </div>
            )}
          </div>
          <div className="flex flex-col">
            <button 
              onClick={() => setMobileConnectOpen(!mobileConnectOpen)}
              className="flex items-center justify-between py-2 font-bold text-base text-gray-700 hover:text-[#0b1120]"
            >
              Connect <ChevronDown className={`w-5 h-5 transition-transform ${mobileConnectOpen ? 'rotate-180' : ''}`} />
            </button>
            {mobileConnectOpen && (
              <div className="flex flex-col gap-3 pl-4 pt-2 pb-2 border-l-2 border-gray-100 ml-2 mt-1">
                <Link to="/about" onClick={() => setMobileOpen(false)} className="text-sm font-bold text-gray-600 hover:text-blue-600">About Us</Link>
                <Link to="/contact" onClick={() => setMobileOpen(false)} className="text-sm font-bold text-gray-600 hover:text-blue-600">Contact Us</Link>
                <a href="https://chat.whatsapp.com/Gi4D9yAd99p7q1XeVh0J1e" target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-gray-600 hover:text-blue-600">Community</a>
                <Link to="/newsletter" onClick={() => setMobileOpen(false)} className="text-sm font-bold text-gray-600 hover:text-blue-600">Newsletter</Link>
                <Link to="/careers" onClick={() => setMobileOpen(false)} className="text-sm font-bold text-gray-600 hover:text-blue-600">Careers</Link>
              </div>
            )}
          </div>
          {user && (
            <NavLink to="/refer" onClick={() => setMobileOpen(false)} className={mobileNavLinkClass}>Refer & Earn</NavLink>
          )}
          <div className="h-0.5 bg-gray-100 my-2" />
          <a href="https://youtube.com/@Gen-ZIITian/" target="_blank" rel="noopener noreferrer" className="py-2 text-red-500 flex items-center gap-2 font-bold text-base">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
            YouTube
          </a>
        </div>
      )}
    </nav>
  );
}
