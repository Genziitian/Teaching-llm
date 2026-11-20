'use client';

import { useState } from 'react';

export default function Newsletter() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="min-h-[calc(100vh-80px)] bg-white text-[#0b1120] font-sans selection:bg-blue-100 flex items-center py-10 lg:py-0">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
          {/* Left Side: Features */}
          <div>
            <h1 className="text-4xl lg:text-5xl font-black text-[#0b1120] mb-3">Newsletter</h1>
            <p className="text-gray-600 font-medium mb-8 text-lg">
              Stay updated with the latest exam blueprints, study resources, and tips from IIT Madras toppers.
            </p>

            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#eef2ff] border-[3px] border-[#0b1120] flex items-center justify-center text-xl flex-shrink-0 shadow-[3px_3px_0px_#0b1120]">📋</div>
                <div>
                  <h4 className="font-bold text-[#0b1120]">Exam Blueprints</h4>
                  <p className="text-gray-500 font-medium text-sm">Detailed blueprints and question patterns before every exam.</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#eef2ff] border-[3px] border-[#0b1120] flex items-center justify-center text-xl flex-shrink-0 shadow-[3px_3px_0px_#0b1120]">📚</div>
                <div>
                  <h4 className="font-bold text-[#0b1120]">Study Resources</h4>
                  <p className="text-gray-500 font-medium text-sm">Curated notes, video links, and practice sets delivered weekly.</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#eef2ff] border-[3px] border-[#0b1120] flex items-center justify-center text-xl flex-shrink-0 shadow-[3px_3px_0px_#0b1120]">🏆</div>
                <div>
                  <h4 className="font-bold text-[#0b1120]">Topper Tips</h4>
                  <p className="text-gray-500 font-medium text-sm">Learn strategies from students who aced their exams.</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#eef2ff] border-[3px] border-[#0b1120] flex items-center justify-center text-xl flex-shrink-0 shadow-[3px_3px_0px_#0b1120]">🔔</div>
                <div>
                  <h4 className="font-bold text-[#0b1120]">Instant Updates</h4>
                  <p className="text-gray-500 font-medium text-sm">Be the first to know about new courses, events, and announcements.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Form */}
          <div className="bg-[#eef2ff] border-[3px] border-[#0b1120] rounded-2xl p-6 lg:p-8 shadow-[8px_8px_0px_#0b1120]">
            {submitted ? (
              <div className="text-center py-8">
                <div className="text-5xl mb-4">🎉</div>
                <h3 className="text-2xl font-black text-[#0b1120] mb-2">Thanks for Subscribing!</h3>
                <p className="text-gray-600 font-bold mb-4">
                  We'll keep you updated with the latest exam blueprints and resources.
                </p>
                <button
                  onClick={() => setSubmitted(false)}
                  className="px-6 py-3 bg-[#10b981] text-white rounded-xl font-bold border-2 border-[#0b1120] hover:bg-[#059669] transition-colors"
                >
                  Subscribe Another
                </button>
              </div>
            ) : (
              <form
                className="flex flex-col gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setSubmitting(true);
                  const form = e.target as HTMLFormElement;
                  const formData = new FormData(form);
                  const params = new URLSearchParams(window.location.search);

                  const payload = new URLSearchParams();
                  payload.append('form_type', 'Newsletter (Page)');
                  payload.append('name', formData.get('name') as string);
                  payload.append('email', formData.get('email') as string);
                  payload.append('whatsapp', formData.get('whatsapp') as string);
                  payload.append('level', formData.get('level') as string);
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

                  setSubmitting(false);
                  setSubmitted(true);
                  form.reset();
                }}
              >
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-[#0b1120] text-sm">Level</label>
                  <select
                    name="level"
                    className="w-full px-4 py-3 rounded-xl bg-white border-[3px] border-[#0b1120] text-[#0b1120] focus:outline-none focus:border-[#10b981] transition-colors font-medium"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>Select your level</option>
                    <option value="Diploma">Diploma</option>
                    <option value="Foundation">Foundation</option>
                    <option value="Qualifier">Qualifier</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-[#0b1120] text-sm">Full Name</label>
                  <input
                    name="name"
                    type="text"
                    placeholder="John Doe"
                    className="w-full px-4 py-3 rounded-xl bg-white border-[3px] border-[#0b1120] text-[#0b1120] placeholder-gray-400 focus:outline-none focus:border-[#10b981] transition-colors font-medium"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-[#0b1120] text-sm">Email Address</label>
                  <input
                    name="email"
                    type="email"
                    placeholder="your@email.com"
                    className="w-full px-4 py-3 rounded-xl bg-white border-[3px] border-[#0b1120] text-[#0b1120] placeholder-gray-400 focus:outline-none focus:border-[#10b981] transition-colors font-medium"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-bold text-[#0b1120] text-sm">WhatsApp Number</label>
                  <input
                    name="whatsapp"
                    type="tel"
                    placeholder="+91 98765 43210"
                    className="w-full px-4 py-3 rounded-xl bg-white border-[3px] border-[#0b1120] text-[#0b1120] placeholder-gray-400 focus:outline-none focus:border-[#10b981] transition-colors font-medium"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-[#10b981] text-white rounded-xl font-bold text-lg border-[3px] border-[#0b1120] hover:bg-[#059669] transition-colors disabled:opacity-60 disabled:cursor-not-allowed mt-1"
                >
                  {submitting ? 'Subscribing...' : '📩 Subscribe Now'}
                </button>
                <p className="text-center text-gray-400 text-xs font-medium">
                  By submitting, you agree to our <a href="/terms" className="underline hover:text-[#10b981]">Terms & Conditions</a> and <a href="/privacy" className="underline hover:text-[#10b981]">Privacy Policy</a>.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
