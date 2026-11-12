'use client';
import { useState } from 'react';
import { Check, Share2 } from 'lucide-react';

/** Shares the course link: native share sheet on phones, copy-to-clipboard elsewhere. */
export default function ShareCourseButton({ courseId, courseName, className = '' }: { courseId: string; courseName: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${window.location.origin}/courses/${courseId}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: courseName, text: `Check out ${courseName} on GenZ IITian`, url });
        return;
      }
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt('Copy this link', url);
    }
  };

  return (
    <button type="button" onClick={share} className={className}>
      {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Share2 className="w-4 h-4" />}
      {copied ? 'Link copied' : 'Share'}
    </button>
  );
}
