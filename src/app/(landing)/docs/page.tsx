import type { Metadata } from 'next';
import Docs from '@/landing/pages/Docs';

export const metadata: Metadata = {
  title: 'Docs | Gen-Z IITian',
  description: 'Complete documentation and academic references for the IIT Madras BS Degree: structure, curriculum, fees, exams and more.',
};

export default function Page() {
  return <Docs />;
}
