export const CURRENT_TOUR_VERSION = 1

export interface TourStep {
  id: string
  targetSelector: string
  title: string
  content: string
  route?: string // Page to navigate to if step requires cross-page navigation
  optional?: boolean // If true, skip if target element is not found in DOM
  placementPreference?: 'bottom' | 'top' | 'left' | 'right'
}

export const WEB_TOUR_STEPS: TourStep[] = [
  {
    id: 'dashboard-hero',
    targetSelector: '[data-tour="dashboard-hero"]',
    title: 'Your Dashboard',
    content: 'Welcome to GenZ IITIAN! View your enrolled courses, announcements, live class countdowns, and quick updates right here.',
    route: '/dashboard',
    placementPreference: 'bottom',
  },
  {
    id: 'sidebar-courses',
    targetSelector: '[data-tour="sidebar-courses"]',
    title: 'Courses & Enrolled Subjects',
    content: 'Click here to explore your active courses, video lectures, and downloadable lecture notes.',
    route: '/dashboard',
    placementPreference: 'right',
  },
  {
    id: 'courses-page-grid',
    targetSelector: '[data-tour="courses-page-grid"]',
    title: 'Lectures & Offline Downloads',
    content: 'Inside any course, you can stream recorded lectures and download study materials. Use the mobile app to read downloaded PDFs inside the app.',
    route: '/courses',
    optional: true,
    placementPreference: 'bottom',
  },
  {
    id: 'sidebar-academics',
    targetSelector: '[data-tour="sidebar-academics"]',
    title: 'Academics Hub',
    content: 'Find free study resources, term schedules, PYQs with step-by-step solutions, live session schedules, and formula sheets.',
    route: '/courses',
    placementPreference: 'right',
  },
  {
    id: 'sidebar-community',
    targetSelector: '[data-tour="sidebar-community"]',
    title: 'Student Community',
    content: 'Ask doubts, participate in subject discussions, and connect with fellow IIT Madras BS peers and senior mentors.',
    route: '/courses',
    placementPreference: 'right',
  },
  {
    id: 'sidebar-support',
    targetSelector: '[data-tour="sidebar-support"]',
    title: 'Support & Helpdesk',
    content: 'Raise a support ticket or live-chat with support staff whenever you need help with academic or platform issues.',
    route: '/courses',
    placementPreference: 'right',
    optional: true,
  },
  {
    id: 'sidebar-settings',
    targetSelector: '[data-tour="sidebar-settings"]',
    title: 'Settings & Tour Replay',
    content: 'Customize app themes, manage push notification alerts, and replay this guided tour anytime from Settings under Guidance!',
    route: '/courses',
    placementPreference: 'right',
  },
]

export const CAPACITOR_TOUR_STEPS: TourStep[] = [
  {
    id: 'mobile-dashboard-hero',
    targetSelector: '[data-tour="dashboard-hero"]',
    title: 'Your Dashboard',
    content: 'Welcome to the GenZ IITIAN mobile app! Track your schedule, announcements, and important updates here.',
    route: '/dashboard',
    placementPreference: 'bottom',
  },
  {
    id: 'nav-courses',
    targetSelector: '[data-tour="nav-courses"]',
    title: 'Enrolled Courses',
    content: 'Tap here to browse your enrolled subjects, video lectures, notes, and downloadable study resources.',
    route: '/dashboard',
    placementPreference: 'top',
  },
  {
    id: 'courses-page-grid',
    targetSelector: '[data-tour="courses-page-grid"]',
    title: 'Lectures & Downloads',
    content: 'Open any course to watch recorded lectures and download PDF notes. The mobile app can read downloaded PDFs offline.',
    route: '/courses',
    optional: true,
    placementPreference: 'bottom',
  },
  {
    id: 'nav-academics',
    targetSelector: '[data-tour="nav-academics"]',
    title: 'Academics Hub',
    content: 'Your quick access to exam schedules, free resources, live class sessions, and PYQs.',
    route: '/courses',
    placementPreference: 'top',
  },
  {
    id: 'nav-support',
    targetSelector: '[data-tour="nav-support"]',
    title: 'Support & Helpdesk',
    content: 'Get instant help with your academic or platform queries directly from our support team.',
    route: '/courses',
    placementPreference: 'top',
  },
  {
    id: 'nav-more',
    targetSelector: '[data-tour="nav-more"]',
    title: 'More & Settings Replay',
    content: 'Manage app preferences, theme settings, profile details, and replay this tour whenever you want!',
    route: '/courses',
    placementPreference: 'top',
  },
]
