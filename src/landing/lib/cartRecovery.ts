/**
 * Abandoned-checkout follow-up logic ("who should customer service call?").
 *
 * Pure functions only — no Supabase here — so the rules are easy to test and tweak.
 *
 * How a lead works
 * ----------------
 * - A LEAD is one person (email) with one "cycle" of unpaid checkouts (website_orders.status = 'CREATED').
 * - Several unpaid checkouts close together are the same lead (we don't call someone 4 times for 4 retries).
 * - A checkout for courses the person already owns is ignored (duplicate order / retry noise).
 * - A checkout that gets paid within the cool-off window never becomes a lead (they finished on their own).
 * - The lead is RECOVERED as soon as the person pays for anything afterwards.
 * - The lead is DROPPED when:
 *     - 60 days pass since their last checkout attempt with no purchase, or
 *     - the call log says Not interested / Wrong number / Already bought, or
 *     - nobody answered 3 calls in a row.
 * - If a dropped person tries to buy again:
 *     - within 60 days of their last attempt -> the same lead reopens (call history kept, marked "came back");
 *     - after 60 days -> a brand-new lead with a clean history (marked "returning").
 */

export const MINUTE = 60 * 1000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

/** Wait this long after a checkout before calling — they may still be paying (UPI pending, retrying card). */
export const COOL_OFF_MS = 1 * HOUR;
/** A lead lives this long after their latest checkout attempt. */
export const LEAD_LIFETIME_DAYS = 60;
export const LEAD_LIFETIME_MS = LEAD_LIFETIME_DAYS * DAY;
/** After this many unanswered calls in a row the lead is dropped. */
export const MAX_NO_ANSWER = 3;
/** When to retry after the 1st, 2nd … unanswered call. */
export const NO_ANSWER_RETRY_MS = [4 * HOUR, 1 * DAY, 2 * DAY];
/** If they say "I'll buy", check back after this long if they still haven't. */
export const INTERESTED_FOLLOWUP_MS = 2 * DAY;
/** Default callback gap when "Call back" is picked without a time. */
export const DEFAULT_CALLBACK_MS = 1 * DAY;
/** Keep dropped / recovered leads visible in their tabs for this long. */
export const HISTORY_VISIBLE_MS = 30 * DAY;
/** How far back to load orders (must comfortably exceed LEAD_LIFETIME_DAYS). */
export const FETCH_WINDOW_DAYS = 180;

export type CallOutcome =
  | 'NO_ANSWER'
  | 'CALLBACK'
  | 'INTERESTED'
  | 'NOT_INTERESTED'
  | 'WRONG_NUMBER'
  | 'ALREADY_BOUGHT'
  | 'NOTE';

export const OUTCOME_LABELS: Record<CallOutcome, string> = {
  NO_ANSWER: 'No answer',
  CALLBACK: 'Call back later',
  INTERESTED: 'Interested — will buy',
  NOT_INTERESTED: 'Not interested',
  WRONG_NUMBER: 'Wrong number',
  ALREADY_BOUGHT: 'Already bought',
  NOTE: 'Note',
};

export interface OrderRow {
  order_id: string;
  user_email: string;
  course_ids: unknown;
  total_amount: number | null;
  status: string;
  created_at: string;
}

export interface CallLog {
  id: string;
  lead_key: string;
  user_email: string;
  outcome: CallOutcome;
  note?: string | null;
  callback_at?: string | null;
  called_by?: string | null;
  created_at: string;
}

export interface ProfileRow {
  email: string;
  name?: string | null;
  phone?: string | null;
}

export type LeadStage = 'COOLING' | 'DUE' | 'SCHEDULED' | 'RECOVERED' | 'DROPPED';
export type LeadHeat = 'HOT' | 'WARM' | 'COOL';

export interface Attempt {
  orderId: string;
  at: number;
  amount: number;
  courseIds: string[];
}

export interface Lead {
  key: string;
  email: string;
  name: string | null;
  phone: string | null;
  hasPhone: boolean;
  attempts: Attempt[];
  courseIds: string[];
  /** Amount of their latest checkout — what we're trying to recover. */
  cartValue: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
  /** When the 60-day window runs out (from the latest attempt). */
  expiresAt: number;
  calls: CallLog[];
  lastCall: CallLog | null;
  noAnswerStreak: number;
  stage: LeadStage;
  /** When the next call should happen (open leads only). */
  dueAt: number | null;
  dropReason: string | null;
  droppedAt: number | null;
  recoveredOrder: Attempt | null;
  recoveredAfterCall: boolean;
  /** They made a new checkout after we had already called them. */
  cameBackAfterCall: boolean;
  /** They had an earlier lead that ended (expired / bought) — this is a fresh one. */
  isReturning: boolean;
  callbackRequested: boolean;
  saidInterested: boolean;
  score: number;
  heat: LeadHeat;
  reasons: string[];
}

