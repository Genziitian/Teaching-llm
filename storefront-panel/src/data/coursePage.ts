import { supabase } from '../lib/supabase';

export const COURSE_PAGE_SETTINGS_KEY = 'course_page_content';

export type CoursePageTheme = 'old' | 'new';

export type FeedbackNote = {
  id: string;
  name: string;
  role: string;
  text: string;
  rating?: number;
};

export type CoursePageChoice = {
  videoUrl?: string;
  reviewIds?: string[];
  theme?: CoursePageTheme;
};

export type CoursePageSettings = {
  bank: FeedbackNote[];
  courses: Record<string, CoursePageChoice>;
  defaultVideoUrl?: string;
};

export const DEFAULT_FEEDBACK_BANK: FeedbackNote[] = [
  {
    id: 'aryan-sharma',
    name: 'Aryan Sharma',
    role: 'Qualifier batch',
    text: 'The mock pattern finally matched the real paper. I stopped guessing what to revise and just followed the weekly plan.',
    rating: 5,
  },
  {
    id: 'priya-patel',
    name: 'Priya Patel',
    role: 'Mathematics 2',
    text: 'Maths 2 used to feel scattered. The class order and the doubt hour after each topic made the hard weeks manageable.',
    rating: 5,
  },
  {
    id: 'rohan-das',
    name: 'Rohan Das',
    role: 'Diploma',
    text: 'I have stayed with Gen-Z IITian since the start of diploma. The notes are the part I actually reopen before a quiz.',
    rating: 5,
  },
  {
    id: 'sanya-verma',
    name: 'Sanya Verma',
    role: 'Foundation',
    text: 'I joined with almost no background. The batch is paced for beginners, and the practice sets tell you if you actually understood the class.',
    rating: 4,
  },
  {
    id: 'vikram-singh',
    name: 'Vikram Singh',
    role: 'Mathematics 2',
    text: 'The explanations stay on the concept, not on tricks. My quiz scores moved once I stopped skipping the practice discussion.',
    rating: 5,
  },
  {
    id: 'meera-iyer',
    name: 'Meera Iyer',
    role: 'Diploma',
    text: 'What helped was having one place for the recording, the notes, and someone to ask when a graded question did not match the lecture.',
    rating: 5,
  },
];

const DEFAULT_IDS = new Set(DEFAULT_FEEDBACK_BANK.map((note) => note.id));

function isFeedbackNote(value: unknown): value is FeedbackNote {
  if (!value || typeof value !== 'object') return false;
  const note = value as FeedbackNote;
  return Boolean(note.id && note.name && note.role && note.text);
}

export function parseCoursePageSettings(raw: string | null | undefined): CoursePageSettings {
  const empty: CoursePageSettings = {
    bank: DEFAULT_FEEDBACK_BANK,
    courses: {},
    defaultVideoUrl: '',
  };
  if (!raw) return empty;

  try {
    const parsed = JSON.parse(raw) as Partial<CoursePageSettings>;
    const storedBank = Array.isArray(parsed.bank) ? parsed.bank.filter(isFeedbackNote) : [];
    const byId = new Map(DEFAULT_FEEDBACK_BANK.map((note) => [note.id, note]));
    storedBank.forEach((note) => byId.set(note.id, note));

    const bank = [
      ...DEFAULT_FEEDBACK_BANK.map((note) => byId.get(note.id) || note),
      ...storedBank.filter((note) => !DEFAULT_IDS.has(note.id)),
    ];

    const courses: Record<string, CoursePageChoice> = {};
    if (parsed.courses && typeof parsed.courses === 'object') {
      Object.entries(parsed.courses).forEach(([id, choice]) => {
        if (!choice || typeof choice !== 'object') return;
        courses[id] = {
          videoUrl: typeof choice.videoUrl === 'string' ? choice.videoUrl : '',
          reviewIds: Array.isArray(choice.reviewIds)
            ? choice.reviewIds.filter((reviewId) => typeof reviewId === 'string')
            : [],
          theme: choice.theme === 'new' ? 'new' : 'old',
        };
      });
    }

    return {
      bank,
      courses,
      defaultVideoUrl: typeof parsed.defaultVideoUrl === 'string' ? parsed.defaultVideoUrl : '',
    };
  } catch {
    return empty;
  }
}

export function themeForCourse(
  settings: CoursePageSettings,
  courseId: string,
  course?: any
): CoursePageTheme {
  if (course?.design_theme === 'new' || course?.theme === 'new') return 'new';
  if (course?.design_theme === 'old' || course?.theme === 'old') return 'old';
  const chosen = settings.courses[courseId]?.theme;
  return chosen === 'new' ? 'new' : 'old';
}

export async function updateCourseTheme(courseId: string, theme: CoursePageTheme) {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', COURSE_PAGE_SETTINGS_KEY)
    .maybeSingle();
  const current = parseCoursePageSettings(data?.value);
  const next: CoursePageSettings = {
    ...current,
    courses: {
      ...current.courses,
      [courseId]: {
        ...(current.courses[courseId] || {}),
        theme,
      },
    },
  };
  const { error } = await supabase
    .from('settings')
    .upsert({ key: COURSE_PAGE_SETTINGS_KEY, value: JSON.stringify(next) });
  return { error, next };
}

export function reviewsForCourse(settings: CoursePageSettings, courseId: string) {
  const chosen = settings.courses[courseId]?.reviewIds;
  if (!chosen) return settings.bank.slice(0, 3);
  return chosen
    .map((id) => settings.bank.find((note) => note.id === id))
    .filter((note): note is FeedbackNote => Boolean(note));
}

