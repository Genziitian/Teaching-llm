'use client';

import { Link, useNavigate } from '@/landing/shims/router';
import { useEffect, useState } from 'react';
import {
  BookOpen, FolderOpen, ListChecks, ClipboardList, Newspaper, Compass,
  Gift, LayoutDashboard, ShieldCheck,
  Mail, Info, Phone, Briefcase, Shield, FileText, RotateCcw,
  Instagram, Youtube, Linkedin, MessageCircle, LogIn, LogOut,
  ChevronRight, ArrowUpRight, User as UserIcon, UserCheck,
  BookMarked,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useAuth } from '@/landing/context/AuthContext';
import { supabase } from '@/landing/lib/supabase';

type RowProps = {
  Icon: typeof Mail;
  tint: string;
  glyph: string;
  label: string;
  to?: string;
  href?: string;
  onClick?: () => void;
  external?: boolean;
  danger?: boolean;
};

function MenuRow({ Icon, tint, glyph, label, to, href, onClick, external, danger }: RowProps) {
  const inner = (
    <>
      <span
        className="w-[38px] h-[38px] rounded-[10px] border-2 border-[#0b1120] flex items-center justify-center shrink-0"
        style={{ background: tint, color: glyph }}
      >
        <Icon className="w-[19px] h-[19px]" strokeWidth={2.1} />
      </span>
      <span className={`flex-1 font-bold text-[14.5px] ${danger ? 'text-red-500' : 'text-[#0b1120]'}`}>{label}</span>
      {external
        ? <ArrowUpRight className="w-[15px] h-[15px] text-gray-400" strokeWidth={2.4} />
        : <ChevronRight className="w-[15px] h-[15px] text-gray-400" strokeWidth={2.4} />}
    </>
  );

  const cls = 'w-full flex items-center gap-3 bg-white border-2 border-[#0b1120] rounded-[14px] shadow-[2.5px_2.5px_0px_#0b1120] px-3 py-[11px] text-left active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0px_#0b1120] transition-all';

  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{inner}</a>;
  if (to) return <Link to={to} className={cls}>{inner}</Link>;
  return <button onClick={onClick} className={cls}>{inner}</button>;
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-[22px]">
      <div className="text-[11px] font-black tracking-[0.1em] text-gray-400 mb-[11px]">{label}</div>
      <div className="flex flex-col gap-[11px]">{children}</div>
    </div>
  );
}