const isAutoOrder = (o: OrderRow) => String(o.order_id || '').startsWith('AUTO_');
const toTime = (v: string | null | undefined) => {
  const t = v ? new Date(v).getTime() : NaN;
  return Number.isFinite(t) ? t : 0;
};

export const normalizeEmail = (email: unknown) => String(email || '').trim().toLowerCase();

export function normalizeCourseIds(raw: unknown): string[] {
  let list: unknown = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      list = raw.split(',');
    }
  }
  if (!Array.isArray(list)) return [];
  return Array.from(new Set(list.map((v) => String(v ?? '').trim()).filter(Boolean)));
}

export const phoneDigits = (phone: unknown) => String(phone || '').replace(/\D/g, '').slice(-10);
export const hasCallablePhone = (phone: unknown) => phoneDigits(phone).length === 10;

export const leadKeyFor = (email: string, firstOrderId: string) => `${normalizeEmail(email)}|${firstOrderId}`;

interface Cycle {
  email: string;
  attempts: Attempt[];
  recovered: Attempt | null;
  index: number;
}

function toAttempt(o: OrderRow): Attempt {
  return {
    orderId: o.order_id,
    at: toTime(o.created_at),
    amount: Number(o.total_amount) || 0,
    courseIds: normalizeCourseIds(o.course_ids),
  };
}

/** Split one person's order history into lead cycles. */
function buildCycles(email: string, orders: OrderRow[]): Cycle[] {
  const paid = orders
    .filter((o) => o.status === 'PAID')
    .map((o) => ({ ...toAttempt(o), real: !isAutoOrder(o) && (Number(o.total_amount) || 0) > 0 }))
    .sort((a, b) => a.at - b.at);
  const created = orders
    .filter((o) => o.status === 'CREATED' && !isAutoOrder(o))
    .map(toAttempt)
    .sort((a, b) => a.at - b.at);

  const cycles: Cycle[] = [];
  const owned = new Set<string>();
  let cur: Cycle | null = null;
  let p = 0;

  const close = () => {
    if (cur) cycles.push(cur);
    cur = null;
  };

  const absorbPaidUntil = (until: number) => {
    while (p < paid.length && paid[p].at <= until) {
      const order = paid[p++];
      order.courseIds.forEach((c) => owned.add(c));
      if (!cur || !order.real) continue;
      if (order.at - cur.attempts[cur.attempts.length - 1].at > LEAD_LIFETIME_MS) {
        close(); // lead had already expired before this purchase
        continue;
      }
      const { real: _real, ...attempt } = order;
      cur.recovered = attempt;
      close();
    }
  };

  for (const attempt of created) {
    absorbPaidUntil(attempt.at);
    const alreadyOwnsAll = attempt.courseIds.length > 0 && attempt.courseIds.every((c) => owned.has(c));
    if (alreadyOwnsAll) continue;
    if (cur && attempt.at - (cur as Cycle).attempts[(cur as Cycle).attempts.length - 1].at > LEAD_LIFETIME_MS) close();
    if (!cur) cur = { email, attempts: [], recovered: null, index: cycles.length };
    (cur as Cycle).attempts.push(attempt);
  }
  absorbPaidUntil(Number.POSITIVE_INFINITY);
  close();

  return cycles.map((c, i) => ({ ...c, index: i }));
}

function retryDelay(streak: number) {
  return NO_ANSWER_RETRY_MS[Math.min(streak, NO_ANSWER_RETRY_MS.length) - 1] ?? NO_ANSWER_RETRY_MS[NO_ANSWER_RETRY_MS.length - 1];
}

