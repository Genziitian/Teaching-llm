'use client';
import Link from 'next/link';
import useSWR from 'swr';
import { ProtectionData, protectionRequest } from '@/lib/exam-protection/client';
export default function ProtectionSummary() {
    const { data, error } = useSWR<ProtectionData>('/api/exam-protection', () => protectionRequest(), { refreshInterval: 60000, revalidateOnFocus: true });
    return <section aria-label="Exam Protection" style={{ padding: 20, margin: '18px 0', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 20 }}><Link href="/exam-protection" style={{ fontWeight: 700, fontSize: 17 }}>Exam Protection →</Link>{error ? <p role="status">Protection could not load. Open it to retry.</p> : data ? <><p>{data.purchases.length} protection purchases · {data.claims.length} claims · visible for {data.retentionDays} days</p>{data.claims.slice(0, 3).map(claim => <p key={claim.id} style={{ fontSize: 13 }}>{claim.purchase.courseName} · {claim.status}</p>)}</> : <p>Loading protection…</p>}</section>;
}
