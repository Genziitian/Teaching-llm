export const DAY = 86400000;
export const STUDENT_DAYS = 60;
export const MANAGER_DAYS = 360;
export const PROOF_DAYS = 60;
export const REFUND_DEDUCTION = 10;
export const CLAIM_WINDOW_DAYS = 7;
export type ClaimWindow = 'not_open' | 'open' | 'closed';
export const claimWindowEnd = (openedAt: Date | null | undefined) => openedAt ? new Date(openedAt.getTime() + CLAIM_WINDOW_DAYS * DAY) : null;
export function claimWindow(openedAt: Date | null | undefined, now = new Date()): ClaimWindow {
    if (!openedAt)
        return 'not_open';
    return now.getTime() < claimWindowEnd(openedAt)!.getTime() ? 'open' : 'closed';
}
export const PASS_PERCENT = 38;
export const REASONS = ['Marks below the passing requirement', 'Could not complete the exam', 'Did not attempt the exam', 'Other reason'] as const;
export const STATUSES = ['Submitted', 'Under Review', 'More Information Required', 'Approved', 'Rejected', 'Processing', 'Completed'] as const;
export const discountForFee = (fee: number) => Math.round(fee * 1.5);
export const refundForFee = (fee: number) => Math.max(0, fee - REFUND_DEDUCTION);
export const validFee = (fee: unknown): fee is number => Number.isSafeInteger(fee) && Number(fee) >= 10 && Number(fee) <= 1000000;
export const cutoff = (days: number, now = new Date()) => new Date(now.getTime() - days * DAY);
export const visible = (date: Date, days: number, now = new Date()) => date.getTime() > cutoff(days, now).getTime();
export function parseFee(value: unknown): number | null | undefined {
    if (value === undefined)
        return undefined;
    if (value === null || value === '')
        return null;
    const fee = Number(value);
    if (!validFee(fee))
        throw new Error('Protection fee must be a whole number from ₹10 to ₹10,00,000, or left empty.');
    return fee;
}
export function validateClaimDetails(body: Record<string, unknown>) {
    if (!body || typeof body !== 'object' || Array.isArray(body))
        throw new Error('Enter valid claim details.');
    if (!REASONS.includes(body.reason as typeof REASONS[number]))
        throw new Error('Choose a reason for not passing.');
    if (body.attempted !== true)
        throw new Error('You must attend the exam to claim. Claims are only for a score below 38%.');
    const marks = body.attempted && ['string', 'number'].includes(typeof body.marks) && body.marks !== '' && body.marks !== null ? Number(body.marks) : null;
    if (body.attempted && (marks === null || !Number.isFinite(marks) || marks < 0 || marks > 100))
        throw new Error('Enter your percentage in this exam, from 0 to 100.');
    if (body.attempted && marks !== null && marks >= PASS_PERCENT)
        throw new Error(`A score of ${PASS_PERCENT}% or above counts as a pass, so this exam is not eligible for a claim.`);
    if (!['refund', 'coupon'].includes(String(body.benefit)))
        throw new Error('Choose a refund or discount benefit.');
    if (typeof body.message !== 'string' || body.message.length > 2000)
        throw new Error('Additional details must be at most 2,000 characters.');
    if (body.resultsReleased !== true)
        throw new Error('Confirm that your official results have been released.');
    return { benefit: String(body.benefit), reason: String(body.reason), attempted: body.attempted, marks, message: body.message.trim() };
}
export function imageMime(bytes: Uint8Array): string | null {
    if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v))
        return 'image/png';
    if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
        return 'image/jpeg';
    if (bytes.length >= 12 && String.fromCharCode(...Array.from(bytes.slice(0, 4))) === 'RIFF' && String.fromCharCode(...Array.from(bytes.slice(8, 12))) === 'WEBP')
        return 'image/webp';
    return null;
}
export const RULES = 'Failed exam: refund your protection fee minus ₹10, OR get 1.5× the fee as a discount on your next purchase of the same course, rounded to a whole rupee. Proof is reviewed manually. Refunds and coupons are handled by the manager. Protection is valid until your exam ends. Claims open only after official results are declared; you then have 7 days to claim. Late claims are void.';
export function isSameSubjectBundle(subject: string, courses: {
    course: {
        subject?: string | null;
        name: string;
    };
}[]) {
    return courses.length > 0 && courses.every(entry => (entry.course.subject || entry.course.name).trim().toLowerCase() === subject.trim().toLowerCase());
}
