// Fixed lists for the Manage > Courses form: course type -> subjects. Exam stage already exists (examCycle).
export const COURSE_TYPES = ['Foundation', 'Diploma', 'Re-attempt', 'Qualifier', 'Crash course', 'Fastrack'] as const

const CORE_SUBJECTS = ['Math 1', 'Stats 1', 'English 1', 'CT']
const EXTRA_SUBJECTS = ['Math 2', 'Stats 2', 'English 2', 'Python']

/** Subjects offered for a type. null = no fixed list (Diploma), so the form shows a free text box. */
export function subjectsFor(type?: string | null): string[] | null {
  if (type === 'Foundation' || type === 'Fastrack') return [...CORE_SUBJECTS, ...EXTRA_SUBJECTS]
  if (type === 'Re-attempt' || type === 'Qualifier' || type === 'Crash course') return CORE_SUBJECTS
  return null
}
