'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import Script from 'next/script';
import Link from 'next/link';
import { ProtectionClaim, ProtectionData, ProtectionPurchase, protectionRequest } from '@/lib/exam-protection/client';
import { DAY, RULES, refundForFee, discountForFee } from '@/lib/exam-protection/policy';
import styles from './protection.module.css';
import { useUserData } from '@/components/UserDataProvider';
import { canSeeProtectionOnWeb } from '@/lib/exam-protection/access';
const date = (value: string) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const until = (value: string, days: number) => date(new Date(new Date(value).getTime() + days * DAY).toISOString());
type RzpConstructor = new (options: Record<string, unknown>) => {
    open(): void;
};
export default function ExamProtectionPage() {
    const { userData } = useUserData();
    if (userData?.user && !canSeeProtectionOnWeb(userData.user.role, userData.user.email))
        return <main className={styles.page}><div className={`${styles.card} ${styles.empty}`}>Exam Protection is not available on the website for your account yet.</div></main>;
    return <ProtectionContent/>;
}
function ProtectionContent() {
    const { data, error, isLoading, mutate } = useSWR<ProtectionData>('/api/exam-protection', () => protectionRequest(), { refreshInterval: 60000 });
    const [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [detail, setDetail] = useState<ProtectionData['courses'][number] | null>(null), [purchasing, setPurchasing] = useState<ProtectionData['courses'][number] | null>(null), [accepted, setAccepted] = useState(false);
    const dialog = useRef<HTMLDialogElement>(null);
    const [guide, setGuide] = useState(false);
    useEffect(() => {
        if (detail || purchasing || guide)
            dialog.current?.showModal();
        else
            dialog.current?.close();
    }, [detail, purchasing, guide]);
    async function run(work: () => Promise<unknown>) {
        setBusy(true);
        setNotice('');
        try {
            await work();
            await mutate();
        }
        catch (error) {
            setNotice((error as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    async function buy() {
        if (!purchasing)
            return;
        const course = purchasing;
        await run(async () => {
            const Checkout = (window as unknown as {
                Razorpay?: RzpConstructor;
            }).Razorpay;
            if (!Checkout)
                throw new Error('Checkout is still loading. Please retry.');
            const order = await protectionRequest<{
                razorpayOrderId: string;
                amount: number;
                keyId: string;
                userName: string;
                userEmail: string;
            }>('/purchase', 'POST', { courseId: course.id, acceptedRules: true });
            setPurchasing(null);
            await new Promise<void>((resolve, reject) => {
                const checkout = new Checkout({ key: order.keyId, order_id: order.razorpayOrderId, amount: order.amount, currency: 'INR', name: 'GenZ IITian', description: 'Exam Protection · ' + course.name, prefill: { name: order.userName, email: order.userEmail }, handler: async (response: unknown) => {
                        try {
                            await protectionRequest('/verify', 'POST', response);
                            setNotice('Payment confirmed. Your protection is active.');
                            resolve();
                        }
                        catch (error) {
                            reject(error);
                        }
                    }, modal: { ondismiss: () => reject(new Error('Checkout closed. If charged, refresh to confirm your protection.')) } });
                checkout.open();
            });
        });
    }
    const [tab, setTab] = useState('overview'), [knowMore, setKnowMore] = useState(false);
    const tone = (status: string) => ({ Submitted: styles.tBlue, 'Under Review': styles.tBlue, 'More Information Required': styles.tAmber, Approved: styles.tGreen, Processing: styles.tAmber, Completed: styles.tGreen, Rejected: styles.tRed } as Record<string, string>)[status] || '';
    const tabs = data ? (data.manager ? [['overview', 'Overview'], ['claims', `Claims · ${data.claims.length}`], ['purchases', `Purchases · ${data.purchases.length}`]] : [['overview', 'Protect'], ['claims', `My claims · ${data.claims.length}`], ['coupons', 'My Coupons']]) : [];
    const open = data?.claims.filter(c => !['Completed', 'Rejected'].includes(c.status)).length ?? 0;
    return <main className={styles.page}><Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive"/>
    <header className={styles.hero}>{tab === 'overview' && <Link href="/dashboard" className={styles.back}>‹ Back</Link>}<h1>Exam Protection</h1>{data?.manager ? <p className={styles.lede}>Manage availability, course fees and claim reviews.</p> : <details className={styles.introDrop}><summary>What is the Exam Protection add-on?</summary><p className={styles.lede}>Your safety net for exam day. Add it to your course for a small fee. If you score below 38%, get your money back or a bigger discount on the same course.</p><p className={styles.tagline}>Study with confidence. Protected either way.</p><div className={styles.deals}><span className={styles.cIndigo}>Small one-time fee</span><span className={styles.cAmber}>Claim in 4 steps</span></div></details>}</header>
    <div role="status" aria-live="polite">{notice && <p className={styles.notice}>{notice}</p>}</div>
    {isLoading ? <div className={styles.skeleton} aria-label="Loading"/> : error ? <div className={styles.card} role="alert"><p>{error.message}</p><button onClick={() => mutate()}>Try again</button></div> : data && <>
    {!data.manager ? (tab === 'overview' ? <><button className={styles.getBtn} onClick={() => setTab('protection')}>Get protection</button><div className={styles.quick}><button className={styles.secondary} onClick={() => setTab('protection')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z"/></svg>My protection</button><button className={styles.secondary} onClick={() => setTab('claim')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>Start a claim</button><button className={styles.secondary} onClick={() => setTab('claims')}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 11h6M9 15h4"/></svg>My claims &amp; coupons · {data.claims.length}</button></div></> : <button className={styles.backBtn} onClick={() => setTab('overview')}>‹ Exam Protection</button>) :
    <nav className={styles.tabs} role="tablist">{tabs.map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? styles.tabOn : ''} onClick={() => setTab(key)}>{label}</button>)}</nav>}
    {tab === 'overview' && <>
      <details className={`${styles.card} ${styles.benefitDrop}`}><summary><h2>Exam protection benefits</h2></summary><p>If you score below 38%, choose one when you claim.</p><div className={styles.math}><div className={styles.cGreen}><small>Refund</small><strong>Full refund</strong><span>minus a minimal ₹10 fee</span></div><div className={styles.cIndigo}><small>Discount on next purchase</small><strong>1.5 × fee</strong><span>Ex: ₹50 fee → ₹75 off</span></div></div><button className={styles.secondary} onClick={() => setKnowMore(true)}>Know more</button></details>
      {data.manager && <section className={styles.stats}><div><small>Purchases</small><strong>{data.isOpen ? 'Open' : 'Closed'}</strong><button disabled={busy} className={data.isOpen ? styles.secondary : ''} onClick={() => run(() => protectionRequest('/settings', 'PUT', { isOpen: !data.isOpen }))}>{data.isOpen ? 'Close purchases' : 'Open purchases'}</button></div><div><small>Courses offered</small><strong>{data.courses.length}</strong><Link href="/manage?tab=courses">Set fees in Manage Course →</Link></div><div><small>Open claims</small><strong>{open}</strong><button className={styles.secondary} onClick={() => setTab('claims')}>Review claims</button></div></section>}
      {data.manager && <section className={styles.card}><div className={styles.sectionHeader}><h2>{data.manager ? 'Courses with protection' : 'Get protection'}</h2>{data.manager && <span className={`${styles.badge} ${data.isOpen ? styles.tGreen : ''}`}>{data.isOpen ? 'Open' : 'Closed'}</span>}</div>{!data.courses.length ? <p className={styles.empty}>{data.manager ? 'No course has a protection fee yet. Add one in Manage Course.' : 'No more courses to protect right now.'}</p> : <div className={styles.list}>{data.courses.map(course => <div key={course.id} className={styles.row}><div className={styles.rowMain}><div><h3>{course.name}</h3>{data.manager && <p>₹{course.fee} · refund ₹{refundForFee(course.fee)} or discount ₹{discountForFee(course.fee)}</p>}</div></div><div className={styles.actions}>{data.manager && (course.claimWindow === 'not_open' ? <button disabled={busy} onClick={() => { if (window.confirm(`Open claims for ${course.name}? Protected students are notified and have 7 days to claim. This cannot be undone.`)) run(() => protectionRequest('/courses/' + course.id + '/open-claims', 'POST')); }}>Open claims · 7 days</button> : course.claimWindow === 'open' ? <span className={`${styles.badge} ${styles.tAmber}`}>Claims open until {date(course.claimsCloseAt!)}</span> : <span className={styles.badge}>Claim window closed</span>)}{course.protected && <span className={`${styles.badge} ${styles.tGreen}`}>Protected</span>}<button className={styles.secondary} onClick={() => { setPurchasing(null); setDetail(course); }}>View Details</button>{!course.protected && !data.manager && <button disabled={busy || !data.isOpen} onClick={() => { setAccepted(false); setDetail(null); setPurchasing(course); }}>{data.isOpen ? 'Add Protection' : 'Closed'}</button>}</div></div>)}</div>}</section>}
    </>}
    {tab === 'overview' && !data.manager && <Faq/>}
    {tab === 'claim' && !data.manager && <ClaimForm purchases={data.purchases.filter(p => !p.claim && p.claimWindow === 'open')} reasons={data.reasons} run={run} busy={busy} onProtect={() => setTab('protection')}/>}
    {tab === 'protection' && !data.manager && <section className={styles.card}><div className={styles.sectionHeader}><h2>My protection</h2><span className={styles.info} tabIndex={0} title={`Protected courses stay listed for ${data.retentionDays} days from purchase.`} aria-label="Protected courses stay listed for a limited time from purchase.">i</span></div>{data.purchases.length ? <div className={styles.list}>{data.purchases.map(p => <div className={styles.row} key={p.id}><div><h3>{p.courseName}</h3><p>₹{p.fee} paid · valid until your exam ends</p><div className={styles.tags}><span className={styles.cGreen}>₹{refundForFee(p.fee)} refund</span><span className={styles.cIndigo}>or ₹{discountForFee(p.fee)} coupon</span></div></div><span className={`${styles.badge} ${p.claim ? styles.tBlue : p.claimWindow === 'open' ? styles.tAmber : p.claimWindow === 'closed' ? '' : styles.tGreen}`}>{p.claim ? 'Claimed' : p.claimWindow === 'open' ? `Claim by ${date(p.claimsCloseAt!)}` : p.claimWindow === 'closed' ? 'Claim window closed' : 'Protected'}</span></div>)}</div> : <div className={styles.emptyBar}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z"/></svg><div><strong>No courses protected yet</strong><span>Choose a course below to protect it.</span></div></div>}</section>}
    {tab === 'protection' && !data.manager && <section className={styles.card}><div className={styles.sectionHeader}><h2>Available to protect</h2></div>{data.courses.filter(c => !c.protected).length === 0 ? <p className={styles.empty}>You have protected all your eligible courses.</p> : <div className={styles.tiles}>{data.courses.filter(c => !c.protected).map(course => <div key={course.id} className={styles.tile} role="button" tabIndex={0} onClick={() => { setPurchasing(null); setDetail(course); }} onKeyDown={e => { if (e.key === 'Enter') { setPurchasing(null); setDetail(course); } }}><div><h3>{course.name}</h3></div><button disabled={busy || !data.isOpen} onClick={e => { e.stopPropagation(); setAccepted(false); setDetail(null); setPurchasing(course); }}>{data.isOpen ? 'Protect' : 'Closed'}</button></div>)}</div>}<p className={styles.hint}>Click a course to see how it works.</p></section>}
    {tab === 'purchases' && <section className={styles.card}><div className={styles.sectionHeader}><h2>Purchases</h2><small>Last {data.retentionDays} days</small></div>{data.purchases.length ? <div className={styles.list}>{data.purchases.map(p => <div className={styles.row} key={p.id}><div><h3>{p.courseName}</h3><p>{p.user?.name} · {p.user?.email}</p></div><div className={styles.actions}><span>₹{p.fee} · {date(p.paidAt)}</span><span className={`${styles.badge} ${p.claim ? styles.tBlue : styles.tGreen}`}>{p.claim ? 'Claimed' : 'Protected'}</span></div></div>)}</div> : <p className={styles.empty}>No purchases in this period.</p>}</section>}
    {tab === 'claims' && <section className={styles.stack}>{data.manager && <div className={styles.card}><h2>Decision paths</h2><ul className={styles.decide}><li style={{ ['--c' as string]: '#16a34a' }}><span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M7 17 17 7M8 7h9v9"/></svg></span><div><strong>Approve</strong><p>Moves the claim to Approved. The benefit still has to be delivered before you mark it Completed.</p></div></li><li style={{ ['--c' as string]: '#dc2626' }}><span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M18 6 6 18M6 6l12 12"/></svg></span><div><strong>Reject with a reason</strong><p>The student sees Rejected and your reason in their claim history. No benefit is delivered.</p></div></li><li style={{ ['--c' as string]: '#d97706' }}><span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6M12 17h.01"/></svg></span><div><strong>Request more information</strong><p>The student sees your request, replies and can replace the screenshot. Their reply returns the claim to Under Review.</p></div></li><li style={{ ['--c' as string]: '#2563eb' }}><span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 6h16M4 12h16M4 18h10"/></svg></span><div><strong>Add internal note</strong><p>Private to managers. Never shown to students or included in notifications.</p></div></li></ul><p className={styles.hint}>Refunds and coupons are delivered manually. Mark a claim Completed only after the refund is actually issued or the coupon is assigned. Claims stay on the manager dashboard for 360 days.</p></div>}<div className={styles.sectionHeader}><h2>{data.manager ? 'Claims' : 'My claims'}</h2><span className={styles.info} tabIndex={0} title={`Claims stay listed for ${data.retentionDays} days. Result screenshots are deleted 60 days after submission; other details are kept.`} aria-label={`Claims stay listed for ${data.retentionDays} days. Result screenshots are deleted 60 days after submission; other details are kept.`}>i</span></div>{!data.claims.length ? <div className={`${styles.card} ${styles.empty}`}>No claims yet.</div> : data.claims.map(claim => <ClaimCard key={claim.id} claim={claim} manager={data.manager} busy={busy} run={run} tone={tone(claim.status)}/>)}{!data.manager && <button className={styles.afterBtn} onClick={() => setKnowMore(true)}><strong>What happens after approval?</strong><span>See the refund and coupon paths</span></button>}{!data.manager && <div className={styles.card}><h2>How a claim moves</h2><ol className={styles.life}>{LIFECYCLE.map(([t, d, c], i) => <li key={t} style={{ ['--c' as string]: c }}><span>{i + 1}</span><div><strong>{t}</strong><p>{d}</p></div></li>)}</ol></div>}</section>}
    {tab === 'claims' && !data.manager && data.coupons.length > 0 && <section className={styles.stack}><h2>My coupons</h2><div className={styles.scratch}><strong>Scratch to reveal your coupon.</strong><span>Once scratched, use it within 7 days.</span></div>{data.claims.filter(c => c.benefit === 'coupon' && c.deliveredAt && !c.coupon).map(c => <p key={c.id} className={styles.notice}>The coupon for {c.purchase.courseName} is unavailable. Contact your manager with claim {c.id}.</p>)}{data.coupons.length ? data.coupons.map(c => <div className={styles.coupon} key={c.id}><div><small>{c.purchase.courseName}</small><h3>₹{discountForFee(c.purchase.fee)} off</h3></div>{c.couponRevealedAt ? <><code>{c.coupon?.code}</code><p>Expires {c.coupon?.expiresAt ? date(c.coupon.expiresAt) : '—'} · {c.coupon?.currentUses}/{c.coupon?.maxUses ?? 1} used</p><button className={styles.secondary} onClick={() => navigator.clipboard.writeText(c.coupon?.code || '').then(() => setNotice('Coupon code copied.')).catch(() => setNotice('Select and copy the code.'))}>Copy code</button></> : <><div className={styles.hidden} aria-hidden>••••••••</div><button disabled={busy} onClick={() => run(() => protectionRequest('/claims/' + c.id + '/reveal', 'POST'))}>Reveal · starts 7 days</button></>}</div>) : <div className={`${styles.card} ${styles.empty}`}>Your coupon appears here once a manager assigns it.</div>}<div className={styles.card}><h2>How to redeem</h2><ol className={styles.steps}><li>Open <a href="https://genziitian.in/courses" target="_blank" rel="noopener noreferrer">genziitian.in/courses</a> or <Link href="/courses/explore">this site’s course store</Link>.</li><li>Choose the same course. A Python coupon works for Python only.</li><li>Sign in with <strong>{data.email}</strong>.</li><li>Apply the code at checkout within 7 days of revealing it.</li></ol></div></section>}
  </>}
  {knowMore && <div className={styles.sheetBack} onClick={() => setKnowMore(false)}><div className={styles.sheet} role="dialog" aria-modal="true" aria-label="How Exam Protection works" onClick={e => e.stopPropagation()}><div className={styles.sectionHeader}><h2>How Exam Protection works</h2><button className={styles.secondary} onClick={() => setKnowMore(false)}>Close</button></div><p>Add protection before the exam. It stays valid until your exam ends. When official results are declared, claims open and you get a notification. You then have 7 days to claim.</p><div className={styles.paths}><div className={styles.path} style={{ ['--c' as string]: '#16a34a' }}><span className={styles.pathTag}>Refund path</span><strong>Full refund</strong><ol><li>Choose Refund when you claim.</li><li>Your claim is reviewed and approved.</li><li>We send your fee back, minus a minimal ₹10 fee.</li><li>You get a notification when it is done.</li></ol><p>Example: ₹50 fee → ₹40 back.</p></div><div className={styles.path} style={{ ['--c' as string]: 'var(--primary)' }}><span className={styles.pathTag}>Coupon path</span><strong>1.5 × fee</strong><ol><li>Choose Discount when you claim.</li><li>Your claim is reviewed and approved.</li><li>A coupon is added to My claims &amp; coupons.</li><li>Reveal it and use it within 7 days on the same course.</li></ol><p>Example: ₹50 fee → ₹75 off the same course.</p></div></div><p className={styles.hint}>Late claims after the 7-day window are void.</p><button className={styles.secondary} onClick={() => { setKnowMore(false); setGuide(true); }}>Read the full guide</button></div></div>}
  <Link href="/support" className={styles.fab} aria-label="Need help? Contact support"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/></svg>Need help?</Link>
  <dialog aria-labelledby="protection-dialog-title" className={styles.dialog} ref={dialog} onCancel={() => { setDetail(null); setPurchasing(null); setGuide(false); }} onClose={() => { setDetail(null); setPurchasing(null); setGuide(false); }}>{guide ? <Guide onBack={() => setGuide(false)}/> : <><small className={styles.eyebrow}>{purchasing ? 'Add Protection' : 'Details'}</small><h2 id="protection-dialog-title">{(detail || purchasing)?.name}</h2><div className={styles.feeHero}><strong>₹{(detail || purchasing)?.fee}</strong><span>one-time fee · valid until your exam ends</span></div><h3>How it works</h3><ol className={styles.howSteps}><li>When results are declared, we notify you. Claims stay open for 7 days.</li><li>Attend the exam. Below 38% counts as a fail, and then you can claim with your result screenshot.</li><li>If your claim is verified and everything checks out, pick one of the two options below.</li><li>We recommend you read the full points and rules before you pay. <button type="button" className={styles.linkBtn} onClick={() => setGuide(true)}>Read the full guide</button></li></ol><h3>Your two options</h3><div className={styles.math}><div className={styles.cGreen}><small>Full refund</small><strong>₹{refundForFee((detail || purchasing)?.fee || 0)}</strong><span>back to you, minus a nominal fee</span></div><div className={styles.cIndigo}><small>Discount on next purchase</small><strong>₹{discountForFee((detail || purchasing)?.fee || 0)}</strong><span>1.5 × your fee, same course</span></div></div><p className={styles.hint}>Claims made after the 7-day window are void.</p>{purchasing && <p className={styles.hint}>By continuing, you agree to our <Link href="/company/terms-and-conditions">Terms and Conditions</Link>.</p>}<div className={styles.actions}><Link href="/support" className={styles.help}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2Z"/></svg>Need help?</Link><button className={styles.secondary} onClick={() => { setDetail(null); setPurchasing(null); }}>Close</button>{detail && !purchasing && !data?.manager && !detail.protected && data?.isOpen && <button onClick={() => { const c = detail; setDetail(null); setPurchasing(c); }}>Get protection now</button>}{purchasing && <button disabled={busy} onClick={buy}>Pay ₹{purchasing.fee} &amp; protect</button>}</div></>}</dialog>
  </main>;
}
type Run = (work: () => Promise<unknown>) => Promise<void>;
const FAQS: [string, string][] = [["What does Exam Protection cover?", "If you score below 38% in the exam for a protected course, you choose a refund or a bigger discount on the same course."], ["How much do I get back?", "Refund: your fee minus ₹10. Discount: 1.5× your fee. For example, a ₹50 fee gives a ₹40 refund or a ₹75 discount."], ["When can I add protection?", "Before your exam, while protection is open for your course. Tap Add Protection on the course."], ["How do I make a claim?", "When official results are declared, claims open and you get a notification. Within 7 days, tap Start a claim, pick your benefit, answer a few quick questions and upload your result screenshot."], ["What proof do I need?", "A screenshot of your official results dashboard. PNG, JPEG or WebP, up to 5 MB."], ["How will I know my claim status?", "You get a notification at every update, and you can follow it anytime in My claims."], ["How do I receive my refund?", "Once your claim is approved, the refund is sent back to you and marked complete in My claims."], ["How do I use my discount coupon?", "Open My coupons and tap Reveal. Use the code within 7 days on the same course, signed in with the same email."], ["Can I use the coupon on another course?", "It works only for the same course you protected. The exam can be different, for example a later quiz or term of that course."], ["Do I have to attend the exam?", "Yes. You must attend the exam for the protected course. If you skip it, you cannot claim."], ["What if I pass?", "Congratulations! No claim is needed. Your protection simply covered you for that exam."]];
function Faq() {
    const [all, setAll] = useState(false);
    return <section className={`${styles.card} ${styles.faq}`}><h2>Frequently asked questions</h2>{(all ? FAQS : FAQS.slice(0, 2)).map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}<button className={styles.secondary} onClick={() => setAll(!all)}>{all ? 'Show less' : `Show all ${FAQS.length} questions`}</button></section>;
}
const LIFECYCLE: [string, string, string][] = [["Submitted", "We have received your claim.", "#2563eb"], ["Under Review", "We are checking your result and eligibility.", "#2563eb"], ["More Information Required", "Please send the extra details or proof we asked for.", "#d97706"], ["Approved", "Your benefit is approved and on its way.", "#16a34a"], ["Rejected", "Not eligible. You will see the reason.", "#dc2626"], ["Processing", "We are arranging your refund or coupon.", "#d97706"], ["Completed", "Refund issued or coupon added to My coupons.", "#16a34a"]];
function YouGet({ refund, fee }: { refund: boolean; fee: number }) {
    return <div className={`${styles.youGet} ${refund ? styles.cGreen : styles.cIndigo}`}><strong>{refund ? `You get ₹${refundForFee(fee)} refund` : `You get a ₹${discountForFee(fee)} coupon`}</strong><span>{refund ? `₹${fee} paid − ₹10 fee` : `1.5 × ₹${fee}, same course only`}</span></div>;
}
const CLAIM_STEPS = ['Course & benefit', 'About the exam', 'Result proof', 'Review'];
function Stepper({ steps, at }: { steps: string[]; at: number }) {
    return <ol className={styles.stepper} aria-label={`Step ${at + 1} of ${steps.length}`}>{steps.map((label, i) => <li key={label} className={i < at ? styles.stepDone : i === at ? styles.stepOn : ''} aria-current={i === at ? 'step' : undefined}><span>{i + 1}</span><em>{label}</em></li>)}</ol>;
}
function ClaimForm({ purchases, reasons, run, busy, onProtect }: {
    onProtect: () => void;
    purchases: ProtectionPurchase[];
    reasons: string[];
    run: Run;
    busy: boolean;
}) {
    const [step, setStep] = useState(0), [purchaseId, setPurchase] = useState(''), [benefit, setBenefit] = useState<'refund' | 'coupon' | ''>(''), [reason, setReason] = useState(''), [attempted, setAttempted] = useState(''), [marks, setMarks] = useState(''), [message, setMessage] = useState(''), [released, setReleased] = useState(false), [file, setFile] = useState<File | null>(null), [preview, setPreview] = useState(''), [fileError, setFileError] = useState('');
    useEffect(() => {
        if (!file) { setPreview(''); return; }
        const url = URL.createObjectURL(file);
        setPreview(url);
        return () => URL.revokeObjectURL(url);
    }, [file]);
    const purchase = purchases.find(p => p.id === purchaseId);
    function choose(file: File | null) {
        setFileError('');
        if (file && (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) {
            setFile(null);
            setFileError('Choose a PNG, JPEG or WebP image up to 5 MB.');
            return;
        }
        setFile(file);
    }
    const marksOk = attempted === 'no' || (attempted === 'yes' && marks !== '' && Number.isFinite(Number(marks)) && Number(marks) >= 0 && Number(marks) < 38);
    const ready = [!!purchase && !!benefit, !!reason && attempted === 'yes' && marksOk, !!file && released, true][step];
    function reset() { setStep(0); setPurchase(''); setBenefit(''); setReason(''); setAttempted(''); setMarks(''); setMessage(''); setReleased(false); setFile(null); }
    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (step < 3) { if (ready) setStep(step + 1); return; }
        run(async () => {
            if (!file) throw new Error('Upload a valid result screenshot.');
            const body = new FormData();
            body.append('proof', file);
            body.append('data', JSON.stringify({ purchaseId, benefit, attempted: attempted === 'yes', reason, marks: attempted === 'yes' ? marks : null, message, resultsReleased: released }));
            await protectionRequest('/claims', 'POST', body);
            reset();
        });
    }
    if (!purchases.length) return <section className={`${styles.card} ${styles.claimCard}`}><div className={styles.sectionHeader}><h2>Start a claim</h2></div><div className={styles.lock}>Claims open after official results are declared. You will get a notification, then you have 7 days to claim. Late claims are void.</div><button onClick={onProtect}>Protect now</button><div className={styles.preview} aria-hidden><label>Protected course<select disabled><option>Your protected course</option></select></label><div className={styles.choices}><div className={`${styles.choice} ${styles.cGreen}`}><small>Refund</small><strong>Fee − ₹10</strong></div><div className={`${styles.choice} ${styles.cIndigo}`}><small>Same-course discount</small><strong>1.5 × fee</strong></div></div><label>Why didn’t you pass?<select disabled><option>Choose a reason</option></select></label><div className={styles.reasonChips}>{reasons.map(r => <span key={r}>{r}</span>)}</div><label>Did you attempt the exam?<select disabled><option>Yes / No</option></select></label><label>Percentage you got in this exam<input disabled placeholder="Enter your percentage"/></label><label>Anything else? (optional)<textarea disabled rows={2}/></label><div className={styles.drop}><strong>Upload official results screenshot</strong><span>PNG, JPEG or WebP · up to 5 MB</span></div><label className={styles.check}><input type="checkbox" disabled/>My official exam results have been released.</label></div></section>;
    return <section className={`${styles.card} ${styles.claimCard}`}><div className={styles.sectionHeader}><h2>Start a claim</h2><small>Step {step + 1} of 4</small></div><Stepper steps={CLAIM_STEPS} at={step}/>
    <form onSubmit={submit} className={styles.wizard}>
    {step === 0 && <><label>Protected course<select required value={purchaseId} onChange={e => setPurchase(e.target.value)}><option value="">Select a course</option>{purchases.map(p => <option value={p.id} key={p.id}>{p.courseName}</option>)}</select></label>
      <fieldset className={styles.choices}><legend>Choose your benefit</legend>
        <label className={`${styles.choice} ${styles.cGreen} ${benefit === 'refund' ? styles.choiceOn : ''}`}><input type="radio" name="benefit" checked={benefit === 'refund'} onChange={() => setBenefit('refund')}/><small>Refund</small><strong>{purchase ? `₹${refundForFee(purchase.fee)}` : 'Fee − ₹10'}</strong><span>Back to your original payment</span></label>
        <label className={`${styles.choice} ${styles.cIndigo} ${benefit === 'coupon' ? styles.choiceOn : ''}`}><input type="radio" name="benefit" checked={benefit === 'coupon'} onChange={() => setBenefit('coupon')}/><small>Same-course discount</small><strong>{purchase ? `₹${discountForFee(purchase.fee)}` : '1.5 × fee'}</strong><span>Coupon for this course, valid 7 days after reveal</span></label>
      </fieldset>{purchase && benefit && <YouGet refund={benefit === 'refund'} fee={purchase.fee}/>}</>}
    {step === 1 && <><label>Why didn’t you pass?<select required value={reason} onChange={e => setReason(e.target.value)}><option value="">Choose a reason</option>{reasons.map(r => <option key={r}>{r}</option>)}</select></label>
      <fieldset className={styles.segment}><legend>Did you attempt the exam?</legend>{[['yes', 'Yes'], ['no', 'No']].map(([v, l]) => <label key={v} className={attempted === v ? styles.segOn : ''}><input type="radio" name="attempted" checked={attempted === v} onChange={() => setAttempted(v)}/>{l}</label>)}</fieldset>
      {attempted === 'no' && <p className={styles.hint}>You must attend the exam to claim.</p>}
      {attempted === 'yes' && <><label>Percentage you got in this exam (%)<input type="number" min="0" max="100" step="0.01" required value={marks} onChange={e => setMarks(e.target.value)} placeholder="e.g. 32"/></label>{marks !== '' && Number(marks) >= 38 && <p className={styles.hint}>38% or above is a pass, so this exam is not eligible for a claim.</p>}{marks === '' && <p className={styles.hint}>Pass mark is 38%. Claims are for scores below 38%.</p>}</>}
      <label>Anything else? <small>Optional</small><textarea maxLength={2000} rows={3} value={message} onChange={e => setMessage(e.target.value)}/></label></>}
    {step === 2 && <><label className={styles.drop}><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => choose(e.target.files?.[0] || null)}/>{preview ? <img className={styles.proof} src={preview} alt="Selected result screenshot"/> : <><strong>Upload official results screenshot</strong><span>PNG, JPEG or WebP · up to 5 MB</span></>}</label>{file && <small>{file.name} · tap the image to replace it</small>}{fileError && <p role="alert" className={styles.error}>{fileError}</p>}
      <label className={styles.check}><input type="checkbox" checked={released} onChange={e => setReleased(e.target.checked)}/>My official exam results have been released.</label></>}
    {step === 3 && purchase && <dl className={styles.review}><div><dt>Course</dt><dd>{purchase.courseName}</dd></div><div><dt>Benefit</dt><dd>{benefit === 'refund' ? `Refund · ₹${refundForFee(purchase.fee)}` : `Discount · ₹${discountForFee(purchase.fee)}`}</dd></div><div><dt>Reason</dt><dd>{reason}</dd></div><div><dt>Attempted</dt><dd>{attempted === 'yes' ? `Yes · ${marks}%` : 'No'}</dd></div>{message && <div><dt>Note</dt><dd>{message}</dd></div>}<div><dt>Proof</dt><dd>{file?.name}</dd></div></dl>}
    {step === 3 && <p className={styles.hint}>A manager reviews your claim manually. You’ll be notified at each status change.</p>}
    <div className={styles.wizardNav}>{step > 0 ? <button type="button" className={styles.secondary} onClick={() => setStep(step - 1)}>Back</button> : <span/>}<button disabled={busy || !ready}>{step < 3 ? 'Continue' : 'Submit claim'}</button></div>
    </form></section>;
}
function ClaimCard({ claim: c, manager, busy, run, tone }: {
    tone: string;
    claim: ProtectionClaim;
    manager: boolean;
    busy: boolean;
    run: Run;
}) {
    const [message, setMessage] = useState(''), [reference, setReference] = useState(''), [code, setCode] = useState(''), [bundleId, setBundle] = useState(''), [confirmed, setConfirmed] = useState(false), [replacement, setReplacement] = useState<File | null>(null);
    const reviewing = ['Submitted', 'Under Review'].includes(c.status), approved = ['Approved', 'Processing'].includes(c.status);
    const { data: eligibleBundles, error: bundleError } = useSWR<{
        id: string;
        name: string;
    }[]>(manager && c.benefit === 'coupon' && approved && !c.deliveredAt ? '/api/exam-protection/claims/' + c.id + '/bundles' : null, () => protectionRequest<{
        id: string;
        name: string;
    }[]>('/claims/' + c.id + '/bundles'));
    const action = (action: string) => run(() => protectionRequest('/claims/' + c.id + '/action', 'POST', { action, message, reference, code, bundleId, delivered: confirmed, refundAmount: refundForFee(c.purchase.fee) }));
    return <article className={styles.card}><div className={styles.sectionHeader}><div><h3>{c.purchase.courseName}</h3><small>{c.id} · {date(c.createdAt)}</small></div><span className={`${styles.badge} ${tone}`}>{c.status}</span></div><YouGet refund={c.benefit === 'refund'} fee={c.purchase.fee}/>{manager && <p>{c.purchase.user?.name} · {c.purchase.user?.email}</p>}<dl className={styles.grid}><div><dt>Requested benefit</dt><dd>{c.benefit === 'refund' ? `₹${refundForFee(c.purchase.fee)} refund` : `₹${discountForFee(c.purchase.fee)} discount`}</dd></div><div><dt>Reason</dt><dd>{c.reason}</dd></div><div><dt>Attempted exam</dt><dd>{c.attempted ? 'Yes' : 'No'}</dd></div><div><dt>Percentage</dt><dd>{c.marks != null ? `${c.marks}%` : 'Not attempted'}</dd></div></dl>{c.message && <p className={styles.message}>Student message: {c.message}</p>}{c.proof ? <a href={'/api/exam-protection/claims/' + c.id + '/proof'} target="_blank" rel="noopener noreferrer">View official result proof ↗</a> : <p>Uploaded proof media was deleted after 60 days. Other claim details are retained.</p>}<div className={styles.history}>{c.events.map(e => <div key={e.id}><strong>{e.internal ? 'Internal note · managers only' : 'Update'}</strong><p>{e.message}</p><small>{date(e.createdAt)}</small></div>)}</div>{!manager && c.status === 'More Information Required' && <form onSubmit={e => {
                e.preventDefault();
                run(async () => {
                    const body = new FormData();
                    body.append('message', message);
                    if (replacement)
                        body.append('proof', replacement);
                    await protectionRequest('/claims/' + c.id + '/reply', 'POST', body);
                    setMessage('');
                    setReplacement(null);
                });
            }}><label>Reply to manager<textarea required maxLength={2000} value={message} onChange={e => setMessage(e.target.value)}/></label><label>Replace result proof (optional)<input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => setReplacement(e.target.files?.[0] || null)}/></label><button disabled={busy}>Submit additional information</button></form>}{manager && <><div className={styles.actions}><button disabled={busy || c.status !== 'Submitted'} onClick={() => action('review')}>Under Review</button><button disabled={busy || !reviewing} onClick={() => action('approve')}>Approve</button><button disabled={busy || c.status !== 'Approved'} onClick={() => action('processing')}>Processing</button></div><label>Reason / information request / internal note<textarea maxLength={2000} value={message} onChange={e => setMessage(e.target.value)}/></label><div className={styles.actions}><button disabled={busy || !reviewing || !message.trim()} onClick={() => action('reject')}>Reject with reason</button><button disabled={busy || !reviewing || !message.trim()} onClick={() => action('information')}>Request More Information</button><button className={styles.secondary} disabled={busy || !message.trim()} onClick={() => action('note')}>Add Internal Note</button></div>{approved && !c.deliveredAt && <div className={styles.fulfillment}><h3>Record manual delivery</h3>{c.benefit === 'refund' ? <><p>Issue ₹{refundForFee(c.purchase.fee)} manually through your payment or banking process.</p><label>Transaction/reference (optional)<input maxLength={200} value={reference} onChange={e => setReference(e.target.value)}/></label></> : <><p>Create an unused, inactive, hidden fixed ₹{discountForFee(c.purchase.fee)} coupon in <Link href="/manage/coupons">Coupon Management</Link>, then assign it here. Only a bundle containing the same subject is eligible.</p><label>Manually generated coupon code<input value={code} onChange={e => setCode(e.target.value)}/></label><label>Eligible course bundle<select value={bundleId} onChange={e => setBundle(e.target.value)}><option value="">Select the eligible course bundle</option>{eligibleBundles?.map(bundle => <option key={bundle.id} value={bundle.id}>{bundle.name}</option>)}</select></label>{bundleError && <p role="alert">Eligible bundles could not load. Refresh to retry.</p>}{eligibleBundles?.length === 0 && <p>No same-subject bundle is configured. Create one in the existing course store before assigning this coupon.</p>}</>}<label className={styles.check}><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>I confirm the refund was actually issued or the coupon is ready for assignment.</label><button disabled={busy || !confirmed} onClick={() => action(c.benefit === 'refund' ? 'refund' : 'coupon')}>{c.benefit === 'refund' ? 'Mark Refund Completed' : 'Mark Coupon Issued'}</button></div>}{c.deliveredAt && <><p>Delivered {date(c.deliveredAt)}{c.refundAmount !== null ? ` · ₹${c.refundAmount}` : ''}{c.refundReference ? ` · ${c.refundReference}` : ''}</p><button disabled={busy || c.status !== 'Processing'} onClick={() => action('complete')}>Mark Benefit Completed</button></>}</>}</article>;
}

function Guide({ onBack }: { onBack: () => void }) {
    const journey: [string, string][] = [["Add protection", "Buy protection on your course before the exam. You pay a small one-time fee."], ["Attend your exam", "Protection stays valid until your exam ends. You must attend the exam."], ["Results are declared", "When official results are out, claims open. You get a notification and an email."], ["Make your claim", "You have 7 days. Pick your benefit, answer a few quick questions and upload your result screenshot."], ["We review your claim", "You get a notification at every update and can follow it anytime in My claims."], ["Receive your benefit", "Your refund is sent back, or your coupon is added to My coupons."]];
    return <div className={styles.guide}>
        <div className={styles.sectionHeader}><h2>Exam Protection: full guide</h2><button className={styles.secondary} onClick={onBack}>Back</button></div>
        <p>Exam Protection is a small one-time add-on for a course. If you attend the exam and do not pass, you can claim either a refund or a bigger discount on the same course. This page explains everything, step by step.</p>
        <h3>The journey at a glance</h3>
        <ol className={styles.journey}>{journey.map(([t, x], i) => <li key={t}><span>{i + 1}</span><div><strong>{t}</strong><p>{x}</p></div></li>)}</ol>
        <h3>Before you buy</h3>
        <ul className={styles.pts}><li>Protection is bought per course, and it covers the exam for that course.</li><li>You pay once. There is no renewal and no extra charge later.</li><li>Add it before your exam, while protection is open for your course. Tap Add Protection on the course.</li><li>It stays valid until your exam ends.</li></ul>
        <h3>Who can claim</h3>
        <ul className={styles.pts}><li>You must attend the exam for the protected course. If you skip it, you cannot claim.</li><li>A score of 38% or above counts as a pass, and no claim is needed. Below 38% counts as a fail, and you can claim.</li><li>Your official results must be released before you claim.</li><li>Use the same account and email you used to buy protection.</li></ul>
        <h3>Your two benefits</h3>
        <div className={styles.paths}><div className={styles.path} style={{ ['--c' as string]: '#16a34a' }}><span className={styles.pathTag}>Refund</span><strong>Fee − ₹10</strong><ol><li>Choose Refund when you claim.</li><li>Your claim is reviewed and approved.</li><li>We send your fee back, minus a minimal ₹10 fee.</li><li>It is marked complete in My claims and you get a notification.</li></ol><p>Example: ₹50 fee → ₹40 back to you.</p></div><div className={styles.path} style={{ ['--c' as string]: 'var(--primary)' }}><span className={styles.pathTag}>Coupon</span><strong>1.5 × fee</strong><ol><li>Choose Discount when you claim.</li><li>Your claim is reviewed and approved.</li><li>A coupon appears in My coupons.</li><li>Tap Reveal and use it within 7 days on the same course, signed in with the same email.</li></ol><p>Example: ₹50 fee → ₹75 off the same course.</p></div></div>
        <h3>How to make a claim</h3>
        <ul className={styles.pts}><li>Open Exam Protection, then tap Start a claim once claims are open.</li><li>Step 1: pick your protected course and your benefit (Refund or Discount).</li><li>Step 2: tell us why you did not pass, whether you attempted the exam, and the percentage you got.</li><li>Step 3: upload a screenshot of your official results dashboard. PNG, JPEG or WebP, up to 5 MB. You can preview or replace it before you submit.</li><li>Step 4: confirm that your official results have been released, check the summary and submit.</li></ul>
        <h3>What each status means</h3>
        <ul className={styles.life}>{LIFECYCLE.map(([name, note, c], i) => <li key={name} style={{ ['--c' as string]: c }}><span>{i + 1}</span><div><strong>{name}</strong><p>{note}</p></div></li>)}</ul>
        <h3>Important rules</h3>
        <ul className={styles.pts}><li>The claim window is 7 days from the day claims open. Claims made after that are void.</li><li>Each protection can be claimed once, with one benefit: refund or coupon, not both.</li><li>Coupons work only on the course you protected. The exam can be different, for example a later quiz or term of that course.</li><li>Please share only true information and your own official result screenshot.</li><li>Your claims stay visible in My claims for a limited time. Uploaded screenshots are deleted after 60 days; other claim details remain.</li><li>Decisions on claims follow these rules and our Terms and Conditions.</li></ul>
        <h3>Common questions</h3>
        <section className={styles.faq}>{FAQS.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</section>
        <p className={styles.hint}><Link href="/company/terms-and-conditions">Read the Terms and Conditions</Link></p>
    </div>;
}
