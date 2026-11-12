'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Link } from '@/landing/shims/router';
import { GraduationCap, BookOpen, Code, Coffee, Zap, Compass, BookText, BarChart3 } from 'lucide-react';
import { docsData } from '@/landing/data/docsData';
import { BlogPost, fallbackBlogs } from '@/landing/data/blogsData';
import { supabase } from '@/landing/lib/supabase';

const iconMap: Record<string, React.ReactNode> = {
  'graduation-cap': <GraduationCap className="w-7 h-7 text-[#0b1120]" />,
  'book-text': <BookText className="w-7 h-7 text-[#0b1120]" />,
  'bar-chart': <BarChart3 className="w-7 h-7 text-[#0b1120]" />,
  'code': <Code className="w-7 h-7 text-[#0b1120]" />,
  'coffee': <Coffee className="w-7 h-7 text-[#0b1120]" />,
  'zap': <Zap className="w-7 h-7 text-[#0b1120]" />,
  'compass': <Compass className="w-7 h-7 text-[#0b1120]" />,
};

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
        <img
          src={widget.image}
          alt={widget.title}
          className="w-full h-auto object-cover group-hover:scale-105 transition-transform duration-500"
          style={{ minHeight: '180px' }}
        />
        {widget.title && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
            <p className="text-white font-bold text-sm leading-tight">{widget.title}</p>
          </div>
        )}
      </div>
    </a>
  );
}

function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link to={`/blog/${post.slug || post.id}`} className="group cursor-pointer block">
      <div className="relative aspect-video rounded-3xl overflow-hidden border-[3px] border-[#0b1120] mb-4 bg-[#0b1120] shadow-[6px_6px_0px_#0b1120] group-hover:-translate-y-1 group-hover:-translate-x-1 group-hover:shadow-[10px_10px_0px_#0b1120] transition-all">
        <img src={post.image} alt={post.title} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute top-4 left-4 px-4 py-1.5 bg-white text-[#0b1120] font-bold text-sm rounded-full border-2 border-[#0b1120]">
          {post.category}
        </div>
      </div>
      <div className="flex items-center gap-4 text-sm font-bold text-gray-500 mb-2">
        <span>{post.date}</span>
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300"></span>
        <span>{post.read_time}</span>
      </div>
      <h3 className="text-lg font-black text-[#0b1120] leading-tight group-hover:text-[#10b981] transition-colors">
        {post.title}
      </h3>
    </Link>
  );
}

