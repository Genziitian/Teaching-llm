export interface PlatformQuery {
  id: string
  question: string
  answer: string
  category: 'COURSE_EXPIRY' | 'APP_VS_WEB' | 'BATCHES_ENROLLMENT' | 'EXAMS_TESTS' | 'LIVE_CLASSES' | 'SECURITY_ACCOUNTS' | 'PLATFORM_SYSTEM'
  appliesTo: 'BOTH' | 'APP_ONLY' | 'WEB_ONLY'
  order: number
  createdAt?: string
  updatedAt?: string
}

export const QUERY_CATEGORIES: { id: PlatformQuery['category']; label: string }[] = [
  { id: 'COURSE_EXPIRY', label: 'Course Expiry & Access' },
  { id: 'APP_VS_WEB', label: 'App vs Web Features' },
  { id: 'BATCHES_ENROLLMENT', label: 'Batches & Enrollments' },
  { id: 'EXAMS_TESTS', label: 'Exams & Evaluations' },
  { id: 'LIVE_CLASSES', label: 'Live Classes & Community' },
  { id: 'SECURITY_ACCOUNTS', label: 'Security & Device Limits' },
  { id: 'PLATFORM_SYSTEM', label: 'Platform & Operations' },
]

export const MASTER_QUERIES: Omit<PlatformQuery, 'id'>[] = [
  // ── 1. Course Expiry & Access ─────────────────────────────────────────────
  {
    question: 'What happens after a course expires? What can a student see?',
    answer:
      `When a course reaches its expiry date (expiresAt <= now):\n\n` +
      `1. On Web (/courses):\n` +
      `   • The course card appears in full grayscale (black & white filter) with dimmed opacity (85%).\n` +
      `   • A bold dark banner displaying "EXPIRED" is stamped across the top of the card.\n` +
      `   • The card becomes unclickable (default cursor, hover lift animations disabled).\n\n` +
      `2. On Mobile App (My Courses tab):\n` +
      `   • The access status badge turns red displaying "Access expired".\n\n` +
      `3. Direct URL Access (/courses/[id]):\n` +
      `   • An "Access Expired" blocking screen is displayed.\n` +
      `   • The message explicitly states: "Your access to [Course Name] has expired. You can no longer view the course lectures or materials."\n` +
      `   • All curriculum content, video lectures, PDFs, and notes are completely locked and hidden from the student.\n\n` +
      `4. Backend API Enforcement:\n` +
      `   • API endpoints (/api/courses/[id], /api/content, /api/classes) block access if the course is expired for non-manager roles.`,
    category: 'COURSE_EXPIRY',
    appliesTo: 'BOTH',
    order: 1,
  },
  {
    question: 'Can a Manager see and open expired courses?',
    answer:
      `YES. Managers have unrestricted system access:\n\n` +
      `• The system rule isCourseEffectivelyDisabled(course, userRole) explicitly returns false whenever userRole === 'MANAGER'.\n` +
      `• Managers can open any expired course, preview all video lectures, download PDFs, and inspect topics.\n` +
      `• In the Course Edit dialog under /manage, a Manager can modify or extend the "Course Expiry Date" (expiresAt) or clear it entirely. As soon as a manager extends the date, access is instantly restored for all enrolled students across both Web and Mobile App.\n` +
      `• If you are reusing the course for a new batch and do NOT want old students back, use "Remove all enrolled students" on the course row in /manage first (export CSV backup optional, then 3 confirmation steps).`,
    category: 'COURSE_EXPIRY',
    appliesTo: 'BOTH',
    order: 2,
  },
  {
    question: 'How do I reuse a course for a new batch without giving old students access again?',
    answer:
      `Extending expiry alone restores access for everyone still enrolled. To reuse a course cleanly:\n\n` +
      `1. On /manage → Courses, click the "Remove all enrolled students" button (user-minus icon) on that course.\n` +
      `2. Step 1 of 3: optionally Export enrollment CSV as a backup, then continue.\n` +
      `3. Step 2 of 3: type the exact course name.\n` +
      `4. Step 3 of 3: type the course name again AND type "REMOVE ALL ENROLLMENTS", then confirm.\n\n` +
      `This permanently deletes Enrollment rows for that course and queues Google Group REMOVE jobs. The course content stays. Then set the new expiry / re-enable and enroll only the new batch.\n` +
      `Demo Course enrollments cannot be bulk-cleared.`,
    category: 'COURSE_EXPIRY',
    appliesTo: 'BOTH',
    order: 3,
  },
  {
    question: 'Is there a course grace period in our code?',
    answer:
      `Yes, the platform contains a built-in grace period logic:\n\n` +
      `• The helper isCourseInGracePeriod in src/lib/course-state.ts defines a 3-day post-expiry window (expiresAt + 3 days).\n` +
      `• In src/lib/auth.ts, queries retain a 4-day buffer (expiresAt > now - 4 days) to maintain background session hydration without crashing.\n` +
      `• However, student-facing UI and APIs enforce content blocking as soon as expiresAt has passed to maintain strict academic integrity.`,
    category: 'COURSE_EXPIRY',
    appliesTo: 'BOTH',
    order: 4,
  },

  // ── 2. App vs Web Features ────────────────────────────────────────────────
  {
    question: 'Which platform features apply to Mobile App ONLY?',
    answer:
      `The following features are native to the Android Mobile App:\n\n` +
      `1. Screen Recording & Screenshot Blocking (FLAG_SECURE):\n` +
      `   • Android native shell enforces PrivacyScreen / FLAG_SECURE so students cannot record screens or capture screenshots of paid video lectures and notes.\n\n` +
      `2. In-App APK Updater:\n` +
      `   • Automatically checks for the newest APK release from GitHub/Supabase and prompts an in-app update modal with direct download.\n\n` +
      `3. Native Local Asset Caching (Capacitor Filesystem):\n` +
      `   • Heavy assets (logos, mascots, banners) are stored directly in device storage to prevent white screen delays.\n\n` +
      `4. Two-Stage Splash Screen with Mascot:\n` +
      `   • Step 2 of the splash sequence (full-bleed mascot screen with 2.5s skip button) only executes on native mobile app.\n\n` +
      `5. Offline File Downloads:\n` +
      `   • Downloaded study materials and notes are stored into native device filesystem storage for rapid offline viewing.`,
    category: 'APP_VS_WEB',
    appliesTo: 'APP_ONLY',
    order: 4,
  },
  {
    question: 'Which platform features apply to Web ONLY (Browser)?',
    answer:
      `The following features are currently exclusive to the Web platform:\n\n` +
      `1. Student Transactions View (/my-transactions):\n` +
      `   • Configured with desktopOnly: true in Sidebar navigation, designed for full-size receipt viewing and desktop printing.\n\n` +
      `2. Full Manager Back-Office Tables:\n` +
      `   • Advanced bulk uploads, user role assignments, sync queues, and database audit logs are tailored for desktop browser viewports.\n\n` +
      `3. Instant Splash Bypass:\n` +
      `   • Desktop browsers bypass Step 2 (mascot graphic) of the splash overlay so desktop users jump directly to their dashboard.`,
    category: 'APP_VS_WEB',
    appliesTo: 'WEB_ONLY',
    order: 5,
  },
  {
    question: 'Which platform features work on BOTH Mobile App and Web?',
    answer:
      `The core learning experience is 100% synchronized across both App and Web:\n\n` +
      `• Google OAuth & JWT Authentication (single account works anywhere).\n` +
      `• Course Curriculum & Video Player (YouTube embed with anti-scraping overlay).\n` +
      `• Study materials: website downloads; the mobile app can view downloaded PDFs in-app. The website has no PDF preview.\n` +
      `• Live Classes (Agora RTC interactive video/audio with real-time room entry).\n` +
      `• Community Chat (Server-Sent Events SSE real-time messaging with attachment sharing).\n` +
      `• Push Notifications (FCM for native mobile, VAPID Web Push for desktop/browsers).\n` +
      `• Helpdesk & Support Tickets (ticket creation, replies, photo attachment, status tracking).\n` +
      `• Dark Mode & Neumorphic UI theme persistence.`,
    category: 'APP_VS_WEB',
    appliesTo: 'BOTH',
    order: 6,
  },

  // ── 3. Batches & Enrollments ──────────────────────────────────────────────
  {
    question: 'What is the difference between PLUS and PRO Batch?',
    answer:
      `Our courses have two batch levels:\n\n` +
      `• PLUS Batch (Standard/Recorded):\n` +
      `  - Full access to all recorded video lectures, topic modules, and downloadable PDF notes.\n` +
      `  - Access to course practice tests and quizzes.\n` +
      `  - Does NOT include entry into live interactive classrooms.\n\n` +
      `• PRO Batch (Live + Recorded):\n` +
      `  - Everything included in the PLUS batch.\n` +
      `  - Direct entry to Live Interactive Classes (Agora RTC video/audio).\n` +
      `  - Real-time Q&A with teachers and priority 1:1 doubt support.\n` +
      `  - Recorded archives of live sessions automatically added after class concludes.`,
    category: 'BATCHES_ENROLLMENT',
    appliesTo: 'BOTH',
    order: 7,
  },
  {
    question: 'How does upgrading from PLUS to PRO work?',
    answer:
      `Students enrolled in a PLUS Batch can upgrade to PRO at any time:\n\n` +
      `1. On the course card or course details page, an "Upgrade to PRO" button is displayed if a liveUpgradePrice is set by the manager.\n` +
      `2. Clicking upgrade opens the Razorpay payment gateway charging only the upgrade price difference.\n` +
      `3. Upon payment success, the backend updates the enrollment type to PRO immediately without losing any course progress or lecture history.`,
    category: 'BATCHES_ENROLLMENT',
    appliesTo: 'BOTH',
    order: 8,
  },
  {
    question: 'What is a Course Bundle vs an Individual Course?',
    answer:
      `• An Individual Course is a single subject container with its own topics, lectures, and materials.\n` +
      `• A Course Bundle (CourseBundle) is a grouped package of multiple courses (e.g., "Term 1 All Subjects" or "Foundation Level Bundle").\n` +
      `• When a student purchases or is assigned to a bundle via UserCourseBundleAssignment, the system automatically grants them active enrollments in all linked courses (CourseBundleCourse).`,
    category: 'BATCHES_ENROLLMENT',
    appliesTo: 'BOTH',
    order: 9,
  },

  // ── 4. Exams & Evaluations ────────────────────────────────────────────────
  {
    question: 'How do Exam timers and auto-submission work?',
    answer:
      `Exam attempts are enforced strictly by server-side synchronization:\n\n` +
      `1. Individual Timer: Each exam has a durationMinutes. Once a student clicks Start Exam, an attempt is created with startedAt.\n` +
      `2. Global Deadline: An exam also has a hard deadline (expiresAt).\n` +
      `3. Auto-Submit Rule: If either now > startedAt + durationMinutes OR now > exam.expiresAt:\n` +
      `   • checkAndAutoSubmitAttempts automatically closes and submits the exam.\n` +
      `   • Any unsubmitted answers currently entered in the browser/app are committed to the database.\n` +
      `4. Grading: MCQs and MSQs are auto-evaluated instantly. Subjective questions are marked for teacher review.`,
    category: 'EXAMS_TESTS',
    appliesTo: 'BOTH',
    order: 10,
  },
  {
    question: 'Can students retake an exam or see solutions immediately?',
    answer:
      `• Single Attempt Default: Students are limited to 1 attempt per exam unless explicitly configured or reset by a Manager in the admin portal.\n` +
      `• Solution Visibility: Exam questions and answers remain hidden while an exam is active to prevent answer leaks. Managers can choose to publish solutions and scorecards after the global exam deadline has passed.`,
    category: 'EXAMS_TESTS',
    appliesTo: 'BOTH',
    order: 11,
  },
  {
    question: 'What are the homework submission limits, and are they the same in the App and on the website?',
    answer:
      `Students can submit or update homework while submissions are open and before the due date. Updating a submission replaces the student's previous files and note. There is no homework-specific daily submission count or file-count cap in the current submission flow.\n\n` +
      `The upload restrictions differ by platform:\n` +
      `• Website: up to 15 MB per file. The submission API accepts PDF, JPG/JPEG, PNG, DOC/DOCX, and ZIP. Multiple files can be selected; no maximum file count is set.\n` +
      `• Android App: up to 20 MB per file. The picker accepts JPG/JPEG/PNG/WEBP photos and PDF, DOC/DOCX, PPT/PPTX, XLS/XLSX, and ZIP documents. Multiple files can be attached; no maximum file count is set.\n` +
      `• The general API throttle still applies: up to 20 write requests per minute per account. App uploads use one request per file plus a submission request.`,
    category: 'EXAMS_TESTS',
    appliesTo: 'BOTH',
    order: 12,
  },

  // ── 5. Live Classes & Community ───────────────────────────────────────────
  {
    question: 'How do Live Classes work? Who is allowed to join?',
    answer:
      `• Live classes use Agora RTC real-time video/audio streaming.\n` +
      `• Only students with active PRO Batch enrollment can generate an Agora join token (/api/agora/token) and enter the live room.\n` +
      `• PLUS batch students attempting to enter see an upgrade banner prompting them to join PRO.\n` +
      `• Upcoming classes appear on the student dashboard in Indian Standard Time (IST). Live sessions trigger live pulse badges when active.`,
    category: 'LIVE_CLASSES',
    appliesTo: 'BOTH',
    order: 13,
  },
  {
    question: 'How does real-time Community Chat work?',
    answer:
      `• Community chat is divided into course-specific channels.\n` +
      `• The system uses Server-Sent Events (SSE) via /api/community/[courseId]/messages/stream.\n` +
      `• Unlike conventional polling which overloads the database, SSE holds a lightweight streaming connection so new messages and reactions appear instantly (<50ms) across all devices.\n` +
      `• Image attachments are supported with secure thumbnail previews and image modal zoom.`,
    category: 'LIVE_CLASSES',
    appliesTo: 'BOTH',
    order: 14,
  },
  {
    question: 'Are Community message and attachment limits the same in the App and on the website?',
    answer:
      `Yes. The App and website use the same server-side limits for course-specific communities, and activity is counted together across both platforms and all course channels for the same student:\n\n` +
      `• Up to 15 new posts and 20 replies/comments in a rolling 24-hour period. Posts can contain up to 500 characters; replies can contain up to 300 characters.\n` +
      `• Up to 10 community attachments in a rolling 24-hour period, with one attachment per message and a maximum file size of 20 MB. Supported formats include JPG, PNG, WEBP, PDF, Office documents, and ZIP.\n` +
      `• General Discussion currently does not use those course-community daily post, reply, and attachment caps. Uploads still share the platform-wide upload allowance of 30 attachments per day across community, direct-chat, and support replies.\n` +
      `• Support-ticket reply photos have a separate 5 MB limit and accept JPG, PNG, or WEBP on both App and website.\n` +
      `• A separate platform throttle allows up to 20 write requests per minute per account. It applies to App and website API writes. These limits are server-enforced, so switching devices or platforms does not reset them.`,
    category: 'LIVE_CLASSES',
    appliesTo: 'BOTH',
    order: 15,
  },

  // ── 6. Security & Device Limits ───────────────────────────────────────────
  {
    question: 'Can a student share their account or log in on multiple devices?',
    answer:
      `NO. The system enforces strict single-user device security:\n\n` +
      `1. Token Version Tracking: Each user profile has a tokenVersion counter in PostgreSQL. When a user logs in or resets credentials, the counter increments, instantly invalidating any older JWT tokens on other phones or laptops.\n` +
      `2. Security Violation Counter: The system logs concurrent anomalous activity (violationCount).\n` +
      `3. Account Termination: If a user is flagged for abuse or sharing, a Manager can terminate the account (isTerminated: true). Edge Middleware instantly drops all requests from terminated users and routes them to /terminated.`,
    category: 'SECURITY_ACCOUNTS',
    appliesTo: 'BOTH',
    order: 16,
  },
  {
    question: 'What is Maintenance Mode and how does it affect users?',
    answer:
      `Maintenance Mode is a global platform kill-switch managed in Upstash Redis (MAINTENANCE_KEY):\n\n` +
      `• When activated by a Manager, all students and instructors are redirected to the /maintenance wall with a real-time status message.\n` +
      `• Critical Exception: Users with the MANAGER or ADMIN role completely bypass the maintenance wall, allowing administrators to inspect issues, run migrations, and test fixes without any downtime disruption to staff.`,
    category: 'SECURITY_ACCOUNTS',
    appliesTo: 'BOTH',
    order: 17,
  },

  // ── 7. Platform & Operations ──────────────────────────────────────────────
  {
    question: 'What timezone does the entire platform operate on?',
    answer:
      `The entire platform is standardized to Indian Standard Time (Asia/Kolkata - IST / UTC+05:30):\n\n` +
      `• All live class start times, exam deadlines, announcement schedules, and daily session snapshots are calculated and formatted in IST using src/lib/date-utils.ts.\n` +
      `• While PostgreSQL stores timestamps in UTC, all business logic and frontend UI displays convert to IST automatically.`,
    category: 'PLATFORM_SYSTEM',
    appliesTo: 'BOTH',
    order: 18,
  },
  {
    question: 'How do Support Tickets work?',
    answer:
      `• Students can submit support tickets categorized under Academic, Technical, or Billing queries.\n` +
      `• Tickets are private: visible only to the student who created them and assigned Managers/Admins.\n` +
      `• Managers can reply, attach screenshots, reassign priority (LOW, MEDIUM, HIGH), and update ticket status (OPEN, IN_PROGRESS, RESOLVED, CLOSED).`,
    category: 'PLATFORM_SYSTEM',
    appliesTo: 'BOTH',
    order: 19,
  },
  {
    question: "How does a student pay for a course or bundle in the App vs on the website?",
    answer:
      `Paying is different on each platform, but the result is the same (the student is enrolled and an order is saved):
` +
      `
` +
      `• Website: Razorpay. Coupons can be used.
` +
      `• Android App: Google Play Billing only. Prices are fixed, coupons are not applied inside the app.
` +
      `
` +
      `How the App flow works:
` +
      `1. The app asks the server to create an order (create-order with playMode).
` +
      `2. The server returns the amount and a Play product id named course_<rupees> (example: course_999 for Rs 999).
` +
      `3. The student pays in the Google Play sheet.
` +
      `4. The server checks the purchase with Google (/api/play/verify-course-purchase), marks the order SUCCESS and enrolls the student exactly like Razorpay does.
` +
      `
` +
      `IMPORTANT: every distinct price you set must exist as a one-time (consumable) product in Google Play Console named course_<price>. If the product is missing the purchase fails and nobody is charged. Notes work the same way with note_<price>.
` +
      `
` +
      `Why we did this: Google requires Play Billing for digital content bought inside the Android app.`,
    category: 'PLATFORM_SYSTEM',
    appliesTo: 'BOTH',
    order: 20,
  },
  {
    question: "Where can I see whether a purchase was paid through Google Play or Razorpay?",
    answer:
      `Every transaction now carries a payment source tag:
` +
      `
` +
      `• Google Play: the payment id starts with GPA. (or play_).
` +
      `• Razorpay: everything else.
` +
      `
` +
      `Where it shows:
` +
      `• Manager > Transactions: a blue GOOGLE PLAY badge on Play purchases. Other rows keep the existing In-app or External web badge.
` +
      `• Student website > My Transactions: a Google Play or Razorpay tag next to the order id.
` +
      `• App > Academics > Purchase History: a Google Play or Razorpay tag on each row.
` +
      `
` +
      `Notes: this needs no database change. It only tells the source for new Play purchases; old orders show as Razorpay because they never had Play ids.
` +
      `
` +
      `Why we did this: so you can quickly tell where money came from when a student writes about a payment.`,
    category: 'PLATFORM_SYSTEM',
    appliesTo: 'BOTH',
    order: 21,
  },
  {
    question: "What does the App Purchase History screen show?",
    answer:
      `Academics > Purchase History lists every successful purchase made with the student's account, whether it was bought in the app or on the website: courses, bundles, premium notes, upgrades, mentorship and test series.
` +
      `
` +
      `Each row shows an icon, the title, type and date, a Google Play or Razorpay tag, 'Paid', and the amount. Pull down to refresh.
` +
      `
` +
      `Before this change the screen showed premium notes only. Old purchases appear too if the server still has them (it reads the same data as the website My Transactions page).`,
    category: 'APP_VS_WEB',
    appliesTo: 'APP_ONLY',
    order: 22,
  },
  {
    question: "Why do students only see the Live Pro price on a fixed bundle, with no option to choose Recorded or Champion?",
    answer:
      `Almost always the bundle is set to Force Class Type = Force Live Classes.
` +
      `
` +
      `Where: Manage > Bundles > Edit Bundle > Force Class Type (only for fixed bundles, i.e. when students cannot pick individual courses).
` +
      `
` +
      `What each value does:
` +
      `• Let user choose: students see every plan that has a price (Recorded, Live Pro, Champion).
` +
      `• Force Recorded / Live / Champion: students can only buy that one plan, no matter how many prices you entered.
` +
      `
` +
      `To fix: open the bundle, set Force Class Type to 'Let user choose', save. The form now loads the real saved value and shows a warning when a force is on. Before this fix the form always displayed 'Let user choose', so a forced bundle looked unforced.
` +
      `
` +
      `A plan only appears if its price is above 0. The same rule applies on the website and in the app.`,
    category: 'BATCHES_ENROLLMENT',
    appliesTo: 'BOTH',
    order: 23,
  },
  {
    question: "What are the three plans (Recorded, Live Pro, Champion) and what does each include?",
    answer:
      `We have exactly three plans:
` +
      `
` +
      `• Recorded: lectures, course materials, class recordings, standard support. No live classes.
` +
      `• Live Pro: everything in Recorded plus direct entry to live classes, live Q&A with the teacher and 24/7 priority support.
` +
      `• Champion: everything in Live Pro plus weekly tests and evaluation, 1-to-1 mentorship, and a full refund or free reattempt support when the student meets the conditions.
` +
      `
` +
      `Champion conditions (shown to students as Terms & Conditions before paying):
` +
      `• Attend at least 80% of live classes.
` +
      `• Score the minimum required marks in the weekly tests.
` +
      `• Regularly share GA marks/progress with the team and be eligible to give the Qualifier exam offline.
• If the student does not qualify, the refund is only the extra amount paid for Champion: Champion price minus Live Pro price (example: 1499 - 999 = Rs 500). The Live Pro price is not refunded.
` +
      `
` +
      `Champion shows only when the course or bundle has a Champion price. Names are the same everywhere: Recorded, Live Pro, Champion (older labels like 'Recorded Plus' and 'Live Batch' were renamed).
` +
      `
` +
      `Where it is shown: website (details screen comparison table with a Champion column, plan cards, a 'Champion terms and conditions' popup) and app (Choose batch page and the Review and pay page).`,
    category: 'BATCHES_ENROLLMENT',
    appliesTo: 'BOTH',
    order: 24,
  },
  {
    question: "How does the App Buy Course flow work, step by step?",
    answer:
      `Store > Buy Course in the app follows the same data as the website store:
` +
      `
` +
      `1. Choose your term (level): cards per level (Foundation, Diploma, Qualifier and so on).
` +
      `2. Level page: bundles and single courses for that level, each with 'Details' and 'Buy now'.
` +
      `3. Bundle page in 3 steps:
` +
      `   Step 1, Choose courses: banner, 'What you get', then the course list. Nothing is pre-selected. Fixed bundles show a lock notice and all courses are included automatically.
` +
      `   Step 2, Choose batch: Recorded, Live Pro (and Champion if priced). The student must pick one, nothing is auto-selected. The Live vs Recorded comparison is shown under the plans. Skipped when the bundle has only one plan.
` +
      `   Step 3, Review and pay: order summary, included points, Champion terms (only for Champion), the 'I agree to the Terms & Conditions and Refund Policy' checkbox, then 'Pay now' (Google Play). The button says 'Accept terms to pay' until the box is ticked.
` +
      `4. Fixed bundles show only the total price, not per-course prices. Bundles where students pick courses show a price per course.
` +
      `
` +
      `After paying the student lands on the Courses tab. The 'i' button in the Buy Course header explains where enrolled courses live.`,
    category: 'APP_VS_WEB',
    appliesTo: 'APP_ONLY',
    order: 25,
  },
  {
    question: "What is the 'What you get' box on a bundle or course and where does it show?",
    answer:
      `Managers can write a short list of benefits (one point per line) for any bundle or course.
` +
      `
` +
      `• Set it: Edit Bundle / Create Bundle has a 'What you get' textarea. On the website details screen a manager also sees an 'Edit points' button.
` +
      `• Shows on: the website details screen and the app bundle page (Step 1) as check-marked points.
` +
      `• Stored in: the highlights field on CourseOffering and BundleOffering.
` +
      `
` +
      `Database note: needs these two columns once (already in the Prisma schema):
` +
      `ALTER TABLE "CourseOffering" ADD COLUMN IF NOT EXISTS "highlights" TEXT;
` +
      `ALTER TABLE "BundleOffering" ADD COLUMN IF NOT EXISTS "highlights" TEXT;`,
    category: 'BATCHES_ENROLLMENT',
    appliesTo: 'BOTH',
    order: 26,
  },
  {
    question: "What changed in the website store design (details screens, notes, bundle cards)?",
    answer:
      `Website store (/courses/explore) updates:
` +
      `
` +
      `• Details and Buy are full screen pages, not popups. Courses and bundles both have a 'View details' option.
` +
      `• Details screen: 'What you get', a Recorded vs Live Pro comparison (plus a Champion column when Champion is priced), 'Included with every purchase', and a sticky price and buy card.
` +
      `• Bundle cards are colour coded (indigo, green, amber, pink, sky) with 'View details' and 'Buy now' in one row.
` +
      `• Fixed bundle buy screen: big plan cards (Recorded, Live Pro, Champion) with prices; Champion shows a 'Read all' row that opens the terms in a popup.
` +
      `• Notes: category pills (General, Foundation, Qualifier...) with note counts replace the single big category card; the first category is selected automatically. Back buttons have an arrow icon.
` +
      `• Calendar page (desktop) was restyled.`,
    category: 'APP_VS_WEB',
    appliesTo: 'WEB_ONLY',
    order: 27,
  },
  {
    question: "How does the App Home screen decide between 'Live Now' and 'Upcoming Session'?",
    answer:
      `Home order: greeting, rotating banner, live/upcoming session card, shortcut tiles, announcements. The banner is always first, below the greeting.
` +
      `
` +
      `• If any class is live right now, the section is titled 'Live Now' and shows only live sessions (upcoming ones are hidden). The red card shows 'STARTED <time>' and a 'Join' button.
` +
      `• If nothing is live, the section is titled 'Upcoming Session' and shows the next class with its time and date.
` +
      `
` +
      `Live Sessions page: Upcoming and Past rows use the same card style as Home (video tile, time label, title, course and teacher). The active class button says 'Join now'.`,
    category: 'APP_VS_WEB',
    appliesTo: 'APP_ONLY',
    order: 28,
  },
  {
    question: "Checklist: what must be done after deploying the Google Play billing and store changes?",
    answer:
      `1. Run the SQL for highlights (see the 'What you get' entry) and run prisma generate, then deploy the website.
` +
      `2. Create one-time (consumable) products in Google Play Console named course_<price> for every distinct bundle and course price, and note_<price> for notes. Make sure the Play service account has permission to verify purchases.
` +
      `3. For every fixed bundle set Force Class Type to 'Let user choose' unless you really want one plan only.
` +
      `4. Rebuild the app fully (flutter clean, flutter pub get, flutter run or build appbundle). Hot reload is not enough.
` +
      `5. Test one purchase per source and confirm it shows in Manager > Transactions with the right tag, in the student's My Transactions and in the app Purchase History.`,
    category: 'PLATFORM_SYSTEM',
    appliesTo: 'BOTH',
    order: 29,
  },
]
