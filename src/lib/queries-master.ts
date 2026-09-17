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
      `• In the Course Edit dialog under /manage, a Manager can modify or extend the "Course Expiry Date" (expiresAt) or clear it entirely. As soon as a manager extends the date, access is instantly restored for all enrolled students across both Web and Mobile App.`,
    category: 'COURSE_EXPIRY',
    appliesTo: 'BOTH',
    order: 2,
  },
  {
    question: 'How does Trial or Demo Course Expiry work?',
    answer:
      `For courses marked with Demo access (isDemoEnabled: true and demoExpiryDays > 0):\n\n` +
      `• Expiry is calculated dynamically per student: now - enrollmentDate > demoExpiryDays.\n` +
      `• Once expired, the student sees a specialized "Demo Access Expired" blocking screen: "Your demo access to [Course Name] has expired. Unlock the full course to continue learning."\n` +
      `• A direct "Unlock Full Course" purchase button is presented, allowing the student to pay and upgrade to full enrollment immediately.`,
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
    order: 5,
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
    order: 6,
  },
  {
    question: 'Which platform features work on BOTH Mobile App and Web?',
    answer:
      `The core learning experience is 100% synchronized across both App and Web:\n\n` +
      `• Google OAuth & JWT Authentication (single account works anywhere).\n` +
      `• Course Curriculum & Video Player (YouTube embed with anti-scraping overlay).\n` +
      `• PDF Study Material Viewer (inline viewing of notes and formula sheets).\n` +
      `• Live Classes (Agora RTC interactive video/audio with real-time room entry).\n` +
      `• Community Chat (Server-Sent Events SSE real-time messaging with attachment sharing).\n` +
      `• Push Notifications (FCM for native mobile, VAPID Web Push for desktop/browsers).\n` +
      `• Helpdesk & Support Tickets (ticket creation, replies, photo attachment, status tracking).\n` +
      `• Dark Mode & Neumorphic UI theme persistence.`,
    category: 'APP_VS_WEB',
    appliesTo: 'BOTH',
    order: 7,
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
    order: 8,
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
    order: 9,
  },
  {
    question: 'What is a Course Bundle vs an Individual Course?',
    answer:
      `• An Individual Course is a single subject container with its own topics, lectures, and materials.\n` +
      `• A Course Bundle (CourseBundle) is a grouped package of multiple courses (e.g., "Term 1 All Subjects" or "Foundation Level Bundle").\n` +
      `• When a student purchases or is assigned to a bundle via UserCourseBundleAssignment, the system automatically grants them active enrollments in all linked courses (CourseBundleCourse).`,
    category: 'BATCHES_ENROLLMENT',
    appliesTo: 'BOTH',
    order: 10,
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
    order: 11,
  },
  {
    question: 'Can students retake an exam or see solutions immediately?',
    answer:
      `• Single Attempt Default: Students are limited to 1 attempt per exam unless explicitly configured or reset by a Manager in the admin portal.\n` +
      `• Solution Visibility: Exam questions and answers remain hidden while an exam is active to prevent answer leaks. Managers can choose to publish solutions and scorecards after the global exam deadline has passed.`,
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
    order: 15,
  },
  {
    question: 'What is Maintenance Mode and how does it affect users?',
    answer:
      `Maintenance Mode is a global platform kill-switch managed in Upstash Redis (MAINTENANCE_KEY):\n\n` +
      `• When activated by a Manager, all students and instructors are redirected to the /maintenance wall with a real-time status message.\n` +
      `• Critical Exception: Users with the MANAGER or ADMIN role completely bypass the maintenance wall, allowing administrators to inspect issues, run migrations, and test fixes without any downtime disruption to staff.`,
    category: 'SECURITY_ACCOUNTS',
    appliesTo: 'BOTH',
    order: 16,
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
    order: 17,
  },
  {
    question: 'How do Support Tickets work?',
    answer:
      `• Students can submit support tickets categorized under Academic, Technical, or Billing queries.\n` +
      `• Tickets are private: visible only to the student who created them and assigned Managers/Admins.\n` +
      `• Managers can reply, attach screenshots, reassign priority (LOW, MEDIUM, HIGH), and update ticket status (OPEN, IN_PROGRESS, RESOLVED, CLOSED).`,
    category: 'PLATFORM_SYSTEM',
    appliesTo: 'BOTH',
    order: 18,
  },
]
