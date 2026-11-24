import { supabase } from '@/landing/lib/supabase';

/** Key in the `settings` table (value is a JSON array of Booklet). */
export const BOOKLETS_KEY = 'booklets';

export type BookletKind = 'single' | 'bundle';
export type BookletBinding = 'spiral-top' | 'spiral-side' | 'spine';
export type BookletCover = 'mint' | 'sun' | 'grape' | 'sky' | 'coral' | 'ink';
export type BookletAction = 'pdf' | 'checkout' | 'link';

export interface Booklet {
  id: string;
  kind: BookletKind;
  /** Shown big on the cover label */
  title: string;
  /** Subject chip / filter, e.g. "Maths 1" */
  subject: string;
  level: string;            // Qualifier | Foundation | Diploma
  term: string;             // e.g. "Term 1"
  exam: string;             // e.g. "Quiz 1"
  /** What's inside — topics for a single booklet, booklet names for a bundle */
  contents: string[];
  description: string;
  /** Price in rupees. 0 = free */
  price: number;
  /** Original price shown struck through (optional) */
  mrp: number;
  /** What the button does */
  action: BookletAction;
  /** Free PDF link (Drive etc.) — used when action = 'pdf' */
  pdfUrl: string;
  /** Course / bundle id in the courses table — used when action = 'checkout' */
  courseId: string;
  /** Any external payment / product page — used when action = 'link' */
  buyUrl: string;
  buttonLabel: string;      // blank = automatic
  badge: string;            // small sticker on the cover, e.g. "New", "Bestseller"
  cover: BookletCover;
  binding: BookletBinding;
  pages: number;            // 0 = hide
  active: boolean;
}

export const COVERS: Record<BookletCover, { label: string; bg: string; deep: string; ink: string; paper: string }> = {
  mint:  { label: 'Mint',   bg: '#34d399', deep: '#059669', ink: '#0b1120', paper: '#ecfdf5' },
  sun:   { label: 'Sun',    bg: '#fbbf24', deep: '#d97706', ink: '#0b1120', paper: '#fffbeb' },
  grape: { label: 'Grape',  bg: '#a78bfa', deep: '#7c3aed', ink: '#0b1120', paper: '#f5f3ff' },
  sky:   { label: 'Sky',    bg: '#7dd3fc', deep: '#0284c7', ink: '#0b1120', paper: '#f0f9ff' },
  coral: { label: 'Coral',  bg: '#fb7185', deep: '#e11d48', ink: '#0b1120', paper: '#fff1f2' },
  ink:   { label: 'Ink',    bg: '#1e293b', deep: '#0b1120', ink: '#ffffff', paper: '#f8fafc' },
};

export const BINDINGS: Record<BookletBinding, string> = {
  'spiral-top': 'Spiral on top (flips up)',
  'spiral-side': 'Spiral on the side (opens like a book)',
  spine: 'Bound spine, no spiral',
};

export const BOOKLET_LEVELS = ['Qualifier', 'Foundation', 'Diploma'];

export function newBooklet(kind: BookletKind = 'single'): Booklet {
  return {
    id: `bk-${Date.now().toString(36)}`,
    kind,
    title: kind === 'bundle' ? 'New Booklet Bundle' : 'New Booklet',
    subject: '',
    level: 'Foundation',
    term: 'Term 1',
    exam: 'Quiz 1',
    contents: [],
    description: '',
    price: 0,
    mrp: 0,
    action: 'pdf',
    pdfUrl: '',
    courseId: '',
    buyUrl: '',
    buttonLabel: '',
    badge: '',
    cover: kind === 'bundle' ? 'ink' : 'mint',
    binding: 'spiral-top',
    pages: 0,
    active: true,
  };
}

