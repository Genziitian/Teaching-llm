'use client';
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from '@/landing/shims/router';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/landing/lib/supabase';
import {
  COURSE_PAGE_SETTINGS_KEY,
  parseCoursePageSettings,
  reviewsForCourse,
  videoForCourse,
  themeForCourse,
  type CoursePageTheme,
  type FeedbackNote,
} from '@/landing/data/coursePage';
import CourseDetailClassic from '@/landing/components/course/CourseDetailClassic';
import CourseDetailModern from '@/landing/components/course/CourseDetailModern';
import CourseFaqSection from '@/landing/components/course/CourseFaqSection';
import CourseReviewsSection from '@/landing/components/course/CourseReviewsSection';

export default function CourseDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [course, setCourse] = useState<any>(null);
  const [reviews, setReviews] = useState<FeedbackNote[]>([]);
  const [videoUrl, setVideoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTheme, setActiveTheme] = useState<CoursePageTheme>('old');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        const { data, error } = await supabase.from('courses').select('*').eq('id', id).single();
        let settingsValue: string | null = null;
        try {
          const settingsRes = await supabase
            .from('settings')
            .select('value')
            .eq('key', COURSE_PAGE_SETTINGS_KEY)
            .maybeSingle();
          settingsValue = settingsRes.data?.value ?? null;
        } catch {
          settingsValue = null;
        }

        if (cancelled) return;
        if (error || !data || data.active === false) {
          navigate('/explore/courses');
          return;
        }

        const parsed = parseCoursePageSettings(settingsValue);
        const resolvedTheme = themeForCourse(parsed, data.id, data);
        
        // If theme query param is passed (e.g. ?theme=new or ?theme=old), respect it for preview
        const queryTheme = searchParams.get('theme');
        const themeToRender: CoursePageTheme = (queryTheme === 'new' || queryTheme === 'old')
          ? queryTheme
          : resolvedTheme;

        setCourse(data);
        setReviews(reviewsForCourse(parsed, data.id));
        setVideoUrl(videoForCourse(parsed, data.id));
        setActiveTheme(themeToRender);
        setLoading(false);
      } catch {
        if (!cancelled) navigate('/explore/courses');
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [id, navigate, searchParams]);

  if (loading || !course) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f6f7f9]">
        <Loader2 className="animate-spin w-8 h-8 text-slate-800" />
      </div>
    );
  }

  return (
    <>
      {activeTheme === 'new' ? (
        <CourseDetailModern
          course={course}
          reviews={reviews}
          videoUrl={videoUrl}
        />
      ) : (
        <CourseDetailClassic
          course={course}
        />
      )}
      <CourseReviewsSection />
      <CourseFaqSection />
    </>
  );
}
