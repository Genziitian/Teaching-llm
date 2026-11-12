'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import { useParams, Link } from '@/landing/shims/router';
import { motion } from 'motion/react';
import {
    BookOpen, ArrowRight, ChevronDown, ChevronUp,
    ExternalLink, Clock, Tag, Layers, TrendingUp,
    Star, Sparkles, FileText, MapPin, Users
} from 'lucide-react';
import ErrorPage from '@/landing/components/ErrorPage';

interface Section {
    heading: string;
    body: string;
}

interface FAQ {
    question: string;
    answer: string;
}

interface InternalLink {
    url: string;
    text: string;
    type?: string;
}

interface SEOPageData {
    id: number;
    slug: string;
    playbook_type: string;
    title: string;
    meta_description: string;
    primary_keyword: string;
    secondary_keywords: string[];
    search_intent: string;
    h1: string;
    introduction: string;
    sections: Section[];
    faq: FAQ[];
    call_to_action: string;
    schema_type: string;
    schema_data: Record<string, unknown>;
    internal_links: InternalLink[];
    related_pages: string[];
    parent_topic: string;
    cluster_topic: string;
    word_count: number;
    updated_at: string;
}

interface RelatedPage {
    slug: string;
    title: string;
    playbook_type: string;
    meta_description: string;
}

