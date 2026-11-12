'use client';

import React, { useState } from 'react';
import { Link } from '@/landing/shims/router';
import { GraduationCap, BookOpen, Code, Coffee, Zap, Compass, BookText, BarChart3 } from 'lucide-react';
import { docsData, DocEntry } from '@/landing/data/docsData';
export type { DocSection, DocEntry, ContentBlock, DocItem } from '@/landing/data/docsData';
export { docsData } from '@/landing/data/docsData';

const iconMap: Record<string, React.ReactNode> = {
  'graduation-cap': <GraduationCap className="w-8 h-8 text-[#0b1120]" />,
  'book-text': <BookText className="w-8 h-8 text-[#0b1120]" />,
  'bar-chart': <BarChart3 className="w-8 h-8 text-[#0b1120]" />,
  'code': <Code className="w-8 h-8 text-[#0b1120]" />,
  'coffee': <Coffee className="w-8 h-8 text-[#0b1120]" />,
  'zap': <Zap className="w-8 h-8 text-[#0b1120]" />,
  'compass': <Compass className="w-8 h-8 text-[#0b1120]" />,
};

function DocCard(props: { doc: DocEntry; key?: string }) {
  const { doc } = props;
  return (
    <Link
      to={`/docs/${doc.slug}`}
      className="group block rounded-xl border-[3px] border-[#0b1120] p-5 bg-white shadow-[4px_4px_0px_#0b1120] hover:-translate-y-1 hover:-translate-x-1 hover:shadow-[8px_8px_0px_#0b1120] transition-all"
    >
      <div className="text-2xl mb-3">{iconMap[doc.icon] || <BookOpen className="w-6 h-6 text-[#0b1120]" />}</div>
      <h3 className="text-lg font-black text-[#0b1120] mb-2 group-hover:text-[#10b981] transition-colors">{doc.title}</h3>
      <p className="text-sm text-gray-500 font-medium leading-relaxed mb-4">{doc.description}</p>
      <div className="flex items-center gap-2 text-xs font-bold text-[#10b981]">
        <span>{doc.sections.reduce((sum, s) => sum + s.items.length, 0)} articles</span>
        <span>·</span>
        <span>{doc.sections.length} sections</span>
      </div>
    </Link>
  );
}

export default function Docs() {
  const [search, setSearch] = useState('');

  const filteredDocs = docsData.filter(doc => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return doc.title.toLowerCase().includes(q) || doc.description.toLowerCase().includes(q) || doc.category.toLowerCase().includes(q);
  });

  const categories = Array.from(new Set(docsData.map(d => d.category)));

  const degreeDocs = filteredDocs.filter(d => d.category === 'Degree');
  const programmingDocs = filteredDocs.filter(d => d.category === 'Programming Languages');

  return (
    <div className="min-h-screen bg-white text-[#0b1120] font-sans selection:bg-blue-100">
      <div className="max-w-7xl mx-auto px-6 pt-20 pb-12">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl lg:text-4xl font-black text-[#0b1120] mb-4">Documentation</h1>
          <p className="text-base text-gray-600 font-medium max-w-2xl mx-auto">
            Handbooks, guides, and reference docs — everything you need in one place.
          </p>
        </div>

        {/* Search */}
        <div className="max-w-xl mx-auto mb-10">
          <div className="relative">
            <svg className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search documentation..."
              className="w-full rounded-xl border-[3px] border-[#0b1120] bg-white pl-12 pr-5 py-3 font-bold text-[#0b1120] text-sm placeholder:text-gray-400 placeholder:font-medium focus:outline-none focus:ring-2 focus:ring-[#10b981] shadow-[4px_4px_0px_#0b1120]"
            />
          </div>
        </div>

        {/* Degree Section */}
        {degreeDocs.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-black text-[#0b1120] mb-4 flex items-center gap-3">
              <GraduationCap className="w-6 h-6" /> Degree
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {degreeDocs.map(doc => <DocCard key={doc.slug} doc={doc} />)}
            </div>
          </div>
        )}

        {/* Programming Languages Section */}
        {programmingDocs.length > 0 && (
          <div className="mb-12">
            <h2 className="text-xl font-black text-[#0b1120] mb-4 flex items-center gap-3">
              <Code className="w-6 h-6" /> Programming Languages & References
            </h2>
            <div className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory" style={{ scrollbarWidth: 'thin' }}>
              {programmingDocs.map(doc => (
                <div key={doc.slug} className="snap-start shrink-0 w-80">
                  <DocCard doc={doc} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Any other categories */}
        {categories.filter(c => c !== 'Degree' && c !== 'Programming Languages').map(cat => {
          const catDocs = filteredDocs.filter(d => d.category === cat);
          if (catDocs.length === 0) return null;
          return (
            <div key={cat} className="mb-12">
              <h2 className="text-xl font-black text-[#0b1120] mb-4 flex items-center gap-3">
                <span className="w-1.5 h-6 bg-[#10b981] rounded-full inline-block"></span>
                {cat}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {catDocs.map(doc => <DocCard key={doc.slug} doc={doc} />)}
              </div>
            </div>
          );
        })}

        {filteredDocs.length === 0 && (
          <div className="text-center py-16">
            <p className="text-gray-400 font-bold text-lg">No documentation found.</p>
            <p className="text-gray-400 text-sm mt-1">Try a different search term.</p>
          </div>
        )}
      </div>
    </div>
  );
}
