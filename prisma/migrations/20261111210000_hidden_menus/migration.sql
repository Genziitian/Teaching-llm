-- Sidebar menu visibility (additive, nullable). NULL = never configured -> app default (Exam Protection hidden).
ALTER TABLE "AppFlags" ADD COLUMN IF NOT EXISTS "hiddenMenus" TEXT;
