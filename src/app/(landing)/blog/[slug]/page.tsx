import type { Metadata } from 'next';
import BlogDetail from '@/landing/pages/BlogDetail';
import { fallbackBlogs } from '@/landing/data/blogsData';

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const blog = fallbackBlogs.find((b) => b.slug === params.slug);
  if (!blog) return { title: 'Blog | Gen-Z IITian' };
  return {
    title: blog.seo_title || `${blog.title} | Gen-Z IITian`,
    description: blog.seo_description,
    keywords: blog.seo_keywords,
  };
}

export default function Page() {
  return <BlogDetail />;
}
