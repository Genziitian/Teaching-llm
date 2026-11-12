'use client';
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from '@/landing/shims/router';
import { 
  Calendar, 
  Clock, 
  UserCheck, 
  CalendarClock, 
  XCircle, 
  MessageCircle, 
  CalendarPlus, 
  AlertCircle, 
  Loader2, 
  CheckCircle2, 
  ArrowRight, 
  X,
  Sparkles
} from 'lucide-react';
import { supabase } from '@/landing/lib/supabase';

const getAuthHeaders = async (): Promise<Record<string, string>> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { 'Authorization': `Bearer ${session.access_token}` };
  }
  return {};
};

interface Booking {
  id: string;
  name: string;
  email: string;
  phone: string;
  level?: string;
  subjects?: string[];
  slot_date: string;
  slot_time: string;
  status: 'CONFIRMED' | 'RESCHEDULED' | 'CANCELLED' | 'COMPLETED' | 'TRY_LATER' | 'GHOSTED' | 'NOT_INTERESTED';
  notes?: string;
  user_notes?: string;
  manager_notes?: string;
  created_at?: string;
}

interface StudentOneOnOneBookingsProps {
  email: string;
}

const TIME_SLOTS = [
  { time: '10:00 AM - 10:15 AM', period: 'Morning' },
  { time: '11:00 AM - 11:15 AM', period: 'Morning' },
  { time: '12:00 PM - 12:15 PM', period: 'Morning' },
  { time: '02:00 PM - 02:15 PM', period: 'Afternoon' },
  { time: '03:30 PM - 03:45 PM', period: 'Afternoon' },
  { time: '05:00 PM - 05:15 PM', period: 'Evening' },
  { time: '06:30 PM - 06:45 PM', period: 'Evening' },
  { time: '07:30 PM - 07:45 PM', period: 'Evening' },
  { time: '08:30 PM - 08:45 PM', period: 'Night' },
  { time: '09:15 PM - 09:30 PM', period: 'Night' }
];

