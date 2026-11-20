import type { Metadata } from 'next';
import RefundPolicy from '@/landing/pages/RefundPolicy';

export const metadata: Metadata = { title: 'Refund Policy | Gen-Z IITian' };

export default function Page() {
  return <RefundPolicy />;
}
