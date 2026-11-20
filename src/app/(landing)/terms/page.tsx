import type { Metadata } from 'next';
import TermsAndConditions from '@/landing/pages/TermsAndConditions';

export const metadata: Metadata = { title: 'Terms & Conditions | Gen-Z IITian' };

export default function Page() {
  return <TermsAndConditions />;
}
