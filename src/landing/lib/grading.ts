// Grading math for the IITM BS Degree program (absolute cutoffs, not curved).
// Kept dependency-free and pure so it can be unit tested in isolation.

export type LetterGrade = 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'U' | 'W';

export interface GradeBand {
  letter: 'S' | 'A' | 'B' | 'C' | 'D' | 'E';
  min: number;
  points: number;
  label: string;
}

// Ordered highest-first; `min` is the inclusive lower cutoff for T.
export const GRADE_BANDS: GradeBand[] = [
  { letter: 'S', min: 90, points: 10, label: 'Outstanding' },
  { letter: 'A', min: 80, points: 9, label: 'Excellent' },
  { letter: 'B', min: 70, points: 8, label: 'Very Good' },
  { letter: 'C', min: 60, points: 7, label: 'Good' },
  { letter: 'D', min: 50, points: 6, label: 'Average' },
  { letter: 'E', min: 40, points: 4, label: 'Pass' },
];

export const U_GRADE: { letter: 'U'; points: 0; label: string } = { letter: 'U', points: 0, label: 'Unsatisfactory (Fail)' };
export const W_GRADE: { letter: 'W'; points: 0; label: string } = { letter: 'W', points: 0, label: 'Withdrawn (low attendance)' };

export const ALL_LETTER_GRADES: LetterGrade[] = ['S', 'A', 'B', 'C', 'D', 'E', 'U', 'W'];

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** Clamp a mark to the valid 0-100 range. */
export function clampMark(value: number): number {
  return clamp(value, 0, 100);
}

/** Clamp an instructor bonus to the valid 0-20 range. */
export function clampBonus(value: number): number {
  return clamp(value, 0, 20);
}

/** Map a computed score T (0-100) to its letter grade using the absolute cutoffs. */
export function letterFor(T: number): 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'U' {
  for (const band of GRADE_BANDS) {
    if (T >= band.min) return band.letter;
  }
  return 'U';
}

/** Grade points for any letter grade, including U and W (both 0). */
export function pointsForLetter(letter: LetterGrade): number {
  if (letter === 'U' || letter === 'W') return 0;
  const band = GRADE_BANDS.find((b) => b.letter === letter);
  return band ? band.points : 0;
}

// ---------------------------------------------------------------------------
// Non-OPPE (theory) courses
// ---------------------------------------------------------------------------

export interface NonOppeInputs {
  qz1: number;
  qz2: number;
  final: number;
  bonus?: number;
}

export interface NonOppeResult {
  T: number;
  formulaA: number;
  formulaB: number;
  used: 'A' | 'B';
  letter: 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'U';
  points: number;
}

export function nonOppeFormulaA(qz1: number, qz2: number, final: number): number {
  return 0.6 * final + 0.3 * Math.max(qz1, qz2);
}

export function nonOppeFormulaB(qz1: number, qz2: number, final: number): number {
  return 0.45 * final + 0.25 * qz1 + 0.3 * qz2;
}

export function computeNonOppe({ qz1, qz2, final, bonus = 0 }: NonOppeInputs): NonOppeResult {
  const Qz1 = clampMark(qz1);
  const Qz2 = clampMark(qz2);
  const F = clampMark(final);
  const B = clampBonus(bonus);

  const formulaA = nonOppeFormulaA(Qz1, Qz2, F);
  const formulaB = nonOppeFormulaB(Qz1, Qz2, F);
  const used: 'A' | 'B' = formulaA >= formulaB ? 'A' : 'B';
  const T = Math.min(100, Math.max(formulaA, formulaB) + B);
  const letter = letterFor(T);

  return { T, formulaA, formulaB, used, letter, points: pointsForLetter(letter) };
}

// ---------------------------------------------------------------------------
// OPPE (Online Proctored Programming Exam) courses
// ---------------------------------------------------------------------------

export interface OppeInputs {
  qz1: number;
  final: number;
  pe1: number;
  pe2: number;
  bonus?: number;
}

export interface OppeResult {
  T: number;
  letter: 'S' | 'A' | 'B' | 'C' | 'D' | 'E' | 'U';
  points: number;
}

