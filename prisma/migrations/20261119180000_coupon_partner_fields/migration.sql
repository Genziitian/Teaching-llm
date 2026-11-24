-- One coupon list for app + website: partner-issued coupons (from /api/site/partner-coupons) now live in "Coupon".
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "partnerId" TEXT;
ALTER TABLE "Coupon" ADD COLUMN IF NOT EXISTS "issuedToEmail" TEXT;
CREATE INDEX IF NOT EXISTS "Coupon_partnerId_issuedToEmail_idx" ON "Coupon"("partnerId", "issuedToEmail");
