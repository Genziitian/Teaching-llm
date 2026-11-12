import type { Metadata } from 'next';
import AccessPdf from '@/landing/pages/AccessPdf';

export const metadata: Metadata = {
  title: 'Get the Free PDF | Gen-Z IITian',
  description: 'Download the free Gen-Z IITian IIT Madras BS Degree PDF guide.',
};

export default function Page() {
  return <AccessPdf />;
}
