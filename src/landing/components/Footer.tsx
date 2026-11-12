'use client';
import { useState } from 'react';
import { Link } from '@/landing/shims/router';
import { GraduationCap, Youtube, MessageCircle, Instagram, Linkedin, LayoutDashboard, BookOpenCheck, Mail } from 'lucide-react';

export default function Footer() {
  const [isNewsletterPopupOpen, setIsNewsletterPopupOpen] = useState(false);

  return (
    <>
      <footer className="bg-[#0b1120] text-white pt-24 pb-12 border-t-[3px] border-[#0b1120]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">

            {/* Column 1: Brand */}
            <div className="flex flex-col gap-6">
              <h3 className="text-3xl font-black text-white leading-tight">
                Take the First Step<br />Towards Mastery!
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                <Link to="/explore/courses" className="w-fit px-6 py-3 bg-[#10b981] text-white rounded-xl font-bold text-lg border-2 border-[#0b1120] flex items-center gap-2 hover:bg-[#059669] transition-colors">
                <GraduationCap className="w-5 h-5" /> Enroll on Courses
              </Link>
                <Link to="/contact" className="w-fit px-6 py-3 bg-transparent text-white rounded-xl font-bold text-lg border-2 border-gray-600 flex items-center gap-2 hover:bg-white hover:text-[#0b1120] hover:border-white transition-colors">
    <Mail className="w-5 h-5" /> Contact Us
  </Link>
              </div>
              <div className="mt-4">
                <div className="flex items-center gap-1 mb-4">
                  <span className="font-black text-2xl tracking-tight text-white">GEN-Z</span>
                  <span className="font-black text-2xl tracking-tight text-red-500">IITian</span>
                </div>
                <p className="text-gray-400 font-medium mb-6">
                  The ultimate ecosystem for IIT Madras Online Degree students. Mastery made simple.
                </p>
                <a href="https://youtube.com/@Gen-ZIITian/" target="_blank" rel="noopener noreferrer" className="px-6 py-3 bg-white text-[#0b1120] rounded-xl font-bold border-2 border-[#0b1120] flex items-center gap-2 hover:bg-gray-100 transition-colors w-fit">
                  <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                  </div>
                  Watch on YouTube
                </a>
              </div>
            </div>

            {/* Column 2: Links */}
            <div>
              <h4 className="text-xl font-black text-white mb-6">Additional Links</h4>
              <ul className="space-y-4">
                <li><Link to="/explore/courses" className="text-gray-400 font-bold hover:text-[#10b981] transition-colors">Courses</Link></li>
                <li><Link to="/resources" className="text-gray-400 font-bold hover:text-[#10b981] transition-colors">Resources</Link></li>
                <li><Link to="/tools/cgpa-calculator" className="text-gray-400 font-bold hover:text-[#10b981] transition-colors">CGPA Calculator</Link></li>
                <li><Link to="/tools/grade-predictor" className="text-gray-400 font-bold hover:text-[#10b981] transition-colors">Grade Predictor</Link></li>
                <li><Link to="/blog" className="text-gray-400 font-bold hover:text-[#10b981] transition-colors">Blog</Link></li>
                <li><Link to="/contact" className="text-gray-400 font-bold hover:text-[#10b981] transition-colors">Contact</Link></li>
                <li><Link to="/about" className="text-gray-400 font-bold hover:text-[#10b981] transition-colors">About Us</Link></li>
                <li><Link to="/newsletter" className="text-gray-400 font-bold hover:text-[#10b981] transition-colors">Newsletter</Link></li>
                <li><Link to="/verify" className="text-gray-400 font-bold hover:text-[#10b981] transition-colors">Verify Credentials</Link></li>
              </ul>
            </div>

            {/* Column 3: Community */}
            <div>
              <h4 className="text-xl font-black text-white mb-6">Join Community</h4>
              <ul className="space-y-4">
                <li>
                  <a href="https://youtube.com/@Gen-ZIITian/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-gray-400 font-bold hover:text-red-400 transition-colors">
                    <Youtube className="w-5 h-5 text-red-500" /> YouTube Channel
                  </a>
                </li>
                <li>
                  <a href="https://chat.whatsapp.com/Gi4D9yAd99p7q1XeVh0J1e" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-gray-400 font-bold hover:text-green-400 transition-colors">
                    <MessageCircle className="w-5 h-5 text-green-500" /> WhatsApp Community
                  </a>
                </li>
                <li>
                  <a href="https://www.instagram.com/genz_iitian/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-gray-400 font-bold hover:text-pink-400 transition-colors">
                    <Instagram className="w-5 h-5 text-pink-500" /> Instagram
                  </a>
                </li>
                <li>
                  <a href="https://www.linkedin.com/company/102554405/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-gray-400 font-bold hover:text-blue-400 transition-colors">
                    <Linkedin className="w-5 h-5 text-blue-500" /> LinkedIn
                  </a>
                </li>
              </ul>

              <h4 className="text-xl font-black text-white mt-10 mb-6">Our Platforms</h4>
              <ul className="space-y-4">
                <li>
                  <a href="https://class.genziitian.in/dashboard" target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-gray-400 font-bold hover:text-[#10b981] transition-colors">
                    <LayoutDashboard className="w-5 h-5 text-[#10b981] shrink-0 mt-0.5" />
                    <span>Student Dashboard<span className="block text-xs font-medium text-gray-500">All your courses in one place</span></span>
                  </a>
                </li>
                <li>
                  <a href="https://quiz.genziitian.in" target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 text-gray-400 font-bold hover:text-amber-400 transition-colors">
                    <BookOpenCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <span>Revise Quiz as Exam<span className="block text-xs font-medium text-gray-500">Practice in exam mode</span></span>
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 4: Newsletter */}
            <div>
              <h4 className="text-xl font-black text-white mb-6">Newsletter</h4>
              <p className="text-gray-400 font-medium mb-6">
                Stay updated with the latest exam blue-prints and resources.
              </p>
              <form
                className="flex flex-col gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target as HTMLFormElement;
                  const formData = new FormData(form);
                  const params = new URLSearchParams(window.location.search);

                  const payload = new URLSearchParams();
                  payload.append('form_type', 'Newsletter (Footer)');
                  payload.append('email', formData.get('entry.0987654321') as string);
                  payload.append('utm_source', params.get('utm_source') || 'direct');
                  payload.append('utm_medium', params.get('utm_medium') || 'organic');
                  payload.append('utm_campaign', params.get('utm_campaign') || 'none');

                  try {
                    await fetch('https://script.google.com/macros/s/AKfycbysGFbxo9r41D5kMnKmO90rr9u_mzn5aBuhZG6AFvRZOhDtFJ9dclTHgJJqdcBNS-Ny/exec', {
                      method: 'POST',
                      mode: 'no-cors',
                      body: payload
                    });
                  } catch { /* no-cors */ }
                  setIsNewsletterPopupOpen(true);
                  form.reset();
                }}
              >
                <input
                  name="entry.0987654321"
                  type="email"
                  placeholder="Your Email"
                  className="w-full px-4 py-3 rounded-xl bg-gray-800 border-2 border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-[#10b981]"
                  required
                />
                <button
                  type="submit"
                  className="w-full px-4 py-3 bg-[#10b981] text-white rounded-xl font-bold border-2 border-[#0b1120] hover:bg-[#059669] transition-colors"
                >
                  Subscribe
                </button>
              </form>
            </div>

          </div>

          <div className="pt-8 border-t border-gray-800 flex flex-col items-center justify-center gap-8">
            <div className="flex flex-col md:flex-row items-center justify-between w-full text-sm text-gray-500 font-bold">
              <div className="flex items-center gap-4 mb-4 md:mb-0">
                <Link to="/terms" className="hover:text-white transition-colors">Terms & Conditions</Link>
                <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
                <Link to="/refund" className="hover:text-white transition-colors">Refund & Cancellation</Link>
              </div>
              <div className="flex items-center gap-4 mb-4 md:mb-0">
                {/* YouTube */}
                <a href="https://youtube.com/@Gen-ZIITian/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center hover:bg-red-600 hover:border-red-600 hover:text-white transition-all" title="YouTube">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33 2.78 2.78 0 0 0 1.94 2c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.33 29 29 0 0 0-.46-5.33z"></path><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"></polygon></svg>
                </a>
                {/* Instagram */}
                <a href="https://www.instagram.com/genz_iitian/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center hover:bg-gradient-to-br hover:from-purple-600 hover:to-pink-500 hover:border-pink-500 hover:text-white transition-all" title="Instagram">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                </a>
                {/* WhatsApp */}
                <a href="https://chat.whatsapp.com/Gi4D9yAd99p7q1XeVh0J1e" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center hover:bg-green-600 hover:border-green-600 hover:text-white transition-all" title="WhatsApp">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" /></svg>
                </a>
                {/* LinkedIn */}
                <a href="https://www.linkedin.com/company/102554405/" target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full border border-gray-700 flex items-center justify-center hover:bg-blue-700 hover:border-blue-700 hover:text-white transition-all" title="LinkedIn">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
                </a>
              </div>
              <p>
                © 2026 GEN-Z IITIAN. All rights reserved.
              </p>
            </div>

            {/* Watermark */}
            <div className="w-full overflow-hidden flex justify-center mt-8 opacity-20 select-none pointer-events-none">
              <h1 className="text-[12vw] font-black tracking-tighter leading-none bg-clip-text text-transparent bg-gradient-to-b from-gray-500 to-[#0b1120]">
                GEN-Z IITIAN
              </h1>
            </div>
          </div>
        </div>
      </footer>

      {/* Newsletter Popup */}
      {isNewsletterPopupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white border-[3px] border-[#0b1120] rounded-3xl p-8 max-w-md w-full shadow-[12px_12px_0px_#0b1120] relative">
            <button
              onClick={() => setIsNewsletterPopupOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 border-2 border-[#0b1120] transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
            <div className="text-5xl mb-6 text-center">🎉</div>
            <h3 className="text-2xl font-black text-[#0b1120] mb-4 text-center">Thanks for Subscribing!</h3>
            <p className="text-gray-600 font-bold text-center mb-8">
              We've received your enquiry. We'll keep you updated with the latest exam blueprints and resources.
            </p>
            <button
              onClick={() => setIsNewsletterPopupOpen(false)}
              className="w-full py-4 bg-[#10b981] text-white rounded-xl font-bold text-lg border-2 border-[#0b1120] hover:bg-[#059669] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