/** Mobile Menu / profile hub. Reachable from the bottom-nav "Menu" tab. */
export default function Menu() {
  const { user, profile, isManager, openLoginModal, signOut } = useAuth();
  const navigate = useNavigate();
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

  const displayName = profile?.name || user?.email?.split('@')[0] || 'Guest';

  return (
    <div className="bg-[#F1F3F7] min-h-screen">
      <div className="max-w-md mx-auto px-4 pt-5 pb-4">
        {/* Profile header */}
        <button
          onClick={() => (user ? navigate('/explore/profile') : openLoginModal())}
          className="w-full flex items-center gap-3.5 rounded-[18px] border-[2.5px] border-[#0b1120] shadow-[4px_4px_0px_#0b1120] px-4 py-4 text-left"
          style={{ background: 'linear-gradient(105deg, #2563EB, #1D4ED8)' }}
        >
          <span className="w-14 h-14 rounded-full bg-white border-[2.5px] border-[#0b1120] flex items-center justify-center text-blue-700 shrink-0 font-black text-xl uppercase">
            {user ? (displayName.charAt(0) || <UserIcon className="w-7 h-7" />) : <UserIcon className="w-7 h-7" />}
          </span>
          <span className="flex-1 text-white">
            <span className="block font-black text-[19px] leading-tight">{displayName}</span>
            <span className="block text-[12.5px] font-semibold text-white/85 mt-0.5">
              {user ? 'Student · View Profile' : 'Guest · Sign in to continue'}
            </span>
          </span>
          <ChevronRight className="w-[18px] h-[18px] text-white" />
        </button>

        <Group label="EXPLORE">
          <MenuRow Icon={BookOpen} tint="#E7EEFF" glyph="#2563EB" label="Courses" to="/explore/courses" />
          <MenuRow Icon={UserCheck} tint="#D1FAE5" glyph="#059669" label="1:1 Personalised Teaching" to="/one-to-one" />
          <MenuRow Icon={FolderOpen} tint="#E4F7EE" glyph="#0E9E6A" label="Resources (PYQs & Notes)" to="/resources" />
          <MenuRow Icon={BookMarked} tint="#EDE9FE" glyph="#7C3AED" label="Booklet" to="/resources?tab=booklet" />
          <MenuRow Icon={ListChecks} tint="#FEF1DF" glyph="#FF7A00" label="Syllabus" to="/syllabus" />
          <MenuRow Icon={ClipboardList} tint="#FBE3EE" glyph="#EC1E79" label="Graded Assignment" to="/graded-assignment" />
          <MenuRow Icon={Newspaper} tint="#E7EEFF" glyph="#2563EB" label="Blog" to="/blog" />
          <MenuRow Icon={FileText} tint="#E4F7EE" glyph="#0E9E6A" label="Docs" to="/docs" />
          <MenuRow Icon={Compass} tint="#FEF1DF" glyph="#FF7A00" label="Knowledge Hub" to="/knowledge" />
        </Group>

        <Group label="ACCOUNT">
          {user && <MenuRow Icon={UserIcon} tint="#E7EEFF" glyph="#2563EB" label="My Profile" to="/explore/profile" />}
          {user && isEmployee && <MenuRow Icon={UserCheck} tint="#D1FAE5" glyph="#059669" label="Your ID" to="/employee/id" />}
          <MenuRow Icon={Gift} tint="#FEF1DF" glyph="#FF7A00" label="Refer & Earn" to="/refer" />
          {user && <MenuRow Icon={LayoutDashboard} tint="#E4F7EE" glyph="#0E9E6A" label="Class Dashboard" href="https://class.genziitian.in" external />}
          {isManager && <MenuRow Icon={ShieldCheck} tint="#FCE4E4" glyph="#FF2424" label="Manager Panel" to="/manager" />}
        </Group>

        <Group label="SOCIAL">
          <MenuRow Icon={Youtube} tint="#FCE4E4" glyph="#FF2424" label="YouTube" href="https://youtube.com/@Gen-ZIITian/" external />
          <MenuRow Icon={MessageCircle} tint="#E4F7EE" glyph="#0E9E6A" label="WhatsApp Community" href="https://chat.whatsapp.com/Gi4D9yAd99p7q1XeVh0J1e" external />
          <MenuRow Icon={Instagram} tint="#FBE3EE" glyph="#EC1E79" label="Instagram" href="https://www.instagram.com/genz_iitian/" external />
          <MenuRow Icon={Linkedin} tint="#E7EEFF" glyph="#2563EB" label="LinkedIn" href="https://www.linkedin.com/company/102554405/" external />
        </Group>

        <Group label="INFORMATION">
          <MenuRow Icon={Info} tint="#E4F7EE" glyph="#0E9E6A" label="About Us" to="/about" />
          <MenuRow Icon={Phone} tint="#FBE3EE" glyph="#EC1E79" label="Contact Us" to="/contact" />
          <MenuRow Icon={Briefcase} tint="#E7EEFF" glyph="#2563EB" label="Careers" to="/careers" />
          <MenuRow Icon={Mail} tint="#FEF1DF" glyph="#FF7A00" label="Newsletter" to="/newsletter" />
        </Group>

        <Group label="LEGAL">
          <MenuRow Icon={Shield} tint="#E7EEFF" glyph="#2563EB" label="Privacy Policy" to="/privacy" />
          <MenuRow Icon={FileText} tint="#F1F3F7" glyph="#0b1120" label="Terms & Conditions" to="/terms" />
          <MenuRow Icon={RotateCcw} tint="#FEF1DF" glyph="#FF7A00" label="Refund Policy" to="/refund" />
        </Group>

        <Group label="SESSION">
          {user
            ? <MenuRow Icon={LogOut} tint="#FCE4E4" glyph="#FF2424" label="Sign Out" onClick={signOut} danger />
            : <MenuRow Icon={LogIn} tint="#E7EEFF" glyph="#2563EB" label="Sign In" onClick={openLoginModal} />}
        </Group>
      </div>
    </div>
  );
}
