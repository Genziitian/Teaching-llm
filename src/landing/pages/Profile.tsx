'use client';
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/landing/context/AuthContext';
import { supabase } from '@/landing/lib/supabase';
import { User, Mail, Calendar, ShoppingBag, LogOut, Loader2, Book, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { apiService } from '@/landing/lib/api';
import { Link } from '@/landing/shims/router';
import StudentOneOnOneBookings from '@/landing/components/profile/StudentOneOnOneBookings';

export default function Profile() {
  const { user, profile, signOut, isManager, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [courseCatalog, setCourseCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchOrders();
      fetchCatalog();
    }
  }, [user]);

  const fetchCatalog = async () => {
    try {
      // Fetch full details including bundleCourses and courseIds for title mapping
      const { data: courses, error } = await supabase
        .from('courses')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setCourseCatalog(courses || []);
    } catch (err) {
      console.error('Catalog fetch error:', err);
    }
  };

  const getCourseDisplayName = (cid: string): string => {
    if (!cid) return '';
    
    // 1. Search inside bundleCourses for matched courseId / courseId2 / courseId3
    for (const course of courseCatalog) {
      if (Array.isArray(course.bundleCourses)) {
        const matchedBc = course.bundleCourses.find((bc: any) => 
          bc.courseId === cid || 
          bc.courseId2 === cid || 
          bc.courseId3 === cid ||
          bc.id === cid
        );
        if (matchedBc && matchedBc.courseName) {
          return matchedBc.courseName;
        }
      }
    }

    // 2. Search direct course by ID
    const directCourse = courseCatalog.find(c => c.id === cid);
    if (directCourse) {
      if (Array.isArray(directCourse.bundleCourses) && directCourse.bundleCourses.length > 0 && directCourse.bundleCourses[0].courseName) {
        return directCourse.bundleCourses[0].courseName;
      }
      return directCourse.name;
    }

    // 3. Search in courseIds array
    for (const course of courseCatalog) {
      if (Array.isArray(course.courseIds) && course.courseIds.includes(cid)) {
        return course.name;
      }
    }

    // 4. Format hyphenated/underscored IDs cleanly (e.g. QUALIFIER-CRASH-COURSE -> Qualifier Crash Course)
    if (cid && typeof cid === 'string' && (cid.includes('-') || cid.includes('_'))) {
      return cid.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    // Unknown raw id (e.g. cuid): show nothing rather than the id
    return '';
  };

  const getEnrolledCourses = () => {
    const paidOrders = orders.filter(o => o.status === 'PAID');
    const allCourseIds = Array.from(new Set(paidOrders.flatMap(o => o.course_ids || [])));
    
    const matchedCourses: any[] = [];
    const addedIds = new Set<string>();

    allCourseIds.forEach((cid: string) => {
      // 1. Direct course
      const directCourse = courseCatalog.find(c => c.id === cid);
      if (directCourse && !addedIds.has(directCourse.id)) {
        matchedCourses.push(directCourse);
        addedIds.add(directCourse.id);
        return;
      }

      // 2. Course by bundleCourses or courseIds
      for (const course of courseCatalog) {
        const hasBc = Array.isArray(course.bundleCourses) && course.bundleCourses.some((bc: any) => 
          bc.courseId === cid || bc.courseId2 === cid || bc.courseId3 === cid || bc.id === cid
        );
        const hasCid = Array.isArray(course.courseIds) && course.courseIds.includes(cid);

        if ((hasBc || hasCid) && !addedIds.has(course.id)) {
          const matchedBc = Array.isArray(course.bundleCourses) ? course.bundleCourses.find((bc: any) => 
            bc.courseId === cid || bc.courseId2 === cid || bc.courseId3 === cid || bc.id === cid
          ) : null;

          matchedCourses.push({
            ...course,
            name: matchedBc?.courseName || course.name
          });
          addedIds.add(course.id);
          return;
        }
      }
    });

    return matchedCourses;
  };

  const enrolledCourses = getEnrolledCourses();

  const fetchOrders = async () => {
    try {
      const data = await apiService.getOrders(user?.email || '');
      setOrders(data || []);
    } catch (err) {
      console.error('Order fetch error:', err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin" /></div>;
  if (!user) return <div className="min-h-screen flex items-center justify-center font-black">PLEASE LOG IN TO VIEW PROFILE</div>;

  return (
    <div className="min-h-screen bg-gray-50 pt-20 md:pt-24 pb-12 px-3.5 sm:px-6">
      <div className="max-w-4xl mx-auto space-y-8 md:space-y-12">
        {/* Profile Card */}
        <section className="bg-white border-[3px] md:border-[4px] border-[#0b1120] rounded-[1.5rem] md:rounded-[2rem] p-5 sm:p-8 lg:p-10 shadow-[6px_6px_0px_#3b82f6] md:shadow-[8px_8px_0px_#3b82f6] flex flex-col md:flex-row gap-6 md:gap-8 items-center">
          <div className="w-20 h-20 sm:w-24 sm:h-24 bg-blue-100 border-[3px] md:border-[4px] border-[#0b1120] rounded-2xl flex items-center justify-center shrink-0 shadow-[4px_4px_0px_#0b1120]">
            <User className="w-10 h-10 sm:w-12 sm:h-12 text-blue-600" />
          </div>
          <div className="flex-grow text-center md:text-left space-y-2 sm:space-y-3 min-w-0 w-full">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#0b1120] truncate">{profile?.name || 'Student'}</h1>
            <div className="flex flex-wrap justify-center md:justify-start gap-2.5 sm:gap-4 text-xs sm:text-sm">
              <div className="flex items-center gap-1.5 font-bold text-gray-500 break-all">
                <Mail className="w-4 h-4 text-blue-500 shrink-0" /> {user.email}
              </div>
              <div className="flex items-center gap-1.5 font-bold text-gray-500">
                <Calendar className="w-4 h-4 text-red-500 shrink-0" /> Joined {new Date(profile?.created_at || user.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-auto shrink-0">
            <button
              onClick={signOut}
              className="px-5 py-2.5 sm:py-3 bg-red-50 text-red-600 border-2 border-red-200 rounded-xl font-black hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2 w-full text-xs sm:text-sm"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </section>

        {/* 1:1 Personal Teaching Bookings (Rendered for students with active bookings; hidden if 0 bookings) */}
        {user?.email && <StudentOneOnOneBookings email={user.email} />}

        {/* Enrolled Courses */}
        <section className="space-y-4 md:space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <h2 className="text-xl sm:text-2xl font-black text-[#0b1120] flex items-center gap-2.5">
              <Book className="w-5 h-5 sm:w-6 sm:h-6 text-[#10b981]" /> My Enrolled Courses
            </h2>
            <a
              href="https://class.genziitian.in"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 bg-[#10b981] text-[#0b1120] rounded-xl sm:rounded-2xl font-black text-xs sm:text-sm border-[2.5px] sm:border-[3px] border-[#0b1120] shadow-[3px_3px_0px_#0b1120] sm:shadow-[4px_4px_0px_#0b1120] hover:translate-y-0.5 active:translate-y-1 transition-all text-center"
            >
              <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              Visit Dashboard to Access Batch
            </a>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400 font-bold">Loading your courses...</div>
          ) : enrolledCourses.length === 0 ? (
            <div className="bg-white border-[3px] md:border-[4px] border-dashed border-gray-200 rounded-[1.5rem] md:rounded-[2.5rem] p-8 sm:p-12 md:p-16 text-center space-y-4">
              <p className="text-base sm:text-xl font-bold text-gray-400">You haven't enrolled in any courses yet.</p>
              
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <Link 
                  to="/explore/courses" 
                  className="px-5 py-3 bg-blue-600 text-white rounded-xl font-black text-xs sm:text-sm border-[2.5px] border-[#0b1120] shadow-[3px_3px_0px_#0b1120] hover:translate-y-0.5 active:translate-y-1 transition-all"
                >
                  Browse Courses →
                </Link>
                <a
                  href="https://class.genziitian.in"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-3 bg-[#10b981] text-[#0b1120] rounded-xl font-black text-xs sm:text-sm border-[2.5px] border-[#0b1120] shadow-[3px_3px_0px_#0b1120] hover:translate-y-0.5 active:translate-y-1 transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  Visit Dashboard (class.genziitian.in)
                </a>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
              {enrolledCourses.map((course: any) => (
                <motion.div
                  key={course.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-white border-[3px] md:border-[4px] border-[#0b1120] rounded-[1.5rem] md:rounded-[2rem] p-4 sm:p-6 shadow-[4px_4px_0px_#0b1120] md:shadow-[6px_6px_0px_#0b1120] hover:shadow-[6px_6px_0px_#10b981] transition-all group flex flex-col justify-between"
                >
                  <div className="flex items-start gap-3 sm:gap-4 mb-4">
                    <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-100 rounded-xl border-2 border-[#0b1120] overflow-hidden shrink-0">
                      <img src={course.image || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=200'} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-black text-[#0b1120] text-base sm:text-lg leading-tight mb-1 truncate">{course.name}</h3>
                    </div>
                  </div>

                  <div className="pt-3.5 border-t-2 border-dashed border-gray-100 flex justify-end">
                    <a
                      href="https://class.genziitian.in"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2.5 bg-[#0b1120] text-white rounded-xl font-black text-[11px] sm:text-xs border-2 border-[#0b1120] shadow-[2px_2px_0px_#10b981] hover:bg-gray-800 transition-all"
                    >
                      <span>Access Batch on Dashboard</span>
                      <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    </a>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Order History */}
        <section className="space-y-4 md:space-y-6">
          <h2 className="text-xl sm:text-2xl font-black text-[#0b1120] flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" /> Order History
          </h2>

          {loading ? (
            <div className="p-12 text-center text-gray-400 font-bold">Checking for orders...</div>
          ) : orders.length === 0 ? (
            <div className="bg-white border-[3px] md:border-[4px] border-dashed border-gray-200 rounded-[1.5rem] md:rounded-[2.5rem] p-12 sm:p-16 text-center">
              <p className="text-base sm:text-xl font-bold text-gray-400">No courses purchased yet.</p>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-6">
              {orders.map((order) => (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white border-[3px] border-[#0b1120] rounded-[1.25rem] sm:rounded-[2rem] p-4 sm:p-6 shadow-[4px_4px_0px_#0b1120] hover:shadow-[6px_6px_0px_#10b981] transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4"
                >
                  <div className="space-y-2.5 sm:space-y-3 w-full sm:w-auto flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black border-2 border-[#0b1120] uppercase tracking-wider ${
                        order.status === 'PAID' ? 'bg-[#d1fae5] text-[#059669]' : 'bg-amber-100 text-amber-600'
                      }`}>
                        {order.status === 'PAID' ? 'PAYMENT SUCCESS' : 'PENDING'}
                      </span>
                      <span className="text-xs font-black text-gray-400">
                        {new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>

                  </div>

                  <div className="w-full sm:w-auto pt-3 sm:pt-0 border-t sm:border-t-0 border-dashed border-gray-200 flex sm:flex-col justify-between sm:justify-center items-center sm:items-end shrink-0">
                    <div className="text-xl sm:text-2xl font-black text-[#0b1120]">₹{order.total_amount}</div>
                    <div className="text-[10px] font-mono font-bold text-gray-400 mt-0.5 uppercase tracking-wider max-w-[160px] truncate sm:max-w-none">
                      ID: {order.order_id}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
