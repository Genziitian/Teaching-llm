'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from '@/landing/shims/router';
import { docsData, DocEntry, ContentBlock, DocItem } from '@/landing/data/docsData';
import ErrorPage from '@/landing/components/ErrorPage';

function ContentRenderer({ blocks }: { blocks: ContentBlock[] }) {
  return (
    <div className="space-y-6">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'text':
            return <p key={i} className="text-gray-600 leading-relaxed text-[15px]">{block.value}</p>;

          case 'html':
            return (
              <div
                key={i}
                className="text-gray-600 leading-relaxed text-[15px] [&_a]:text-[#10b981] [&_a]:font-black [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: block.value || '' }}
              />
            );

          case 'heading': {
            const hId = (block.value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
            if (block.level === 3) return <h3 key={i} id={hId} className="text-xl font-black text-[#0b1120] mt-8 mb-3 flex items-center gap-3"><span className="w-1.5 h-6 bg-[#10b981] rounded-full inline-block"></span>{block.value}</h3>;
            return <h2 key={i} id={hId} className="text-2xl font-black text-[#0b1120] mt-10 mb-4">{block.value}</h2>;
          }

          case 'list':
            return (
              <ul key={i} className="space-y-2 ml-1">
                {block.items?.map((item, j) => (
                  <li key={j} className="flex items-start gap-3 text-[15px] text-gray-600">
                    <span className="w-2 h-2 rounded-full bg-[#10b981] mt-2 shrink-0"></span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            );

          case 'stats':
            return (
              <div key={i} id={`stats-${i}`} className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {block.stats?.map((stat, j) => (
                  <div key={j} className="rounded-xl border-[2px] border-[#0b1120] p-4 bg-gray-50 text-center shadow-[3px_3px_0px_#0b1120]">
                    <p className="text-2xl font-black text-[#0b1120]">{stat.value}</p>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-1">{stat.label}</p>
                    {stat.sub && <p className="text-[11px] text-gray-400 font-medium mt-0.5">{stat.sub}</p>}
                  </div>
                ))}
              </div>
            );

          case 'table':
            return (
              <div key={i} id={`table-${i}`} className="overflow-x-auto rounded-xl border-[2px] border-[#0b1120] shadow-[3px_3px_0px_#0b1120]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#0b1120] text-white">
                      {block.columns?.map((col, j) => (
                        <th key={j} className="px-4 py-3 text-left font-black text-xs uppercase tracking-wider">{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows?.map((row, j) => (
                      <tr key={j} className={j % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        {row.map((cell, k) => (
                          <td key={k} className="px-4 py-3 text-gray-700 font-medium border-t border-gray-100">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case 'callout':
            const variants = {
              info: 'bg-blue-50 border-blue-400 text-blue-800',
              warning: 'bg-amber-50 border-amber-400 text-amber-800',
              success: 'bg-emerald-50 border-emerald-400 text-emerald-800',
              important: 'bg-purple-50 border-purple-400 text-purple-800',
            };
            const v = block.variant || 'info';
            const icons = { info: 'ℹ️', warning: '⚠️', success: '✅', important: '🔔' };
            return (
              <div key={i} id={`note-${i}`} className={`border-l-4 p-4 rounded-r-xl ${variants[v]}`}>
                <p className="text-sm font-semibold leading-relaxed">
                  <span className="mr-2">{icons[v]}</span>
                  {block.value}
                </p>
              </div>
            );

          case 'image':
            return (
              <div key={i} className="rounded-xl overflow-hidden border-[2px] border-gray-200">
                <img src={block.src} alt={block.alt || ''} className="w-full h-auto" />
              </div>
            );

          case 'divider':
            return <hr key={i} className="border-t-2 border-gray-100 my-8" />;

          default:
            return null;
        }
      })}
    </div>
  );
}

interface Widget {
  id: number;
  title: string;
  image: string;
  link: string;
  position: number;
}

function WidgetCard({ widget }: { widget: Widget; key?: number }) {
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
          style={{ minHeight: '140px' }}
        />
        {widget.title && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
            <p className="text-white font-bold text-sm leading-tight">{widget.title}</p>
          </div>
        )}
      </div>
    </a>
  );
}

function AnimatedAdPlaceholder() {
  return (
    <div className="rounded-2xl border-[3px] border-[#0b1120] shadow-[6px_6px_0px_#0b1120] overflow-hidden">
      <svg viewBox="0 0 280 200" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="adGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981">
              <animate attributeName="stop-color" values="#10b981;#0b1120;#10b981" dur="4s" repeatCount="indefinite" />
            </stop>
            <stop offset="100%" stopColor="#0b1120">
              <animate attributeName="stop-color" values="#0b1120;#10b981;#0b1120" dur="4s" repeatCount="indefinite" />
            </stop>
          </linearGradient>
          <linearGradient id="shimmer" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.15)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
        </defs>
        <rect width="280" height="200" fill="url(#adGrad)" />
        <rect width="280" height="200" fill="url(#shimmer)">
          <animate attributeName="x" from="-280" to="280" dur="2.5s" repeatCount="indefinite" />
        </rect>
        <rect x="90" y="30" width="100" height="100" rx="16" fill="none" stroke="white" strokeWidth="2" opacity="0.3">
          <animate attributeName="opacity" values="0.2;0.5;0.2" dur="3s" repeatCount="indefinite" />
        </rect>
        <rect x="110" y="55" width="60" height="6" rx="3" fill="white" opacity="0.5" />
        <rect x="120" y="70" width="40" height="6" rx="3" fill="white" opacity="0.3" />
        <circle cx="140" cy="100" r="12" fill="none" stroke="white" strokeWidth="2" opacity="0.4">
          <animate attributeName="r" values="10;16;10" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0.15;0.5" dur="2s" repeatCount="indefinite" />
        </circle>
        <polygon points="136,95 136,105 148,100" fill="white" opacity="0.6" />
        <text x="140" y="155" textAnchor="middle" fill="white" fontWeight="800" fontSize="14" fontFamily="system-ui, sans-serif" opacity="0.9">Your Ad Here</text>
        <text x="140" y="175" textAnchor="middle" fill="white" fontWeight="600" fontSize="10" fontFamily="system-ui, sans-serif" opacity="0.5">Advertise with us</text>
      </svg>
    </div>
  );
}

export default function DocsDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [activeItem, setActiveItem] = useState('');
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const contentRef = useRef<HTMLDivElement>(null);

  const doc: DocEntry | undefined = docsData.find(d => d.slug === slug);

  useEffect(() => {
    if (doc) {
      const expanded: Record<string, boolean> = {};
      doc.sections.forEach(s => { expanded[s.title] = true; });
      setExpandedSections(expanded);
      if (doc.sections[0]?.items[0]) {
        setActiveItem(doc.sections[0].items[0].slug);
      }
    }
  }, [doc]);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeItem]);

  useEffect(() => {
    fetch('/api/site/widgets')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setWidgets(data); })
      .catch(() => { });
  }, []);

  if (!doc) {
    return (
      <ErrorPage
        code={404}
        title="Doc Not Found"
        description="This documentation page doesn't exist or may have been moved."
        homeHref="/docs"
        homeLabel="Back to Documentation"
      />
    );
  }

  const toggleSection = (title: string) => {
    setExpandedSections(prev => ({ ...prev, [title]: !prev[title] }));
  };

  const allItems: DocItem[] = doc.sections.flatMap(s => s.items);
  const currentItem = allItems.find(i => i.slug === activeItem) || allItems[0];

  // Build TOC from all significant content blocks
  const tocItems = currentItem?.content
    ?.map((b, i) => {
      if (b.type === 'heading') return { id: (b.value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-'), label: b.value || '' };
      if (b.type === 'stats') return { id: `stats-${i}`, label: 'Key Statistics' };
      if (b.type === 'table') return { id: `table-${i}`, label: b.columns?.[0] ? `${b.columns[0]} Table` : 'Data Table' };
      if (b.type === 'callout') return { id: `note-${i}`, label: b.variant === 'warning' ? 'Warning' : b.variant === 'important' ? 'Important' : 'Note' };
      return null;
    })
    .filter((item): item is { id: string; label: string } => item !== null) || [];

  return (
    <div className="min-h-screen bg-white text-[#0b1120] font-sans selection:bg-blue-100">
      {/* Mobile toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="lg:hidden fixed top-24 left-4 z-50 w-10 h-10 rounded-xl border-[2px] border-[#0b1120] bg-white shadow-[3px_3px_0px_#0b1120] flex items-center justify-center"
      >
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      <div className="max-w-[1400px] mx-auto flex">
        {/* Left Sidebar */}
        <aside className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
          fixed lg:sticky top-20 left-0 z-40 lg:z-auto
          w-72 h-[calc(100vh-5rem)] overflow-y-auto bg-white
          border-r border-gray-200
          transition-transform duration-200
          px-5 py-8
          scrollbar-thin
        `}>
          <Link to="/docs" className="flex items-center gap-2 text-sm font-bold text-gray-400 hover:text-[#0b1120] transition-colors mb-6">
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            All Docs
          </Link>

          <h2 className="font-black text-lg text-[#0b1120] mb-6 leading-tight">{doc.title}</h2>

          {doc.sections.map((section) => (
            <div key={section.title} className="mb-4">
              <button
                onClick={() => toggleSection(section.title)}
                className="flex items-center justify-between w-full text-left py-2 text-sm font-black text-gray-500 uppercase tracking-wider hover:text-[#0b1120] transition-colors"
              >
                {section.title}
                <svg
                  className={`w-4 h-4 transition-transform ${expandedSections[section.title] ? 'rotate-180' : ''}`}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </button>
              {expandedSections[section.title] && (
                <div className="ml-1 border-l-2 border-gray-100 pl-4 space-y-0.5">
                  {section.items.map(item => (
                    <button
                      key={item.slug}
                      onClick={() => { setActiveItem(item.slug); setSidebarOpen(false); }}
                      className={`
                        w-full text-left py-2 px-3 rounded-lg text-sm font-semibold transition-all flex items-center gap-2
                        ${activeItem === item.slug
                          ? 'bg-[#10b981]/10 text-[#10b981] border-l-[3px] border-[#10b981] -ml-[3px] pl-[15px]'
                          : 'text-gray-600 hover:text-[#0b1120] hover:bg-gray-50'
                        }
                      `}
                    >
                      {item.title}
                      {item.badge && (
                        <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded-full ${
                          item.badge === 'New' ? 'bg-emerald-100 text-emerald-600' :
                          item.badge === 'Updated' ? 'bg-blue-100 text-blue-600' :
                          item.badge === 'Important' ? 'bg-amber-100 text-amber-600' :
                          item.badge === 'Deprecated' ? 'bg-red-100 text-red-500' :
                          'bg-gray-100 text-gray-500'
                        }`}>{item.badge}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0 px-6 lg:px-16 py-12" ref={contentRef}>
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-400 mb-8 flex-wrap">
            <Link to="/" className="hover:text-[#0b1120] transition-colors">Home</Link>
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <Link to="/docs" className="hover:text-[#0b1120] transition-colors">Docs</Link>
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <Link to={`/docs/${doc.slug}`} className="hover:text-[#0b1120] transition-colors">{doc.title}</Link>
            <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="text-[#0b1120]">{currentItem?.title}</span>
          </div>

          {/* Title */}
          <h1 className="text-4xl lg:text-5xl font-black text-[#0b1120] mb-4">{currentItem?.title}</h1>
          <p className="text-lg text-gray-500 font-medium mb-10 max-w-2xl">
            {doc.title} — {currentItem?.title}
          </p>

          {/* Rich Content */}
          {currentItem?.content && currentItem.content.length > 0 ? (
            <ContentRenderer blocks={currentItem.content} />
          ) : (
            <div className="bg-gray-50 border-[2px] border-dashed border-gray-200 rounded-xl p-8 text-center">
              <p className="text-gray-400 font-bold">Content coming soon</p>
              <p className="text-gray-400 text-sm mt-1">This section will be updated with detailed documentation.</p>
            </div>
          )}

          {widgets.length > 0 && (
            <div className="xl:hidden mt-12">
              <h3 className="text-xs font-black uppercase tracking-wider text-gray-400 mb-4">Updates</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {widgets.map(w => (
                  <WidgetCard key={w.id} widget={w} />
                ))}
              </div>
            </div>
          )}

          {/* Prev / Next navigation */}
          <div className="border-t-2 border-gray-100 pt-8 mt-16 flex items-center justify-between">
            {(() => {
              const flatIdx = allItems.findIndex(i => i.slug === activeItem);
              const prev = flatIdx > 0 ? allItems[flatIdx - 1] : null;
              const next = flatIdx < allItems.length - 1 ? allItems[flatIdx + 1] : null;
              return (
                <>
                  {prev ? (
                    <button onClick={() => setActiveItem(prev.slug)} className="group text-left">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Previous</span>
                      <p className="text-sm font-black text-[#0b1120] group-hover:text-[#10b981] transition-colors">← {prev.title}</p>
                    </button>
                  ) : <div />}
                  {next ? (
                    <button onClick={() => setActiveItem(next.slug)} className="group text-right">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Next</span>
                      <p className="text-sm font-black text-[#0b1120] group-hover:text-[#10b981] transition-colors">{next.title} →</p>
                    </button>
                  ) : <div />}
                </>
              );
            })()}
          </div>
        </main>

        {/* Right Sidebar - Updates */}
        <aside className="hidden xl:block w-72 shrink-0 sticky top-24 h-[calc(100vh-6rem)] overflow-y-auto py-12 pr-4 space-y-8 scrollbar-thin">
          {/* Updates / Widget Banners */}
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-gray-400">Updates</h3>
            {widgets.length > 0 ? widgets.map(w => (
              <WidgetCard key={w.id} widget={w} />
            )) : (
              <>
                <AnimatedAdPlaceholder />
                <AnimatedAdPlaceholder />
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
