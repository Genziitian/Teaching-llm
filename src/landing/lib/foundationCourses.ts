// Foundation-level course list for the IITM BS Degree program.
// Used for quick-add / autocomplete in the CGPA ledger.

export interface FoundationCourse {
  name: string;
  credits: number;
  isOppe: boolean;
}

// "Programming in Python" has a programming-exam component, so it defaults to
// the OPPE score formula in the predictor; the rest are theory (Non-OPPE) courses.
export const FOUNDATION_COURSES: FoundationCourse[] = [
  { name: 'Mathematics 1', credits: 4, isOppe: false },
  { name: 'Statistics 1', credits: 4, isOppe: false },
  { name: 'English 1', credits: 4, isOppe: false },
  { name: 'Computational Thinking', credits: 4, isOppe: false },
  { name: 'Mathematics 2', credits: 4, isOppe: false },
  { name: 'Statistics 2', credits: 4, isOppe: false },
  { name: 'English 2', credits: 4, isOppe: false },
  { name: 'Programming in Python', credits: 4, isOppe: true },
];

export const FOUNDATION_COURSE_NAMES = FOUNDATION_COURSES.map((c) => c.name);
