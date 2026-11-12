import { NextRequest } from 'next/server'
import { isStorefrontConfigured, storefrontDb } from '@/lib/storefront/db'
import { readBody, jsonRes } from '@/lib/site/http'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const res = jsonRes();

  const {
    name,
    email,
    phone,
    level,
    subjects,
    slot_date,
    slot_time,
    plan,
    notes,
    bcc = 'genziitian@gmail.com'
  } = await readBody(request);

  if (!email || !name) {
    return res.status(400).json({ error: 'Name and email are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();

  // 1. Supabase logging (if configured)
  const storefrontConfigured = isStorefrontConfigured();

  if (storefrontConfigured) {
    try {
      const supabase = storefrontDb();

      // Max 3 bookings per user per calendar day (IST)
      const istDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date());
      const dayStart = new Date(`${istDate}T00:00:00+05:30`).toISOString();
      const dayEnd = new Date(`${istDate}T23:59:59.999+05:30`).toISOString();

      const { count, error: countErr } = await supabase
        .from('one_on_one_bookings')
        .select('id', { count: 'exact', head: true })
        .eq('email', normalizedEmail)
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd)
        .neq('status', 'CANCELLED');

      if (!countErr && typeof count === 'number' && count >= 3) {
        return res.status(429).json({
          success: false,
          code: 'DAILY_LIMIT',
          error: 'You can book up to 3 sessions in one day. Please contact us for more help.',
          contact: {
            whatsapp: '+917970495447',
            email: 'genziitian@gmail.com'
          }
        });
      }
      
      // Persist the booking so confirmation is real. Email goes out after we respond.
      const { error: bookingErr } = await supabase.from('one_on_one_bookings').insert({
        name,
        email: normalizedEmail,
        phone,
        level,
        subjects,
        slot_date,
        slot_time,
        plan,
        notes,
        status: 'CONFIRMED',
        created_at: new Date().toISOString()
      });
      if (bookingErr) console.warn('[1:1 Booking] one_on_one_bookings notice:', bookingErr.message);
    } catch (dbErr: any) {
      console.error('[1:1 Booking] Supabase logging caught error:', dbErr.message);
    }
  }

  const bookingDetails = {
    name,
    email: normalizedEmail,
    slot_date,
    slot_time,
    bcc
  };

  const webhookUrl =
    process.env.ONE_ON_ONE_WEBHOOK_URL ||
    process.env.VITE_ONE_ON_ONE_WEBHOOK_URL ||
    process.env.ONE_TO_ONE_WEBHOOK_URL ||
    process.env.VITE_ONE_TO_ONE_WEBHOOK_URL ||
    process.env.ONE_ON_ONE_APP_SCRIPT_URL ||
    process.env.WELCOME_WEBHOOK_URL ||
    process.env.GOOGLE_SHEET_WEBHOOK_URL ||
    process.env.APP_SCRIPT_URL;

  // Serverless: the slow side effects (activity log + email webhook) are awaited before responding.
  await (async () => {
    if (storefrontConfigured) {
      try {
        const supabase = storefrontDb();
        const { error: logErr } = await supabase.from('activity_logs').insert({
          email: normalizedEmail,
          action: '1ON1_SLOT_BOOKED',
          metadata: {
            name,
            phone,
            level,
            subjects,
            slot_date,
            slot_time,
            plan,
            notes,
            bcc,
            timestamp: new Date().toISOString()
          }
        });
        if (logErr) console.warn('[1:1 Booking] activity_logs notice:', logErr.message);
      } catch (dbErr: any) {
        console.error('[1:1 Booking] activity_logs caught error:', dbErr.message);
      }
    }

    if (!webhookUrl) {
      console.warn('[1:1 Booking] No webhook URL configured! Checked: ONE_ON_ONE_WEBHOOK_URL, WELCOME_WEBHOOK_URL, GOOGLE_SHEET_WEBHOOK_URL');
      return;
    }

    const hookRes = await fetch(webhookUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'one_on_one_booking',
        name,
        email: normalizedEmail,
        phone,
        level,
        subjects,
        slot_date,
        slot_time,
        plan,
        notes,
        bcc: 'genziitian@gmail.com, lkiitmng2428@gmail.com',
        timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
      })
    });
    const resText = await hookRes.text();
    console.log('[1:1 Booking] Dispatched email webhook with response:', resText.slice(0, 100));
  })().catch((whErr: any) => {
    console.error('[1:1 Booking] Background email/sync error:', whErr.message);
  });


  res.status(200).json({
    success: true,
    message: 'Slot successfully booked. Confirmation email is on its way.',
    details: bookingDetails
  });
}