export function computeOppe({ qz1, final, pe1, pe2, bonus = 0 }: OppeInputs): OppeResult {
  const Qz1 = clampMark(qz1);
  const F = clampMark(final);
  const P1 = clampMark(pe1);
  const P2 = clampMark(pe2);
  const B = clampBonus(bonus);

  const T = Math.min(
    100,
    0.15 * Qz1 + 0.4 * F + 0.25 * Math.max(P1, P2) + 0.2 * Math.min(P1, P2) + B
  );
  const letter = letterFor(T);

  return { T, letter, points: pointsForLetter(letter) };
}

// ---------------------------------------------------------------------------
// SGPA / CGPA
// ---------------------------------------------------------------------------

export interface CourseEntry {
  credits: number;
  grade: LetterGrade;
}

/** Credit-weighted grade point average for a single list of courses (used for both SGPA and CGPA). */
export function gpa(courses: CourseEntry[]): number {
  const totalCredits = courses.reduce((sum, c) => sum + c.credits, 0);
  if (totalCredits <= 0) return 0;
  const totalPoints = courses.reduce((sum, c) => sum + c.credits * pointsForLetter(c.grade), 0);
  return totalPoints / totalCredits;
}

/** SGPA for a single term's courses. */
export function sgpa(courses: CourseEntry[]): number {
  return gpa(courses);
}

/** CGPA across every term (U/W courses still occupy credits in the denominator). */
export function cgpa(terms: CourseEntry[][]): number {
  return gpa(terms.flat());
}

export function percentageFromCgpa(cgpaValue: number): number {
  return cgpaValue * 10;
}

// ---------------------------------------------------------------------------
// "What do I need in the Final" solver
// ---------------------------------------------------------------------------

export type NeedStatus = 'already' | 'value' | 'unreachable';

export interface NeedRow {
  letter: 'S' | 'A' | 'B' | 'C' | 'D' | 'E';
  points: number;
  status: NeedStatus;
  requiredFinal?: number; // present only when status === 'value'
}

function roundTo1Decimal(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * For each grade band, find the minimum Final-exam score needed to reach it,
 * given the quizzes/PEs/bonus already entered. Non-OPPE courses can reach a
 * cutoff via either formula, so we take whichever formula needs a lower Final.
 */
export function neededFinalNonOppe(qz1: number, qz2: number, bonus = 0): NeedRow[] {
  const Qz1 = clampMark(qz1);
  const Qz2 = clampMark(qz2);
  const B = clampBonus(bonus);

  return GRADE_BANDS.map(({ letter, min: target, points }) => {
    const atF0 = Math.max(nonOppeFormulaA(Qz1, Qz2, 0), nonOppeFormulaB(Qz1, Qz2, 0)) + B;
    if (atF0 >= target) {
      return { letter, points, status: 'already' as const };
    }

    const atF100 = Math.max(nonOppeFormulaA(Qz1, Qz2, 100), nonOppeFormulaB(Qz1, Qz2, 100)) + B;
    if (atF100 < target) {
      return { letter, points, status: 'unreachable' as const };
    }

    // Solve each linear formula for F, then take the easier (smaller) path.
    const fNeededA = (target - B - 0.3 * Math.max(Qz1, Qz2)) / 0.6;
    const fNeededB = (target - B - 0.25 * Qz1 - 0.3 * Qz2) / 0.45;
    const required = clamp(Math.min(fNeededA, fNeededB), 0, 100);

    return { letter, points, status: 'value' as const, requiredFinal: roundTo1Decimal(required) };
  });
}

/**
 * Same solver for OPPE courses. T only has a single linear term in Final
 * (0.4F), so the algebra is a direct inversion rather than a min of two paths.
 */
export function neededFinalOppe(qz1: number, pe1: number, pe2: number, bonus = 0): NeedRow[] {
  const Qz1 = clampMark(qz1);
  const P1 = clampMark(pe1);
  const P2 = clampMark(pe2);
  const B = clampBonus(bonus);

  const withoutFinal = 0.15 * Qz1 + 0.25 * Math.max(P1, P2) + 0.2 * Math.min(P1, P2) + B;

  return GRADE_BANDS.map(({ letter, min: target, points }) => {
    if (withoutFinal >= target) {
      return { letter, points, status: 'already' as const };
    }

    const atF100 = withoutFinal + 0.4 * 100;
    if (atF100 < target) {
      return { letter, points, status: 'unreachable' as const };
    }

    const required = clamp((target - withoutFinal) / 0.4, 0, 100);
    return { letter, points, status: 'value' as const, requiredFinal: roundTo1Decimal(required) };
  });
}
