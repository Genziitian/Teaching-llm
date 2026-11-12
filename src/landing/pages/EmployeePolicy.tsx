'use client';

import { useEffect } from 'react';

type Section = {
  no: string;
  title: string;
  intro?: string;
  points?: string[];
  outro?: string;
  tone?: 'danger';
};

const SECTIONS: Section[] = [
  {
    no: '01',
    title: 'Purpose and Scope',
    intro:
      'This Employee Policy establishes the standards and procedures applicable to individuals engaged by Gen-Z IITian. It is designed to protect students, educational quality, company resources, confidential information, intellectual property, business operations and professional relationships while providing clear expectations to employees and contributors.',
    outro:
      'The policy applies to full-time and part-time employees, educators, tutors, teaching assistants, content creators, interns, contractors and other personnel where their engagement documentation or onboarding process makes this policy applicable.',
  },
  {
    no: '02',
    title: 'Definitions',
    points: [
      'Company / Gen-Z IITian: Gen-Z IITian and its applicable business, products, platforms, courses, communities and related operations.',
      'Employee: Any person engaged by Gen-Z IITian under an employment, educator, tutor, contributor or similar arrangement to whom this policy applies.',
      'Company Information: Non-public information relating to students, customers, courses, pricing, strategy, operations, technology, marketing, finances, internal processes or personnel.',
      'Confidential Information: Any information that is not publicly available and that an employee receives or accesses because of their association with Gen-Z IITian.',
      'Company Materials: Course recordings, notes, slides, question banks, assignments, assessments, scripts, documents, databases, designs, software, credentials, student records and other materials created, commissioned, purchased or maintained for Gen-Z IITian.',
      'Competing Activity: An independent educational product or service that materially overlaps with the subject, audience or commercial category of the Gen-Z IITian product or role for which the employee is engaged.',
      "Notice Period: The period that must be served after formal resignation before separation, as specified in the employee's applicable engagement terms or this policy.",
    ],
  },
  {
    no: '04',
    title: 'Professional Conduct',
    points: [
      'Act honestly, professionally and in good faith while performing responsibilities for Gen-Z IITian.',
      'Treat students, colleagues, management and external partners respectfully.',
      'Do not misrepresent personal projects, products or services as Gen-Z IITian products without authorization.',
      "Do not make commitments to students, parents, customers or partners on behalf of Gen-Z IITian beyond the employee's authority.",
      "Do not intentionally interfere with another employee's work, student support or company operations.",
      'Promptly report material conflicts of interest, security incidents, unauthorized access, student-data issues or misuse of company resources.',
    ],
  },
  {
    no: '05',
    title: 'Duties of Educators and Content Contributors',
    points: [
      'Deliver educational content with reasonable accuracy, preparation and professionalism.',
      'Follow the agreed syllabus, academic standards, recording requirements and course schedule.',
      'Protect student information and avoid unnecessary collection or disclosure of personal data.',
      'Use only authorized resources and properly licensed third-party materials.',
      'Do not knowingly provide students with misleading information regarding Gen-Z IITian courses, pricing, certificates, policies or outcomes.',
      'Maintain appropriate boundaries with students and do not use company student lists for unauthorized personal marketing.',
    ],
  },
  {
    no: '06',
    title: 'Confidentiality and Non-Disclosure',
    intro:
      "During the course of engagement, employees may receive confidential information. Such information shall be used only for legitimate Gen-Z IITian purposes and only to the extent necessary for the employee's role. Confidential information includes, without limitation:",
    points: [
      'Student/customer names, contact details, enquiries, leads, academic information and communications.',
      'Course pricing, conversion data, revenue information and commercial terms.',
      'Unreleased courses, launches, schedules, product roadmaps and marketing plans.',
      'Internal teaching plans, course blueprints, question banks and assessment strategies.',
      'Internal documents, SOPs, credentials, dashboards, databases and technical information.',
      'Non-public business relationships, supplier/tutor arrangements and partnership terms.',
      'Any other information reasonably understood to be confidential.',
    ],
    outro:
      'Confidentiality obligations continue after separation for as long as the information remains confidential or otherwise protected by applicable law or agreement. Publicly available information, independently developed information and information that an employee is legally required to disclose are excluded to the extent permitted by law.',
  },
  {
    no: '07',
    title: 'Intellectual Property and Company Materials',
    intro:
      'Ownership of content and other intellectual property shall be determined by the applicable employment/engagement agreement, assignment terms, commissioning arrangement and applicable law. Employees must not assume that personal authorship alone determines ownership where the material was created as part of paid work or commissioned for Gen-Z IITian.',
    points: [
      'Company course recordings, notes, slides, scripts, assignments, tests and other commissioned materials must be stored and handled through authorized systems.',
      'Employees must not copy, sell, upload, redistribute or commercially reuse Company Materials outside the scope authorized by Gen-Z IITian.',
      'Company branding, logos, trademarks, domains and social-media assets may be used only for authorized Company activities.',
      'On separation, employees must return or securely delete Company Materials as directed, subject to legal retention requirements.',
    ],
    outro:
      "Nothing in this section transfers ownership of an employee's pre-existing work that was not created for Gen-Z IITian, unless a separate written agreement provides otherwise.",
  },
  {
    no: '08',
    title: 'Student Data, Leads and Communications',
    intro:
      'Student and customer information obtained through Gen-Z IITian systems, courses, communities, forms, CRM systems, WhatsApp groups, email systems or other Company channels must be treated as Company-controlled business information, subject to applicable privacy and data-protection law.',
    points: [
      'Do not export or copy student lists for personal use.',
      'Do not add Company students/leads to personal marketing lists without authorization.',
      'Do not use student contact details to market an independent competing course where prohibited by policy, contract or law.',
      'Do not transfer student records to another business, device or platform without authorization.',
      'Report suspected data loss, unauthorized access or accidental disclosure immediately.',
    ],
  },
  {
    no: '09',
    title: 'Conflict of Interest and Outside Activities',
    intro:
      'Employees may have personal projects or outside professional interests where these do not conflict with their Gen-Z IITian responsibilities, misuse Company information/resources, create an undisclosed conflict, or breach an applicable agreement. Before undertaking an outside activity that could reasonably overlap with the employee’s Gen-Z IITian role or student audience, the employee must disclose the potential conflict to management and obtain any approval required by their applicable engagement terms.',
    points: [
      'An employee must not use their Gen-Z IITian position to divert Company students, leads, partners or commercial opportunities to an undisclosed outside business.',
      'An employee must not represent an outside business as being affiliated with Gen-Z IITian without authorization.',
      'An employee must not use Company confidential information to develop or market an outside product.',
    ],
  },
  {
    no: '10',
    title: 'Competing Educational Activities',
    intro:
      'Because educators may have access to course plans, student information, internal strategies and other sensitive business information, Gen-Z IITian requires employees to disclose proposed competing educational activities during their engagement. Where the applicable employment/engagement agreement or accepted policy contains a restriction on competing activity after separation, the employee must comply with that restriction to the extent it is valid and enforceable under applicable law.',
    outro:
      "Any post-employment restriction is intended to protect legitimate business interests and shall be interpreted and enforced only to the extent permitted by applicable law. Nothing in this policy is intended to unlawfully restrain a person's lawful right to work or carry on a profession, trade or business.",
  },
  {
    no: '11',
    title: 'Resignation and Notice Period',
    intro:
      "An employee who wishes to leave Gen-Z IITian must provide formal written resignation/notification through the channel designated by Gen-Z IITian. The applicable notice period shall be the period specified in the employee's employment/engagement terms or other accepted written policy.",
    points: [
      "A verbal statement to a colleague, student or friend does not constitute formal resignation unless expressly accepted through the Company's designated process.",
      'During the notice period, the employee remains responsible for assigned duties and must cooperate with transition requirements.',
      'The employee must not intentionally disrupt classes, student support, content schedules or business operations during the notice period.',
      'The employee must complete reasonable handover requirements, including course status, pending student matters, files, credentials held on behalf of the Company, communications and operational information.',
      'Failure to serve a contractually applicable notice period may result in notice pay or other remedies only to the extent provided by the applicable agreement and permitted by law.',
    ],
  },
  {
    no: '12',
    title: 'Separation and Handover',
    points: [
      'Return Company devices, documents, access cards and other physical property.',
      'Transfer or return Company files and records stored on personal devices or accounts, subject to applicable law and Company instructions.',
      'Hand over active student/course matters, pending tasks, schedules and relevant communications.',
      'Provide a reasonable transition summary for courses or projects managed by the employee.',
      'Stop using Company credentials and systems after access is revoked or employment ends.',
      'Do not retain or exploit confidential student, business or Company information after separation.',
    ],
  },
  {
    no: '13',
    title: 'Company Accounts, Access and Security',
    points: [
      'Company accounts are provided for authorized business purposes.',
      'Employees must not share passwords or authentication codes.',
      'Employees must not create hidden administrator accounts or bypass access controls.',
      "Access must be limited to information necessary for the employee's role.",
      'All Company systems may be subject to access logging and security monitoring consistent with applicable law.',
      'Any suspected account compromise must be reported immediately.',
    ],
  },
  {
    no: '14',
    title: 'Social Media, Public Statements and Brand Use',
    points: [
      'Only authorized persons may issue official statements on behalf of Gen-Z IITian.',
      'Employees must not disclose confidential Company information through social media, videos, public communities or private groups.',
      'Use of the Gen-Z IITian name, logo, branding or official identity must be authorized.',
      'Personal opinions should not be presented as official Company positions.',
    ],
  },
  {
    no: '15',
    title: 'Payments, Compensation and Deductions',
    intro:
      "Compensation shall be governed by the employee's applicable offer, engagement terms or other written arrangement. Any deduction, recovery or notice-period adjustment shall be made only where authorized by applicable law and the relevant contractual/policy terms.",
    outro:
      'Nothing in this policy authorizes an unlawful deduction from wages or creates a financial penalty that is prohibited by law.',
  },
  {
    no: '16',
    title: 'Policy Violations and Disciplinary Action',
    intro:
      "Depending on the nature and seriousness of a violation, Gen-Z IITian may take appropriate action consistent with the employee's applicable agreement and law.",
    points: [
      'Written warning or corrective direction.',
      'Restriction or removal of access to Company systems.',
      'Suspension of specific responsibilities where permitted.',
      'Termination or other employment action where legally and contractually permitted.',
      'Recovery of Company property or confidential information.',
      'Pursuit of appropriate civil, contractual or other remedies where a legal basis exists.',
    ],
    outro:
      'The Company will consider the facts, severity, evidence and applicable contractual/legal requirements before taking disciplinary or legal action.',
  },
  {
    no: '16A',
    title: 'Compensation for Breach',
    tone: 'danger',
    intro:
      "Where an employee commits a material breach of this policy \u2014 including breach of confidentiality, misuse of Company Materials or student data, diversion of students, leads or business opportunities, unauthorized competing activity, or departure without serving the applicable notice period \u2014 the employee shall be liable to compensate Gen-Z IITian in a sum equal to three (3) months of the employee's last drawn compensation.",
    points: [
      "The parties agree that loss arising from such a breach is difficult to quantify precisely, and that a sum equal to three (3) months of last drawn compensation is a genuine pre-estimate of the loss Gen-Z IITian would suffer, and not a penalty.",
      'This amount is the maximum recoverable under this clause. Gen-Z IITian may claim the whole or any part of it, and a court or competent authority may award such reasonable compensation as it considers appropriate, not exceeding this amount.',
      'This clause is in addition to, and not in substitution for, the remedies in Section 16, including injunctive relief, recovery of Company property and any other remedy available in law or under the applicable agreement.',
      'Any recovery shall be made as a claim against the employee. Nothing in this clause authorizes a deduction from wages that is not permitted by applicable law, and any set-off against dues shall be made only where lawful and contractually permitted.',
    ],
    outro:
      'This clause shall be enforced only to the extent permitted by applicable law, including Section 74 of the Indian Contract Act, 1872, and shall be read down to the minimum extent necessary rather than treated as void.',
  },
  {
    no: '17',
    title: 'Reporting and Investigation',
    points: [
      'Employees may report suspected policy violations to management through the designated official communication channel.',
      'Employees must cooperate honestly with legitimate internal investigations.',
      'Records relevant to a reported dispute should not be knowingly destroyed, altered or concealed.',
      'The Company may review relevant Company systems and records as permitted by law.',
    ],
  },
  {
    no: '18',
    title: 'No Retaliation',
    intro:
      'Good-faith reporting of a suspected policy violation will not, by itself, be treated as misconduct. Retaliation, knowingly false allegations or deliberate misuse of the reporting process may themselves constitute policy violations.',
  },
  {
    no: '19',
    title: 'Amendments and Updates',
    intro:
      "Gen-Z IITian may update this policy from time to time to reflect operational, technological, legal or organizational changes. Material changes should be communicated through an appropriate Company channel. Where an amendment changes an employee's contractual rights or obligations, the Company will obtain any acceptance or documentation required by applicable law or the relevant agreement.",
  },
  {
    no: '20',
    title: 'Governing Law and Severability',
    intro:
      'This policy shall be interpreted consistently with applicable law. If any provision is found to be invalid or unenforceable, that provision shall be limited or severed to the minimum extent necessary, and the remaining provisions shall continue to the extent legally permitted.',
    outro:
      'Where an employee has a separate written employment or engagement agreement, the specific agreement and applicable law will govern in the event of a direct inconsistency, unless the documents expressly provide otherwise.',
  },
];

