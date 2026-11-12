import SEOPage from '@/landing/pages/SEOPage';

// pSEO catch-all (storefront's `/*` route): slugs such as compare/..., served from /api/pseo/page/<slug>
export default function Page({ params }: { params: { slug: string[] } }) {
  return <SEOPage slug={(params.slug || []).join('/')} />;
}
