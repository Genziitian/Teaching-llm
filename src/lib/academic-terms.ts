/**
 * Academic Term Definitions & Helpers
 *
 * Provides type-safe term/exam-cycle structures used by the analytics engine.
 * This module is pure logic — no database calls.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type TermKey = 'JAN' | 'MAY' | 'SEP'
export type ExamCycle = 'QUIZ_1' | 'QUIZ_2' | 'END_TERM' | 'FULL_TERM'

export interface AcademicTerm {
  /** Unique identifier, e.g. "JAN-2026" */
  id: string
  /** Human-readable label, e.g. "January 2026 Term" */
  name: string
  /** Calendar year */
  year: number
  /** Which of the 3 annual terms */
  termKey: TermKey
  /** Manager-defined or default start date */
  startDate: Date
  /** Manager-defined or default end date */
  endDate: Date
}

// ─── Constants ───────────────────────────────────────────────────────────────

export const TERM_LABELS: Record<TermKey, string> = {
  JAN: 'January Term',
  MAY: 'May Term',
  SEP: 'September Term',
}

export const EXAM_CYCLE_LABELS: Record<ExamCycle, string> = {
  QUIZ_1: 'Quiz 1',
  QUIZ_2: 'Quiz 2',
  END_TERM: 'End Term',
  FULL_TERM: 'Full Term',
}

/** Default month ranges when a manager has not specified custom dates */
const DEFAULT_TERM_MONTHS: Record<TermKey, { startMonth: number; endMonth: number }> = {
  JAN: { startMonth: 0, endMonth: 3 },   // Jan 1 – Apr 30
  MAY: { startMonth: 4, endMonth: 7 },   // May 1 – Aug 31
  SEP: { startMonth: 8, endMonth: 11 },  // Sep 1 – Dec 31
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build a canonical term ID from key + year.
 * Example: buildTermId('JAN', 2026) → "JAN-2026"
 */
export function buildTermId(termKey: TermKey, year: number): string {
  return `${termKey}-${year}`
}

/**
 * Build a human-readable term name.
 * Example: buildTermName('JAN', 2026) → "January 2026 Term"
 */
export function buildTermName(termKey: TermKey, year: number): string {
  return `${TERM_LABELS[termKey].replace(' Term', '')} ${year} Term`
}

/**
 * Given a date, determine which academic term it falls in
 * using the default calendar boundaries.
 * Returns null if the date somehow doesn't match any term.
 */
export function getDefaultTermForDate(date: Date): { termKey: TermKey; year: number } | null {
  const month = date.getMonth() // 0-indexed
  const year = date.getFullYear()

  if (month >= 0 && month <= 3) return { termKey: 'JAN', year }
  if (month >= 4 && month <= 7) return { termKey: 'MAY', year }
  if (month >= 8 && month <= 11) return { termKey: 'SEP', year }

  return null
}

/**
 * Generate default start/end dates for a term + year when no
 * custom dates are provided by the manager.
 */
export function getDefaultTermDates(termKey: TermKey, year: number): { startDate: Date; endDate: Date } {
  const { startMonth, endMonth } = DEFAULT_TERM_MONTHS[termKey]

  const startDate = new Date(year, startMonth, 1) // 1st of first month

  // Last day of endMonth: day 0 of next month = last day of endMonth
  const endDate = new Date(year, endMonth + 1, 0)
  endDate.setHours(23, 59, 59, 999)

  return { startDate, endDate }
}

/**
 * Build a full AcademicTerm object from a termKey, year, and optional custom dates.
 */
export function buildAcademicTerm(
  termKey: TermKey,
  year: number,
  customStartDate?: Date | null,
  customEndDate?: Date | null,
): AcademicTerm {
  const defaults = getDefaultTermDates(termKey, year)

  return {
    id: buildTermId(termKey, year),
    name: buildTermName(termKey, year),
    year,
    termKey,
    startDate: customStartDate || defaults.startDate,
    endDate: customEndDate || defaults.endDate,
  }
}

/**
 * Generate a list of all possible terms from startYear to endYear.
 * Useful for populating a "Term Selector" dropdown.
 */
export function generateTermList(startYear: number, endYear: number): AcademicTerm[] {
  const terms: AcademicTerm[] = []
  const keys: TermKey[] = ['JAN', 'MAY', 'SEP']

  for (let year = startYear; year <= endYear; year++) {
    for (const key of keys) {
      terms.push(buildAcademicTerm(key, year))
    }
  }

  return terms
}

/**
 * Check if an exam cycle value is valid.
 */
export function isValidExamCycle(value: string | null | undefined): value is ExamCycle {
  return !!value && ['QUIZ_1', 'QUIZ_2', 'END_TERM', 'FULL_TERM'].includes(value)
}

/**
 * Check if a term key value is valid.
 */
export function isValidTermKey(value: string | null | undefined): value is TermKey {
  return !!value && ['JAN', 'MAY', 'SEP'].includes(value)
}