function timeAgoShort(ms: number) {
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / MINUTE))}m ago`;
  if (ms < DAY) return `${Math.round(ms / HOUR)}h ago`;
  return `${Math.round(ms / DAY)}d ago`;
}

function scoreLead(lead: Lead, now: number) {
  const reasons: string[] = [];
  let score = 0;
  const since = now - lead.lastAttemptAt;

  if (since < DAY) score += 40;
  else if (since < 3 * DAY) score += 30;
  else if (since < 7 * DAY) score += 20;
  else if (since < 14 * DAY) score += 10;
  reasons.push(`Tried ${timeAgoShort(since)}`);

  const n = lead.attempts.length;
  if (n > 1) {
    score += Math.min(30, (n - 1) * 12);
    reasons.push(`Tried ${n}×`);
  }

  if (lead.cartValue >= 500) {
    score += 15;
    reasons.push('Big cart');
  } else if (lead.cartValue >= 250) score += 10;
  else if (lead.cartValue > 0) score += 5;

  if (lead.callbackRequested) {
    score += 25;
    reasons.push('Asked for callback');
  }
  if (lead.saidInterested) {
    score += 20;
    reasons.push('Said interested');
  }
  if (lead.cameBackAfterCall) {
    score += 20;
    reasons.push('Came back after call');
  }
  if (lead.isReturning) {
    score += 5;
    reasons.push('Returning');
  }
  if (lead.noAnswerStreak > 0) {
    score -= 8 * lead.noAnswerStreak;
    reasons.push(`No answer ×${lead.noAnswerStreak}`);
  }

  const heat: LeadHeat = score >= 60 ? 'HOT' : score >= 35 ? 'WARM' : 'COOL';
  return { score, heat, reasons };
}

export interface BuildLeadsInput {
  orders: OrderRow[];
  calls: CallLog[];
  profiles: ProfileRow[];
  now?: number;
}

export function buildLeads({ orders, calls, profiles, now = Date.now() }: BuildLeadsInput): Lead[] {
  const ordersByEmail = new Map<string, OrderRow[]>();
  for (const o of orders) {
    const email = normalizeEmail(o.user_email);
    if (!email) continue;
    if (!ordersByEmail.has(email)) ordersByEmail.set(email, []);
    ordersByEmail.get(email)!.push(o);
  }

  const callsByKey = new Map<string, CallLog[]>();
  for (const c of calls) {
    if (!callsByKey.has(c.lead_key)) callsByKey.set(c.lead_key, []);
    callsByKey.get(c.lead_key)!.push(c);
  }

  const profileByEmail = new Map<string, ProfileRow>();
  for (const pr of profiles) profileByEmail.set(normalizeEmail(pr.email), pr);

  const leads: Lead[] = [];

  for (const [email, personOrders] of Array.from(ordersByEmail)) {
    const cycles = buildCycles(email, personOrders);
    const profile = profileByEmail.get(email);

    for (const cycle of cycles) {
      const first = cycle.attempts[0];
      const last = cycle.attempts[cycle.attempts.length - 1];
      const key = leadKeyFor(email, first.orderId);
      const leadCalls = (callsByKey.get(key) || []).slice().sort((a, b) => toTime(a.created_at) - toTime(b.created_at));
      const stateCalls = leadCalls.filter((c) => c.outcome !== 'NOTE');

      // Finished on their own before we were ever meant to call -> not a lead, just a payment retry.
      if (cycle.recovered && cycle.recovered.at - first.at <= COOL_OFF_MS && stateCalls.length === 0) continue;

      // Replay checkouts + calls in time order to get the current state.
      type Ev = { at: number; attempt?: Attempt; call?: CallLog };
      const events: Ev[] = [
        ...cycle.attempts.map((a): Ev => ({ at: a.at, attempt: a })),
        ...stateCalls.map((c): Ev => ({ at: toTime(c.created_at), call: c })),
      ].sort((a, b) => a.at - b.at || (a.attempt ? -1 : 1));

      let dueAt = first.at + COOL_OFF_MS;
      let streak = 0;
      let dropReason: string | null = null;
      let droppedAt: number | null = null;
      let cameBackAfterCall = false;
      let callbackRequested = false;
      let saidInterested = false;
      let calledYet = false;

      for (const ev of events) {
        if (ev.attempt) {
          if (calledYet) cameBackAfterCall = true;
          dropReason = null;
          droppedAt = null;
          streak = 0;
          callbackRequested = false;
          dueAt = ev.at + COOL_OFF_MS;
          continue;
        }
        const call = ev.call!;
        calledYet = true;
        cameBackAfterCall = false;
        callbackRequested = false;
        dropReason = null;
        droppedAt = null;
        switch (call.outcome) {
          case 'NO_ANSWER':
            streak += 1;
            if (streak >= MAX_NO_ANSWER) {
              dropReason = `No answer ${streak} times`;
              droppedAt = ev.at;
            } else {
              dueAt = ev.at + retryDelay(streak);
            }
            break;
          case 'CALLBACK': {
            streak = 0;
            callbackRequested = true;
            const cb = toTime(call.callback_at);
            dueAt = cb > 0 ? cb : ev.at + DEFAULT_CALLBACK_MS;
            break;
          }
          case 'INTERESTED':
            streak = 0;
            saidInterested = true;
            dueAt = ev.at + INTERESTED_FOLLOWUP_MS;
            break;
          case 'NOT_INTERESTED':
            dropReason = 'Not interested';
            droppedAt = ev.at;
            break;
          case 'WRONG_NUMBER':
            dropReason = 'Wrong number';
            droppedAt = ev.at;
            break;
          case 'ALREADY_BOUGHT':
            dropReason = 'Says already bought';
            droppedAt = ev.at;
            break;
        }
      }

      const expiresAt = last.at + LEAD_LIFETIME_MS;
      let stage: LeadStage;
      if (cycle.recovered) {
        stage = 'RECOVERED';
      } else if (dropReason) {
        stage = 'DROPPED';
      } else if (now >= expiresAt) {
        stage = 'DROPPED';
        dropReason = `No purchase in ${LEAD_LIFETIME_DAYS} days`;
        droppedAt = expiresAt;
      } else if (now < dueAt) {
        stage = calledYet && !cameBackAfterCall ? 'SCHEDULED' : 'COOLING';
      } else {
        stage = 'DUE';
      }

      // Old history isn't useful on the board.
      if (stage === 'DROPPED' && droppedAt !== null && now - droppedAt > HISTORY_VISIBLE_MS) continue;
      if (stage === 'RECOVERED' && cycle.recovered && now - cycle.recovered.at > HISTORY_VISIBLE_MS) continue;

      const recoveredAfterCall = !!cycle.recovered && stateCalls.some((c) => toTime(c.created_at) < cycle.recovered!.at);
      const phone = profile?.phone ? String(profile.phone) : null;

      const lead: Lead = {
        key,
        email,
        name: profile?.name || null,
        phone,
        hasPhone: hasCallablePhone(phone),
        attempts: cycle.attempts,
        courseIds: Array.from(new Set(cycle.attempts.flatMap((a) => a.courseIds))),
        cartValue: last.amount,
        firstAttemptAt: first.at,
        lastAttemptAt: last.at,
        expiresAt,
        calls: leadCalls,
        lastCall: leadCalls[leadCalls.length - 1] || null,
        noAnswerStreak: streak,
        stage,
        dueAt: stage === 'DUE' || stage === 'SCHEDULED' || stage === 'COOLING' ? dueAt : null,
        dropReason: stage === 'DROPPED' ? dropReason : null,
        droppedAt: stage === 'DROPPED' ? droppedAt : null,
        recoveredOrder: cycle.recovered,
        recoveredAfterCall,
        cameBackAfterCall,
        isReturning: cycle.index > 0,
        callbackRequested,
        saidInterested,
        score: 0,
        heat: 'COOL',
        reasons: [],
      };
      Object.assign(lead, scoreLead(lead, now));
      leads.push(lead);
    }
  }

  return leads;
}

/** Order leads the way each tab wants them. */
export function sortLeads(leads: Lead[], stage: LeadStage | 'OPEN'): Lead[] {
  const list = leads.slice();
  if (stage === 'DUE' || stage === 'OPEN') {
    return list.sort((a, b) => b.score - a.score || b.lastAttemptAt - a.lastAttemptAt);
  }
  if (stage === 'SCHEDULED' || stage === 'COOLING') {
    return list.sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));
  }
  if (stage === 'RECOVERED') {
    return list.sort((a, b) => (b.recoveredOrder?.at ?? 0) - (a.recoveredOrder?.at ?? 0));
  }
  return list.sort((a, b) => (b.droppedAt ?? 0) - (a.droppedAt ?? 0));
}

export interface FollowUpStats {
  dueNow: number;
  dueNoPhone: number;
  open: number;
  openValue: number;
  recovered: number;
  recoveredValue: number;
  recoveredAfterCall: number;
  recoveredAfterCallValue: number;
  calledLeads: number;
  /** % of leads we called that went on to buy. */
  callConversion: number;
}

export function computeStats(leads: Lead[]): FollowUpStats {
  const open = leads.filter((l) => l.stage === 'DUE' || l.stage === 'SCHEDULED' || l.stage === 'COOLING');
  const recovered = leads.filter((l) => l.stage === 'RECOVERED');
  const afterCall = recovered.filter((l) => l.recoveredAfterCall);
  const called = leads.filter((l) => l.calls.some((c) => c.outcome !== 'NOTE'));
  return {
    dueNow: leads.filter((l) => l.stage === 'DUE' && l.hasPhone).length,
    dueNoPhone: leads.filter((l) => l.stage === 'DUE' && !l.hasPhone).length,
    open: open.length,
    openValue: open.reduce((s, l) => s + l.cartValue, 0),
    recovered: recovered.length,
    recoveredValue: recovered.reduce((s, l) => s + (l.recoveredOrder?.amount || 0), 0),
    recoveredAfterCall: afterCall.length,
    recoveredAfterCallValue: afterCall.reduce((s, l) => s + (l.recoveredOrder?.amount || 0), 0),
    calledLeads: called.length,
    callConversion: called.length ? Math.round((afterCall.length / called.length) * 100) : 0,
  };
}
