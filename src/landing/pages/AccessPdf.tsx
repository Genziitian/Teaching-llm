'use client';

import { useState } from 'react';
import { Download, FileText, Mail, ShieldCheck } from 'lucide-react';

const DRIVE_DOWNLOAD_LINK = 'https://drive.google.com/uc?export=download&id=1uKq2UKsIkdNiv3VKx2_BV_j2UXkjB2fA';

type Level = 'Foundation' | 'Diploma';

export default function AccessPdf() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [level, setLevel] = useState<Level>('Foundation');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/site/lead-magnet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ name, email, phone, level }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#0b1120] font-sans selection:bg-blue-100">
      <div className="max-w-3xl mx-auto px-6 pt-16 pb-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#eef2ff] border-2 border-[#0b1120] rounded-full text-xs font-black uppercase tracking-wider mb-6">
          <FileText className="w-3.5 h-3.5" /> Free Resource
        </div>
        <h1 className="text-5xl lg:text-6xl font-black text-[#0b1120] mb-6">Access PDF</h1>
        <p className="text-xl text-gray-600 font-medium max-w-xl mx-auto">
          Enter your details below and we'll email you the download link instantly — you can also grab it right here.
        </p>
      </div>

      <div className="max-w-xl mx-auto px-6 pb-24">
        <div className="bg-[#eef2ff] border-[3px] border-[#0b1120] rounded-[2.5rem] p-8 lg:p-10 shadow-[12px_12px_0px_#0b1120]">
          {submitted ? (
            <div className="text-center py-8">
              <div className="text-5xl mb-4">🎉</div>
              <h3 className="text-2xl font-black text-[#0b1120] mb-2">You're all set!</h3>
              <p className="text-gray-600 font-bold mb-8">
                We've emailed the download link to <span className="text-[#0b1120]">{email}</span>. You can also
                download it right now below.
              </p>
              <a
                href={DRIVE_DOWNLOAD_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#10b981] text-white rounded-xl font-black text-lg border-[3px] border-[#0b1120] shadow-[6px_6px_0px_#0b1120] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[10px_10px_0px_#0b1120] transition-all"
              >
                <Download className="w-5 h-5" /> Download PDF Now
              </a>
              <button
                type="button"
                onClick={() => {
                  setSubmitted(false);
                  setName('');
                  setEmail('');
                  setPhone('');
                }}
                className="block mx-auto mt-6 text-sm font-bold text-gray-500 hover:text-[#0b1120] transition-colors"
              >
                Request for someone else
              </button>
            </div>
          ) : (
            <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
              <h2 className="text-3xl font-black text-[#0b1120]">Get Your Free PDF</h2>

              <div className="flex flex-col gap-2">
                <label className="font-bold text-[#0b1120]">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-6 py-4 rounded-xl bg-white border-[3px] border-[#0b1120] text-[#0b1120] placeholder-gray-400 focus:outline-none focus:border-[#10b981] transition-colors font-medium"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-bold text-[#0b1120]">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full px-6 py-4 rounded-xl bg-white border-[3px] border-[#0b1120] text-[#0b1120] placeholder-gray-400 focus:outline-none focus:border-[#10b981] transition-colors font-medium"
                  required
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-bold text-[#0b1120]">WhatsApp / Phone Number</label>
                <div className="flex gap-3">
                  <div className="w-16 px-2 py-4 rounded-xl bg-gray-100 border-[3px] border-[#0b1120] text-[#0b1120] font-black flex items-center justify-center shrink-0">
                    +91
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="98765 43210"
                    className="w-full px-6 py-4 rounded-xl bg-white border-[3px] border-[#0b1120] text-[#0b1120] placeholder-gray-400 focus:outline-none focus:border-[#10b981] transition-colors font-medium"
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-bold text-[#0b1120]">Your Level</label>
                <div className="flex gap-3">
                  {(['Foundation', 'Diploma'] as const).map((lv) => (
                    <button
                      key={lv}
                      type="button"
                      onClick={() => setLevel(lv)}
                      className={`flex-1 px-4 py-3 border-[3px] border-[#0b1120] rounded-xl text-sm font-black transition-all hover:-translate-y-0.5 ${
                        level === lv
                          ? 'bg-[#10b981] text-white shadow-[3px_3px_0px_#0b1120]'
                          : 'bg-white text-[#0b1120] shadow-[2px_2px_0px_#0b1120]'
                      }`}
                    >
                      {lv} Level
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-sm font-bold text-red-600 bg-red-50 border-2 border-red-200 rounded-xl px-4 py-3">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-5 bg-[#10b981] text-white rounded-xl font-black text-xl border-[3px] border-[#0b1120] shadow-[6px_6px_0px_#0b1120] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[10px_10px_0px_#0b1120] transition-all mt-2 disabled:opacity-60"
              >
                {submitting ? 'Sending...' : 'Get the PDF →'}
              </button>

              <p className="text-center text-xs font-medium text-gray-500">
                We'll only use your details to send you this PDF and relevant updates.
              </p>
            </form>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          <div className="flex items-center gap-3 px-4 py-3 bg-white border-2 border-gray-100 rounded-xl">
            <Mail className="w-4 h-4 text-[#10b981] shrink-0" />
            <span className="text-xs font-bold text-gray-600">Instant email delivery</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 bg-white border-2 border-gray-100 rounded-xl">
            <Download className="w-4 h-4 text-[#10b981] shrink-0" />
            <span className="text-xs font-bold text-gray-600">Direct download too</span>
          </div>
          <div className="flex items-center gap-3 px-4 py-3 bg-white border-2 border-gray-100 rounded-xl">
            <ShieldCheck className="w-4 h-4 text-[#10b981] shrink-0" />
            <span className="text-xs font-bold text-gray-600">No spam, ever</span>
          </div>
        </div>
      </div>
    </div>
  );
}
