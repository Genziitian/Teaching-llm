import { prisma } from '@/lib/db';
import { DAY, PROOF_DAYS, STUDENT_DAYS, MANAGER_DAYS, cutoff, imageMime } from './policy';
import { Prisma } from '@prisma/client';
export class ProtectionError extends Error {
    constructor(message: string, public status = 400) { super(message); }
}
export function check(condition: unknown, message: string, status = 400): asserts condition {
    if (!condition)
        throw new ProtectionError(message, status);
}
export async function cleanupProtectionMedia() {
    return prisma.protectionProof.deleteMany({ where: { expiresAt: { lte: new Date() } } });
}
export const retentionDays = (role: string) => role === 'MANAGER' ? MANAGER_DAYS : STUDENT_DAYS;
export async function limitedForm(request: Request): Promise<FormData> {
    const max = 6 * 1024 * 1024;
    check(Number(request.headers?.get('content-length') || 0) <= max, 'Proof request must be at most 6 MB.', 413);
    const reader = request.body?.getReader();
    if (!reader)
        return request.formData();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
        const { done, value } = await reader.read();
        if (done)
            break;
        size += value.byteLength;
        if (size > max) {
            await reader.cancel();
            throw new ProtectionError('Proof request must be at most 6 MB.', 413);
        }
        chunks.push(value);
    }
    return new Response(Buffer.concat(chunks), { headers: { 'Content-Type': request.headers.get('content-type') || '' } }).formData();
}
export async function proofFile(form: FormData, required: boolean) {
    const file = form.get('proof');
    if (!(file instanceof File) || file.size === 0) {
        check(!required, 'Upload your official results-dashboard screenshot.');
        return null;
    }
    check(file.size <= 5 * 1024 * 1024, 'Proof must be at most 5 MB.');
    const bytes = Buffer.from(await file.arrayBuffer());
    const mime = imageMime(bytes);
    check(mime && file.type === mime, 'Choose a real PNG, JPEG or WebP image.');
    return { bytes, mime };
}
export function notify(tx: Prisma.TransactionClient, userId: string, content: string) {
    return tx.notification.create({ data: { userId, title: 'Exam Protection', content, type: 'INFO' } });
}
export async function ownedClaim(id: string, session: {
    userId: string;
    role: string;
}, requireVisibility = true) {
    const claim = await prisma.protectionClaim.findFirst({
        where: { id, ...(requireVisibility ? { createdAt: { gt: cutoff(retentionDays(session.role)) } } : {}), ...(session.role === 'MANAGER' ? {} : { purchase: { userId: session.userId } }) },
        include: { purchase: { include: { user: { select: { id: true, email: true, name: true } } } }, coupon: true },
    });
    check(claim, 'Claim not found in your dashboard visibility period.', 404);
    return claim;
}
export async function claimChange(id: string, expectedStatus: string, actorId: string, data: Prisma.ProtectionClaimUpdateManyMutationInput, message: string, internal = false) {
    return prisma.$transaction(async (tx) => {
        if (!internal) {
            const updated = await tx.protectionClaim.updateMany({ where: { id, status: expectedStatus, ...(data.deliveredAt ? { deliveredAt: null } : {}) }, data });
            check(updated.count === 1, 'This claim changed. Refresh before continuing.', 409);
        }
        await tx.protectionClaimEvent.create({ data: { claimId: id, actorId, message, internal } });
        if (!internal) {
            const claim = await tx.protectionClaim.findUniqueOrThrow({ where: { id }, include: { purchase: true } });
            await notify(tx, claim.purchase.userId, `${id}: ${message}`);
        }
    });
}
export const proofExpiry = (submitted: Date) => new Date(submitted.getTime() + PROOF_DAYS * DAY);