export default function EmployeePolicy() {
  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = 'Employee Policy | Gen-Z IITian';
  }, []);

  return (
    <div className="min-h-screen bg-white text-[#0b1120] font-sans selection:bg-blue-100">
      <div className="max-w-4xl mx-auto px-6 py-24">
        <div className="mb-16">
          <p className="text-[#10b981] font-black tracking-widest uppercase text-sm mb-3">Gen-Z IITian</p>
          <h1 className="text-4xl lg:text-5xl font-black text-[#0b1120] mb-4">Employee Policy</h1>
          <p className="text-gray-500 font-bold">
            Educators, Tutors, Content Contributors &amp; Team Members
          </p>
          <p className="text-gray-400 font-bold text-sm mt-2">Last Updated: September 2026</p>
          <div className="h-1.5 w-24 bg-[#10b981] mt-6 rounded-full"></div>
        </div>

        <div className="space-y-12 text-lg text-gray-600 font-medium leading-relaxed">
          <section className="p-8 bg-amber-50 border-[3px] border-amber-100 rounded-[2rem]">
            <h2 className="text-xl font-black text-amber-700 mb-3">Important</h2>
            <p className="text-gray-700">
              This policy is intended to establish clear workplace, confidentiality, conduct, notice and
              business-protection standards. It should be read together with any individual employment/engagement
              letter or other written agreement. Where a provision is not legally enforceable, it shall apply only to
              the maximum extent permitted by applicable law.
            </p>
          </section>

          <section className="p-8 bg-[#0b1120] text-white rounded-[2rem]">
            <h2 className="text-2xl font-black mb-4 flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 text-white text-sm">
                03
              </span>
              Onboarding, Employee ID and Policy Acceptance
            </h2>
            <p className="text-emerald-300 font-black mb-4">
              If you hold a Gen-Z IITian Employee ID, you have formally accepted this policy. By accepting your first
              payment from Gen-Z IITian, you legally accept these terms.
            </p>
            <div className="space-y-4 text-white/80 font-medium">
              <p>
                Before or at the commencement of an employee's engagement, Gen-Z IITian may issue an Employee ID and
                provide this policy through its onboarding system, email, dashboard or other documented channel.
              </p>
              <p>
                Where the onboarding process expressly requires acknowledgement of this policy, the employee's recorded
                acknowledgement, acceptance through the onboarding system, electronic acceptance, signature, or other
                documented acceptance shall constitute evidence that the employee received and accepted the policy. The
                issue of an Employee ID, and the acceptance of any payment from Gen-Z IITian, are each treated as
                documented acceptance of this policy.
              </p>
              <p>
                Employee ID generation and commencement of payment may form part of the onboarding process, but the
                exact contractual status of the relationship shall be determined by the applicable
                employment/engagement documents and applicable law.
              </p>
              <p>
                Employees are responsible for reading the policy and raising questions before accepting it. Continued
                engagement after documented acceptance may also be relevant where permitted by applicable law and the
                applicable agreement.
              </p>
            </div>
          </section>

          {SECTIONS.map((section) => (
            <section
              key={section.no}
              className={
                section.tone === 'danger'
                  ? 'p-8 bg-red-50 border-[3px] border-red-100 rounded-[2rem]'
                  : undefined
              }
            >
              <h2
                className={`text-2xl font-black mb-4 flex items-center gap-3 ${
                  section.tone === 'danger' ? 'text-red-600' : 'text-[#0b1120]'
                }`}
              >
                <span
                  className={`flex items-center justify-center w-8 h-8 rounded-lg text-sm shrink-0 px-1 ${
                    section.tone === 'danger'
                      ? 'bg-white text-red-600 shadow-sm'
                      : 'bg-[#eef2ff] text-[#0b1120]'
                  }`}
                >
                  {section.no}
                </span>
                {section.title}
              </h2>
              {section.intro && (
                <p className={`mb-4 ${section.tone === 'danger' ? 'text-gray-700 font-bold' : ''}`}>
                  {section.intro}
                </p>
              )}
              {section.points && (
                <ul className={`space-y-3 mb-4 ${section.tone === 'danger' ? 'text-gray-700' : ''}`}>
                  {section.points.map((point, i) => (
                    <li key={i} className="flex gap-3">
                      <span
                        className={`mt-2.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                          section.tone === 'danger' ? 'bg-red-400' : 'bg-[#10b981]'
                        }`}
                      ></span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              )}
              {section.outro && (
                <p className={section.tone === 'danger' ? 'text-gray-700' : undefined}>{section.outro}</p>
              )}
            </section>
          ))}

          <section className="p-8 bg-gray-50 border-[3px] border-gray-100 rounded-[2rem]">
            <h2 className="text-2xl font-black text-[#0b1120] mb-4 flex items-center gap-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-white text-[#0b1120] shadow-sm text-sm">
                21
              </span>
              Employee Acknowledgement and Acceptance
            </h2>
            <div className="space-y-4 text-gray-700">
              <p>
                I acknowledge that I have received, read and understood the Gen-Z IITian Employee Policy. I have had the
                opportunity to raise questions regarding the policy and understand that compliance with applicable
                policies and my individual employment/engagement terms is a condition of my association with Gen-Z
                IITian.
              </p>
              <p>
                I understand in particular my obligations concerning confidentiality, Company materials, student
                information, conflicts of interest, resignation/notice, handover, Company systems and any applicable
                restrictions on competing activity.
              </p>
              <p>
                I understand that the specific terms applicable to my role may also be set out in my offer letter,
                employment/engagement agreement or other written document.
              </p>
              <p>
                I understand that a material breach of this policy may render me liable to compensate Gen-Z IITian in a
                sum of up to three (3) months of my last drawn compensation, as set out in Section 16A.
              </p>
              <p className="font-black text-[#0b1120]">
                I understand that holding a Gen-Z IITian Employee ID constitutes my formal acceptance of this policy,
                and that accepting my first payment from Gen-Z IITian constitutes my legal acceptance of these terms.
              </p>
            </div>
          </section>

          <div className="text-center text-gray-400 font-black tracking-widest uppercase text-sm">
            End of Policy
          </div>

          <div className="p-8 bg-[#f8fafc] border-2 border-dashed border-gray-200 rounded-3xl mt-16 text-center">
            <p className="text-gray-500 font-bold mb-4">Questions about this policy?</p>
            <a href="/contact" className="text-[#10b981] font-black hover:underline">
              Contact Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
