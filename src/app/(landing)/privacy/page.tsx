import type { Metadata } from 'next';
import PrivacyPolicy from '@/landing/pages/PrivacyPolicy';

export const metadata: Metadata = { title: 'Privacy Policy | Gen-Z IITian' };

export default function Page() {
  return <PrivacyPolicy />;
}
