'use client';

import { useEffect } from 'react';

export default function TermsAndConditions() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#0b1120] font-sans selection:bg-blue-100">
      <div className="max-w-4xl mx-auto px-6 py-24">
        <div className="mb-16">
          <h1 className="text-4xl lg:text-5xl font-black text-[#0b1120] mb-4">Terms & Conditions</h1>
          <p className="text-gray-500 font-bold">Last Updated: April 2026</p>
          <div className="h-1.5 w-24 bg-[#10b981] mt-6 rounded-full"></div>
        </div>

        <div className="space-y-12 text-lg text-gray-600 font-medium leading-relaxed">
          <section>
            <h2 className="text-2xl font-black text-[#0b1120] mb-4 flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#eef2ff] text-[#0b1120] text-sm">01</span>
              Service Description
            </h2>
            <p>
              Gen-Z IITian provides access to premium digital educational courses designed specifically for students. Our services are delivered entirely online. Access to the courses is granted immediately upon successful completion of the payment process.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-[#0b1120] mb-4 flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#eef2ff] text-[#0b1120] text-sm">02</span>
              User Account & Security
            </h2>
            <p>
              To access our courses, users must sign in via their Google account. You are solely responsible for maintaining the confidentiality of your account information and for all activities that occur under your account. We reserve the right to terminate accounts that violate our security protocols.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-[#0b1120] mb-4 flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#eef2ff] text-[#0b1120] text-sm">03</span>
              Course Access & Usage
            </h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access is granted exclusively to the email address used during the purchase.</li>
              <li>Course access is non-transferable and intended for personal use only.</li>
              <li>Sharing account credentials or course content with third parties is strictly prohibited.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-black text-[#0b1120] mb-4 flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#eef2ff] text-[#0b1120] text-sm">04</span>
              Payment Terms
            </h2>
            <p>
              All prices are clearly displayed before the final checkout. By proceeding with the payment, you agree to the price and terms of the specific course. All payments are processed through secure third-party payment gateways (Razorpay, Stripe, or Cashfree).
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-[#0b1120] mb-4 flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#eef2ff] text-[#0b1120] text-sm">05</span>
              Prohibited Use & Copyright
            </h2>
            <p>
              All content on this platform, including videos, documents, and code samples, is the intellectual property of Gen-Z IITian. Any form of piracy, unauthorized redistribution, or commercial use of our content will result in legal action and immediate termination of access without notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-[#0b1120] mb-4 flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#eef2ff] text-[#0b1120] text-sm">06</span>
              Limitation of Liability
            </h2>
            <p>
              Gen-Z IITian is an educational platform. While we strive for excellence, we do not guarantee specific academic results or career outcomes. The platform is not responsible for any misuse of the information provided or for any technical issues arising from the user's internet connection or device.
            </p>
          </section>

          <div className="p-8 bg-[#f8fafc] border-2 border-dashed border-gray-200 rounded-3xl mt-16 text-center">
            <p className="text-gray-500 font-bold mb-4">Questions about our Terms?</p>
            <a href="/contact" className="text-[#10b981] font-black hover:underline">Contact Support</a>
          </div>
        </div>
      </div>
    </div>
  );
}
