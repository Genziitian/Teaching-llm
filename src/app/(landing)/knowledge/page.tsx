import type { Metadata } from 'next';
import SEODirectory from '@/landing/pages/SEODirectory';

export const metadata: Metadata = {
  title: 'Knowledge Hub — IIT Madras BS Degree Resources | GenZ IITian',
};

export default function Page() {
  return <SEODirectory />;
}
