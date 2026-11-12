'use client';

import React from 'react';
import { useState, useEffect } from 'react';
import { Link } from '@/landing/shims/router';
import { motion } from 'motion/react';
import {
    BookOpen, TrendingUp, MapPin, Users, FileText,
    Layers, Star, Sparkles, Search, ChevronRight,
    Filter, Tag
} from 'lucide-react';

interface PageItem {
    id: number;
    slug: string;
    playbook_type: string;
    title: string;
    meta_description: string;
    primary_keyword: string;
    cluster_topic: string;
    word_count: number;
    updated_at: string;
}

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

const playbookMeta: Record<string, { label: string; icon: React.ReactNode; color: string; bgColor: string }> = {
    glossary: { label: 'Glossary', icon: <BookOpen className="w-4 h-4" />, color: 'text-purple-600', bgColor: 'bg-purple-50' },
    comparison: { label: 'Comparison', icon: <TrendingUp className="w-4 h-4" />, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    location: { label: 'Location', icon: <MapPin className="w-4 h-4" />, color: 'text-green-600', bgColor: 'bg-green-50' },
    persona: { label: 'For You', icon: <Users className="w-4 h-4" />, color: 'text-amber-600', bgColor: 'bg-amber-50' },
    guide: { label: 'Guide', icon: <FileText className="w-4 h-4" />, color: 'text-rose-600', bgColor: 'bg-rose-50' },
    subject_notes: { label: 'Subject Notes', icon: <Layers className="w-4 h-4" />, color: 'text-teal-600', bgColor: 'bg-teal-50' },
    career: { label: 'Career', icon: <Star className="w-4 h-4" />, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
    profile: { label: 'Profile', icon: <Users className="w-4 h-4" />, color: 'text-sky-600', bgColor: 'bg-sky-50' },
    curation: { label: 'Curated', icon: <Sparkles className="w-4 h-4" />, color: 'text-fuchsia-600', bgColor: 'bg-fuchsia-50' },
};

export default function SEODirectory() {
    const [pages, setPages] = useState<PageItem[]>([]);
    const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
    const [activeType, setActiveType] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        document.title = 'Knowledge Hub — IIT Madras BS Degree Resources | GenZ IITian';
        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.setAttribute('content', 'Explore 500+ in-depth articles, guides, comparisons, and glossary pages about IIT Madras BS Degree — your complete knowledge hub.');
    }, []);

    useEffect(() => {
        fetchPages();
    }, [activeType, pagination.page, searchQuery]);

    const fetchPages = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (activeType) params.set('type', activeType);
            if (searchQuery) params.set('search', searchQuery);
            params.set('page', String(pagination.page));
            params.set('limit', '20');

            const res = await fetch(`/api/site/pseo/pages?${params}`);
            const data = await res.json();
            setPages(data.pages || []);
            setPagination(data.pagination || { page: 1, limit: 20, total: 0, totalPages: 0 });
        } catch {
            setPages([]);
        } finally {
            setLoading(false);
        }
    };

    const playbooks = Object.entries(playbookMeta);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Hero */}
            <section className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white overflow-hidden">
                <div className="absolute inset-0" style={{
                    backgroundImage: 'radial-gradient(circle at 25% 50%, rgba(59,130,246,0.15) 0%, transparent 50%), radial-gradient(circle at 75% 30%, rgba(139,92,246,0.12) 0%, transparent 50%)',
                }} />
                <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur text-sm font-medium text-blue-200 mb-4">
                            <Sparkles className="w-4 h-4" /> Knowledge Hub
                        </span>
                        <h1 className="text-3xl sm:text-5xl font-bold mb-4 tracking-tight">
                            IIT Madras BS Degree<br />
                            <span className="text-blue-300">Complete Knowledge Hub</span>
                        </h1>
                        <p className="text-lg text-white/70 max-w-2xl mx-auto mb-8">
                            Your definitive resource for everything about the IIT Madras BS Degree — guides, comparisons, subject notes, career paths, and more.
                        </p>

                        {/* Search */}
                        <div className="max-w-xl mx-auto relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search articles, guides, comparisons..."
                                value={searchQuery}
                                onChange={e => {
                                    setSearchQuery(e.target.value);
                                    setPagination(p => ({ ...p, page: 1 }));
                                }}
                                className="w-full pl-12 pr-4 py-3.5 rounded-2xl bg-white/10 backdrop-blur border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:bg-white/15 transition-all"
                            />
                        </div>

                        {pagination.total > 0 && (
                            <p className="text-white/50 text-sm mt-4">{pagination.total} articles available</p>
                        )}
                    </motion.div>
                </div>
            </section>

            {/* Filter Bar */}
            <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-lg border-b border-gray-100 shadow-sm">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center gap-2 py-3 overflow-x-auto scrollbar-hide">
                        <Filter className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <button
                            onClick={() => { setActiveType(''); setPagination(p => ({ ...p, page: 1 })); }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${!activeType ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            All
                        </button>
                        {playbooks.map(([key, meta]) => (
                            <button
                                key={key}
                                onClick={() => { setActiveType(key); setPagination(p => ({ ...p, page: 1 })); }}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeType === key ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                {meta.icon}
                                {meta.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content Grid */}
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
                                <div className="h-4 bg-gray-100 rounded w-20 mb-3" />
                                <div className="h-5 bg-gray-200 rounded w-full mb-2" />
                                <div className="h-4 bg-gray-100 rounded w-5/6 mb-4" />
                                <div className="h-3 bg-gray-50 rounded w-24" />
                            </div>
                        ))}
                    </div>
                ) : pages.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="text-5xl mb-4">📚</div>
                        <h2 className="text-xl font-bold text-gray-800 mb-2">No pages found</h2>
                        <p className="text-gray-500">
                            {searchQuery ? 'Try a different search term' : 'Content is being generated. Check back soon!'}
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                            {pages.map((page, i) => {
                                const meta = playbookMeta[page.playbook_type] || playbookMeta.glossary;
                                return (
                                    <motion.div
                                        key={page.id}
                                        initial={{ opacity: 0, y: 16 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.03, duration: 0.3 }}
                                    >
                                        <Link
                                            to={`/${page.slug}`}
                                            className="block bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-lg hover:border-gray-200 transition-all group h-full"
                                        >
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium ${meta.bgColor} ${meta.color} mb-3`}>
                                                {meta.icon} {meta.label}
                                            </span>
                                            <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors mb-2 line-clamp-2 text-sm sm:text-base">
                                                {page.title}
                                            </h3>
                                            <p className="text-gray-500 text-sm line-clamp-2 mb-3">
                                                {page.meta_description}
                                            </p>
                                            <div className="flex items-center justify-between text-xs text-gray-400">
                                                <span>{page.word_count.toLocaleString()} words</span>
                                                <span className="flex items-center gap-1 text-blue-500 group-hover:text-blue-600 font-medium">
                                                    Read <ChevronRight className="w-3 h-3" />
                                                </span>
                                            </div>
                                        </Link>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Pagination */}
                        {pagination.totalPages > 1 && (
                            <div className="flex justify-center items-center gap-2 mt-10">
                                <button
                                    onClick={() => setPagination(p => ({ ...p, page: Math.max(1, p.page - 1) }))}
                                    disabled={pagination.page === 1}
                                    className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    Previous
                                </button>
                                <span className="text-sm text-gray-500">
                                    Page {pagination.page} of {pagination.totalPages}
                                </span>
                                <button
                                    onClick={() => setPagination(p => ({ ...p, page: Math.min(p.totalPages, p.page + 1) }))}
                                    disabled={pagination.page === pagination.totalPages}
                                    className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
