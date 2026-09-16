export interface MasterFaq {
  question: string
  answer: string
  order: number
}

export const MASTER_FAQS: MasterFaq[] = [
  {
    question: 'What is the difference between PLUS and PRO Batch?',
    answer:
      'PLUS Batch includes full access to recorded lectures, course materials, and practice resources. PRO Batch includes everything in PLUS, plus direct entry to Live Classes, interactive Q&A sessions with teachers, and priority 1:1 doubt support.',
    order: 0,
  },
  {
    question: 'Can I upgrade from PLUS to PRO later?',
    answer:
      "Yes, you can upgrade at any time! Simply visit the course store, find your course, and choose the 'Upgrade to PRO' option which only charges the price difference.",
    order: 1,
  },
  {
    question: 'How long do I have access to the course?',
    answer:
      'Most courses provide access until the end of the academic term (e.g., End Term 1 or Term 2). You can view the exact validity and expiry date on your course card or details page.',
    order: 2,
  },
  {
    question: 'Is there a mobile app available?',
    answer:
      'Yes! The official Gen-Z IITian Android app is live and available for download. You can also access the full learning platform on any web browser at app.genziitian.in. An iOS app is currently in our roadmap.',
    order: 3,
  },
  {
    question: 'What payment methods do you accept?',
    answer:
      'We accept all major Credit/Debit cards, UPI (Google Pay, PhonePe, Paytm, BHIM), Net Banking, and popular Wallets through our secure Razorpay payment gateway.',
    order: 4,
  },
  {
    question: 'What should I do if my payment fails but money is deducted?',
    answer:
      "Don't worry! Usually, failed bank transactions are automatically refunded within 24 to 48 hours by your bank. If your enrolled course does not appear in your dashboard within 2 hours, please raise a support ticket with your transaction reference ID.",
    order: 5,
  },
  {
    question: 'Can I get a refund?',
    answer:
      "Refund policies vary by course. Generally, we offer a 2-day 'no questions asked' refund if you have not consumed more than 10% of the content. Please refer to our Return & Refund Policy for full terms.",
    order: 6,
  },
  {
    question: 'How do I access the Live Classes?',
    answer:
      "If you are enrolled in a PRO Batch, navigate to the 'Live' tab in your dashboard or mobile app. You will see upcoming class schedules and a 'Join Now' button whenever a session is live.",
    order: 7,
  },
  {
    question: 'Where can I find my course certificates?',
    answer:
      'Once you achieve 100% course completion and clear the final evaluation, your certificate will be automatically generated and available for download under your Profile or Course Details section.',
    order: 8,
  },
  {
    question: 'I forgot my password, how do I reset it?',
    answer:
      "We use Google Sign-In for streamlined and secure authentication. You don't need to remember a separate password—simply log in with your registered Google account. If needed, password recovery is managed directly through your Google account.",
    order: 9,
  },
  {
    question: 'Can I share my account with a friend?',
    answer:
      'No. Account sharing is strictly against our terms of service. Our security system monitors concurrent logins and abnormal device activity. Simultaneous unauthorized access may result in immediate and permanent account suspension.',
    order: 10,
  },
  {
    question: 'What are "Free Resources"?',
    answer:
      'Free Resources include curated demo lectures, formula sheets, revision notes, and previous year question papers (PYQs) accessible to all registered students at zero cost.',
    order: 11,
  },
  {
    question: 'How can I contact my instructor?',
    answer:
      "PRO Batch students can ask questions directly during interactive Live Classes or use the dedicated 'Doubt Support' feature inside each lesson. Our academic team reviews and responds to queries promptly.",
    order: 12,
  },
  {
    question: 'Do you provide offline access to videos and materials?',
    answer:
      'Due to copyright protection, lecture videos stream online. However, course PDFs, formula sheets, notes, and study materials can be downloaded for offline viewing directly inside the app and web.',
    order: 13,
  },
  {
    question: 'What is the "Community" tab?',
    answer:
      'The Community tab is a student collaboration forum where you can discuss concepts, share problem-solving strategies, solve PYQs together, and stay connected with fellow IITM BS peers.',
    order: 14,
  },
  {
    question: 'How do I track my study progress?',
    answer:
      'Your learning progress updates automatically across both web and mobile app. You can monitor your overall completion percentage on your main dashboard and view module-by-module progress inside each course.',
    order: 15,
  },
  {
    question: 'Are recordings available after a Live Class concludes?',
    answer:
      "Yes! High-definition recordings of every Live Class are processed and added to the 'Recorded' section of your course within 4 to 6 hours after the live session concludes.",
    order: 16,
  },
  {
    question: 'Can I change my registered email address?',
    answer:
      'Because course enrollments and academic records are tied to your student account, email updates require manual verification. Please raise a support ticket requesting an email change, and our team will assist you.',
    order: 17,
  },
  {
    question: 'What devices and browsers are recommended?',
    answer:
      'You can use our official Android app on mobile devices, or any modern web browser (Google Chrome, Microsoft Edge, Brave, Mozilla Firefox, or Safari) on desktop, laptop, or tablet.',
    order: 18,
  },
  {
    question: 'How do I report a technical bug or app issue?',
    answer:
      "Please raise a 'Technical Support' ticket under the Support section with a description and screenshot of the issue. Our technical team will investigate and resolve it as quickly as possible.",
    order: 19,
  },
]
