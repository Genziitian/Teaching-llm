import type { Metadata } from 'next';
import ToolsPage from '@/landing/pages/tools/ToolsPage';

export const metadata: Metadata = {
  title: 'CGPA / SGPA Calculator | IIT Madras BS Tools | Gen-Z IITian',
  description: 'Free IIT Madras BS Degree tools: CGPA / SGPA ledger, grade predictor and grading scale.',
};

export default function Page() {
  return <ToolsPage />;
}
