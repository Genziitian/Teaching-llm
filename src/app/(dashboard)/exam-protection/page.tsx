'use client';
import { FormEvent, useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import Script from 'next/script';
import Link from 'next/link';
import { ProtectionClaim, ProtectionData, ProtectionPurchase, protectionRequest } from '@/lib/exam-protection/client';
import { DAY, RULES, refundForFee, discountForFee } from '@/lib/exam-protection/policy';
import styles from './protection.module.css';
const date = (value: string) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const until = (value: string, days: number) => date(new Date(new Date(value).getTime() + days * DAY).toISOString());
type RzpConstructor = new (options: Record<string, unknown>) => {
    open(): void;
};
export default function ExamProtectionPage() {
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
    return <main className={styles.page}><Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive"/><header className={styles.header}><div><p className={styles.eyebrow}>ACADEMICS</p><h1>Exam Protection</h1><p>Clear choices. A manager reviews every claim.</p></div><Link href="/dashboard">Dashboard</Link></header><div role="status" aria-live="polite">{notice && <p className={styles.notice}>{notice}</p>}</div>{isLoading ? <p>Loading your protection…</p> : error ? <div className={styles.card} role="alert"><p>{error.message}</p><button onClick={() => mutate()}>Try again</button></div> : data && <>
    <section className={styles.benefits}><div className={styles.card}><span className={styles.badge}>Outcome A · Failed Quiz 1</span><h2>Your fee − ₹10 refund</h2><p>or choose <strong>1.5× your fee</strong> as a same-course discount, rounded to a whole rupee.</p><p>₹50 fee → ₹40 refund or ₹75 discount. Each course has its own fee.</p></div><div className={styles.card}><span className={styles.badge}>Outcome B</span><h2>Coming soon</h2></div></section>
    {data.manager && <section className={styles.card}><h2>Purchase availability</h2><p>Closing purchases keeps View Details and existing claims available.</p><button disabled={busy} onClick={() => run(() => protectionRequest('/settings', 'PUT', { isOpen: !data.isOpen }))}>{data.isOpen ? 'Close protection purchases' : 'Open protection purchases'}</button><p>Fees are set in <Link href="/manage?tab=courses">Manage Course</Link>.</p></section>}
    <section className={styles.card}><div className={styles.sectionHeader}><h2>Explore protection</h2><span className={styles.badge}>{data.isOpen ? 'Open' : 'Closed'}</span></div><p>Only eligible enrolled Quiz 1 courses with a protection fee appear here.</p>{!data.courses.length ? <p>No courses currently offer protection.</p> : data.courses.map(course => <div key={course.id} className={styles.row}><div><h3>{course.name}</h3><p>₹{course.fee} fee · ₹{refundForFee(course.fee)} refund or ₹{discountForFee(course.fee)} discount</p><span>{course.protected ? 'Protected' : 'Not Protected'}</span></div><div className={styles.actions}><button className={styles.secondary} onClick={() => { setPurchasing(null); setDetail(course); }}>View Details</button>{!course.protected && !data.manager && <button disabled={busy || !data.isOpen} onClick={() => { setAccepted(false); setDetail(null); setPurchasing(course); }}>{data.isOpen ? 'Add Protection' : 'Closed'}</button>}</div></div>)}</section>
    <section className={styles.card}><h2>{data.manager ? 'Protection purchases' : 'My protection'}</h2><p>Visible for {data.retentionDays} days from purchase.</p>{data.purchases.length ? data.purchases.map(p => <div className={styles.row} key={p.id}><div><h3>{p.courseName}</h3><p>₹{p.fee} paid · {date(p.paidAt)} · visible until {until(p.paidAt, data.retentionDays)}</p>{data.manager && <p>{p.user?.name} · {p.user?.email}</p>}</div><span className={styles.badge}>Protected</span></div>) : <p>No protection purchases within this visibility period.</p>}</section>
    {!data.manager && <ClaimForm purchases={data.purchases.filter(p => !p.claim)} reasons={data.reasons} run={run} busy={busy}/>}
    <section><h2>{data.manager ? 'Manager claim review' : 'My claims'}</h2><p>Claims are visible for {data.retentionDays} days from submission. Proof media is deleted after 60 days; claim details remain.</p>{!data.claims.length ? <div className={styles.card}>No claims within this visibility period.</div> : data.claims.map(claim => <ClaimCard key={claim.id} claim={claim} manager={data.manager} busy={busy} run={run}/>)}</section>
    {!data.manager && <section className={styles.card}><h2>My Coupons</h2><p><strong>Scratch to reveal your coupon. Once scratched, use it within 7 days.</strong></p><ol><li>Submit a protection claim and choose the discount benefit.</li><li>The manager reviews your proof, then creates or selects a coupon and assigns it to your account.</li><li>Reveal the issued coupon below.</li><li>Visit <a href="https://genziitian.in/courses" target="_blank" rel="noopener noreferrer">genziitian.in/courses</a> and select the same course. A Python coupon is for Python only.</li><li>You can also redeem on <a href="https://class.genziitian.in/courses/explore" target="_blank" rel="noopener noreferrer">class.genziitian.in</a> for the same eligible course.</li><li>Sign in with the same email address you used here: <strong>{data.email}</strong>.</li><li>Apply the code at checkout and complete your purchase within 7 days of revealing it.</li></ol><p><Link href="/courses/explore">Browse this website’s course store →</Link></p>{data.claims.filter(c => c.benefit === 'coupon' && c.deliveredAt && !c.coupon).map(c => <p key={c.id}>The assigned coupon for {c.purchase.courseName} is unavailable. Contact your manager with claim {c.id}.</p>)}{data.coupons.length ? data.coupons.map(c => <div className={styles.coupon} key={c.id}><h3>{c.purchase.courseName} · ₹{discountForFee(c.purchase.fee)} discount</h3>{c.couponRevealedAt ? <><strong>{c.coupon?.code}</strong><p>Expires {c.coupon?.expiresAt ? date(c.coupon.expiresAt) : '—'} · {c.coupon?.currentUses}/{c.coupon?.maxUses ?? 1} uses</p><button className={styles.secondary} onClick={() => navigator.clipboard.writeText(c.coupon?.code || '').then(() => setNotice('Coupon code copied.')).catch(() => setNotice('Select and copy the coupon code above.'))}>Copy code</button></> : <><p>Revealing starts the 7-day usage period.</p><button disabled={busy} onClick={() => run(() => protectionRequest('/claims/' + c.id + '/reveal', 'POST'))}>Reveal coupon · start 7 days</button></>}</div>) : <p>Your coupon appears here once the manager assigns it.</p>}</section>}
  </>}
  <dialog aria-labelledby="protection-dialog-title" className={styles.dialog} ref={dialog} onCancel={() => { setDetail(null); setPurchasing(null); }} onClose={() => { setDetail(null); setPurchasing(null); }}><h2 id="protection-dialog-title">{purchasing ? 'Add Protection' : detail?.name}</h2><p>{(detail || purchasing)?.name}</p><p>{RULES}</p><p>Fee: ₹{(detail || purchasing)?.fee}. Refund: ₹{refundForFee((detail || purchasing)?.fee || 0)}. Discount: ₹{discountForFee((detail || purchasing)?.fee || 0)}.</p><p>Upload official results after release. Media is deleted 60 days after claim submission. Other claim details remain. Refunds and coupons are delivered manually.</p>{purchasing && <><label className={styles.check}><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}/>I have read the rules, conditions and benefits.</label><button disabled={!accepted || busy} onClick={buy}>Pay ₹{purchasing.fee} & add protection</button></>}<button className={styles.secondary} onClick={() => { setDetail(null); setPurchasing(null); }}>Close</button></dialog>
  </main>;
}
type Run = (work: () => Promise<unknown>) => Promise<void>;
function ClaimForm({ purchases, reasons, run, busy }: {
    purchases: ProtectionPurchase[];
    reasons: string[];
    run: Run;
    busy: boolean;
}) {
    const [purchaseId, setPurchase] = useState(''), [benefit, setBenefit] = useState('refund'), [attempted, setAttempted] = useState(''), [file, setFile] = useState<File | null>(null), [preview, setPreview] = useState(''), [fileError, setFileError] = useState('');
    useEffect(() => {
        if (!file) {
            setPreview('');
            return;
        }
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
    function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const form = event.currentTarget, fields = new FormData(form);
        run(async () => {
            if (!file)
                throw new Error('Upload a valid result screenshot.');
            const body = new FormData();
            body.append('proof', file);
            body.append('data', JSON.stringify({ purchaseId, benefit, attempted: attempted === 'yes', reason: fields.get('reason'), marks: fields.get('marks'), message: fields.get('message') || '', resultsReleased: fields.get('released') === 'on' }));
            await protectionRequest('/claims', 'POST', body);
            form.reset();
            setFile(null);
            setAttempted('');
            setPurchase('');
        });
    }
    return <section className={styles.card}><h2>Start a protection claim</h2>{!purchases.length ? <p>No unclaimed protected purchases within your 60-day dashboard period.</p> : <form onSubmit={submit}><div className={styles.grid}><label>Protected course<select required value={purchaseId} onChange={e => setPurchase(e.target.value)}><option value="">Select your protected course</option>{purchases.map(p => <option value={p.id} key={p.id}>{p.courseName}</option>)}</select></label><label>Benefit<select value={benefit} onChange={e => setBenefit(e.target.value)}><option value="refund">Refund{purchase ? ` · ₹${refundForFee(purchase.fee)}` : ''}</option><option value="coupon">Same-course discount{purchase ? ` · ₹${discountForFee(purchase.fee)}` : ''}</option></select></label><label>Why didn’t you pass?<select name="reason" required defaultValue=""><option value="">Choose a reason</option>{reasons.map(r => <option key={r}>{r}</option>)}</select></label><label>Did you attempt the exam?<select required value={attempted} onChange={e => setAttempted(e.target.value)}><option value="">Choose Yes or No</option><option value="yes">Yes</option><option value="no">No</option></select></label><label>Marks obtained in this course<input name="marks" type="number" min="0" step="0.01" required={attempted === 'yes'} disabled={attempted !== 'yes'} placeholder={attempted === 'no' ? 'Not attempted' : 'Enter marks'}/></label></div><label>Anything else you’d like to share? (optional)<textarea name="message" maxLength={2000} rows={3}/></label><label>Official results-dashboard screenshot<input type="file" accept="image/png,image/jpeg,image/webp" required onChange={e => choose(e.target.files?.[0] || null)}/></label><p>Up to 5 MB. Preview or replace it before submitting. A manager checks it manually. Uploaded media is deleted 60 days after submission; other claim details stay.</p>{fileError && <p role="alert">{fileError}</p>}{preview && <img className={styles.proof} src={preview} alt="Your selected result proof"/>}<label className={styles.check}><input type="checkbox" name="released" required/>My official results have been released.</label><button disabled={busy}>Submit claim</button></form>}</section>;
}
function ClaimCard({ claim: c, manager, busy, run }: {
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
    return <article className={styles.card}><div className={styles.sectionHeader}><div><h3>{c.purchase.courseName}</h3><small>{c.id} · {date(c.createdAt)}</small></div><span className={styles.badge}>{c.status}</span></div>{manager && <p>{c.purchase.user?.name} · {c.purchase.user?.email}</p>}<dl className={styles.grid}><div><dt>Requested benefit</dt><dd>{c.benefit === 'refund' ? `₹${refundForFee(c.purchase.fee)} refund` : `₹${discountForFee(c.purchase.fee)} discount`}</dd></div><div><dt>Reason</dt><dd>{c.reason}</dd></div><div><dt>Attempted exam</dt><dd>{c.attempted ? 'Yes' : 'No'}</dd></div><div><dt>Marks</dt><dd>{c.marks ?? 'Not attempted'}</dd></div></dl>{c.message && <p className={styles.message}>Student message: {c.message}</p>}{c.proof ? <a href={'/api/exam-protection/claims/' + c.id + '/proof'} target="_blank" rel="noopener noreferrer">View official result proof ↗</a> : <p>Uploaded proof media was deleted after 60 days. Other claim details are retained.</p>}<div className={styles.history}>{c.events.map(e => <div key={e.id}><strong>{e.internal ? 'Internal note · managers only' : 'Update'}</strong><p>{e.message}</p><small>{date(e.createdAt)}</small></div>)}</div>{!manager && c.status === 'More Information Required' && <form onSubmit={e => {
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