export const DEFAULT_BOOKLETS: Booklet[] = [
  {
    ...newBooklet('single'),
    id: 'bk-maths1-quiz1',
    title: 'Maths 1 Quiz 1 Booklet',
    subject: 'Maths 1',
    contents: ['Week 1 · Set Theory', 'Week 2 · Coordinate Geometry', 'Week 3 · Quadratic Functions', 'Week 4 · Polynomials'],
    description: 'Weeks 1–4 in one place — concepts, solved examples and practice for Quiz 1.',
    pdfUrl: 'https://drive.google.com/file/d/1sLpUSWANC8cEVw8B2r7qpR_QhL7fiPDD/view',
    cover: 'sun',
  },
  {
    ...newBooklet('single'),
    id: 'bk-english1-quiz1',
    title: 'English 1 Quiz 1 Booklet',
    subject: 'English 1',
    contents: ['Week 1 · Sounds', 'Week 2 · Parts of Speech', 'Week 3 · Sentences', 'Week 4 · Speaking Skills'],
    description: 'Weeks 1–4 covered for Quiz 1 — quick revision notes and practice.',
    pdfUrl: 'https://drive.google.com/file/d/1sMN5D9vX7eq4R94yyUAStGFRw1l-y1te/view',
    cover: 'grape',
  },
];

const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Math.max(0, Number(v)) : 0);

export function normalizeBooklet(raw: any, i = 0): Booklet {
  const base = newBooklet(raw?.kind === 'bundle' ? 'bundle' : 'single');
  return {
    ...base,
    id: str(raw?.id, `bk-${i}`),
    title: str(raw?.title, base.title),
    subject: str(raw?.subject),
    level: str(raw?.level, base.level),
    term: str(raw?.term),
    exam: str(raw?.exam),
    contents: Array.isArray(raw?.contents) ? raw.contents.filter((c: unknown) => typeof c === 'string' && c.trim()) : [],
    description: str(raw?.description),
    price: num(raw?.price),
    mrp: num(raw?.mrp),
    action: (['pdf', 'checkout', 'link'] as const).includes(raw?.action) ? raw.action : 'pdf',
    pdfUrl: str(raw?.pdfUrl),
    courseId: str(raw?.courseId),
    buyUrl: str(raw?.buyUrl),
    buttonLabel: str(raw?.buttonLabel),
    badge: str(raw?.badge),
    cover: raw?.cover in COVERS ? raw.cover : base.cover,
    binding: raw?.binding in BINDINGS ? raw.binding : base.binding,
    pages: num(raw?.pages),
    active: raw?.active !== false,
  };
}

export function parseBooklets(raw: unknown): Booklet[] | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(normalizeBooklet) : null;
  } catch {
    return null;
  }
}

/** Manager-edited booklets, or the defaults if none were saved yet. */
export async function fetchBooklets(): Promise<Booklet[]> {
  try {
    const { data } = await supabase.from('settings').select('value').eq('key', BOOKLETS_KEY).maybeSingle();
    return parseBooklets(data?.value) ?? DEFAULT_BOOKLETS;
  } catch {
    return DEFAULT_BOOKLETS;
  }
}

export async function saveBooklets(booklets: Booklet[]) {
  return supabase.from('settings').upsert({ key: BOOKLETS_KEY, value: JSON.stringify(booklets) });
}

/** What the button says / where it goes. */
export function bookletCta(b: Booklet): { label: string; href: string; external: boolean } {
  const label = b.buttonLabel || (b.price <= 0 ? 'Get for Free' : `Get for ₹${b.price}`);
  if (b.action === 'checkout' && b.courseId) {
    return { label, href: `/checkout/${encodeURIComponent(b.courseId)}`, external: false };
  }
  if (b.action === 'link' && b.buyUrl) {
    return { label, href: b.buyUrl, external: true };
  }
  return { label, href: b.pdfUrl, external: true };
}

export function discountPercent(b: Booklet) {
  if (b.mrp > b.price && b.mrp > 0) return Math.round(((b.mrp - b.price) / b.mrp) * 100);
  return 0;
}
