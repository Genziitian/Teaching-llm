# storefront-panel

Isolated Vite + React 19 + Tailwind 4 build of the genziitian.in storefront Manager panel (design copied unchanged).
Served by class genz at `/storefront-panel/` (iframe). Uses HashRouter, so no server rewrites are needed.

## Rebuild
    cd storefront-panel && npm install && npm run build

Output goes to `../public/storefront-panel/` (relative asset URLs).

## URLs
- Full panel: `/storefront-panel/#/manager/<tab>`
- Single tab, no menu/title/back link: `/storefront-panel/#/manager/<tab>?embed=1`

Tabs: users, 1on1, applications, employees, courses, boxes, booklets, discounts, payments, followups, referrals, blogs, faqs, reviews, settings. (Logs tab removed.)

## Data access (no browser Supabase)
- `src/lib/supabase.ts` is a shim. Each query chain is POSTed once to `/api/storefront/db`
  with `Content-Type: application/json`, `X-Requested-With: XMLHttpRequest`, same-origin credentials.
  Request: `{"table":"courses","calls":[{"m":"select","a":["*"]},{"m":"eq","a":["id","x"]},{"m":"order","a":["name",{"ascending":true}]},{"m":"maybeSingle","a":[]}]}`
  Response (200): `{"data":any,"error":null|{message,code?,details?,hint?},"count":number|null,"status":number}`
  HTTP 401/403/503 body `{"error":"msg","code"?}` becomes `{data:null,error:{message}}` (never throws).
- `src/context/AuthContext.tsx`: GET `/api/auth/me`; `isManager = user.role === 'MANAGER'`; otherwise "Only managers can open this page."
- `src/lib/api.ts`: `managerFetch` -> GET `/api/storefront/manager-fetch?tab=&filter=&search=&from=&to=`
- POST `/api/storefront/job-applications/{update-status,delete}`, GET `/api/storefront/job-applications`
- GET `/api/storefront/1on1-bookings`, POST `/api/storefront/1on1-bookings/{update-status,cancel,reschedule,update-notes}`
