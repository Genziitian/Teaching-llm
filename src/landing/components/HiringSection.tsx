'use client';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from '@/landing/shims/router';
import { ChevronDown, ChevronUp, Briefcase, Star, Users, BrainCircuit, Rocket, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/landing/context/AuthContext';

export default function HiringSection() {
  const { user, openLoginModal } = useAuth();
  const [openJob, setOpenJob] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      try {
        const pending = localStorage.getItem('gzi_pending_apply_role');
        if (pending === 'tutor' || pending === 'campus-leader') {
          localStorage.removeItem('gzi_pending_apply_role');
          setOpenJob(pending);
          navigate(`/careers/apply/${pending}`);
        }
      } catch (e) {}
    }
  }, [user]);

  const handleApply = (role: 'tutor' | 'campus-leader') => {
    if (!user) {
      try {
        localStorage.setItem('gzi_pending_apply_role', role);
      } catch (e) {}
      openLoginModal();
      return;
    }
    navigate(`/careers/apply/${role}`);
  };

  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  const testimonials = [
    {
      id: 1,
      name: "Vaibhav",
      role: "Maths 1 Tutor",
      content: "Working here helped me master my own college subjects! Teaching others the same syllabus I studied gave me a unique edge in my career interviews."
    },
    {
      id: 2,
      name: "Ayush",
      role: "Computational Thinking Tutor",
      content: "The flexible hours allowed me to balance my own studies while earning a good stipend. The students are eager to learn, making the process very rewarding."
    },
    {
      id: 3,
      name: "Ankit K.",
      role: "Machine Learning Tutor",
      content: "It's an amazing platform for peer-to-peer learning. Preparing course material strengthened my ML foundations more than any regular coursework could."
    }
  ];

  const nextTestimonial = () => {
    setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };


  return (
    <section id="careers" className="py-14 sm:py-24 bg-gray-50 border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Job Openings */}
        <div className="max-w-4xl mx-auto mb-16 sm:mb-24">
          <h3 className="text-2xl sm:text-3xl font-black text-[#0b1120] mb-6 sm:mb-8 flex items-center gap-3">
            <BrainCircuit className="text-blue-600 w-7 h-7 sm:w-8 sm:h-8 shrink-0" /> Current Openings
          </h3>

          <div className="space-y-4 sm:space-y-6">
            {/* Accordion Item: Subject Tutor */}
            <div className="bg-white rounded-2xl border-2 border-[#0b1120] shadow-[4px_4px_0px_#0b1120] sm:shadow-[8px_8px_0px_#0b1120] overflow-hidden transition-all">
              <button 
                onClick={() => {
                  const isOpening = openJob !== 'tutor';
                  setOpenJob(isOpening ? 'tutor' : null);
                }}
                className="w-full px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors text-left gap-3"
              >
                <div>
                  <h4 className="text-lg sm:text-xl md:text-2xl font-black text-[#0b1120] mb-2">Subject Tutor (Faculty)</h4>
                  <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm font-bold">
                    <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-lg">Part-time / Paid</span>
                    <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg">Remote</span>
                  </div>
                </div>
                {openJob === 'tutor' ? <ChevronUp className="w-6 h-6 sm:w-8 sm:h-8 shrink-0 text-slate-700" /> : <ChevronDown className="w-6 h-6 sm:w-8 sm:h-8 shrink-0 text-slate-700" />}
              </button>

              {openJob === 'tutor' && (
                <div className="px-4 sm:px-8 py-5 sm:py-6 border-t-2 border-gray-100 bg-gray-50/50">
                  <div className="mb-6 sm:mb-10 text-gray-700 prose prose-blue max-w-none text-left">
                    <p className="font-medium text-base sm:text-lg mb-6 text-[#0b1120]">
                      Are you passionate about educating peers and simplifying tough subjects? We are looking for dedicated Subject Tutors to guide students towards academic excellence. Share your knowledge, earn while you learn, and build a stellar profile!
                    </p>
                    
                    <h5 className="font-bold text-[#0b1120] text-base sm:text-lg mt-6 mb-3">Roles & Responsibilities:</h5>
                    <ul className="list-disc pl-5 space-y-2 font-medium text-sm sm:text-base">
                      <li>Deliver high-quality lessons in <strong>Hindi, English, or comfortably blended (Both)</strong>.</li>
                      <li>Teach foundational or diploma-level subjects aligned with the curriculum.</li>
                      <li>Solve student doubts and create engaging academic content.</li>
                    </ul>

                    <h5 className="font-bold text-[#0b1120] text-base sm:text-lg mt-6 mb-3">What We Need From You:</h5>
                    <ul className="list-disc pl-5 space-y-2 font-medium text-sm sm:text-base">
                      <li><strong>Tech-Ready:</strong> A digital pen tablet/graphic pad, a laptop, good microphone, and stable internet are mandatory.</li>
                      <li><strong>Academic Excellence:</strong> CGPA of 7.5+ in the subject you wish to teach is highly preferred.</li>
                      <li><strong>Background:</strong> Being an IIT Madras BS student is a bonus (but completely optional).</li>
                      <li>Unwavering passion for teaching!</li>
                    </ul>

                    <h5 className="font-bold text-[#0b1120] text-base sm:text-lg mt-6 mb-3">Perks & Compensation:</h5>
                    <ul className="space-y-2 font-medium text-sm sm:text-base">
                      <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" /> <span><strong>Stipend:</strong> ₹5,000 to ₹10,000 per month (based on interview & merit).</span></li>
                      <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" /> <span><strong>Experience:</strong> Add a highly valued teaching internship to your CV.</span></li>
                      <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" /> <span><strong>Visibility:</strong> Open doors to immense future career prospects!</span></li>
                    </ul>
                    
                    <div className="mt-8 p-4 bg-blue-50 rounded-xl border border-blue-100 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
                      <img src="https://upload.wikimedia.org/wikipedia/commons/0/09/YouTube_full-color_icon_%282017%29.svg" alt="YouTube" className="w-[36px] h-[26px] sm:w-[40px] sm:h-[30px] object-contain shrink-0" />
                      <p className="font-bold text-[#0b1120] text-xs sm:text-sm m-0">
                        Check out our teaching style: <br/>
                        <a href="https://www.youtube.com/@Gen-ZIITian/videos" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">youtube.com/@Gen-ZIITian/videos</a>
                      </p>
                    </div>

                    <div className="mt-8 flex justify-center">
                      <button 
                        onClick={() => handleApply('tutor')}
                        className="w-full sm:w-auto px-8 py-3.5 sm:py-4 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition-colors border-2 border-transparent shadow-[4px_4px_0px_#0b1120] text-base sm:text-lg cursor-pointer active:scale-95 text-center"
                      >
                        Apply for this role
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Accordion Item: Campus Leaders */}
            <div className="bg-white rounded-2xl border-2 border-[#0b1120] shadow-[4px_4px_0px_#0b1120] sm:shadow-[8px_8px_0px_#0b1120] overflow-hidden transition-all">
              <button 
                onClick={() => {
                  const isOpening = openJob !== 'campus-leader';
                  setOpenJob(isOpening ? 'campus-leader' : null);
                }}
                className="w-full px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between bg-white hover:bg-gray-50 transition-colors text-left gap-3"
              >
                <div>
                  <h4 className="text-lg sm:text-xl md:text-2xl font-black text-[#0b1120] mb-2">Campus Leaders</h4>
                  <div className="flex flex-wrap gap-2 sm:gap-3 text-xs sm:text-sm font-bold">
                    <span className="bg-green-100 text-green-700 px-2.5 py-1 rounded-lg font-bold">Part-time / Performance-based</span>
                    <span className="bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg font-bold">Remote</span>
                  </div>
                </div>
                {openJob === 'campus-leader' ? <ChevronUp className="w-6 h-6 sm:w-8 sm:h-8 shrink-0 text-slate-700" /> : <ChevronDown className="w-6 h-6 sm:w-8 sm:h-8 shrink-0 text-slate-700" />}
              </button>

              {openJob === 'campus-leader' && (
                <div className="px-4 sm:px-8 py-5 sm:py-6 border-t-2 border-gray-100 bg-gray-50/50">
                  <div className="mb-6 sm:mb-10 text-gray-700 prose prose-blue max-w-none text-left">
                    <h4 className="text-xl md:text-2xl font-black text-[#0b1120] mb-4">We're Looking for Campus Leaders | GenZ IITian</h4>
                    <p className="font-semibold text-base sm:text-lg mb-6 text-[#0b1120]">
                      Do you own or manage an <strong>IIT Madras BS Degree</strong> WhatsApp, Telegram, Discord, or any other student community?
                    </p>
                    <p className="font-medium text-base sm:text-lg mb-6 text-[#0b1120]">
                      If yes, we'd love to work with you.
                    </p>

                    <p className="font-medium text-sm sm:text-base text-gray-700 mb-4">
                      At <strong>GenZ IITian</strong>, we're building a unified ecosystem for IIT Madras BS students through high-quality resources, mentorship, and community-driven initiatives. Over the past few months, we've launched:
                    </p>
                    <ul className="list-disc pl-5 space-y-2 font-medium text-sm sm:text-base mb-6">
                      <li><strong>exam.genziitian.in</strong> – Previous Year Questions, video solutions, PDFs, and exam resources.</li>
                      <li><strong>genziitian.in/resources</strong> – Completely free study materials.</li>
                      <li><strong>Free YouTube Marathon Classes</strong> before exams.</li>
                      <li><strong>genziitian.live</strong> – A dedicated social platform for IIT Madras BS students with better privacy and organized discussions than traditional WhatsApp groups.</li>
                    </ul>

                    <p className="font-medium text-sm sm:text-base text-gray-700 mb-6">
                      Instead of communities working in isolation, we believe they can grow together while continuing to serve students independently.
                    </p>

                    <h5 className="font-bold text-[#0b1120] text-base sm:text-lg mt-6 mb-3">Who Can Apply?</h5>
                    <ul className="list-disc pl-5 space-y-2 font-medium text-sm sm:text-base mb-6">
                      <li>You must be the <strong>owner or primary administrator</strong> of an IIT Madras BS student community.</li>
                      <li>Your community should actively serve IIT Madras BS Degree students.</li>
                      <li>You should be interested in building a long-term partnership with GenZ IITian.</li>
                    </ul>

                    <h5 className="font-bold text-[#0b1120] text-base sm:text-lg mt-6 mb-3">What You'll Get:</h5>
                    <ul className="space-y-3 font-medium text-sm sm:text-base mb-6">
                      <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" /> <span>Official <strong>GenZ IITian Campus Leader</strong> recognition.</span></li>
                      <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" /> <span>Your own referral code with earning opportunities.</span></li>
                      <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" /> <span>Students using your code receive <strong>5% OFF</strong> on courses.</span></li>
                      <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" /> <span>You earn rewards on every successful referral.</span></li>
                      <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" /> <span>Free onboarding course worth approximately <strong>₹500</strong>.</span></li>
                      <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" /> <span>Opportunity to earn <strong>performance-based stipends up to ₹5,000 per month</strong>.</span></li>
                      <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" /> <span>Priority consideration for future <strong>paid internships, part-time roles, and leadership opportunities</strong> within GenZ IITian.</span></li>
                      <li className="flex gap-2"><CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" /> <span>Direct access to our core team and upcoming projects.</span></li>
                    </ul>

                    <p className="font-medium text-sm sm:text-base text-gray-700 mb-6">
                      If you're passionate about helping the IIT Madras BS community and want to grow with us, we'd love to hear from you.
                    </p>

                    <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                      <button 
                        onClick={() => handleApply('campus-leader')}
                        className="w-full sm:w-auto px-8 py-3.5 sm:py-4 bg-blue-600 text-white font-black rounded-xl hover:bg-blue-700 transition-colors border-2 border-transparent shadow-[4px_4px_0px_#0b1120] text-base sm:text-lg text-center cursor-pointer active:scale-95"
                      >
                        Apply for this role
                      </button>
                      <a 
                        href="https://forms.gle/bQL5p6Bb9zX3pk2n8" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-slate-500 hover:text-blue-600 underline py-2"
                      >
                        Or open Google Form
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2. Why Work With Us */}
        <div className="max-w-5xl mx-auto mb-16 sm:mb-24">
          <h3 className="text-2xl sm:text-3xl font-black text-[#0b1120] mb-6 sm:mb-8 flex items-center gap-3">
            <Star className="text-yellow-500 w-7 h-7 sm:w-8 sm:h-8 shrink-0" /> Why Work With Us?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
            <div className="bg-white p-5 sm:p-8 rounded-2xl border-2 border-gray-200 hover:border-blue-500 transition-colors shadow-xs">
              <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mb-5 sm:mb-6">
                <Rocket className="w-6 h-6" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-[#0b1120] mb-2 sm:mb-3">Vibrant Work Culture</h3>
              <p className="text-gray-600 font-medium text-sm sm:text-base leading-relaxed">
                Experience a vibrant work culture where your ideas matter. We offer flexible working hours, creative freedom in teaching, and a peer-driven environment that pushes you to excel.
              </p>
            </div>
            <div className="bg-white p-5 sm:p-8 rounded-2xl border-2 border-gray-200 hover:border-blue-500 transition-colors shadow-xs">
              <div className="w-12 h-12 bg-green-100 text-green-600 rounded-xl flex items-center justify-center mb-5 sm:mb-6">
                <Briefcase className="w-6 h-6" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-[#0b1120] mb-2 sm:mb-3">The Power of Internships</h3>
              <p className="text-gray-600 font-medium text-sm sm:text-base leading-relaxed">
                Internships bridge the gap between theory and practice. Teaching solidifies your own foundational knowledge while building a strong professional network and adding massive weight to your resume.
              </p>
            </div>
          </div>
        </div>

        {/* 3. Feedback Slider */}
        <div className="max-w-4xl mx-auto">
          <h3 className="text-2xl sm:text-3xl font-black text-[#0b1120] mb-6 sm:mb-8 flex items-center gap-3">
            <Users className="text-purple-600 w-7 h-7 sm:w-8 sm:h-8 shrink-0" /> What Our Tutors Say
          </h3>
          <div className="relative bg-white rounded-2xl border-2 border-[#0b1120] shadow-[4px_4px_0px_#0b1120] sm:shadow-[8px_8px_0px_#0b1120] p-5 sm:p-8 md:p-12">
            <div className="overflow-hidden">
               <p className="text-base sm:text-lg md:text-xl text-gray-700 font-medium italic mb-6">"{testimonials[currentTestimonial].content}"</p>
               <div>
                 <p className="font-black text-[#0b1120] text-base">{testimonials[currentTestimonial].name}</p>
                 <p className="text-xs sm:text-sm font-bold text-gray-500">{testimonials[currentTestimonial].role}</p>
               </div>
            </div>
            
            <div className="flex gap-3 sm:gap-4 mt-6 sm:mt-8 justify-end">
               <button onClick={prevTestimonial} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-[#0b1120] hover:bg-gray-50 transition-colors">
                 <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 text-[#0b1120]" />
               </button>
               <button onClick={nextTestimonial} className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-[#0b1120] bg-[#0b1120] text-white flex items-center justify-center hover:bg-gray-800 transition-colors shadow-[2px_2px_0px_#0b1120] sm:shadow-[4px_4px_0px_#0b1120]">
                 <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
               </button>
            </div>
          </div>
        </div>

        {/* 4. Recruiter Portal Section */}
        <div className="max-w-4xl mx-auto mt-14 sm:mt-20">
          <div className="bg-white rounded-2xl border-2 border-gray-200 p-8 md:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden text-left">
            {/* Grid Pattern Background */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#0b1120 1.5px, transparent 1.5px)', backgroundSize: '24px 24px' }}></div>
            
            <div className="flex-grow z-10 pr-0 md:pr-4">
              <h3 className="text-3xl font-black text-[#0b1120] mb-4">Recruiter Portal</h3>
              <p className="text-gray-600 font-bold leading-relaxed mb-6 max-w-lg">
                Instantly validate candidate career histories, contract durations, and department roles. Query our secure ledger for authenticated digital records.
              </p>
              <Link 
                to="/verify" 
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#0b1120] text-white font-black rounded-xl hover:bg-gray-800 transition-all shadow-[4px_4px_0px_#10b981] hover:translate-y-[-2px] active:translate-y-[0px]"
              >
                Get Details <ChevronRight className="w-5 h-5" />
              </Link>
            </div>
            
            <div className="w-full md:w-auto flex justify-center z-10 flex-shrink-0">
              <div className="relative w-56 h-40 bg-white border-2 border-gray-200 rounded-2xl p-5 shadow-lg flex flex-col justify-between hover:scale-[1.02] transition-transform">
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="w-12 h-3 bg-gray-200 rounded"></div>
                    <div className="w-24 h-2.5 bg-gray-100 rounded"></div>
                    <div className="w-16 h-2 bg-gray-100 rounded"></div>
                  </div>
                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100 text-gray-400">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                
                {/* Horizontal lines to mimic layout */}
                <div className="space-y-1.5">
                  <div className="w-full h-1 bg-gray-200 rounded-full"></div>
                  <div className="w-5/6 h-1 bg-gray-200 rounded-full"></div>
                  <div className="w-4/6 h-1 bg-gray-200 rounded-full"></div>
                </div>
                
                {/* Check Badge Icon */}
                <div className="absolute -bottom-4 -left-4 w-12 h-12 bg-emerald-500 rounded-full border-4 border-white flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}