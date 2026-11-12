'use client';

import { useEffect } from 'react';

export default function RefundPolicy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#0b1120] font-sans selection:bg-blue-100">
      <div className="max-w-4xl mx-auto px-6 py-24">
        <div className="mb-16">
          <h1 className="text-4xl lg:text-5xl font-black text-[#0b1120] mb-4">Refund & Cancellation</h1>
          <p className="text-gray-500 font-bold">Last Updated: April 2026</p>
          <div className="h-1.5 w-24 bg-[#10b981] mt-6 rounded-full"></div>
        </div>

        <div className="space-y-12 text-lg text-gray-600 font-medium leading-relaxed">
          <p className="text-xl text-[#0b1120] font-bold">
            At Gen-Z IITian, we aim to provide high-quality educational content and resources to our students. Because our products are digital and delivered instantly, we maintain a clear refund and cancellation policy.
          </p>

          <section className="p-8 bg-red-50 border-[3px] border-red-100 rounded-[2rem]">
            <h2 className="text-2xl font-black text-red-600 mb-4 flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white text-red-600 shadow-sm text-sm">01</span>
              No Refund Policy
            </h2>
            <p className="text-red-700 font-bold mb-4">
              "All purchases are final. We do not offer refunds once a course is purchased."
            </p>
            <p className="text-gray-700">
              As our products are digital educational courses and access is granted immediately upon payment, we cannot provide any refunds or returns. Once the course material is accessed, the value is considered delivered.
            </p>
          </section>

          <section className="p-8 bg-gray-50 border-[3px] border-gray-100 rounded-[2rem]">
            <h2 className="text-2xl font-black text-[#0b1120] mb-4 flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white text-[#0b1120] shadow-sm text-sm">02</span>
              No Cancellation Policy
            </h2>
            <p className="font-bold mb-4">
              "Orders cannot be cancelled once placed."
            </p>
            <p className="text-gray-700">
              Due to the automated nature of our enrollment process, once a payment is successful, the order cannot be reversed or cancelled. Access is linked to your account immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-[#0b1120] mb-4 flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#eef2ff] text-[#0b1120] text-sm">03</span>
              Reason for this Policy
            </h2>
            <p>
              We provide access to proprietary educational content, downloadable resources, and curriculum-specific study materials. Since these materials are accessible instantly to anyone after purchase, we cannot revoke access once the content has been viewed.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-black text-[#0b1120] mb-4 flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#eef2ff] text-[#0b1120] text-sm">04</span>
              Duplicate Payment Resolution
            </h2>
            <p>
              In case of a technical glitch leading to a duplicate payment for the same course, users should contact our support team immediately. Upon verification, we will initiate a refund for the duplicate transaction through the original payment method. The refund process may take 5-7 business days depending on the payment gateway and your bank.
            </p>
          </section>

          <div className="p-8 bg-[#f8fafc] border-2 border-dashed border-gray-200 rounded-3xl mt-16 text-center">
            <p className="text-gray-500 font-bold mb-4">Still have questions?</p>
            <a href="/contact" className="text-[#10b981] font-black hover:underline">Contact Support</a>
          </div>
        </div>
      </div>
    </div>
  );
}
