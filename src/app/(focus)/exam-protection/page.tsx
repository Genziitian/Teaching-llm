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
    useEffect(() => {
        if (detail || purchasing)
            dialog.current?.showModal();
        else
            dialog.current?.close();
    }, [detail, purchasing]);
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
        if (!purchasing || !accepted)
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
    const [tab, setTab] = useState('overview');
    const tone = (status: string) => ({ Submitted: styles.tBlue, 'Under Review': styles.tBlue, 'More Information Required': styles.tAmber, Approved: styles.tGreen, Processing: styles.tAmber, Completed: styles.tGreen, Rejected: styles.tRed } as Record<string, string>)[status] || '';
    const tabs = data ? (data.manager ? [['overview', 'Overview'], ['claims', `Claims · ${data.claims.length}`], ['purchases', `Purchases · ${data.purchases.length}`]] : [['overview', 'Protect'], ['claims', `My claims · ${data.claims.length}`], ['coupons', 'My Coupons']]) : [];
    const open = data?.claims.filter(c => !['Completed', 'Rejected'].includes(c.status)).length ?? 0;
    return <main className={styles.page}><Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive"/>
    <header className={styles.hero}><Link href="/dashboard" className={styles.back}>‹ Back</Link><p className={styles.eyebrow}>Academics</p><h1>Exam Protection</h1><p className={styles.lede}>{data?.manager ? 'Manage availability, course fees and claim reviews.' : 'Protect your Quiz 1 attempt. If you do not pass, request a refund or a same-course discount.'}</p></header>
    <div role="status" aria-live="polite">{notice && <p className={styles.notice}>{notice}</p>}</div>
    {isLoading ? <div className={styles.skeleton} aria-label="Loading"/> : error ? <div className={styles.card} role="alert"><p>{error.message}</p><button onClick={() => mutate()}>Try again</button></div> : data && <>
    <nav className={styles.tabs} role="tablist">{tabs.map(([key, label]) => <button key={key} role="tab" aria-selected={tab === key} className={tab === key ? styles.tabOn : ''} onClick={() => setTab(key)}>{label}</button>)}</nav>
    {tab === 'overview' && <>
      <section className={styles.benefit}><div><span className={styles.pill}>Failed Quiz 1</span><h2>Quiz 1 protection benefits</h2><p>One benefit is chosen at claim time. Amounts are calculated from the fee paid at purchase.</p></div><div className={styles.math}><div className={styles.cGreen}><small>Refund</small><strong>Fee − ₹10</strong><span>₹50 → ₹40</span></div><div className={styles.cIndigo}><small>Same-course discount</small><strong>1.5 × fee</strong><span>₹50 → ₹75</span></div></div></section>
      {data.manager && <section className={styles.stats}><div><small>Purchases</small><strong>{data.isOpen ? 'Open' : 'Closed'}</strong><button disabled={busy} className={data.isOpen ? styles.secondary : ''} onClick={() => run(() => protectionRequest('/settings', 'PUT', { isOpen: !data.isOpen }))}>{data.isOpen ? 'Close purchases' : 'Open purchases'}</button></div><div><small>Courses offered</small><strong>{data.courses.length}</strong><Link href="/manage?tab=courses">Set fees in Manage Course →</Link></div><div><small>Open claims</small><strong>{open}</strong><button className={styles.secondary} onClick={() => setTab('claims')}>Review claims</button></div></section>}
      <section className={styles.card}><div className={styles.sectionHeader}><h2>{data.manager ? 'Courses with protection' : 'Your courses'}</h2><span className={`${styles.badge} ${data.isOpen ? styles.tGreen : ''}`}>{data.isOpen ? 'Open' : 'Closed'}</span></div>{!data.courses.length ? <p className={styles.empty}>{data.manager ? 'No course has a protection fee yet. Add one in Manage Course.' : 'None of your enrolled Quiz 1 courses offer protection right now.'}</p> : <div className={styles.list}>{data.courses.map(course => <div key={course.id} className={styles.row}><div className={styles.rowMain}><span className={styles.ico} aria-hidden><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg></span><div><h3>{course.name}</h3><p>₹{course.fee} · refund ₹{refundForFee(course.fee)} or discount ₹{discountForFee(course.fee)}</p></div></div><div className={styles.actions}>{course.protected && <span className={`${styles.badge} ${styles.tGreen}`}>Protected</span>}<button className={styles.secondary} onClick={() => { setPurchasing(null); setDetail(course); }}>View Details</button>{!course.protected && !data.manager && <button disabled={busy || !data.isOpen} onClick={() => { setAccepted(false); setDetail(null); setPurchasing(course); }}>{data.isOpen ? 'Add Protection' : 'Closed'}</button>}</div></div>)}</div>}</section>
      {!data.manager && <ClaimForm purchases={data.purchases.filter(p => !p.claim)} reasons={data.reasons} run={run} busy={busy}/>}
    </>}
    {tab === 'purchases' && <section className={styles.card}><div className={styles.sectionHeader}><h2>Purchases</h2><small>Last {data.retentionDays} days</small></div>{data.purchases.length ? <div className={styles.list}>{data.purchases.map(p => <div className={styles.row} key={p.id}><div><h3>{p.courseName}</h3><p>{p.user?.name} · {p.user?.email}</p></div><div className={styles.actions}><span>₹{p.fee} · {date(p.paidAt)}</span><span className={`${styles.badge} ${p.claim ? styles.tBlue : styles.tGreen}`}>{p.claim ? 'Claimed' : 'Protected'}</span></div></div>)}</div> : <p className={styles.empty}>No purchases in this period.</p>}</section>}
    {tab === 'claims' && <section className={styles.stack}>{!data.manager && data.purchases.length > 0 && <div className={styles.list}>{data.purchases.map(p => <div className={styles.row} key={p.id}><div><h3>{p.courseName}</h3><p>₹{p.fee} paid {date(p.paidAt)} · shown until {until(p.paidAt, data.retentionDays)}</p></div><span className={`${styles.badge} ${styles.tGreen}`}>Protected</span></div>)}</div>}<p className={styles.hint}>Claims stay visible for {data.retentionDays} days. Proof images are deleted 60 days after submission; claim details remain.</p>{!data.claims.length ? <div className={`${styles.card} ${styles.empty}`}>No claims yet.</div> : data.claims.map(claim => <ClaimCard key={claim.id} claim={claim} manager={data.manager} busy={busy} run={run} tone={tone(claim.status)}/>)}</section>}
    {tab === 'coupons' && <section className={styles.stack}><div className={styles.scratch}><strong>Scratch to reveal your coupon.</strong><span>Once scratched, use it within 7 days.</span></div>{data.claims.filter(c => c.benefit === 'coupon' && c.deliveredAt && !c.coupon).map(c => <p key={c.id} className={styles.notice}>The coupon for {c.purchase.courseName} is unavailable. Contact your manager with claim {c.id}.</p>)}{data.coupons.length ? data.coupons.map(c => <div className={styles.coupon} key={c.id}><div><small>{c.purchase.courseName}</small><h3>₹{discountForFee(c.purchase.fee)} off</h3></div>{c.couponRevealedAt ? <><code>{c.coupon?.code}</code><p>Expires {c.coupon?.expiresAt ? date(c.coupon.expiresAt) : '—'} · {c.coupon?.currentUses}/{c.coupon?.maxUses ?? 1} used</p><button className={styles.secondary} onClick={() => navigator.clipboard.writeText(c.coupon?.code || '').then(() => setNotice('Coupon code copied.')).catch(() => setNotice('Select and copy the code.'))}>Copy code</button></> : <><div className={styles.hidden} aria-hidden>••••••••</div><button disabled={busy} onClick={() => run(() => protectionRequest('/claims/' + c.id + '/reveal', 'POST'))}>Reveal · starts 7 days</button></>}</div>) : <div className={`${styles.card} ${styles.empty}`}>Your coupon appears here once a manager assigns it.</div>}<div className={styles.card}><h2>How to redeem</h2><ol className={styles.steps}><li>Open <a href="https://genziitian.in/courses" target="_blank" rel="noopener noreferrer">genziitian.in/courses</a> or <Link href="/courses/explore">this site’s course store</Link>.</li><li>Choose the same course. A Python coupon works for Python only.</li><li>Sign in with <strong>{data.email}</strong>.</li><li>Apply the code at checkout within 7 days of revealing it.</li></ol></div></section>}
  </>}
  <dialog aria-labelledby="protection-dialog-title" className={styles.dialog} ref={dialog} onCancel={() => { setDetail(null); setPurchasing(null); }} onClose={() => { setDetail(null); setPurchasing(null); }}>{purchasing && <Stepper steps={['Details', 'Confirm & pay']} at={accepted ? 1 : 0}/>}<small className={styles.eyebrow}>{purchasing ? 'Add Protection' : 'Details'}</small><h2 id="protection-dialog-title">{(detail || purchasing)?.name}</h2><div className={styles.math}><div className={styles.cAmber}><small>You pay</small><strong>₹{(detail || purchasing)?.fee}</strong></div><div className={styles.cGreen}><small>Refund</small><strong>₹{refundForFee((detail || purchasing)?.fee || 0)}</strong></div><div className={styles.cIndigo}><small>or discount</small><strong>₹{discountForFee((detail || purchasing)?.fee || 0)}</strong></div></div><p>{RULES}</p><p>Upload your official results screenshot after release. A manager reviews it by hand. Refunds and coupons are delivered manually. Images are deleted 60 days after you claim; other details remain.</p>{purchasing && <label className={styles.check}><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}/>I have read the rules, conditions and benefits.</label>}<div className={styles.actions}><button className={styles.secondary} onClick={() => { setDetail(null); setPurchasing(null); }}>Close</button>{purchasing && <button disabled={!accepted || busy} onClick={buy}>Pay ₹{purchasing.fee}</button>}</div></dialog>
  </main>;
}
type Run = (work: () => Promise<unknown>) => Promise<void>;
const CLAIM_STEPS = ['Course & benefit', 'About the exam', 'Result proof', 'Review'];
function Stepper({ steps, at }: { steps: string[]; at: number }) {
    return <ol className={styles.stepper} aria-label={`Step ${at + 1} of ${steps.length}`}>{steps.map((label, i) => <li key={label} className={i < at ? styles.stepDone : i === at ? styles.stepOn : ''} aria-current={i === at ? 'step' : undefined}><span>{i + 1}</span><em>{label}</em></li>)}</ol>;
}
function ClaimForm({ purchases, reasons, run, busy }: {
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
    const marksOk = attempted === 'no' || (attempted === 'yes' && marks !== '' && Number.isFinite(Number(marks)) && Number(marks) >= 0);
    const ready = [!!purchase && !!benefit, !!reason && marksOk, !!file && released, true][step];
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
    if (!purchases.length) return <section className={`${styles.card} ${styles.claimCard}`}><div className={styles.sectionHeader}><h2>Start a claim</h2></div><p className={styles.empty}>Once you add protection to a course, you can claim here after Quiz 1 results are released.</p></section>;
    return <section className={`${styles.card} ${styles.claimCard}`}><div className={styles.sectionHeader}><h2>Start a claim</h2><small>Step {step + 1} of 4</small></div><Stepper steps={CLAIM_STEPS} at={step}/>
    <form onSubmit={submit} className={styles.wizard}>
    {step === 0 && <><label>Protected course<select required value={purchaseId} onChange={e => setPurchase(e.target.value)}><option value="">Select a course</option>{purchases.map(p => <option value={p.id} key={p.id}>{p.courseName}</option>)}</select></label>
      <fieldset className={styles.choices}><legend>Choose your benefit</legend>
        <label className={`${styles.choice} ${styles.cGreen} ${benefit === 'refund' ? styles.choiceOn : ''}`}><input type="radio" name="benefit" checked={benefit === 'refund'} onChange={() => setBenefit('refund')}/><small>Refund</small><strong>{purchase ? `₹${refundForFee(purchase.fee)}` : 'Fee − ₹10'}</strong><span>Back to your original payment</span></label>
        <label className={`${styles.choice} ${styles.cIndigo} ${benefit === 'coupon' ? styles.choiceOn : ''}`}><input type="radio" name="benefit" checked={benefit === 'coupon'} onChange={() => setBenefit('coupon')}/><small>Same-course discount</small><strong>{purchase ? `₹${discountForFee(purchase.fee)}` : '1.5 × fee'}</strong><span>Coupon for this course, valid 7 days after reveal</span></label>
      </fieldset></>}
    {step === 1 && <><label>Why didn’t you pass?<select required value={reason} onChange={e => setReason(e.target.value)}><option value="">Choose a reason</option>{reasons.map(r => <option key={r}>{r}</option>)}</select></label>
      <fieldset className={styles.segment}><legend>Did you attempt the exam?</legend>{[['yes', 'Yes'], ['no', 'No']].map(([v, l]) => <label key={v} className={attempted === v ? styles.segOn : ''}><input type="radio" name="attempted" checked={attempted === v} onChange={() => setAttempted(v)}/>{l}</label>)}</fieldset>
      {attempted === 'yes' && <label>Marks obtained in this course<input type="number" min="0" step="0.01" required value={marks} onChange={e => setMarks(e.target.value)} placeholder="e.g. 32"/></label>}
      <label>Anything else? <small>Optional</small><textarea maxLength={2000} rows={3} value={message} onChange={e => setMessage(e.target.value)}/></label></>}
    {step === 2 && <><label className={styles.drop}><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => choose(e.target.files?.[0] || null)}/>{preview ? <img className={styles.proof} src={preview} alt="Selected result screenshot"/> : <><strong>Upload official results screenshot</strong><span>PNG, JPEG or WebP · up to 5 MB</span></>}</label>{file && <small>{file.name} · tap the image to replace it</small>}{fileError && <p role="alert" className={styles.error}>{fileError}</p>}
      <label className={styles.check}><input type="checkbox" checked={released} onChange={e => setReleased(e.target.checked)}/>My official Quiz 1 results have been released.</label></>}
    {step === 3 && purchase && <dl className={styles.review}><div><dt>Course</dt><dd>{purchase.courseName}</dd></div><div><dt>Benefit</dt><dd>{benefit === 'refund' ? `Refund · ₹${refundForFee(purchase.fee)}` : `Discount · ₹${discountForFee(purchase.fee)}`}</dd></div><div><dt>Reason</dt><dd>{reason}</dd></div><div><dt>Attempted</dt><dd>{attempted === 'yes' ? `Yes · ${marks} marks` : 'No'}</dd></div>{message && <div><dt>Note</dt><dd>{message}</dd></div>}<div><dt>Proof</dt><dd>{file?.name}</dd></div></dl>}
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
    return <article className={styles.card}><div className={styles.sectionHeader}><div><h3>{c.purchase.courseName}</h3><small>{c.id} · {date(c.createdAt)}</small></div><span className={`${styles.badge} ${tone}`}>{c.status}</span></div>{manager && <p>{c.purchase.user?.name} · {c.purchase.user?.email}</p>}<dl className={styles.grid}><div><dt>Requested benefit</dt><dd>{c.benefit === 'refund' ? `₹${refundForFee(c.purchase.fee)} refund` : `₹${discountForFee(c.purchase.fee)} discount`}</dd></div><div><dt>Reason</dt><dd>{c.reason}</dd></div><div><dt>Attempted exam</dt><dd>{c.attempted ? 'Yes' : 'No'}</dd></div><div><dt>Marks</dt><dd>{c.marks ?? 'Not attempted'}</dd></div></dl>{c.message && <p className={styles.message}>Student message: {c.message}</p>}{c.proof ? <a href={'/api/exam-protection/claims/' + c.id + '/proof'} target="_blank" rel="noopener noreferrer">View official result proof ↗</a> : <p>Uploaded proof media was deleted after 60 days. Other claim details are retained.</p>}<div className={styles.history}>{c.events.map(e => <div key={e.id}><strong>{e.internal ? 'Internal note · managers only' : 'Update'}</strong><p>{e.message}</p><small>{date(e.createdAt)}</small></div>)}</div>{!manager && c.status === 'More Information Required' && <form onSubmit={e => {
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
