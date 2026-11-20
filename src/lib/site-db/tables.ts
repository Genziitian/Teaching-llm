// Website tables that were moved into the platform database. `courses` is not here: courses come from the Store.
export const SITE_TABLES = [
  'settings', 'blogs', 'course_catalog', 'pseo_pages', 'resources', 'widgets',
  'profiles', 'referral_profiles', 'referral_transactions', 'referral_milestones',
  'website_orders', 'discount_coupons', 'coupon_uses', 'cart_followup_calls',
  'employees', 'employee_photos', 'employee_birth_dates', 'employee_identity_documents', 'employee_logs',
  'one_on_one_bookings', 'job_applications', 'activity_logs',
] as const