const playbookColors: Record<string, { bg: string; text: string; accent: string; gradient: string }> = {
    glossary: { bg: 'bg-purple-50', text: 'text-purple-700', accent: 'border-purple-400', gradient: 'from-purple-600 to-indigo-600' },
    comparison: { bg: 'bg-blue-50', text: 'text-blue-700', accent: 'border-blue-400', gradient: 'from-blue-600 to-cyan-600' },
    location: { bg: 'bg-green-50', text: 'text-green-700', accent: 'border-green-400', gradient: 'from-green-600 to-emerald-600' },
    persona: { bg: 'bg-amber-50', text: 'text-amber-700', accent: 'border-amber-400', gradient: 'from-amber-600 to-orange-600' },
    guide: { bg: 'bg-rose-50', text: 'text-rose-700', accent: 'border-rose-400', gradient: 'from-rose-600 to-pink-600' },
    subject_notes: { bg: 'bg-teal-50', text: 'text-teal-700', accent: 'border-teal-400', gradient: 'from-teal-600 to-cyan-600' },
    career: { bg: 'bg-indigo-50', text: 'text-indigo-700', accent: 'border-indigo-400', gradient: 'from-indigo-600 to-violet-600' },
    profile: { bg: 'bg-sky-50', text: 'text-sky-700', accent: 'border-sky-400', gradient: 'from-sky-600 to-blue-600' },
    curation: { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', accent: 'border-fuchsia-400', gradient: 'from-fuchsia-600 to-purple-600' },
    template: { bg: 'bg-lime-50', text: 'text-lime-700', accent: 'border-lime-400', gradient: 'from-lime-600 to-green-600' },
    directory: { bg: 'bg-orange-50', text: 'text-orange-700', accent: 'border-orange-400', gradient: 'from-orange-600 to-red-600' },
    integration: { bg: 'bg-cyan-50', text: 'text-cyan-700', accent: 'border-cyan-400', gradient: 'from-cyan-600 to-teal-600' },
};

const playbookIcons: Record<string, React.ReactNode> = {
    glossary: <BookOpen className="w-5 h-5" />,
    comparison: <TrendingUp className="w-5 h-5" />,
    location: <MapPin className="w-5 h-5" />,
    persona: <Users className="w-5 h-5" />,
    guide: <FileText className="w-5 h-5" />,
    subject_notes: <Layers className="w-5 h-5" />,
    career: <Star className="w-5 h-5" />,
    profile: <Users className="w-5 h-5" />,
    curation: <Sparkles className="w-5 h-5" />,
    template: <FileText className="w-5 h-5" />,
    directory: <Tag className="w-5 h-5" />,
    integration: <ExternalLink className="w-5 h-5" />,
};

export default function SEOPage({ slug: slugProp }: { slug?: string } = {}) {
    const params = useParams();
    const slug = slugProp ?? params['*'] ?? '';

    const [page, setPage] = useState<SEOPageData | null>(null);
    const [related, setRelated] = useState<RelatedPage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

    useEffect(() => {
        if (!slug) return;
        setLoading(true);
        setError('');

        Promise.all([
            fetch(`/api/site/pseo/page/${slug}`).then(r => {
                if (!r.ok) throw new Error('Page not found');
                return r.json();
            }),
            fetch(`/api/site/pseo/related/${slug}`).then(r => r.json()).catch(() => []),
        ])
            .then(([pageData, relatedData]) => {
                setPage(pageData);
                setRelated(relatedData);

                // Update document title and meta
                document.title = `${pageData.title} | GenZ IITian`;
                const metaDesc = document.querySelector('meta[name="description"]');
                if (metaDesc) metaDesc.setAttribute('content', pageData.meta_description);

                // Inject structured data
                let scriptTag = document.querySelector('#pseo-schema');
                if (!scriptTag) {
                    scriptTag = document.createElement('script');
                    scriptTag.id = 'pseo-schema';
                    scriptTag.setAttribute('type', 'application/ld+json');
                    document.head.appendChild(scriptTag);
                }
                scriptTag.textContent = JSON.stringify(buildSchema(pageData));
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));

        return () => {
            const scriptTag = document.querySelector('#pseo-schema');
            if (scriptTag) scriptTag.remove();
        };
    }, [slug]);

    const colors = page ? (playbookColors[page.playbook_type] || playbookColors.glossary) : playbookColors.glossary;

    if (loading) return <LoadingSkeleton />;
    if (error || !page) {
        return (
            <ErrorPage
                code={404}
                title="Page Not Found"
                description="The page you're looking for doesn't exist or hasn't been published yet."
            />
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero Section */}
            <section className={`relative overflow-hidden bg-gradient-to-br ${colors.gradient} text-white`}>
                <div className="absolute inset-0 bg-black/10" />
                <div className="absolute inset-0" style={{
                    backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 60%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.08) 0%, transparent 50%)',
                }} />
                <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        {/* Breadcrumb */}
                        <div className="flex items-center gap-2 text-white/70 text-sm mb-6">
                            <Link to="/" className="hover:text-white transition-colors">Home</Link>
                            <span>/</span>
                            {page.cluster_topic && (
                                <>
                                    <span className="hover:text-white transition-colors">{page.cluster_topic}</span>
                                    <span>/</span>
                                </>
                            )}
                            <span className="text-white/90">{page.playbook_type ? String(page.playbook_type).replace('_', ' ') : ''}</span>
                        </div>

                        {/* Playbook Badge */}
                        <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-sm font-medium mb-4">
                            {page.playbook_type && playbookIcons[page.playbook_type]}
                            {page.playbook_type ? String(page.playbook_type).replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()) : ''}
                        </span>

                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4 tracking-tight">
                            {page.h1}
                        </h1>

                        <p className="text-lg sm:text-xl text-white/85 max-w-3xl leading-relaxed">
                            {page.introduction}
                        </p>

                        {/* Meta info */}
                        <div className="flex flex-wrap items-center gap-4 mt-6 text-white/60 text-sm">
                            <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                {Math.ceil(page.word_count / 200)} min read
                            </span>
                            <span className="flex items-center gap-1">
                                <FileText className="w-4 h-4" />
                                {page.word_count.toLocaleString()} words
                            </span>
                            {page.updated_at && (
                                <span className="flex items-center gap-1">
                                    Updated {new Date(page.updated_at).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </span>
                            )}
                        </div>
                    </motion.div>
                </div>
            </section>

            {/* Main Content */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10">
                    {/* Article Content */}
                    <article className="min-w-0">
                        {/* Table of Contents */}
                        {page.sections.length > 3 && (
                            <motion.nav
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 0.2 }}
                                className="mb-10 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm"
                            >
                                <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Table of Contents</h2>
                                <ol className="space-y-2">
                                    {page.sections.map((section, i) => (
                                        <li key={i}>
                                            <a
                                                href={`#section-${i}`}
                                                className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm"
                                            >
                                                <span className={`w-6 h-6 rounded-full ${colors.bg} ${colors.text} flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                                                    {i + 1}
                                                </span>
                                                {section.heading}
                                            </a>
                                        </li>
                                    ))}
                                </ol>
                            </motion.nav>
                        )}

                        {/* Sections */}
                        {page.sections.map((section, i) => (
                            <motion.section
                                key={i}
                                id={`section-${i}`}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, margin: '-50px' }}
                                transition={{ duration: 0.4, delay: i * 0.05 }}
                                className="mb-10"
                            >
                                <h2 className={`text-xl sm:text-2xl font-bold text-gray-900 mb-4 pb-2 border-b-2 ${colors.accent}`}>
                                    {section.heading}
                                </h2>
                                <div className="prose prose-gray max-w-none text-gray-700 leading-relaxed whitespace-pre-line">
                                    {section.body}
                                </div>
                            </motion.section>
                        ))}

                        {/* FAQ Section */}
                        {page.faq.length > 0 && (
                            <motion.section
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                className="mt-12 mb-10"
                            >
                                <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                    <span className="text-2xl">❓</span> Frequently Asked Questions
                                </h2>
                                <div className="space-y-3">
                                    {page.faq.map((item, i) => (
                                        <div
                                            key={i}
                                            className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden transition-all"
                                        >
                                            <button
                                                onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                                                className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
                                            >
                                                <span className="font-semibold text-gray-900 text-sm sm:text-base">{item.question}</span>
                                                {expandedFaq === i ? (
                                                    <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                                ) : (
                                                    <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                                )}
                                            </button>
                                            <motion.div
                                                initial={false}
                                                animate={{
                                                    height: expandedFaq === i ? 'auto' : 0,
                                                    opacity: expandedFaq === i ? 1 : 0,
                                                }}
                                                transition={{ duration: 0.25 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="px-5 pb-4 text-gray-600 leading-relaxed text-sm border-t border-gray-50 pt-3">
                                                    {item.answer}
                                                </div>
                                            </motion.div>
                                        </div>
                                    ))}
                                </div>
                            </motion.section>
                        )}

                        {/* CTA Section */}
                        {page.call_to_action && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                className={`rounded-2xl bg-gradient-to-br ${colors.gradient} text-white p-8 sm:p-10 text-center mt-12`}
                            >
                                <h3 className="text-2xl font-bold mb-3">🚀 Ready to Start?</h3>
                                <p className="text-white/85 mb-6 max-w-lg mx-auto">{page.call_to_action}</p>
                                <div className="flex flex-wrap gap-3 justify-center">
                                    <Link
                                        to="/explore/courses"
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 font-semibold rounded-xl hover:bg-gray-100 transition-colors shadow-lg"
                                    >
                                        Explore Courses <ArrowRight className="w-4 h-4" />
                                    </Link>
                                    <Link
                                        to="/resources"
                                        className="inline-flex items-center gap-2 px-6 py-3 bg-white/15 backdrop-blur-sm text-white font-semibold rounded-xl hover:bg-white/25 transition-colors border border-white/20"
                                    >
                                        Study Resources <BookOpen className="w-4 h-4" />
                                    </Link>
                                </div>
                            </motion.div>
                        )}

                        {/* Keywords / Tags */}
                        {page.secondary_keywords.length > 0 && (
                            <div className="mt-8 flex flex-wrap gap-2">
                                {page.secondary_keywords.map((kw, i) => (
                                    <span key={i} className={`px-3 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
                                        {kw}
                                    </span>
                                ))}
                            </div>
                        )}
                    </article>

                    {/* Sidebar */}
                    <aside className="hidden lg:block">
                        <div className="sticky top-24 space-y-6">
                            {/* Internal Links */}
                            {page.internal_links.length > 0 && (
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                                    <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wider mb-4">Related Links</h3>
                                    <ul className="space-y-2">
                                        {page.internal_links.slice(0, 8).map((link, i) => (
                                            <li key={i}>
                                                <Link
                                                    to={link.url}
                                                    className="flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 transition-colors py-1"
                                                >
                                                    <ArrowRight className="w-3 h-3 flex-shrink-0" />
                                                    <span className="line-clamp-2">{link.text}</span>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Related Pages */}
                            {related.length > 0 && (
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                                    <h3 className="font-semibold text-gray-900 text-sm uppercase tracking-wider mb-4">You Might Also Like</h3>
                                    <ul className="space-y-3">
                                        {related.slice(0, 5).map((rp, i) => (
                                            <li key={i}>
                                                <Link
                                                    to={`/${rp.slug}`}
                                                    className="block group"
                                                >
                                                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-1 ${playbookColors[rp.playbook_type]?.bg || 'bg-gray-100'} ${playbookColors[rp.playbook_type]?.text || 'text-gray-700'}`}>
                                                        {rp.playbook_type ? String(rp.playbook_type).replace('_', ' ') : ''}
                                                    </span>
                                                    <p className="text-sm text-gray-700 group-hover:text-blue-600 transition-colors font-medium line-clamp-2">
                                                        {rp.title}
                                                    </p>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {/* Quick CTA */}
                            <div className={`rounded-2xl bg-gradient-to-br ${colors.gradient} text-white p-5 text-center`}>
                                <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-80" />
                                <p className="text-sm font-medium mb-3">Need help with IITM BS Degree?</p>
                                <Link
                                    to="/contact"
                                    className="inline-flex items-center gap-1 px-4 py-2 bg-white text-gray-900 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
                                >
                                    Get in Touch <ArrowRight className="w-3 h-3" />
                                </Link>
                            </div>
                        </div>
                    </aside>
                </div>
            </div>

            {/* Mobile Related Pages */}
            {related.length > 0 && (
                <section className="lg:hidden bg-white border-t border-gray-100 py-10 px-4">
                    <h3 className="text-xl font-bold text-gray-900 mb-6 text-center">Related Articles</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
                        {related.slice(0, 4).map((rp, i) => (
                            <Link key={i} to={`/${rp.slug}`} className="block p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium mb-2 ${playbookColors[rp.playbook_type]?.bg || 'bg-gray-100'} ${playbookColors[rp.playbook_type]?.text || 'text-gray-700'}`}>
                                    {rp.playbook_type ? String(rp.playbook_type).replace('_', ' ') : ''}
                                </span>
                                <p className="text-sm font-medium text-gray-800">{rp.title}</p>
                            </Link>
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

// ==========================================
// Helper Components
// ==========================================

function LoadingSkeleton() {
    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-gradient-to-br from-gray-300 to-gray-400 animate-pulse h-72" />
            <div className="max-w-4xl mx-auto px-4 py-12">
                <div className="space-y-6">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="space-y-3">
                            <div className="h-6 bg-gray-200 rounded-lg w-1/3 animate-pulse" />
                            <div className="h-4 bg-gray-100 rounded w-full animate-pulse" />
                            <div className="h-4 bg-gray-100 rounded w-5/6 animate-pulse" />
                            <div className="h-4 bg-gray-100 rounded w-4/6 animate-pulse" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ==========================================
// Schema Builder
// ==========================================

function buildSchema(page: SEOPageData) {
    const baseSchema = {
        '@context': 'https://schema.org',
        '@type': page.schema_type || 'Article',
        headline: page.h1,
        description: page.meta_description,
        author: {
            '@type': 'Organization',
            name: 'GenZ IITian',
            url: 'https://genziitian.in',
        },
        publisher: {
            '@type': 'Organization',
            name: 'GenZ IITian',
            url: 'https://genziitian.in',
        },
        dateModified: page.updated_at,
        mainEntityOfPage: `https://genziitian.in/${page.slug}`,
    };

    // Add FAQ schema if present
    if (page.faq.length > 0 && page.schema_type === 'FAQPage') {
        return {
            ...baseSchema,
            mainEntity: page.faq.map(f => ({
                '@type': 'Question',
                name: f.question,
                acceptedAnswer: {
                    '@type': 'Answer',
                    text: f.answer,
                },
            })),
        };
    }

    return baseSchema;
}
