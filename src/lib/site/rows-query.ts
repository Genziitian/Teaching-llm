// Tiny supabase-style query builder over an in-memory list of rows (select/eq/in/order/single ...).
// Lets code that used `supabase.from('courses')...` keep working while courses now come from the Store API.
type Row = Record<string, any>
type Result = { data: any; error: { message: string } | null; count: number | null; status: number }

export function queryRows(rows: Row[]) {
  let list = rows.slice()
  let mode: 'many' | 'single' | 'maybeSingle' = 'many'
  let from = 0
  let to: number | null = null

  const b: any = {
    select() { return b },
    eq(col: string, val: any) { list = list.filter((r) => r[col] === val); return b },
    neq(col: string, val: any) { list = list.filter((r) => r[col] !== val); return b },
    in(col: string, vals: any[]) { const set = new Set(vals); list = list.filter((r) => set.has(r[col])); return b },
    is(col: string, val: any) { list = list.filter((r) => (val === null ? r[col] == null : r[col] === val)); return b },
    gt(col: string, val: any) { list = list.filter((r) => r[col] > val); return b },
    gte(col: string, val: any) { list = list.filter((r) => r[col] >= val); return b },
    lt(col: string, val: any) { list = list.filter((r) => r[col] < val); return b },
    lte(col: string, val: any) { list = list.filter((r) => r[col] <= val); return b },
    ilike(col: string, pat: string) { const re = new RegExp('^' + pat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*') + '$', 'i'); list = list.filter((r) => re.test(String(r[col] ?? ''))); return b },
    order(col: string, opts?: { ascending?: boolean }) {
      const dir = opts?.ascending === false ? -1 : 1
      list.sort((x, y) => (x[col] == null ? 1 : y[col] == null ? -1 : x[col] < y[col] ? -dir : x[col] > y[col] ? dir : 0))
      return b
    },
    limit(n: number) { to = from + n - 1; return b },
    range(a: number, z: number) { from = a; to = z; return b },
    single() { mode = 'single'; return b },
    maybeSingle() { mode = 'maybeSingle'; return b },
    then(resolve: (r: Result) => any, reject?: (e: any) => any) {
      const page = list.slice(from, to == null ? undefined : to + 1)
      let res: Result
      if (mode === 'many') res = { data: page, error: null, count: list.length, status: 200 }
      else if (page.length === 1) res = { data: page[0], error: null, count: 1, status: 200 }
      else if (mode === 'maybeSingle' && page.length === 0) res = { data: null, error: null, count: 0, status: 200 }
      else res = { data: null, error: { message: page.length === 0 ? 'No rows found' : 'More than one row found' }, count: null, status: 406 }
      return Promise.resolve(res).then(resolve, reject)
    },
  }
  return b
}
