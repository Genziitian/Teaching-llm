'use client';
import { useEffect, useState } from 'react';
import { protectionRequest } from '@/lib/exam-protection/client';
import { discountForFee, refundForFee } from '@/lib/exam-protection/policy';
export default function CourseProtectionField({ courseId }: {
    courseId: string | null;
}) {
    const [fee, setFee] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false), [loaded, setLoaded] = useState(false);
    useEffect(() => { setLoaded(false); setFee(''); setMessage(''); if (!courseId)
        return; let live = true; protectionRequest<{
        fee: number | null;
    }>('/courses/' + courseId).then(data => { if (live) {
        setFee(data.fee === null ? '' : String(data.fee));
        setLoaded(true);
    } }).catch(error => { if (live)
        setMessage(error.message); }); return () => { live = false; }; }, [courseId]);
    async function save() { setBusy(true); setMessage(''); try {
        await protectionRequest('/courses/' + courseId, 'PUT', { fee: fee === '' ? null : Number(fee) });
        setMessage('Protection fee saved. Existing purchases keep their original fee.');
    }
    catch (error) {
        setMessage((error as Error).message);
    }
    finally {
        setBusy(false);
    } }
    return <div className="ce-row"><div className="ce-field"><label htmlFor="course-protection-fee">Protection fee (₹) · optional</label><input id="course-protection-fee" className="form-input" type="number" min="10" max="1000000" step="1" value={fee} disabled={!courseId || !loaded || busy} onChange={event => setFee(event.target.value)} placeholder="No protection fee"/><p className="ce-hint">Outcome A covers Quiz 1 only. Leave empty to hide this course from protection. {fee && Number(fee) >= 10 ? `Refund: ₹${refundForFee(Number(fee))}. Discount: ₹${discountForFee(Number(fee))}.` : ''}</p>{courseId ? <button type="button" className="btn btn-secondary" disabled={busy || !loaded} onClick={save}>{busy ? 'Saving…' : 'Save protection fee'}</button> : <p className="ce-hint">Create the course first, then set its protection fee here.</p>}<p role="status" className="ce-hint">{message}</p></div></div>;
}
