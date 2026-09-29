/**
 * Shared utility for Indian Standard Time (IST) formatting and event status.
 * This ensures consistency between the backend and frontend across different
 * server/browser timezones.
 */

export function formatIST(date: string | Date, options: Intl.DateTimeFormatOptions = { 
  hour: 'numeric', 
  minute: '2-digit', 
  hour12: true 
}) {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'Invalid Date';

    const hasTime = options.hour !== undefined || options.minute !== undefined;
    const isHour12 = options.hour12 !== false;

    if (!hasTime) {
      return new Intl.DateTimeFormat('en-IN', {
        ...options,
        timeZone: 'Asia/Kolkata'
      }).format(d);
    }

    if (!isHour12) {
      const formatOpts: Intl.DateTimeFormatOptions = {
        ...options,
        timeZone: 'Asia/Kolkata',
        hour12: false
      };
      return new Intl.DateTimeFormat('en-IN', formatOpts).format(d);
    }

    // 12-hour AM/PM format (guaranteed to avoid system 24-hour setting override in WebViews)
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(d);

    const hourStr = parts.find(p => p.type === 'hour')?.value || '00';
    const minuteStr = parts.find(p => p.type === 'minute')?.value || '00';

    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12;

    const is2Digit = options.hour === '2-digit';
    const formattedHour = is2Digit ? hour.toString().padStart(2, '0') : hour.toString();
    const timePart = `${formattedHour}:${minuteStr} ${ampm}`;

    const hasDate = options.month !== undefined || options.day !== undefined || options.year !== undefined;
    if (hasDate) {
      const datePart = new Intl.DateTimeFormat('en-IN', {
        month: options.month,
        day: options.day,
        year: options.year,
        timeZone: 'Asia/Kolkata'
      }).format(d);
      return `${datePart}, ${timePart}`;
    }

    return timePart;
  } catch (error) {
    console.error('Error formatting IST date:', error);
    return 'Invalid Date';
  }
}

export function formatTimeString12Hour(timeStr?: string | null): string {
  if (!timeStr) return '';
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return timeStr;
  let hour = parseInt(parts[0], 10);
  const minute = parts[1];
  if (isNaN(hour)) return timeStr;
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12;
  return `${hour}:${minute} ${ampm}`;
}

export function formatISTDate(date: string | Date) {
  return formatIST(date, { month: 'short', day: 'numeric' });
}

export function formatISTDateTime(date: string | Date) {
  return formatIST(date, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export type ExamTimingState = 'before' | 'active' | 'ending' | 'ended'

export function getExamTimingState(
  startTime: string | Date | null | undefined,
  endTime: string | Date,
  now: Date = new Date()
): ExamTimingState {
  const start = startTime ? new Date(startTime) : null
  const end = typeof endTime === 'string' ? new Date(endTime) : endTime

  if (Number.isNaN(end.getTime())) return 'ended'
  if (start && !Number.isNaN(start.getTime()) && now < start) return 'before'
  if (now >= end) return 'ended'

  const remainingMs = end.getTime() - now.getTime()
  if (remainingMs <= 60 * 60 * 1000) return 'ending'

  return 'active'
}

export function formatCountdownDuration(totalMs: number) {
  const totalSeconds = Math.max(0, Math.floor(totalMs / 1000))
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`
  }

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }

  return `${minutes}m ${seconds}s`
}

export function getEventStatus(
  startTime: string | Date, 
  endTime: string | Date, 
  status: string = 'SCHEDULED'
) {
  if (status === 'CANCELLED') return 'cancelled';
  if (status === 'RESCHEDULED') return 'rescheduled';

  const now = new Date();
  const start = typeof startTime === 'string' ? new Date(startTime) : startTime;
  const end = typeof endTime === 'string' ? new Date(endTime) : endTime;

  // Active definition: starts 5 minutes BEFORE scheduled start, 
  // ends 6 minutes BEFORE scheduled end.
  const activeStart = new Date(start.getTime() - 5 * 60 * 1000);
  const activeEnd = new Date(end.getTime() - 6 * 60 * 1000);

  if (now < activeStart) return 'upcoming';
  if (now >= activeStart && now <= activeEnd) return 'live';
  return 'completed';
}

/**
 * Returns the exact UTC boundaries corresponding to the start (00:00:00) 
 * and end (23:59:59.999) of the given date (or current date) in IST.
 */
export function getISTDayBoundaries(date?: Date | string) {
  const targetDate = date ? new Date(date) : new Date();
  
  // Format the target date to its corresponding YYYY-MM-DD string in IST timezone
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  
  const formattedDates = formatter.formatToParts(targetDate);
  const year = formattedDates.find(p => p.type === 'year')?.value;
  const month = formattedDates.find(p => p.type === 'month')?.value;
  const day = formattedDates.find(p => p.type === 'day')?.value;
  
  const isoDateString = `${year}-${month}-${day}`;
  
  // Create absolute UTC dates from the IST string representation
  const startOfDay = new Date(`${isoDateString}T00:00:00.000+05:30`);
  const endOfDay = new Date(`${isoDateString}T23:59:59.999+05:30`);
  
  return { startOfDay, endOfDay };
}
