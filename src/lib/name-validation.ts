export const NAME_DIGIT_ERROR = 'Name cannot contain numbers. Please enter your real name correctly.'

/** True if any of the given name parts contains a digit. */
export function nameHasDigit(...parts: unknown[]): boolean {
  return parts.some(p => typeof p === 'string' && /\d/.test(p))
}
