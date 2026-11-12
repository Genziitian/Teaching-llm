'use client';

import { useEffect } from 'react';
import { Link } from '@/landing/shims/router';
import {
  Shield,
  Lock,
  Eye,
  FileText,
  Mail,
  MapPin,
  Server,
  ExternalLink,
  Clock
} from 'lucide-react';

export default function PrivacyPolicy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const tocItems = [
    { id: 'section-1', title: '1. What Information Do We Collect?' },
    { id: 'section-2', title: '2. How Do We Process Your Information?' },
    { id: 'section-3', title: '3. When and With Whom Do We Share Your Personal Information?' },
    { id: 'section-4', title: '4. How Long Do We Keep Your Information?' },
    { id: 'section-5', title: '5. How Do We Keep Your Information Safe?' },
    { id: 'section-6', title: '6. What Are Your Privacy Rights?' },
    { id: 'section-7', title: '7. Controls for Do-Not-Track Features' },
    { id: 'section-8', title: '8. Service Description' },
    { id: 'section-9', title: '9. User Account & Security' },
    { id: 'section-10', title: '10. Course & Material Access & Usage' },
    { id: 'section-11', title: '11. Prohibited Use & Copyright' },
    { id: 'section-12', title: '12. Limitation of Liability' },
    { id: 'section-13', title: '13. Return & Refund Policy' },
    { id: 'section-14', title: '14. Do We Make Updates to This Notice?' },
    { id: 'section-15', title: '15. How Can You Contact Us About This Notice?' },
    { id: 'section-16', title: '16. How Can You Review, Update, or Delete Your Data?' },
  ];

  return (
    <div className="min-h-screen bg-[#fcfcfd] text-[#0b1120] font-sans selection:bg-emerald-100 selection:text-emerald-900">
      {/* Header Banner */}
      <div className="bg-gradient-to-b from-emerald-50/60 via-white to-[#fcfcfd] border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 pt-20 pb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100/80 text-emerald-800 font-semibold text-xs mb-6">
            <Shield className="w-4 h-4 text-emerald-600" />
            Official Legal Document
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-[#0b1120] tracking-tight mb-4">
            Privacy Policy
          </h1>
          <p className="text-gray-500 font-medium text-sm sm:text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600 inline" />
            <span>Last updated: <strong className="text-gray-700">August 24, 2026</strong></span>
          </p>
          <div className="h-1.5 w-20 bg-emerald-500 mt-6 rounded-full"></div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Intro */}
        <div className="bg-white border border-gray-200/80 rounded-2xl p-6 sm:p-8 shadow-xs mb-10 text-gray-700 leading-relaxed space-y-4">
          <p className="text-base sm:text-lg">
            This Privacy Notice for <strong>GENZ IITIAN</strong> (&quot;<strong>we</strong>,&quot; &quot;<strong>us</strong>,&quot; or &quot;<strong>our</strong>&quot;), describes how and why we might access, collect, store, use, and/or share (&quot;<strong>process</strong>&quot;) your personal information when you use our services (&quot;<strong>Services</strong>&quot;), including when you:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-sm sm:text-base text-gray-600">
            <li>
              Visit our website at{' '}
              <a href="https://class.genziitian.in/" target="_blank" rel="noopener noreferrer" className="text-emerald-600 font-semibold underline hover:text-emerald-700">
                https://class.genziitian.in/
              </a>{' '}
              or any website of ours that links to this Privacy Notice
            </li>
            <li>
              Download and use our mobile application (<strong>GENZ IITIAN</strong>), or any other application of ours that links to this Privacy Notice
            </li>
            <li>
              Use <strong>GENZ IITIAN</strong> — The ultimate ecosystem for IIT Madras Online Degree students. Mastery made simple. Gen-Z IITian was founded with a simple yet powerful vision: to make high-quality, IIT-level education accessible to everyone, regardless of their background or location. We recognized the challenges faced by online and hybrid degree students—lack of structured resources, limited mentorship, and isolation. Our platform bridges this gap by providing comprehensive courses, expert guidance, and a thriving community.
            </li>
            <li>
              Engage with us in other related ways, including any marketing or events
            </li>
          </ul>
          <div className="p-4 bg-emerald-50/70 border border-emerald-200/60 rounded-xl text-sm text-emerald-950 font-medium mt-4">
            <strong>Questions or concerns?</strong> Reading this Privacy Notice will help you understand your privacy rights and choices. We are responsible for making decisions about how your personal information is processed. If you do not agree with our policies and practices, please do not use our Services. If you still have any questions or concerns, please contact us at{' '}
            <a href="mailto:ADMIN@GENZIITIAN.ORG" className="text-emerald-700 underline font-bold">ADMIN@GENZIITIAN.ORG</a> or{' '}
            <a href="mailto:GENZIITIAN@GMAIL.COM" className="text-emerald-700 underline font-bold">GENZIITIAN@GMAIL.COM</a>.
          </div>
        </div>

        {/* Summary of Key Points */}
        <div className="bg-gradient-to-br from-slate-900 to-[#0b1120] text-white rounded-3xl p-6 sm:p-10 shadow-lg mb-12 border border-slate-800">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl">
              <Eye className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white">Summary of Key Points</h2>
              <p className="text-xs sm:text-sm text-slate-400">A quick glance at how we handle your personal data</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-slate-300">
            <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60">
              <h3 className="font-bold text-emerald-300 mb-1">What personal information do we process?</h3>
              <p className="text-slate-300 text-xs sm:text-sm">
                When you visit, use, or navigate our Services, we may process personal information depending on how you interact with us and the Services, the choices you make, and the products and features you use. Learn more about personal information you disclose to us.
              </p>
            </div>

            <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60">
              <h3 className="font-bold text-emerald-300 mb-1">Do we process sensitive personal information?</h3>
              <p className="text-slate-300 text-xs sm:text-sm">
                Some of the information may be considered &quot;special&quot; or &quot;sensitive&quot; in certain jurisdictions, for example your racial or ethnic origins, sexual orientation, and religious beliefs. We do not process sensitive personal information.
              </p>
            </div>

            <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60">
              <h3 className="font-bold text-emerald-300 mb-1">Do we collect information from third parties?</h3>
              <p className="text-slate-300 text-xs sm:text-sm">
                We do not collect any information from third parties.
              </p>
            </div>

            <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60">
              <h3 className="font-bold text-emerald-300 mb-1">How do we process your information?</h3>
              <p className="text-slate-300 text-xs sm:text-sm">
                We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes with your consent. We process your information only when we have a valid legal reason to do so. Learn more about how we process your information.
              </p>
            </div>

            <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60">
              <h3 className="font-bold text-emerald-300 mb-1">In what situations and with which parties do we share personal information?</h3>
              <p className="text-slate-300 text-xs sm:text-sm">
                We may share information in specific situations and with specific third parties. Learn more about when and with whom we share your personal information.
              </p>
            </div>

            <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60">
              <h3 className="font-bold text-emerald-300 mb-1">How do we keep your information safe?</h3>
              <p className="text-slate-300 text-xs sm:text-sm">
                We have adequate organizational and technical processes and procedures in place to protect your personal information. However, no electronic transmission over the internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information. Learn more about how we keep your information safe.
              </p>
            </div>

            <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60">
              <h3 className="font-bold text-emerald-300 mb-1">What are your rights?</h3>
              <p className="text-slate-300 text-xs sm:text-sm">
                Depending on where you are located geographically, the applicable privacy law may mean you have certain rights regarding your personal information. Learn more about your privacy rights.
              </p>
            </div>

            <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60">
              <h3 className="font-bold text-emerald-300 mb-1">How do you exercise your rights?</h3>
              <p className="text-slate-300 text-xs sm:text-sm">
                The easiest way to exercise your rights is by visiting support built in the app/website for this, or by contacting us. We will consider and act upon any request in accordance with applicable data protection laws.
              </p>
            </div>
          </div>
          <p className="mt-6 text-sm text-slate-300">
            Want to learn more about what we do with any information we collect? Review the Privacy Notice in full.
          </p>
        </div>

        {/* Table of Contents */}
        <div className="bg-emerald-50/40 border border-emerald-200/60 rounded-2xl p-6 sm:p-8 mb-14">
          <h2 className="text-xl font-black text-[#0b1120] mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-600" />
            Table of Contents
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            {tocItems.map((item) => (
              <a
                key={item.id}
                href={`#${item.id}`}
                className="py-1.5 px-2.5 rounded-lg text-gray-700 hover:text-emerald-700 hover:bg-emerald-100/60 font-medium transition-colors flex items-center justify-between group"
              >
                <span>{item.title}</span>
                <span className="text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity">→</span>
              </a>
            ))}
          </div>
        </div>

        {/* Main Content Sections */}
        <div className="space-y-14 text-gray-700 font-medium leading-relaxed">
          {/* Section 1 */}
          <section id="section-1" className="scroll-mt-20">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-sm">01</span>
              <h2 className="text-2xl font-black text-[#0b1120]">1. What Information Do We Collect?</h2>
            </div>

            <div className="space-y-4 pl-0 sm:pl-11">
              <h3 className="text-lg font-bold text-[#0b1120]">Personal Information You Disclose to Us</h3>
              <div className="p-3.5 bg-gray-50 border-l-4 border-emerald-500 text-sm text-gray-700 rounded-r-lg font-semibold">
                In Short: We collect personal information that you provide to us.
              </div>
              <p>
                We collect personal information that you voluntarily provide to us when you register on the Services, express an interest in obtaining information about us or our products and Services, when you participate in activities on the Services, or otherwise when you contact us.
              </p>

              <h4 className="text-base font-bold text-[#0b1120] mt-3">Personal Information Provided by You</h4>
              <p>
                The personal information that we collect depends on the context of your interactions with us and the Services, the choices you make, and the products and features you use. The personal information we collect may include the following:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm font-semibold text-gray-800 my-3">
                <span className="px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-2xs">✓ names</span>
                <span className="px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-2xs">✓ phone numbers</span>
                <span className="px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-2xs">✓ email addresses</span>
                <span className="px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-2xs">✓ mailing addresses</span>
                <span className="px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-2xs">✓ usernames</span>
                <span className="px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-2xs">✓ contact preferences</span>
                <span className="px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-2xs">✓ contact or authentication data</span>
                <span className="px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-2xs">✓ debit/credit card numbers</span>
                <span className="px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-2xs">✓ education</span>
              </div>

              <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-xl p-4 text-sm mt-3 space-y-2">
                <p><strong>Sensitive Information:</strong> We do not process sensitive information.</p>
                <p>
                  <strong>Payment Data:</strong> We may collect data necessary to process your payment if you choose to make purchases, such as your payment instrument number, and the security code associated with your payment instrument. All payment data is handled and stored by <strong>RAZORPAY</strong>. You may find their privacy notice link here:{' '}
                  <a href="https://razorpay.com/privacy-policy/" target="_blank" rel="noopener noreferrer" className="text-emerald-700 font-bold underline inline-flex items-center gap-1">
                    https://razorpay.com/privacy-policy/ <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </p>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-900 bg-emerald-200/60 px-2.5 py-1 rounded-md inline-block">
                  WE USE PAYMENT IN OUR WEBSITE ONLY
                </p>
              </div>

              <h4 className="text-base font-bold text-[#0b1120] mt-4">Application Data</h4>
              <p>
                If you use our application(s), we also may collect the following information if you choose to provide us with access or permission:
              </p>
              <p className="text-sm">
                <strong>Mobile Device Access:</strong> We may request access or permission to certain features from your mobile device, including your mobile device&apos;s contacts, storage, and other features. If you wish to change our access or permissions, you may do so in your device&apos;s settings.
              </p>
              <p className="text-sm">
                This information is primarily needed to maintain the security and operation of our application(s), for troubleshooting, and for our internal analytics and reporting purposes.
              </p>
              <p className="text-sm text-gray-500 italic">
                All personal information that you provide to us must be true, complete, and accurate, and you must notify us of any changes to such personal information.
              </p>

              <h3 className="text-lg font-bold text-[#0b1120] mt-6">Information Automatically Collected</h3>
              <div className="p-3.5 bg-gray-50 border-l-4 border-emerald-500 text-sm text-gray-700 rounded-r-lg font-semibold">
                In Short: Some information — such as your Internet Protocol (IP) address and/or browser and device characteristics — is collected automatically when you visit our Services.
              </div>
              <p>
                We automatically collect certain information when you visit, use, or navigate the Services. This information does not reveal your specific identity (like your name or contact information) but may include device and usage information, such as your IP address, browser and device characteristics, operating system, language preferences, referring URLs, device name, country, location, information about how and when you use our Services, and other technical information. This information is primarily needed to maintain the security and operation of our Services, and for our internal analytics and reporting purposes.
              </p>
              <div className="space-y-2 text-sm mt-2">
                <p><strong>The information we collect includes:</strong></p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    <strong>Log and Usage Data:</strong> Log and usage data is service-related, diagnostic, usage, and performance information our servers automatically collect when you access or use our Services and which we record in log files. Depending on how you interact with us, this log data may include your IP address, device information, browser type, and settings and information about your activity in the Services (such as the date/time stamps associated with your usage, pages and files viewed, searches, and other actions you take such as which features you use), device event information (such as system activity, error reports (sometimes called &quot;crash dumps&quot;), and hardware settings).
                  </li>
                  <li>
                    <strong>Device Data:</strong> We collect device data such as information about your computer, phone, tablet, or other device you use to access the Services. Depending on the device used, this device data may include information such as your IP address (or proxy server), device and application identification numbers, location, browser type, hardware model, Internet service provider and/or mobile carrier, operating system, and system configuration information.
                  </li>
                </ul>
              </div>

              <div className="p-4 bg-blue-50/70 border border-blue-200/80 rounded-xl text-sm text-blue-950 mt-4">
                <strong>Google API:</strong> Our use of information received from Google APIs will adhere to{' '}
                <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline font-bold inline-flex items-center gap-1">
                  Google API Services User Data Policy <ExternalLink className="w-3.5 h-3.5" />
                </a>, including the Limited Use requirements.
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section id="section-2" className="scroll-mt-20">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-sm">02</span>
              <h2 className="text-2xl font-black text-[#0b1120]">2. How Do We Process Your Information?</h2>
            </div>
            <div className="space-y-4 pl-0 sm:pl-11">
              <div className="p-3.5 bg-gray-50 border-l-4 border-emerald-500 text-sm text-gray-700 rounded-r-lg font-semibold">
                In Short: We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes with your consent.
              </div>
              <p>We process your personal information for a variety of reasons, depending on how you interact with our Services, including:</p>
              <ul className="list-disc pl-6 space-y-2.5 text-sm sm:text-base">
                <li><strong>To facilitate account creation and authentication and otherwise manage user accounts:</strong> We may process your information so you can create and log in to your account, as well as keep your account in working order.</li>
                <li><strong>To deliver and facilitate delivery of services to the user:</strong> We may process your information to provide you with the requested service.</li>
                <li><strong>To enable user-to-user communications:</strong> We may process your information if you choose to use any of our offerings that allow for communication with another user.</li>
                <li><strong>To request feedback:</strong> We may process your information when necessary to request feedback and to contact you about your use of our Services.</li>
                <li><strong>To send you marketing and promotional communications:</strong> We may process the personal information you send to us for our marketing purposes, if this is in accordance with your marketing preferences. You can opt out of our marketing emails at any time. For more information, see &quot;WHAT ARE YOUR PRIVACY RIGHTS?&quot; below.</li>
                <li><strong>To protect our Services:</strong> We may process your information as part of our efforts to keep our Services safe and secure, including fraud monitoring and prevention.</li>
                <li><strong>To identify usage trends:</strong> We may process information about how you use our Services to better understand how they are being used so we can improve them.</li>
                <li><strong>To comply with our legal obligations:</strong> We may process your information to comply with our legal obligations, respond to legal requests, and exercise, establish, or defend our legal rights.</li>
              </ul>
            </div>
          </section>

          {/* Section 3 */}
          <section id="section-3" className="scroll-mt-20">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-sm">03</span>
              <h2 className="text-2xl font-black text-[#0b1120]">3. When and With Whom Do We Share Your Personal Information?</h2>
            </div>
            <div className="space-y-4 pl-0 sm:pl-11">
              <div className="p-3.5 bg-gray-50 border-l-4 border-emerald-500 text-sm text-gray-700 rounded-r-lg font-semibold">
                In Short: We may share information in specific situations described in this section and/or with the following third parties.
              </div>
              <p>
                <strong>Vendors, Consultants, and Other Third-Party Service Providers.</strong> We may share your data with third-party vendors, service providers, contractors, or agents (&quot;third parties&quot;) who perform services for us or on our behalf and require access to such information to do that work.
              </p>
              <p>The third parties we may share personal information with are as follows:</p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
                <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-xs">
                  <div className="text-xs uppercase font-bold text-gray-400 mb-1">Data Backup and Security</div>
                  <div className="text-base font-bold text-emerald-700 flex items-center gap-1.5">
                    <Server className="w-4 h-4" /> SUPERBASE
                  </div>
                </div>
                <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-xs">
                  <div className="text-xs uppercase font-bold text-gray-400 mb-1">Registration & Authentication</div>
                  <div className="text-base font-bold text-emerald-700 flex items-center gap-1.5">
                    <Lock className="w-4 h-4" /> Google Sign-In
                  </div>
                </div>
                <div className="p-4 bg-white border border-gray-200 rounded-xl shadow-xs">
                  <div className="text-xs uppercase font-bold text-gray-400 mb-1">Web and Mobile Analytics</div>
                  <div className="text-base font-bold text-emerald-700 flex items-center gap-1.5">
                    <Eye className="w-4 h-4" /> POSTHOG
                  </div>
                </div>
              </div>

              <p className="mt-4">We also may need to share your personal information in the following situations:</p>
              <ul className="list-disc pl-6 space-y-2 text-sm">
                <li>
                  <strong>Business Transfers:</strong> We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.
                </li>
                <li>
                  <strong>Other Users:</strong> When you share personal information (for example, by posting comments, contributions, or other content to the Services) or otherwise interact with public areas of the Services, such personal information may be viewed by all users and may be publicly made available outside the Services in perpetuity. Similarly, other users will be able to view descriptions of your activity, communicate with you within our Services, and view your profile.
                </li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section id="section-4" className="scroll-mt-20">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-sm">04</span>
              <h2 className="text-2xl font-black text-[#0b1120]">4. How Long Do We Keep Your Information?</h2>
            </div>
            <div className="space-y-4 pl-0 sm:pl-11">
              <div className="p-3.5 bg-gray-50 border-l-4 border-emerald-500 text-sm text-gray-700 rounded-r-lg font-semibold">
                In Short: We keep your information for as long as necessary to fulfill the purposes outlined in this Privacy Notice unless otherwise required by law.
              </div>
              <p>
                We will only keep your personal information for as long as it is necessary for the purposes set out in this Privacy Notice, unless a longer retention period is required or permitted by law (such as tax, accounting, or other legal requirements). No purpose in this notice will require us keeping your personal information for longer than the period of time in which users have an account with us.
              </p>
              <p>
                When we have no ongoing legitimate business need to process your personal information, we will either delete or anonymize such information, or, if this is not possible (for example, because your personal information has been stored in backup archives), then we will securely store your personal information and isolate it from any further processing until deletion is possible.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section id="section-5" className="scroll-mt-20">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-sm">05</span>
              <h2 className="text-2xl font-black text-[#0b1120]">5. How Do We Keep Your Information Safe?</h2>
            </div>
            <div className="space-y-4 pl-0 sm:pl-11">
              <div className="p-3.5 bg-gray-50 border-l-4 border-emerald-500 text-sm text-gray-700 rounded-r-lg font-semibold">
                In Short: We aim to protect your personal information through a system of organizational and technical security measures.
              </div>
              <p>
                We have implemented appropriate and reasonable technical and organizational security measures designed to protect the security of any personal information we process. However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information.
              </p>
              <p>
                Although we will do our best to protect your personal information, transmission of personal information to and from our Services is at your own risk. You should only access the Services within a secure environment.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section id="section-6" className="scroll-mt-20">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-sm">06</span>
              <h2 className="text-2xl font-black text-[#0b1120]">6. What Are Your Privacy Rights?</h2>
            </div>
            <div className="space-y-4 pl-0 sm:pl-11">
              <div className="p-3.5 bg-gray-50 border-l-4 border-emerald-500 text-sm text-gray-700 rounded-r-lg font-semibold">
                In Short: You may review, change, or terminate your account at any time, depending on your country, province, or state of residence.
              </div>
              <p>
                <strong>Withdrawing your consent:</strong> If we are relying on your consent to process your personal information, which may be express and/or implied consent depending on the applicable law, you have the right to withdraw your consent at any time. You can withdraw your consent at any time by contacting us by using the contact details provided in the section &quot;HOW CAN YOU CONTACT US ABOUT THIS NOTICE?&quot; below.
              </p>
              <p>
                However, please note that this will not affect the lawfulness of the processing before its withdrawal nor, when applicable law allows, will it affect the processing of your personal information conducted in reliance on lawful processing grounds other than consent.
              </p>
              <p>
                <strong>Opting out of marketing and promotional communications:</strong> You can unsubscribe from our marketing and promotional communications at any time by clicking on the unsubscribe link in the emails that we send, or by contacting us using the details provided in the section &quot;HOW CAN YOU CONTACT US ABOUT THIS NOTICE?&quot; below. You will then be removed from the marketing lists. However, we may still communicate with you — for example, to send you service-related messages that are necessary for the administration and use of your account, to respond to service requests, or for other non-marketing purposes.
              </p>

              <h3 className="text-lg font-bold text-[#0b1120] mt-4">Account Information</h3>
              <p>If you would at any time like to review or change the information in your account or terminate your account, you can:</p>
              <ul className="list-disc pl-6 space-y-1.5 text-sm">
                <li>Log in to your account settings and update your user account.</li>
                <li>Contact us using the contact information provided.</li>
              </ul>
              <p className="text-sm">
                Upon your request to terminate your account, we will deactivate or delete your account and information from our active databases. However, we may retain some information in our files to prevent fraud, troubleshoot problems, assist with any investigations, enforce our legal terms and/or comply with applicable legal requirements.
              </p>
              <p className="text-sm">
                If you have questions or comments about your privacy rights, you may email us at{' '}
                <a href="mailto:ADMIN@GENZIITIAN.ORG" className="text-emerald-700 font-bold underline">ADMIN@GENZIITIAN.ORG</a> ,{' '}
                <a href="mailto:GENZIITIAN@GMAIL.COM" className="text-emerald-700 font-bold underline">GENZIITIAN@GMAIL.COM</a>.
              </p>
            </div>
          </section>

          {/* Section 7 */}
          <section id="section-7" className="scroll-mt-20">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-sm">07</span>
              <h2 className="text-2xl font-black text-[#0b1120]">7. Controls for Do-Not-Track Features</h2>
            </div>
            <div className="space-y-4 pl-0 sm:pl-11">
              <p>
                Most web browsers and some mobile operating systems and mobile applications include a Do-Not-Track (&quot;DNT&quot;) feature or setting you can activate to signal your privacy preference not to have data about your online browsing activities monitored and collected. At this stage, no uniform technology standard for recognizing and implementing DNT signals has been finalized. As such, we do not currently respond to DNT browser signals or any other mechanism that automatically communicates your choice not to be tracked online. If a standard for online tracking is adopted that we must follow in the future, we will inform you about that practice in a revised version of this Privacy Notice.
              </p>
            </div>
          </section>

          {/* Section 8 */}
          <section id="section-8" className="scroll-mt-20">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-sm">08</span>
              <h2 className="text-2xl font-black text-[#0b1120]">8. Service Description</h2>
            </div>
            <div className="space-y-4 pl-0 sm:pl-11">
              <p>
                Gen-Z IITian provides access to premium digital educational courses designed specifically for students. Our services are delivered entirely online. Access to the courses is granted immediately upon successful completion of the payment process.
              </p>
            </div>
          </section>

          {/* Section 9 */}
          <section id="section-9" className="scroll-mt-20">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-sm">09</span>
              <h2 className="text-2xl font-black text-[#0b1120]">9. User Account & Security</h2>
            </div>
            <div className="space-y-4 pl-0 sm:pl-11">
              <p>
                To access our courses, users must sign in via their Google account. You are solely responsible for maintaining the confidentiality of your account information and for all activities that occur under your account. We reserve the right to terminate accounts that violate our security protocols.
              </p>
            </div>
          </section>

          {/* Section 10 */}
          <section id="section-10" className="scroll-mt-20">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-sm">10</span>
              <h2 className="text-2xl font-black text-[#0b1120]">10. Course & Material Access & Usage</h2>
            </div>
            <div className="space-y-4 pl-0 sm:pl-11">
              <p>
                Access is granted exclusively to the email address used during the purchase. Course/MATERIAL access is non-transferable and intended for personal use only. Sharing account credentials or course content with third parties is strictly prohibited.
              </p>
            </div>
          </section>

          {/* Section 11 */}
          <section id="section-11" className="scroll-mt-20">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-sm">11</span>
              <h2 className="text-2xl font-black text-[#0b1120]">11. Prohibited Use & Copyright</h2>
            </div>
            <div className="space-y-4 pl-0 sm:pl-11">
              <p>
                All content on this platform, including videos, documents, and code samples, is the intellectual property of Gen-Z IITian. Any form of piracy, unauthorized redistribution, or commercial use of our content will result in legal action and immediate termination of access without notice.
              </p>
            </div>
          </section>

          {/* Section 12 */}
          <section id="section-12" className="scroll-mt-20">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-sm">12</span>
              <h2 className="text-2xl font-black text-[#0b1120]">12. Limitation of Liability</h2>
            </div>
            <div className="space-y-4 pl-0 sm:pl-11">
              <p>
                Gen-Z IITian is an educational platform. While we strive for excellence, we do not guarantee specific academic results or career outcomes. The platform is not responsible for any misuse of the information provided or for any technical issues arising from the user&apos;s internet connection or device.
              </p>
            </div>
          </section>

          {/* Section 13 */}
          <section id="section-13" className="scroll-mt-20">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-sm">13</span>
              <h2 className="text-2xl font-black text-[#0b1120]">13. Return & Refund Policy</h2>
            </div>
            <div className="space-y-4 pl-0 sm:pl-11">
              <div className="p-5 bg-amber-50/70 border border-amber-200/80 rounded-2xl text-amber-950">
                <p className="font-semibold mb-2">
                  At GenZ IITian, we provide 100% digital educational services in the form of online courses. There is no physical product, shipment, or delivery involved.
                </p>
                <p className="text-sm leading-relaxed">
                  Due to the nature of digital content, all purchases are final. We do not offer refunds, returns, or exchanges under any circumstances once a course has been purchased. We strongly recommend reviewing course details before making a purchase. In case of any technical issues, payment errors, or access-related problems, you can contact our support team. We will ensure that you receive proper access to your purchased course. We reserve the right to update or modify this policy at any time without prior notice. Changes will be effective immediately upon posting.
                </p>
              </div>
            </div>
          </section>

          {/* Section 14 */}
          <section id="section-14" className="scroll-mt-20">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-sm">14</span>
              <h2 className="text-2xl font-black text-[#0b1120]">14. Do We Make Updates to This Notice?</h2>
            </div>
            <div className="space-y-4 pl-0 sm:pl-11">
              <div className="p-3.5 bg-gray-50 border-l-4 border-emerald-500 text-sm text-gray-700 rounded-r-lg font-semibold">
                In Short: Yes, we will update this notice as necessary to stay compliant with relevant laws.
              </div>
              <p>
                We may update this Privacy Notice from time to time. The updated version will be indicated by an updated &quot;Revised&quot; date at the top of this Privacy Notice. If we make material changes to this Privacy Notice, we may notify you either by prominently posting a notice of such changes or by directly sending you a notification. We encourage you to review this Privacy Notice frequently to be informed of how we are protecting your information.
              </p>
            </div>
          </section>

          {/* Section 15 */}
          <section id="section-15" className="scroll-mt-20">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-sm">15</span>
              <h2 className="text-2xl font-black text-[#0b1120]">15. How Can You Contact Us About This Notice?</h2>
            </div>
            <div className="space-y-4 pl-0 sm:pl-11">
              <p>If you have questions or comments about this notice, you may email us at <a href="mailto:ADMIN@GENZIITIAN.ORG" className="text-emerald-700 font-bold underline">ADMIN@GENZIITIAN.ORG</a> or contact us by post at:</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-xs">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold mb-2">
                    <Mail className="w-4 h-4" /> Email Addresses
                  </div>
                  <div className="space-y-1 text-sm font-medium">
                    <div>
                      <a href="mailto:ADMIN@GENZIITIAN.ORG" className="text-emerald-700 hover:underline">ADMIN@GENZIITIAN.ORG</a>
                    </div>
                    <div>
                      <a href="mailto:GENZIITIAN@GMAIL.COM" className="text-emerald-700 hover:underline">GENZIITIAN@GMAIL.COM</a>
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-white border border-gray-200 rounded-2xl shadow-xs">
                  <div className="flex items-center gap-2 text-emerald-700 font-bold mb-2">
                    <MapPin className="w-4 h-4" /> Postal Address
                  </div>
                  <div className="text-sm text-gray-600 leading-relaxed font-medium">
                    GENZ IITIAN<br />
                    BIHAR , INDIA<br />
                    PATNA, BIHAR 800001<br />
                    India
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Section 16 */}
          <section id="section-16" className="scroll-mt-20">
            <div className="flex items-center gap-3 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-sm">16</span>
              <h2 className="text-2xl font-black text-[#0b1120]">16. How Can You Review, Update, or Delete the Data We Collect From You?</h2>
            </div>
            <div className="space-y-4 pl-0 sm:pl-11">
              <p>
                You have the right to request access to the personal information we collect from you, details about how we have processed it, correct inaccuracies, or delete your personal information. You may also have the right to withdraw your consent to our processing of your personal information. These rights may be limited in some circumstances by applicable law.
              </p>
              <div className="p-5 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-bold text-emerald-400 text-base mb-1">Exercise Your Rights</h4>
                  <p className="text-xs sm:text-sm text-slate-300">
                    To request to review, update, or delete your personal information, please visit support built in the app/website for this.
                  </p>
                </div>
                <Link
                  to="/contact"
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-sm rounded-xl transition-colors whitespace-nowrap shadow-sm"
                >
                  Visit Support
                </Link>
              </div>
            </div>
          </section>
        </div>

        {/* Footer Support Banner */}
        <div className="p-8 bg-[#f8fafc] border-2 border-dashed border-gray-200 rounded-3xl mt-16 text-center">
          <p className="text-gray-500 font-bold mb-3">Have questions about your privacy?</p>
          <div className="flex flex-wrap justify-center items-center gap-4">
            <Link to="/contact" className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors text-sm shadow-xs">
              <Mail className="w-4 h-4" /> Contact Support
            </Link>
            <a href="mailto:ADMIN@GENZIITIAN.ORG" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 font-bold rounded-xl transition-colors text-sm shadow-2xs">
              Email Us Directly
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
