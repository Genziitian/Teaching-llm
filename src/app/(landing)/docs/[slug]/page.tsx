import type { Metadata } from 'next';
import DocsDetail from '@/landing/pages/DocsDetail';
import { docsData } from '@/landing/data/docsData';

export function generateStaticParams() {
  return docsData.map((d) => ({ slug: d.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const doc = docsData.find((d) => d.slug === params.slug);
  if (!doc) return { title: 'Docs | Gen-Z IITian' };
  return { title: `${doc.title} | Gen-Z IITian Docs`, description: doc.description };
}

export default function Page() {
  return <DocsDetail />;
}