export default function StudentOneOnOneBookings({ email }: StudentOneOnOneBookingsProps) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Reschedule modal state
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const [newDate, setNewDate] = useState('');
  const [newSlot, setNewSlot] = useState(TIME_SLOTS[6].time);
  const [rescheduleReason, setRescheduleReason] = useState('');

  // Cancel modal state
  const [cancelBooking, setCancelBooking] = useState<Booking | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const fetchBookings = async () => {
    if (!email) return;
    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`/api/1on1-bookings?email=${encodeURIComponent(email)}`, {
        headers: authHeaders
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.bookings)) {
        setBookings(data.bookings);
      }
    } catch (err) {
      console.error('Failed to fetch 1:1 bookings for student:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [email]);

  // Next 7 days generator
  const upcomingDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];
    const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString('en-US', { weekday: 'short' });
    const dayMonth = d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    return { dateStr, dayName, dayMonth };
  });

  // CRITICAL REQUIREMENT: "if they didnt have any booking dont show any feild"
  if (!loading && bookings.length === 0) {
    return null;
  }

  // During initial background check, avoid flashing layout
  if (loading && bookings.length === 0) {
    return null;
  }

  const handleOpenReschedule = (booking: Booking) => {
    setRescheduleBooking(booking);
    setNewDate(upcomingDates[0].dateStr);
    setNewSlot(booking.slot_time || TIME_SLOTS[6].time);
    setRescheduleReason('');
    setStatusMessage(null);
  };

  const handleOpenCancel = (booking: Booking) => {
    setCancelBooking(booking);
    setCancelReason('');
    setStatusMessage(null);
  };

  const handleConfirmReschedule = async () => {
    if (!rescheduleBooking || !newDate || !newSlot) return;
    setActionLoading(true);
    setStatusMessage(null);

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/1on1-bookings/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          id: rescheduleBooking.id,
          email: rescheduleBooking.email,
          new_slot_date: newDate,
          new_slot_time: newSlot,
          reason: rescheduleReason || 'Rescheduled by student from profile',
          rescheduledBy: 'student'
        })
      });

      const data = await res.json();
      if (data.success) {
        setBookings(prev =>
          prev.map(b =>
            b.id === rescheduleBooking.id
              ? { ...b, slot_date: newDate, slot_time: newSlot, status: 'RESCHEDULED' }
              : b
          )
        );
        setStatusMessage({
          type: 'success',
          text: `Slot successfully rescheduled to ${newDate} (${newSlot}). Confirmation email sent!`
        });
        setRescheduleBooking(null);
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to reschedule. Please try again or message WhatsApp support.'
        });
      }
    } catch (err) {
      console.error('Reschedule error:', err);
      setStatusMessage({
        type: 'error',
        text: 'Network error while rescheduling. Please try again.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelBooking) return;
    setActionLoading(true);
    setStatusMessage(null);

    try {
      const authHeaders = await getAuthHeaders();
      const res = await fetch('/api/1on1-bookings/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({
          id: cancelBooking.id,
          email: cancelBooking.email,
          reason: cancelReason || 'Cancelled by student from profile',
          cancelledBy: 'student'
        })
      });

      const data = await res.json();
      if (data.success) {
        setBookings(prev =>
          prev.map(b =>
            b.id === cancelBooking.id
              ? { ...b, status: 'CANCELLED', notes: cancelReason || b.notes }
              : b
          )
        );
        setStatusMessage({
          type: 'success',
          text: 'Booking has been cancelled. A cancellation confirmation email was sent.'
        });
        setCancelBooking(null);
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || 'Failed to cancel booking. Please try again.'
        });
      }
    } catch (err) {
      console.error('Cancel error:', err);
      setStatusMessage({
        type: 'error',
        text: 'Network error while cancelling. Please try again.'
      });
    } finally {
      setActionLoading(false);
    }
  };

  const formatCalendarDates = (dateStr: string, slotTimeStr: string) => {
    try {
      const cleanDate = dateStr.replace(/-/g, '');
      const [startPart, endPart] = slotTimeStr.split('-').map(s => s.trim());
      if (!startPart || !endPart) return '';

      const parseTime = (timeStr: string) => {
        const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!match) return null;
        let hours = parseInt(match[1], 10);
        const minutes = match[2];
        const period = match[3].toUpperCase();
        if (period === 'PM' && hours < 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        return `${String(hours).padStart(2, '0')}${minutes}00`;
      };

      const startTime = parseTime(startPart);
      const endTime = parseTime(endPart);
      if (startTime && endTime) {
        return `${cleanDate}T${startTime}/${cleanDate}T${endTime}`;
      }
    } catch {
      // ignore
    }
    return '';
  };

  const getGoogleCalendarUrl = (b: Booking) => {
    const title = encodeURIComponent('Gen-Z IITian: 1:1 Personalised Consultation');
    const details = encodeURIComponent(
      `Hello ${b.name}!\n\nYour 1:1 Personalised Teaching session with GenZ IITian is confirmed.\n\nDate: ${b.slot_date}\nTime: ${b.slot_time}\nSubjects: ${(Array.isArray(b.subjects) ? b.subjects.join(', ') : b.subjects || '')}\nLevel: ${b.level || ''}\n\nSupport WhatsApp: +91 79704 95447\nBCC: genziitian@gmail.com`
    );
    const location = encodeURIComponent('Google Meet / WhatsApp (+91 79704 95447)');
    const datesParam = formatCalendarDates(b.slot_date, b.slot_time);
    const datesQuery = datesParam ? `&dates=${datesParam}` : '';
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}${datesQuery}&details=${details}&location=${location}`;
  };

  const getWhatsAppChatUrl = (b: Booking) => {
    const text = encodeURIComponent(
      `Hi GenZ IITian team! I have a 1:1 Personalised Teaching session (Booking ID #${b.id}) scheduled for ${b.slot_date} at ${b.slot_time}. Name: ${b.name}, Level: ${b.level || 'Foundation'}.`
    );
    return `https://wa.me/917970495447?text=${text}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border-2 border-emerald-300">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            CONFIRMED
          </span>
        );
      case 'RESCHEDULED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-800 border-2 border-purple-300">
            <CalendarClock className="w-3 h-3" />
            RESCHEDULED
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-rose-100 text-rose-700 border-2 border-rose-300">
            <XCircle className="w-3 h-3" />
            CANCELLED
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-blue-100 text-blue-800 border-2 border-blue-300">
            <CheckCircle2 className="w-3 h-3" />
            COMPLETED
          </span>
        );
      case 'TRY_LATER':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-indigo-100 text-indigo-800 border-2 border-indigo-300">
            <Clock className="w-3 h-3" />
            TRY LATER
          </span>
        );
      case 'GHOSTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-slate-100 text-slate-800 border-2 border-slate-300">
            GHOSTED
          </span>
        );
      case 'NOT_INTERESTED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-orange-100 text-orange-800 border-2 border-orange-300">
            NOT INTERESTED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-gray-100 text-gray-700 border-2 border-gray-300">
            {status}
          </span>
        );
    }
  };

  return (
    <section className="space-y-4 md:space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-[#0b1120] flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-100 border-2 border-[#0b1120] flex items-center justify-center text-purple-700 shadow-[2px_2px_0px_#0b1120]">
              <UserCheck className="w-4 h-4" />
            </div>
            1:1 Personal Teaching Sessions
          </h2>
          <p className="text-xs sm:text-sm text-gray-600 font-semibold mt-1">
            Your dedicated private tutoring sessions and scheduled consultations.
          </p>
        </div>

        <Link
          to="/one-to-one"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0b1120] text-white hover:bg-gray-800 border-2 border-[#0b1120] shadow-[3px_3px_0px_#8b5cf6] rounded-xl font-black text-xs transition-all self-start sm:self-auto hover:translate-y-0.5"
        >
          <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
          <span>Book Another Slot</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Global Status Message Toast */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border-2 text-xs sm:text-sm font-bold flex items-center justify-between gap-2 shadow-sm ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-rose-50 text-rose-800 border-rose-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
          <button
            onClick={() => setStatusMessage(null)}
            className="p-1 hover:bg-black/5 rounded-lg text-gray-500"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bookings List */}
      <div className="space-y-4 sm:space-y-5">
        {bookings.map((booking) => {
          const isActive = booking.status === 'CONFIRMED' || booking.status === 'RESCHEDULED';
          const isCancelled = booking.status === 'CANCELLED';

          return (
            <motion.div
              key={booking.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white border-[3px] border-[#0b1120] rounded-[1.5rem] p-4 sm:p-6 transition-all ${
                isCancelled
                  ? 'opacity-80 bg-gray-50/70 border-dashed shadow-none'
                  : 'shadow-[5px_5px_0px_#0b1120] hover:shadow-[7px_7px_0px_#8b5cf6]'
              }`}
            >
              {/* Card Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b-2 border-gray-100">
                <div className="flex items-center gap-2.5">
                  {getStatusBadge(booking.status)}
                  <span className="text-[11px] font-mono font-bold text-gray-500">
                    ID: #{booking.id.slice(-6)}
                  </span>
                </div>

                {booking.created_at && (
                  <span className="text-[11px] font-bold text-gray-400">
                    Booked on {new Date(booking.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>

              {/* Card Body */}
              <div className="py-4 grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                {/* Date & Time Slot */}
                <div className="md:col-span-6 space-y-2">
                  <div className="flex items-center gap-2 text-[#0b1120] font-black text-base sm:text-lg">
                    <Calendar className="w-5 h-5 text-purple-600 shrink-0" />
                    <span>
                      {new Date(booking.slot_date + 'T00:00:00').toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-700 font-bold text-sm">
                    <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200">
                      {booking.slot_time}
                    </span>
                    <span className="text-xs text-gray-400">(15 Min 1:1)</span>
                  </div>

                  {booking.level && (
                    <div className="pt-1 text-xs font-black text-gray-500 uppercase tracking-wide">
                      Target Level: <span className="text-gray-900">{booking.level}</span>
                    </div>
                  )}
                </div>

                {/* Subjects & Notes */}
                <div className="md:col-span-6 space-y-2">
                  <div className="text-xs font-black uppercase tracking-wider text-gray-400">
                    Selected Subjects
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(() => {
                      const subjectsList = Array.isArray(booking.subjects)
                        ? booking.subjects
                        : typeof booking.subjects === 'string'
                        ? (booking.subjects as string).split(',').map(s => s.trim()).filter(Boolean)
                        : [];
                      return subjectsList.length > 0 ? (
                        subjectsList.map((sub, idx) => (
                          <span
                            key={idx}
                            className="px-2.5 py-1 bg-purple-50 border border-purple-200 rounded-lg text-xs font-bold text-purple-800"
                          >
                            {sub}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-500">General Guidance</span>
                      );
                    })()}
                  </div>

                  {booking.notes && (
                    <p className="text-xs text-gray-500 italic mt-1 bg-gray-50 p-2 rounded-lg border border-gray-100">
                      "{booking.notes}"
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons Footer */}
              <div className="pt-3.5 border-t-2 border-gray-100 flex flex-wrap items-center justify-between gap-3">
                {isActive ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={getGoogleCalendarUrl(booking)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition-colors"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                        Add to Calendar
                      </a>

                      <a
                        href={getWhatsAppChatUrl(booking)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold transition-colors"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        WhatsApp Tutor
                      </a>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenReschedule(booking)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold transition-colors"
                      >
                        <CalendarClock className="w-3.5 h-3.5 text-purple-600" />
                        Reschedule
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenCancel(booking)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Cancel
                      </button>
                    </div>
                  </>
                ) : isCancelled ? (
                  <div className="flex items-center justify-between w-full text-xs font-bold text-gray-500">
                    <span className="text-rose-600">This session has been cancelled.</span>
                    <Link
                      to="/one-to-one"
                      className="text-purple-600 hover:underline inline-flex items-center gap-1"
                    >
                      Book a new session <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                ) : (
                  <div className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    Session completed!
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Reschedule Modal */}
      <AnimatePresence>
        {rescheduleBooking && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-3.5 sm:p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border-[3.5px] border-[#0b1120] rounded-[1.5rem] p-5 sm:p-6 shadow-[8px_8px_0px_#0b1120] w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b-2 border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 border-2 border-[#0b1120] flex items-center justify-center text-purple-700">
                    <CalendarClock className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-[#0b1120] text-base sm:text-lg">Reschedule 1:1 Session</h3>
                    <p className="text-[11px] text-gray-500 font-bold">Pick your preferred new date & 15-min slot</p>
                  </div>
                </div>
                <button
                  onClick={() => setRescheduleBooking(null)}
                  disabled={actionLoading}
                  className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Current slot reminder */}
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs font-semibold text-purple-900">
                Current Slot: <span className="font-bold">{rescheduleBooking.slot_date}</span> at{' '}
                <span className="font-bold">{rescheduleBooking.slot_time}</span>
              </div>

              {/* Date Selector */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-gray-500 tracking-wider">
                  Select New Date
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {upcomingDates.map((d) => {
                    const isSelected = newDate === d.dateStr;
                    return (
                      <button
                        key={d.dateStr}
                        type="button"
                        onClick={() => setNewDate(d.dateStr)}
                        className={`p-2.5 rounded-xl border-2 text-center transition-all ${
                          isSelected
                            ? 'bg-[#0b1120] text-white border-[#0b1120] shadow-[2px_2px_0px_#8b5cf6]'
                            : 'bg-white border-gray-200 text-gray-700 hover:border-[#0b1120]'
                        }`}
                      >
                        <div className="text-[10px] uppercase font-black opacity-80">{d.dayName}</div>
                        <div className="text-xs font-black mt-0.5">{d.dayMonth}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Slot Selector */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-gray-500 tracking-wider">
                  Select 15-Minute Slot
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {TIME_SLOTS.map((s) => {
                    const isSelected = newSlot === s.time;
                    return (
                      <button
                        key={s.time}
                        type="button"
                        onClick={() => setNewSlot(s.time)}
                        className={`p-2.5 rounded-xl border-2 text-left flex items-center justify-between text-xs font-bold transition-all ${
                          isSelected
                            ? 'bg-purple-600 text-white border-purple-700 shadow-[2px_2px_0px_#0b1120]'
                            : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        <span>{s.time}</span>
                        <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {s.period}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Reason (Optional) */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-gray-500 tracking-wider">
                  Reason for Rescheduling (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Have college test at earlier time, conflict with schedule..."
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border-2 border-gray-200 rounded-xl focus:border-[#0b1120] outline-none font-medium"
                />
              </div>

              <div className="pt-3 border-t-2 border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setRescheduleBooking(null)}
                  className="px-4 py-2 border-2 border-gray-200 text-gray-600 font-bold rounded-xl text-xs hover:bg-gray-50"
                >
                  Keep Existing Slot
                </button>

                <button
                  type="button"
                  disabled={actionLoading || !newDate || !newSlot}
                  onClick={handleConfirmReschedule}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl text-xs border-2 border-[#0b1120] shadow-[2px_2px_0px_#0b1120] flex items-center gap-1.5 transition-all"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Rescheduling...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirm New Slot</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Cancel Modal */}
      <AnimatePresence>
        {cancelBooking && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-3.5 sm:p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white border-[3.5px] border-[#0b1120] rounded-[1.5rem] p-5 sm:p-6 shadow-[8px_8px_0px_#0b1120] w-full max-w-md space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 border-2 border-[#0b1120] flex items-center justify-center text-rose-600 shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-[#0b1120] text-base sm:text-lg">Cancel 1:1 Session?</h3>
                  <p className="text-xs text-gray-500 font-semibold">
                    Are you sure you want to cancel this booking?
                  </p>
                </div>
              </div>

              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-900 space-y-1">
                <div>
                  Date: <span className="font-bold">{cancelBooking.slot_date}</span>
                </div>
                <div>
                  Time: <span className="font-bold">{cancelBooking.slot_time}</span>
                </div>
                <div className="text-[11px] text-rose-700 pt-1">
                  A cancellation confirmation email will be sent to {cancelBooking.email} and recorded.
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-gray-500 tracking-wider">
                  Reason for Cancellation (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Schedule clash, topic already solved..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border-2 border-gray-200 rounded-xl focus:border-[#0b1120] outline-none font-medium"
                />
              </div>

              <div className="pt-3 border-t-2 border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => setCancelBooking(null)}
                  className="px-4 py-2 border-2 border-gray-200 text-gray-600 font-bold rounded-xl text-xs hover:bg-gray-50"
                >
                  Keep Booking
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={handleConfirmCancel}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black rounded-xl text-xs border-2 border-[#0b1120] shadow-[2px_2px_0px_#0b1120] flex items-center gap-1.5 transition-all"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Cancelling...</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Yes, Cancel Slot</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
