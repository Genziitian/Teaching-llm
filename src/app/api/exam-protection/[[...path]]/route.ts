import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import Razorpay from 'razorpay';
import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { checkRateLimit } from '@/lib/ratelimit';
import { DAY, STUDENT_DAYS, MANAGER_DAYS, REASONS, RULES, cutoff, validFee, parseFee, refundForFee, discountForFee, validateClaimDetails, isSameSubjectBundle } from '@/lib/exam-protection/policy';
import { check, ProtectionError, cleanupProtectionMedia, limitedForm, proofFile, notify, ownedClaim, claimChange, proofExpiry } from '@/lib/exam-protection/server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
type Context = {
    params: {
        path?: string[];
    };
};
const json = (value: unknown, status = 200) => NextResponse.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
function provider() {
    check(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET, 'Protection payments are not configured.', 503);
    return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
}
async function capturedPurchase(orderId: string, userId?: string) {
    const purchase = await prisma.protectionPurchase.findFirst({ where: { providerOrderId: orderId, ...(userId ? { userId } : {}) } });
    check(purchase, 'Protection order not found.', 404);
    if (purchase.status === 'PAID')
        return purchase;
    const payments = await provider().orders.fetchPayments(orderId);
    const payment = payments.items.find(item => item.status === 'captured' && Number(item.amount) === purchase.fee * 100 && item.currency === 'INR' && item.order_id === orderId);
    check(payment, 'Payment is not captured yet. Refresh to retry confirmation.', 409);
    await prisma.$transaction(async (tx) => {
        const paid = await tx.protectionPurchase.updateMany({ where: { id: purchase.id, status: 'PENDING' }, data: { status: 'PAID', paidAt: new Date(), paymentId: payment.id } });
        if (paid.count)
            await notify(tx, purchase.userId, `Protection is active for ${purchase.courseName}. Fee paid: ₹${purchase.fee}.`);
    });
    return prisma.protectionPurchase.findUniqueOrThrow({ where: { id: purchase.id } });
}
async function handle(request: NextRequest, context: Context, method: string) {
    try {
        const path = context.params.path || [];
        const session = await getSession();
        check(session, 'Sign in to continue.', 401);
        const manager = session.role === 'MANAGER';
        if (method !== 'GET') {
            const limit = await checkRateLimit(session.userId, 'general');
            check(limit.success, 'Please wait before trying again.', 429);
        }
        if (method === 'GET' && path.length === 0) {
            await cleanupProtectionMedia();
            // Recover a captured payment even if the app closed before verification.
            const pending = await prisma.protectionPurchase.findMany({ where: { userId: session.userId, status: 'PENDING', providerOrderId: { not: null } }, take: 5, orderBy: { createdAt: 'desc' } });
            for (const purchase of pending) {
                try {
                    await capturedPurchase(purchase.providerOrderId!, session.userId);
                }
                catch (error) {
                    if (!(error instanceof ProtectionError && error.status === 409))
                        console.error('[protection] Payment reconciliation failed', purchase.id);
                }
            }
            const since = cutoff(manager ? MANAGER_DAYS : STUDENT_DAYS);
            const [settings, courses, purchases, claims, couponClaims] = await Promise.all([
                prisma.protectionSettings.findUnique({ where: { id: 'global' } }),
                prisma.protectionCourse.findMany({ where: { fee: { not: null }, course: { isDisabled: false, isGlobal: false, examCycle: 'QUIZ_1', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], ...(manager ? {} : { enrollments: { some: { userId: session.userId } } }) } }, include: { course: { select: { id: true, name: true, subject: true, examCycle: true } } }, orderBy: { courseId: 'asc' } }),
                prisma.protectionPurchase.findMany({ where: { status: 'PAID', paidAt: { gt: since }, ...(manager ? {} : { userId: session.userId }) }, include: { user: { select: { name: true, email: true } }, claim: { select: { id: true } } }, orderBy: { paidAt: 'desc' } }),
                prisma.protectionClaim.findMany({ where: { createdAt: { gt: since }, ...(manager ? {} : { purchase: { userId: session.userId } }) }, include: { purchase: { include: { user: { select: { name: true, email: true } } } }, proof: { select: { expiresAt: true } }, coupon: true, events: { where: manager ? {} : { internal: false }, orderBy: { createdAt: 'asc' } } }, orderBy: { createdAt: 'desc' } }),
                manager ? Promise.resolve([]) : prisma.protectionClaim.findMany({ where: { couponId: { not: null }, purchase: { userId: session.userId } }, include: { purchase: { select: { courseName: true, fee: true } }, coupon: true }, orderBy: { createdAt: 'desc' } }),
            ]);
            const protectedKeys = await prisma.protectionPurchase.findMany({ where: { userId: session.userId, status: 'PAID' }, select: { courseKey: true } });
            return json({ manager, email: session.email, isOpen: settings?.isOpen ?? false, rules: RULES, reasons: REASONS, retentionDays: manager ? MANAGER_DAYS : STUDENT_DAYS,
                courses: courses.map(entry => ({ ...entry.course, fee: entry.fee, protected: protectedKeys.some(p => p.courseKey === entry.courseId) })), purchases,
                coupons: couponClaims.map(claim => ({ id: claim.id, purchase: claim.purchase, couponRevealedAt: claim.couponRevealedAt, coupon: claim.coupon ? { code: claim.couponRevealedAt ? claim.coupon.code : null, expiresAt: claim.coupon.expiresAt, currentUses: claim.coupon.currentUses, maxUses: claim.coupon.maxUses, isActive: claim.coupon.isActive } : null })),
                claims: claims.map(claim => ({ ...claim, coupon: claim.coupon ? { code: manager || claim.couponRevealedAt ? claim.coupon.code : null, expiresAt: claim.coupon.expiresAt, currentUses: claim.coupon.currentUses, maxUses: claim.coupon.maxUses, isActive: claim.coupon.isActive } : null })) });
        }
        if (path[0] === 'courses' && path[1]) {
            check(manager, 'Only managers can change course protection.', 403);
            const course = await prisma.course.findUnique({ where: { id: path[1] }, select: { id: true } });
            check(course, 'Course not found.', 404);
            if (method === 'GET')
                return json(await prisma.protectionCourse.findUnique({ where: { courseId: course.id } }) || { courseId: course.id, fee: null });
            if (method === 'PUT') {
                const body = await request.json(), fee = parseFee(body.fee);
                check(fee !== undefined, 'Supply a protection fee or null.');
                return json(await prisma.protectionCourse.upsert({ where: { courseId: course.id }, create: { courseId: course.id, fee }, update: { fee } }));
            }
        }
        if (method === 'PUT' && path[0] === 'settings') {
            check(manager, 'Only managers can open or close protection purchases.', 403);
            const { isOpen } = await request.json();
            check(typeof isOpen === 'boolean', 'Choose Open or Closed.');
            return json(await prisma.protectionSettings.upsert({ where: { id: 'global' }, create: { id: 'global', isOpen }, update: { isOpen } }));
        }
        if (method === 'POST' && path[0] === 'purchase') {
            const body = await request.json();
            check(body.acceptedRules === true, 'Read and accept the protection rules before purchasing.');
            const settings = await prisma.protectionSettings.findUnique({ where: { id: 'global' } });
            check(settings?.isOpen, 'Protection purchases are closed.', 409);
            const course = await prisma.course.findFirst({ where: { id: String(body.courseId), isDisabled: false, examCycle: 'QUIZ_1', isGlobal: false, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }], enrollments: { some: { userId: session.userId } } }, include: { protectionSettings: true } });
            check(course && validFee(course.protectionSettings?.fee), 'Protection is not offered for this course.', 400);
            const fee = course.protectionSettings.fee!;
            let purchase = await prisma.protectionPurchase.findUnique({ where: { userId_courseKey: { userId: session.userId, courseKey: course.id } } });
            check(purchase?.status !== 'PAID', 'This course is already protected.', 409);
            if (!purchase) {
                purchase = await prisma.protectionPurchase.create({ data: { userId: session.userId, courseId: course.id, courseKey: course.id, courseName: course.name, subject: course.subject || course.name, academicTerm: course.academicTerm, academicYear: course.academicYear, fee } });
                try {
                    const order = await provider().orders.create({ amount: fee * 100, currency: 'INR', receipt: purchase.id, notes: { protectionPurchaseId: purchase.id } });
                    purchase = await prisma.protectionPurchase.update({ where: { id: purchase.id }, data: { providerOrderId: order.id } });
                }
                catch (error) {
                    // Keep provider-order snapshots intact; only an uncreated checkout can be retried.
                    await prisma.protectionPurchase.deleteMany({ where: { id: purchase.id, providerOrderId: null, status: 'PENDING' } });
                    throw error;
                }
            }
            check(purchase.providerOrderId, 'Checkout is being prepared. Please retry shortly.', 409);
            return json({ purchaseId: purchase.id, razorpayOrderId: purchase.providerOrderId, amount: purchase.fee * 100, keyId: process.env.RAZORPAY_KEY_ID, currency: 'INR', courseName: purchase.courseName, userName: session.name, userEmail: session.email });
        }
        if (method === 'POST' && path[0] === 'verify') {
            const body = await request.json(), orderId = String(body.razorpay_order_id || ''), paymentId = String(body.razorpay_payment_id || ''), signature = String(body.razorpay_signature || '');
            provider();
            const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!).update(`${orderId}|${paymentId}`).digest('hex');
            check(signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected)), 'Invalid payment signature.');
            const payment = await provider().payments.fetch(paymentId);
            check(payment.order_id === orderId, 'Payment does not match this order.');
            return json({ success: true, purchase: await capturedPurchase(orderId, session.userId) });
        }
        if (method === 'POST' && path[0] === 'claims' && path.length === 1) {
            const form = await limitedForm(request), body = JSON.parse(String(form.get('data') || '{}'));
            const details = validateClaimDetails(body), file = await proofFile(form, true);
            const purchase = await prisma.protectionPurchase.findFirst({ where: { id: String(body.purchaseId), userId: session.userId, status: 'PAID' } });
            check(purchase, 'Choose an eligible protected Quiz 1 purchase.', 403);
            const now = new Date();
            const claim = await prisma.$transaction(async (tx) => {
                const created = await tx.protectionClaim.create({ data: { purchaseId: purchase.id, ...details, createdAt: now, proof: { create: { ...file!, expiresAt: proofExpiry(now) } }, events: { create: { actorId: session.userId, message: 'Submitted for manual proof review.' } } } });
                await notify(tx, session.userId, `${created.id}: Your protection claim was submitted for review.`);
                return created;
            });
            return json({ id: claim.id, status: claim.status }, 201);
        }
        if (path[0] === 'claims' && path[1]) {
            const action = path[2], claim = await ownedClaim(path[1], session, action !== 'reveal');
            if (method === 'GET' && action === 'bundles') {
                check(manager, 'Manager access required.', 403);
                const bundles = await prisma.bundleOffering.findMany({ include: { courses: { include: { course: { select: { name: true, subject: true } } } } }, orderBy: { name: 'asc' } });
                return json(bundles.filter(bundle => isSameSubjectBundle(claim.purchase.subject, bundle.courses)).map(bundle => ({ id: bundle.id, name: bundle.name })));
            }
            if (method === 'GET' && action === 'proof') {
                const proof = await prisma.protectionProof.findUnique({ where: { claimId: claim.id } });
                check(proof && proof.expiresAt > new Date(), 'Proof media was deleted after 60 days.', 410);
                if (request.nextUrl.searchParams.get('format') === 'base64')
                    return json({ mime: proof.mime, base64: Buffer.from(proof.bytes).toString('base64') });
                return new NextResponse(new Uint8Array(proof.bytes), { headers: { 'Content-Type': proof.mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' } });
            }
            if (method === 'POST' && action === 'reply') {
                check(!manager && claim.purchase.userId === session.userId && claim.status === 'More Information Required', 'This claim is not awaiting your information.', 409);
                const form = await limitedForm(request), message = String(form.get('message') || '').trim(), file = await proofFile(form, false);
                check(message.length > 0 && message.length <= 2000, 'Enter up to 2,000 characters.');
                await prisma.$transaction(async (tx) => {
                    const changed = await tx.protectionClaim.updateMany({ where: { id: claim.id, status: 'More Information Required' }, data: { status: 'Under Review' } });
                    check(changed.count, 'Claim changed. Please refresh.', 409);
                    if (file)
                        await tx.protectionProof.upsert({ where: { claimId: claim.id }, create: { claimId: claim.id, ...file, expiresAt: proofExpiry(claim.createdAt) }, update: { ...file } });
                    await tx.protectionClaimEvent.create({ data: { claimId: claim.id, actorId: session.userId, message: `Student reply: ${message}` } });
                    await notify(tx, session.userId, `${claim.id}: Your additional information was submitted for review.`);
                });
                return json({ success: true });
            }
            if (method === 'POST' && action === 'reveal') {
                check(claim.purchase.userId === session.userId && claim.couponId && claim.coupon && claim.deliveredAt, 'No coupon assigned to this account.', 403);
                await prisma.$transaction(async (tx) => {
                    const revealed = await tx.protectionClaim.updateMany({ where: { id: claim.id, couponRevealedAt: null }, data: { couponRevealedAt: new Date() } });
                    if (revealed.count)
                        await tx.coupon.update({ where: { id: claim.couponId! }, data: { isActive: true, startDate: new Date(), expiresAt: new Date(Date.now() + 7 * DAY) } });
                });
                return json({ success: true });
            }
            if (method === 'POST' && action === 'action') {
                check(manager, 'Manager access required.', 403);
                const body = await request.json(), message = String(body.message || '').trim();
                check(message.length <= 2000, 'Use at most 2,000 characters.');
                if (body.action === 'note') {
                    check(message, 'Enter an internal note.');
                    await claimChange(claim.id, claim.status, session.userId, {}, message, true);
                }
                else if (['review', 'approve', 'reject', 'information', 'processing'].includes(body.action)) {
                    const reviewing = ['Submitted', 'Under Review'].includes(claim.status);
                    const targets: Record<string, string> = { review: 'Under Review', approve: 'Approved', reject: 'Rejected', information: 'More Information Required', processing: 'Processing' };
                    check(body.action === 'processing' ? claim.status === 'Approved' : reviewing, 'This action is not available for the current status.', 409);
                    if (['reject', 'information'].includes(body.action))
                        check(message, 'A student-visible reason or information request is required.');
                    await claimChange(claim.id, claim.status, session.userId, { status: targets[body.action] }, message || targets[body.action]);
                }
                else if (body.action === 'refund') {
                    check(claim.benefit === 'refund' && ['Approved', 'Processing'].includes(claim.status) && !claim.deliveredAt, 'Approve this refund before recording delivery.', 409);
                    check(body.delivered === true && Number(body.refundAmount) === refundForFee(claim.purchase.fee), 'Confirm the refund was issued and enter the exact fee minus ₹10.');
                    const reference = String(body.reference || '').trim();
                    check(reference.length <= 200, 'Reference is too long.');
                    await claimChange(claim.id, claim.status, session.userId, { status: 'Processing', deliveredAt: new Date(), refundAmount: refundForFee(claim.purchase.fee), refundReference: reference || null }, `Refund of ₹${refundForFee(claim.purchase.fee)} issued manually.${reference ? ` Reference: ${reference}` : ''}`);
                }
                else if (body.action === 'coupon') {
                    check(claim.benefit === 'coupon' && ['Approved', 'Processing'].includes(claim.status) && !claim.deliveredAt, 'Approve this discount before assigning its coupon.', 409);
                    check(body.delivered === true, 'Confirm coupon assignment.');
                    const coupon = await prisma.coupon.findUnique({ where: { code: String(body.code || '').trim().toUpperCase() } });
                    check(coupon && coupon.discountType === 'FIXED' && coupon.discountValue === discountForFee(claim.purchase.fee) && coupon.currentUses === 0 && coupon.isHidden && !coupon.isActive, `Generate an unused, inactive, hidden fixed ₹${discountForFee(claim.purchase.fee)} coupon in the existing coupon manager first.`);
                    check(!await prisma.couponUsage.findFirst({ where: { couponId: coupon.id } }), 'This coupon has already been used. Generate a fresh coupon.');
                    const bundle = await prisma.bundleOffering.findUnique({ where: { id: String(body.bundleId || '') }, include: { courses: { include: { course: true } } } });
                    check(bundle && isSameSubjectBundle(claim.purchase.subject, bundle.courses), 'Choose a bundle containing only this same subject. Mixed-subject bundles are not eligible.');
                    await prisma.$transaction(async (tx) => {
                        const changed = await tx.protectionClaim.updateMany({ where: { id: claim.id, status: claim.status, deliveredAt: null }, data: { status: 'Processing', deliveredAt: new Date(), couponId: coupon.id } });
                        check(changed.count, 'Claim changed. Refresh to continue.', 409);
                        await tx.coupon.update({ where: { id: coupon.id }, data: { applicability: 'BUNDLE', targetBundleIds: JSON.stringify([bundle.id]), targetUserEmails: JSON.stringify([claim.purchase.user.email]), maxUses: 1, isSingleUsePerUser: true, isFirstPurchaseOnly: false, isHidden: true, isActive: false, startDate: null, expiresAt: null } });
                        await tx.protectionClaimEvent.create({ data: { claimId: claim.id, actorId: session.userId, internal: true, message: `Assigned coupon ${coupon.code} to ${claim.purchase.user.email} for ${bundle.name}.` } });
                        await tx.protectionClaimEvent.create({ data: { claimId: claim.id, actorId: session.userId, message: 'Discount coupon assigned. Reveal it in My Coupons; use it within 7 days.' } });
                        await notify(tx, claim.purchase.userId, `${claim.id}: Your coupon is available in My Coupons.`);
                    });
                }
                else if (body.action === 'complete') {
                    check(claim.deliveredAt && claim.status === 'Processing', 'Record actual benefit delivery before completion.', 409);
                    await claimChange(claim.id, claim.status, session.userId, { status: 'Completed' }, 'Benefit delivered. Claim completed.');
                }
                else
                    throw new ProtectionError('Unknown manager action.');
                return json({ success: true });
            }
        }
        throw new ProtectionError('Not found.', 404);
    }
    catch (error) {
        if (error instanceof ProtectionError)
            return json({ error: error.message }, error.status);
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
            return json({ error: 'A purchase, claim or coupon assignment already exists. Refresh to see it.' }, 409);
        if (error instanceof SyntaxError || (error instanceof Error && /^(Choose|Enter|Confirm|Protection fee|Additional details)/.test(error.message)))
            return json({ error: error.message }, 400);
        console.error('[exam-protection]', error);
        return json({ error: 'Protection could not be updated. Please retry.' }, 500);
    }
}
export const GET = (req: NextRequest, ctx: Context) => handle(req, ctx, 'GET');
export const POST = (req: NextRequest, ctx: Context) => handle(req, ctx, 'POST');
export const PUT = (req: NextRequest, ctx: Context) => handle(req, ctx, 'PUT');
