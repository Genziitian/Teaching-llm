import type { Metadata } from 'next';
import Blog from '@/landing/pages/Blog';

export const metadata: Metadata = {
  title: 'Blog | Gen-Z IITian',
  description: 'Guides, strategies and insights on the IIT Madras BS Degree, exams, coding and student life from Gen-Z IITian.',
};

export default function Page() {
  return <Blog />;
}
