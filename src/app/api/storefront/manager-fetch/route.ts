// Port of the storefront's api/manager-fetch.ts (manager panel data tabs).
// GET /api/storefront/manager-fetch?tab=users|courses|discounts|payments|referrals&search=&filter=&from=&to=
// Same JSON shapes as the storefront function. Auth: class manager session (requireManager).
import { NextRequest, NextResponse } from 'next/server'
import { storefrontDb, StorefrontNotConfiguredError } from '@/lib/storefront/db'
import { requireManager, storefrontError } from '@/lib/storefront/guard'

export const dynamic = 'force-dynamic'

const formatInList = (values: string[]) => values.map(value => `"${value}"`).join(',')

const fetchProfileEmailsForPaymentSearch = async (supabase: any, search: string): Promise<string[]> => {
  if (!search.trim()) return []

  const { data, error } = await supabase
    .from('profiles')
    .select('email')
    .or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)

  if (error) throw error
  return Array.from(new Set((data || []).map((profile: any) => profile.email).filter(Boolean))) as string[]
}

const attachProfilesToOrders = async (supabase: any, orders: any[]) => {
  const emails = Array.from(new Set(
    orders
      .map(order => order.user_email)
      .filter(Boolean)
  )) as string[]

  if (emails.length === 0) return orders

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('email, name, phone, created_at')
    .in('email', emails)

  if (error) throw error

  const profilesByEmail = new Map<string, any>(
    (profiles || []).map((profile: any) => [profile.email?.toLowerCase(), profile])
  )

  return orders.map(order => {
    const profile = profilesByEmail.get(order.user_email?.toLowerCase())
    return {
      ...order,
      user_name: profile?.name || null,
      user_phone: profile?.phone || null,
      user_joined_at: profile?.created_at || null
    }
  })
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams
  const tab = q.get('tab') as string
  const filter = q.get('filter') || 'all'
  const from = q.get('from') || ''
  const to = q.get('to') || ''
  if (!tab) return NextResponse.json({ error: 'Tab is required' }, { status: 400 })

  const g = await requireManager()
  if ('response' in g) return g.response

  try {
    const supabase: any = storefrontDb()
    const search = q.get('search') || ''

    if (tab === 'courses') {
      let query = supabase.from('courses').select('*').order('name')
      if (search) {
        query = query.or(`name.ilike.%${search}%,id.ilike.%${search}%`)
      }
      const { data, error } = await query
      if (error) throw error
      return NextResponse.json(data || [])
    }

    if (tab === 'users') {
      let query = supabase.from('profiles').select('*').order('created_at', { ascending: false })
      if (search) {
        query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
      }
      const { data, error } = await query
      if (error) throw error
      return NextResponse.json(data || [])
    }

    if (tab === 'discounts') {
      let query = supabase.from('discount_coupons').select('*').order('created_at', { ascending: false })
      if (search) {
        query = query.ilike('code', `%${search}%`)
      }
      const { data, error } = await query
      if (error) throw error
      return NextResponse.json(data || [])
    }

    if (tab === 'payments') {
      if (filter === 'not-purchased') {
        let profileQuery = supabase.from('profiles').select('*').order('created_at', { ascending: false })
        if (search) {
          profileQuery = profileQuery.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`)
        }
        const { data: profiles, error: pError } = await profileQuery
        if (pError) throw pError

        const { data: paidOrders, error: oError } = await supabase
          .from('website_orders')
          .select('user_email')
          .not('order_id', 'like', 'AUTO_%')
          .gt('total_amount', 0)
          .eq('status', 'PAID')
        if (oError) throw oError

        const paidEmails = new Set(paidOrders?.map((order: any) => order.user_email?.toLowerCase()) || [])
        const leads = profiles?.filter((profile: any) => !paidEmails.has(profile.email?.toLowerCase())) || []

        return NextResponse.json(leads.map((profile: any) => ({
          order_id: `LEAD_${profile.id.toString().slice(0, 8)}`,
          user_email: profile.email,
          user_name: profile.name,
          user_phone: profile.phone,
          user_joined_at: profile.created_at,
          course_ids: [],
          total_amount: 0,
          status: 'NOT_PURCHASED',
          created_at: profile.created_at
        })))
      }

      let query = supabase
        .from('website_orders')
        .select('*')
        .not('order_id', 'like', 'AUTO_%')
        .order('created_at', { ascending: false })

      if (search) {
        const profileEmails = await fetchProfileEmailsForPaymentSearch(supabase, search)
        const searchTerms = [`user_email.ilike.%${search}%`, `order_id.ilike.%${search}%`]
        if (profileEmails.length > 0) {
          searchTerms.push(`user_email.in.(${formatInList(profileEmails)})`)
        }
        query = query.or(searchTerms.join(','))
      }

      if (filter === 'abandoned') {
        query = query.eq('status', 'CREATED')
      }

      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

      if (filter === 'today') {
        query = query.gte('created_at', startOfToday.toISOString())
      } else if (filter === 'yesterday') {
        const startOfYesterday = new Date(startOfToday)
        startOfYesterday.setDate(startOfYesterday.getDate() - 1)
        query = query.gte('created_at', startOfYesterday.toISOString()).lt('created_at', startOfToday.toISOString())
      } else if (filter === 'custom' || (from && to)) {
        if (from && to) {
          const start = new Date(`${from}T00:00:00`)
          const end = new Date(`${to}T23:59:59.999`)
          if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
            query = query.gte('created_at', start.toISOString()).lte('created_at', end.toISOString())
          }
        }
      } else if (filter === 'month') {
        const thirtyDaysAgo = new Date(startOfToday)
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
        query = query.gte('created_at', thirtyDaysAgo.toISOString())
      }

      const { data, error } = await query
      if (error) throw error
      return NextResponse.json(await attachProfilesToOrders(supabase, data || []))
    }

    if (tab === 'referrals') {
      let query = supabase.from('referral_transactions').select('*').order('created_at', { ascending: false })
      if (search) {
        query = query.or(`buyer_email.ilike.%${search}%,referrer_email.ilike.%${search}%,referral_code.ilike.%${search}%`)
      }
      const { data, error } = await query
      if (error) throw error
      return NextResponse.json(data || [])
    }

    return NextResponse.json({ error: 'Invalid tab' }, { status: 400 })
  } catch (err: any) {
    if (err instanceof StorefrontNotConfiguredError) return storefrontError('manager-fetch', err)
    // Log only the error code/message (never request params or row data).
    console.error('[storefront:manager-fetch] query failed:', err?.code || '', err?.message || 'unknown error')
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