export default function Blog() {
  const [blogs, setBlogs] = useState<BlogPost[]>(fallbackBlogs);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [sortBy, setSortBy] = useState('Newest First');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Blogs now live in Supabase (managed from the Manager → Blogs panel).
    supabase
      .from('blogs')
      .select('*')
      .eq('published', 1)
      .order('created_at', { ascending: false })
      .then(({ data }) => { if (Array.isArray(data) && data.length > 0) setBlogs(data as BlogPost[]); });

    // Sidebar widgets stay on the server admin (unchanged).
    fetch('/api/site/widgets')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setWidgets(data); })
      .catch(() => { });
  }, []);

  const categories = ['All Categories', ...Array.from(new Set(blogs.map(b => b.category)))];

  const filteredBlogs = blogs
    .filter(post => selectedCategory === 'All Categories' || post.category === selectedCategory)
    .filter(post => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return post.title.toLowerCase().includes(q) || post.category.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortBy === 'Newest First' ? dateB - dateA : dateA - dateB;
    });

  // Split widgets: first widget goes before blogs (on mobile), rest go after
  const widget1 = widgets[0] || null;
  const widget2 = widgets[1] || null;
  const widget3 = widgets[2] || null;

  return (
    <div className="min-h-screen bg-white text-[#0b1120] font-sans selection:bg-blue-100">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl lg:text-5xl font-black text-[#0b1120] mb-4">Our Blog</h1>
          <p className="text-lg text-gray-600 font-medium max-w-2xl mx-auto">
            Insights, tips, and strategies to help you excel in your online degree program.
          </p>
        </div>

        {/* Docs Slider */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-black text-[#0b1120] flex items-center gap-3">
              <BookOpen className="w-6 h-6" /> Documentation
            </h2>
            <Link to="/docs" className="text-sm font-bold text-[#10b981] hover:underline">View all docs →</Link>
          </div>
          <div className="relative">
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin snap-x snap-mandatory" style={{ scrollbarWidth: 'thin' }}>
              {docsData.map(doc => (
                <Link
                  key={doc.slug}
                  to={`/docs/${doc.slug}`}
                  className="snap-start shrink-0 w-64 rounded-2xl border-[3px] border-[#0b1120] p-4 bg-white shadow-[4px_4px_0px_#0b1120] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_#0b1120] transition-all group"
                >
                  <div className="mb-2">{iconMap[doc.icon] || <BookOpen className="w-6 h-6 text-[#0b1120]" />}</div>
                  <h3 className="text-sm font-black text-[#0b1120] mb-1 group-hover:text-[#10b981] transition-colors">{doc.title}</h3>
                  <p className="text-[10px] text-gray-500 font-medium leading-relaxed mb-2 line-clamp-2">{doc.description}</p>
                  <span className="text-[10px] font-bold text-[#10b981]">{doc.sections.reduce((s, sec) => s + sec.items.length, 0)} articles</span>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Filter / Sort / Search Bar */}
        <div className="mb-10 rounded-2xl border-[3px] border-[#0b1120] bg-gray-50 p-4 shadow-[4px_4px_0px_#0b1120]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Category</label>
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="w-full appearance-none rounded-xl border-[2px] border-[#0b1120] bg-white px-4 py-3 pr-10 font-bold text-[#0b1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#10b981] cursor-pointer"
              >
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value)}
                className="w-full appearance-none rounded-xl border-[2px] border-[#0b1120] bg-white px-4 py-3 pr-10 font-bold text-[#0b1120] text-sm focus:outline-none focus:ring-2 focus:ring-[#10b981] cursor-pointer"
              >
                <option value="Newest First">Newest First</option>
                <option value="Oldest First">Oldest First</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-black uppercase tracking-wider text-gray-500 mb-2">Search Articles</label>
              <div className="relative">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search titles, tags..."
                  className="w-full rounded-xl border-[2px] border-[#0b1120] bg-white pl-11 pr-4 py-3 font-bold text-[#0b1120] text-sm placeholder:text-gray-400 placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-[#10b981]"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Desktop: Blog grid + sticky sidebar | Mobile: widgets interspersed */}
        <div className="flex gap-8 items-start">

          {/* Main blog content */}
          <div className="flex-1 min-w-0">
            {/* Mobile only: Widget 1 before blogs */}
            {widget1 && (
              <div className="lg:hidden mb-8">
                <WidgetCard widget={widget1} />
              </div>
            )}

            {filteredBlogs.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-400 font-bold text-lg">No articles found.</p>
                <p className="text-gray-400 text-sm mt-1">Try adjusting your filters or search query.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {filteredBlogs.map((post) => (
                  <BlogCard key={post.id} post={post} />
                ))}
              </div>
            )}

            {/* Mobile only: Widgets 2 & 3 after blogs */}
            {(widget2 || widget3) && (
              <div className="lg:hidden mt-10 space-y-6">
                {widget2 && <WidgetCard widget={widget2} />}
                {widget3 && <WidgetCard widget={widget3} />}
              </div>
            )}
          </div>

          {/* Desktop sidebar - sticky */}
          <aside className="hidden lg:block w-[320px] shrink-0 sticky top-24">
            <div className="space-y-6">
              {widgets.length > 0 ? (
                widgets.map((w) => <WidgetCard key={w.id} widget={w} />)
              ) : (
                <div className="p-6 bg-gray-50 border-[3px] border-dashed border-gray-200 rounded-2xl text-center">
                  <p className="text-gray-400 font-bold text-sm">Widget space</p>
                  <p className="text-gray-400 text-xs mt-1">Add widgets from admin panel</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