export function videoForCourse(settings: CoursePageSettings, courseId: string) {
  return (settings.courses[courseId]?.videoUrl || settings.defaultVideoUrl || '').trim();
}

export type BatchFeature = {
  title: string;
  detail: string;
};

export function batchFeaturesFor(course: {
  courseCategory?: string | null;
  class_type?: string | null;
}): { primary: BatchFeature[]; more: BatchFeature[] } {
  const category = course.courseCategory || 'NONE';
  const live = category === 'LIVE' || course.class_type === 'live';
  const recorded = category === 'RECORDED';
  const qualifier = category === 'QUALIFIER';

  const primary: BatchFeature[] = [
    {
      title: live ? 'Classes on a fixed timetable' : 'Lessons you can replay',
      detail: live
        ? 'A live class is scheduled for the topic, so the week has a start and a finish.'
        : 'Each topic is uploaded as a recording you can pause and watch again.',
    },
    {
      title: 'Practice after the topic',
      detail: 'A short set goes up with the class so you test the idea before the next one.',
    },
    {
      title: 'A doubt hour on the plan',
      detail: 'Questions from the batch are taken in a separate session, not left in a comment thread.',
    },
    {
      title: 'Revision copy of the class',
      detail: 'The session stays on the dashboard after it is taught, for the weeks you need to revisit it.',
    },
  ];

  const more: BatchFeature[] = [
    {
      title: 'Notes on the same login',
      detail: 'Handouts and practice files are added to the class dashboard with the lesson.',
    },
    {
      title: 'Past questions in the plan',
      detail: 'Older quiz and assignment questions are discussed against the topic, not dumped as a folder.',
    },
    {
      title: 'A syllabus-shaped week',
      detail: 'The order follows the subject outline, so you are not jumping between unrelated weeks.',
    },
  ];

  if (qualifier) {
    more.unshift({
      title: 'Qualifier weeks kept together',
      detail: 'Coverage stays on the qualifier window, with drills before the attempt.',
    });
  }

  if (recorded && !live) {
    more.push({
      title: 'Watch on your own hours',
      detail: 'There is no live attendance for the lesson itself. The doubt hour is still on the calendar.',
    });
  }

  if (live) {
    more.push({
      title: 'Ask inside the live class',
      detail: 'If a step is unclear, you can raise it while the topic is being taught.',
    });
  }

  return { primary, more };
}

export function includedPointsFor(course: { courseCategory?: string | null }) {
  const points = [
    'Notes for each class are uploaded on the class dashboard.',
    'Practice for that class is added in the same place.',
    'Doubts from the batch are taken with a mentor, not only peer to peer.',
    'Dashboard access for this batch stays open through the exam window listed on the page.',
    'The price on this page is the batch fee. Your invoice separates the registration portion. Notes, recordings, and practice follow the batch you buy, and those details can differ from one batch to the next.',
  ];

  if (course.courseCategory === 'QUALIFIER') {
    points.splice(3, 0, 'Qualifier batches may carry a separate written offer. Read those terms on this page before you pay.');
  }

  return points;
}

export function faqFor(course: {
  name?: string;
  who?: string | null;
  courseCategory?: string | null;
  class_type?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}, formatDate: (value: string) => string) {
  const live = course.courseCategory === 'LIVE' || course.class_type === 'live';
  const recorded = course.courseCategory === 'RECORDED' || course.class_type === 'recorded';
  const start = course.startDate ? formatDate(course.startDate) : '';
  const end = course.endDate ? formatDate(course.endDate) : '';

  const timing = start && end
    ? `This batch is listed from ${start} to ${end}. The day-wise timetable is posted on the class dashboard after you enroll.`
    : start
      ? `Classes are listed to begin on ${start}. The day-wise timetable is posted on the class dashboard after you enroll.`
      : 'The day-wise timetable is posted on the class dashboard after you enroll. Start and end dates appear on this page when they are fixed.';

  return [
    {
      q: 'Why join this batch?',
      a: course.who?.trim()
        || `This batch is for students taking ${course.name || 'this subject'} who want a class order, practice after each topic, and a mentor hour for doubts.`,
    },
    {
      q: 'How do the classes run?',
      a: live
        ? 'You join the live class from the dashboard. The recording is kept afterwards so you can revise the same session.'
        : recorded
          ? 'Lessons are uploaded as recordings. You watch them on your own time, and a doubt hour is still scheduled for the batch.'
          : 'Classes are online. The dashboard has the session link or the recording, plus the notes for that class.',
    },
    {
      q: 'Can I download the classes?',
      a: 'Recordings stay on the class dashboard for students in the batch. Notes and practice files are uploaded there as well.',
    },
    {
      q: 'Which days and what time?',
      a: timing,
    },
    {
      q: 'How do doubts get answered?',
      a: 'Bring them to the doubt hour, or send them through the batch community. Mentors take subject questions from students enrolled in the batch.',
    },
    {
      q: 'What is the refund rule?',
      a: course.courseCategory === 'QUALIFIER'
        ? 'Digital access starts after payment, so a normal purchase is final. Qualifier batches can include a separate written offer. Open “Offer terms” on this page and read it before you enroll. Duplicate charges are checked by support at help@genziitian.in.'
        : 'Access is digital and starts after a successful payment, so a completed purchase is final and cannot be cancelled. If you were charged twice for the same batch, write to help@genziitian.in and the extra charge is reviewed.',
    },
  ];
}
