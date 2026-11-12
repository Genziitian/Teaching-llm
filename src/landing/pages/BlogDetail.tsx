'use client';

import { useState, useEffect } from 'react';
import { useParams, Link } from '@/landing/shims/router';
import { ChevronLeft, Share, Clock, Tag } from 'lucide-react';
import { fallbackBlogs, BlogPost } from '@/landing/data/blogsData';
import { supabase } from '@/landing/lib/supabase';
import ErrorPage from '@/landing/components/ErrorPage';

interface Widget {
    id: number;
    title: string;
    image: string;
    link: string;
    position: number;
}

function WidgetCard({ widget }: { widget: Widget }) {
    return (
        <a
            href={widget.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-2xl overflow-hidden border-[3px] border-[#0b1120] shadow-[6px_6px_0px_#0b1120] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[10px_10px_0px_#0b1120] transition-all group"
        >
            <div className="relative">
                <img src={widget.image} alt={widget.title} className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500" style={{ minHeight: '150px' }} />
                {widget.title && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                        <p className="text-white font-bold text-sm leading-tight">{widget.title}</p>
                    </div>
                )}
            </div>
        </a>
    );
}

function splitContentForMobile(content: string) {
    if (content.includes('<') && content.includes('>')) {
        const chunks = content.trim().split(/(?=<h2\b)/i).filter(Boolean);
        if (chunks.length <= 1) return [content, ''];
        const midpoint = Math.ceil(chunks.length / 2);
        return [chunks.slice(0, midpoint).join(''), chunks.slice(midpoint).join('')];
    }

    const lines = content.split('\n');
    const midpoint = Math.ceil(lines.length / 2);
    return [lines.slice(0, midpoint).join('\n'), lines.slice(midpoint).join('\n')];
}

export default function BlogDetail() {
    const { slug } = useParams<{ slug: string }>();
    const [blog, setBlog] = useState<BlogPost | null>(null);
    const [widgets, setWidgets] = useState<Widget[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        setLoading(true);
        setError(false);

        // Blogs now come from Supabase (managed in Manager → Blogs).
        // Look up by slug first, then fall back to a numeric id.
        (async () => {
            try {
                let { data } = await supabase.from('blogs').select('*').eq('slug', slug).maybeSingle();
                if (!data && slug && /^\d+$/.test(slug)) {
                    ({ data } = await supabase.from('blogs').select('*').eq('id', Number(slug)).maybeSingle());
                }
                if (data) {
                    setBlog(data as BlogPost);
                    setError(false);
                } else {
                    throw new Error('Not found');
                }
            } catch {
                const fallback = fallbackBlogs.find(post => post.slug === slug || String(post.id) === slug);
                if (fallback) {
                    setBlog(fallback);
                    setError(false);
                } else {
                    setError(true);
                }
            } finally {
                setLoading(false);
            }
        })();

        fetch('/api/site/widgets')
            .then(res => res.json())
            .then(data => { if (Array.isArray(data)) setWidgets(data); })
            .catch(() => { });
    }, [slug]);

    useEffect(() => {
        if (blog) {
            // Update Title
            document.title = blog.seo_title || `${blog.title} | Gen-Z IITian`;

            // Update Meta Description
            let metaDesc = document.querySelector('meta[name="description"]');
            if (!metaDesc) {
                metaDesc = document.createElement('meta');
                metaDesc.setAttribute('name', 'description');
                document.head.appendChild(metaDesc);
            }
            metaDesc.setAttribute('content', blog.seo_description || `Read about ${blog.title} on Gen-Z IITian.`);

            // Update Meta Keywords
            let metaKey = document.querySelector('meta[name="keywords"]');
            if (!metaKey) {
                metaKey = document.createElement('meta');
                metaKey.setAttribute('name', 'keywords');
                document.head.appendChild(metaKey);
            }
            metaKey.setAttribute('content', blog.seo_keywords || 'iit, madras, bs, qualifier');
        }
    }, [blog]);

    const handleShare = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const renderContent = (content: string) => {
        // If content contains HTML tags, render it as HTML
        if (content.includes('<') && content.includes('>')) {
            return (
                <div
                    className="rich-text-content"
                    dangerouslySetInnerHTML={{ __html: content }}
                />
            );
        }

        // Fallback to legacy markdown-style rendering for old posts
        return content.split('\n').map((line, i) => {
            if (line.startsWith('## ')) return <h2 key={i} className="text-2xl lg:text-3xl font-black text-[#0b1120] mt-10 mb-4">{line.slice(3)}</h2>;
            if (line.startsWith('### ')) return <h3 key={i} className="text-xl lg:text-2xl font-black text-[#0b1120] mt-8 mb-3">{line.slice(4)}</h3>;
            if (line.startsWith('- ')) return (
                <li key={i} className="flex items-start gap-3 text-lg text-gray-700 font-medium mb-2 ml-2">
                    <div className="w-2 h-2 rounded-full bg-[#10b981] mt-2.5 shrink-0"></div>
                    {line.slice(2)}
                </li>
            );
            if (line.trim() === '') return <div key={i} className="h-2"></div>;
            return <p key={i} className="text-lg text-gray-700 font-medium leading-relaxed mb-4">{line}</p>;
        });
    };

    const widget1 = widgets[0] || null;
    const widget2 = widgets[1] || null;
    const widget3 = widgets[2] || null;

    if (loading) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-[#10b981] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500 font-bold">Loading article...</p>
                </div>
            </div>
        );
    }

    if (error || !blog) {
        return (
            <ErrorPage
                code={404}
                title="Blog Post Not Found"
                description="The article you're looking for doesn't exist or has been removed."
                homeHref="/blog"
                homeLabel="Back to Blog"
            />
        );
    }

    const hasThumbnail = Boolean(blog.image?.trim());
    const [mobileContentStart, mobileContentEnd] = splitContentForMobile(blog.content || '');

    return (
        <div className="min-h-screen bg-white text-[#0b1120] font-sans selection:bg-blue-100">
            {/* Hero */}
            <div className={`relative bg-[#0b1120] ${hasThumbnail ? 'px-0 py-0 md:px-6 md:py-8' : 'px-4 py-16 md:px-6 md:py-20'}`}>
                {hasThumbnail && (
                    <div className="relative mx-auto aspect-video w-full max-w-7xl overflow-hidden rounded-none md:rounded-3xl bg-[#0b1120]">
                        <img src={blog.image} alt={blog.title} className="w-full h-full object-contain" />
                        <div className="absolute inset-0 hidden bg-gradient-to-t from-[#0b1120] via-[#0b1120]/40 to-transparent md:block"></div>
                    </div>
                )}
                {!hasThumbnail && (
                    <div className="mx-auto min-h-[260px] w-full max-w-5xl"></div>
                )}
                <div className={`${hasThumbnail ? 'hidden md:block' : 'block'} absolute bottom-0 left-0 right-0 pb-8 md:pb-14 px-6`}>
                    <div className="max-w-5xl mx-auto">
                        <span className="inline-block px-4 py-1.5 bg-[#10b981] text-white font-bold text-sm rounded-full border-2 border-white/30 mb-4">{blog.category}</span>
                        <h1 className="text-2xl md:text-5xl font-black text-white leading-tight mb-4">{blog.title}</h1>
                        <div className="flex flex-wrap items-center gap-4 text-white/80 text-sm font-bold">
                            <span className="flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" />{blog.category}</span>
                            <span className="w-1 h-1 rounded-full bg-white/50"></span>
                            <span>{blog.date}</span>
                            <span className="w-1 h-1 rounded-full bg-white/50"></span>
                            <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{blog.read_time}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Nav Bar */}
            <div className="border-b-[3px] border-gray-100 bg-white sticky top-0 z-30">
                <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
                    <Link to="/blog" className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-[#0b1120] transition-colors">
                        <ChevronLeft className="w-4 h-4" /> All Articles
                    </Link>
                    <button onClick={handleShare} className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-[#0b1120] rounded-lg text-xs font-bold text-[#0b1120] hover:bg-gray-50 transition-colors">
                        <Share className="w-3.5 h-3.5" /> {copied ? "Link Copied!" : "Share"}
                    </button>
                </div>
            </div>

            {/* Content + Sidebar */}
            <div className="max-w-5xl mx-auto px-6 py-12 md:py-16">
                <div className="flex gap-8 items-start">
                    {/* Main article */}
                    <article className="flex-1 min-w-0">
                        <div className="hidden lg:block prose-custom">
                            {renderContent(blog.content)}
                        </div>

                        <div className="lg:hidden space-y-10">
                            {widget1 && <WidgetCard widget={widget1} />}
                            <div className="prose-custom">{renderContent(mobileContentStart)}</div>
                            {widget2 && <WidgetCard widget={widget2} />}
                            {mobileContentEnd && <div className="prose-custom">{renderContent(mobileContentEnd)}</div>}
                            {widget3 && (
                                <div className="pt-2">
                                    <WidgetCard widget={widget3} />
                                </div>
                            )}
                        </div>
                    </article>

                    {/* Desktop sidebar */}
                    <aside className="hidden lg:block w-[300px] shrink-0 sticky top-24">
                        <div className="space-y-6">
                            {widgets.map((w) => <WidgetCard key={w.id} widget={w} />)}
                        </div>
                    </aside>
                </div>
            </div>

            {/* Bottom CTA */}
            <div className="max-w-5xl mx-auto px-6 pb-24">
                <div className="bg-[#eef2ff] border-[3px] border-[#0b1120] rounded-3xl p-8 md:p-12 shadow-[8px_8px_0px_#0b1120] text-center">
                    <h3 className="text-2xl md:text-3xl font-black text-[#0b1120] mb-3">Enjoyed this article?</h3>
                    <p className="text-gray-600 font-medium mb-6 max-w-lg mx-auto">Explore more insights to help you ace your online degree program.</p>
                    <Link to="/blog" className="inline-flex items-center gap-2 px-8 py-4 bg-[#10b981] text-white rounded-xl font-bold text-lg border-[3px] border-[#0b1120] shadow-[4px_4px_0px_#0b1120] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_#0b1120] transition-all">
                        Read More Articles
                    </Link>
                </div>
            </div>
        </div>
    );
}
