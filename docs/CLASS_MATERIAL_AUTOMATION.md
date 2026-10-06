# Class Genz: daily recordings and notes

## What is implemented

A Render cron worker runs at **08:00 Asia/Kolkata (02:30 UTC)**. It discovers Google Meet recording segments, compares their actual intervals with materialized website timetable occurrences, validates private Drive playback, and creates normal course content. It supports one shared Meet link across classes: recording resource IDs identify files, and timestamps identify classes. Ambiguous overlaps require manager review.

Notes are read from one Drive folder per course. Supported types are PDF, Google Docs, and Google Slides. Name them `YYYY-MM-DD_HHmm_Description.pdf` using the **scheduled** class date/time in IST. Extra files become notes-only content. Videos do not wait for notes.

The source application reserves content management to `MANAGER`; automation APIs and navigation follow that existing role rule. Students and course-scoped ADMIN users cannot configure or resolve automation imports.

## Architecture

`Render cron -> coordinator -> Google Meet/Drive discovery -> timetable matcher -> private-file verification -> transactional publisher -> existing Content / Topic tables`

The website retains enrollment checks and byte-range streaming. Automatically created content has `strictDriveAccess=true`: no anonymous or API-key fallback if the service account fails. The worker never moves, publicly shares, deletes, transcodes, or reuploads Google files.

PostgreSQL holds course configuration, import identity, permanent timetable copies, retry states, run reports, and a five-minute lease. The worker renews the lease every minute; transactions lock/check it before publishing. Google requests are sequential (below the three-request ceiling). Processing stops taking new work after twenty minutes. Published files are periodically revalidated; unpublished recordings are processed first.

## One-time setup

1. Deploy the migration with the normal release process: `npm run db:migrate:deploy`. Do not use `db push` against production. The migration adds tables and a default-false Content column; it does not remove existing data.
2. Enable Google Meet REST API and Drive API in your Google Cloud project.
3. Create an OAuth client supporting the redirect `http://127.0.0.1:8787/oauth/callback`. Configure its audience for the organizer's Workspace and use a production-ready authorization configuration; do not rely on temporary testing credentials for a daily job.
4. Set `AUTOMATION_GOOGLE_CLIENT_ID` and `AUTOMATION_GOOGLE_CLIENT_SECRET` in your local shell. Run `npm run automation:google -- --output /absolute/private/location/google-token.json`. The utility listens on loopback, validates state, uses PKCE, and writes the token with owner-only permissions. It does not print refresh tokens.
5. Authorize the organizer account in the browser. Save `AUTOMATION_GOOGLE_REFRESH_TOKEN` from the private file into Render secrets; securely remove the file afterwards. Do not commit it.
6. Share the organizer's recording location and each course notes folder with the existing playback service account. Check actual files, including files uploaded/moved by teachers; folder access alone is not assumed to guarantee every file's access.
7. Configure the web service and cron service with `DATABASE_URL`, all three `AUTOMATION_GOOGLE_*` secrets, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, and `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`. The web service needs Google credentials to validate folder settings. No new secrets are stored in the database.
8. To verify both identities, set `AUTOMATION_VERIFY_FOLDER_ID`, `AUTOMATION_VERIFY_RECORDING_ID`, and `AUTOMATION_VERIFY_NOTE_ID`, then run `npm run automation:google -- --verify`.
9. As MANAGER, open `/automation` (Class Automation in the sidebar). Set course folder IDs, activation dates, and destination topics. A blank topic selection creates/reuses Daily Recordings. Start with one course.
10. Keep the Render schedule suspended during setup. Run a dry run, inspect its report, then manually run one real import. Verify with an enrolled student before enabling the daily schedule.

Courses default to disabled. The application does not authorize Google or enable live courses on your behalf. Render cron services must have the same database configuration as the web service. The YAML also expresses the pre-existing analytics job under Render's supported `services` structure; ensure that service retains its existing secrets.

## Commands

```sh
npm run automation:import -- --dry-run
npm run automation:import -- --manual --course COURSE_ID
npm run automation:import -- --dry-run --from 2026-10-01T00:00:00+05:30 --to 2026-10-06T00:00:00+05:30 --course COURSE_ID
```

`--from` is inclusive and `--to` exclusive. Explicit backfills may discover recordings before the configured activation date; regular runs obey it. Both boundaries are required. Dry runs store only a run report and lease housekeeping, not live import records, timetable copies, content, or watermarks. Reports are capped at 2,000 detail entries; aggregate discovery counters still include all items.

## Discovery and exceptions

- All API pages are consumed. Normal discovery covers at least seven days since activation and extends back to the last completed discovery watermark after downtime. Only complete discovery advances that phase's watermark.
- Already-discovered pending recordings are retried outside the rolling window. Notes folders are rescanned for late files.
- Google conference metadata expires approximately 30 days after a conference. Recovery/backfill older than that may require manually mapping existing Drive files; the importer cannot recover already-expired Meet metadata merely by widening its date range. See https://developers.google.com/workspace/meet/api/reference/rest/v2/conferenceRecords.
- Timetable occurrences must be course-specific Meet classes. Matching counts overlaps even with other courses that have not enabled automation, avoiding false matches in a shared room.
- If a recording overlaps two scheduled classes, select the correct occurrence in Imports. Manual decisions persist.
- Notes with invalid names, unsupported types, changed class keys, or missing permissions remain in review. Resolve to a class if appropriate; changing the content of an already-attached file does not create duplicate notes.
- A deleted lecture is not recreated automatically. A manually edited automated field is preserved and flagged. Retry repeats validation; it does not override edits or deleted-content decisions.
- A newly discovered earlier segment can update untouched part labels and move an untouched primary notes attachment to the earlier part. Manually changed attachments are preserved.
- The Pending view shows missing-recording/overdue-notes warnings for the latest 500 sessions older than seven days.
- Settings and import decisions return 409 during an active run to avoid racing the worker. Retry queues the item; Render's Trigger Run executes immediately. Ignoring an import does not delete already-published content.

## Operations and security

Run summaries appear in `/automation` and structured worker stdout. Authentication and file-access failures contain sanitized messages, never Google request headers/tokens. No email, Slack, or external notifications are sent. Refresh-token rejection stops Google processing and requires reconnection.

The lease and database uniqueness constraints give at-least-once processing with duplicate-safe publication. Publication creates Content and records its source in one transaction. Google requests stay outside database transactions. Course content IDs survive as historical strings in imports when corresponding application records are deleted.

Pause by disabling course automation or suspending the Render cron. Keep the migration/tables when rolling back the worker so historical IDs and duplicate protection are retained. Existing manually created material continues to work.

Video load remains on the existing Render playback proxy. This feature does not add a CDN, transcoding, or automatic recording. Teachers still start/stop a recording for each class and upload their notes.

## Validation

```sh
npm run test:automation
npx tsc --noEmit --incremental false
```

Database integration tests require an isolated PostgreSQL database named exactly `class_genz_automation_test` on localhost. **Tests truncate that database.** The suite rejects remote hosts or other database names. Bootstrap it using a schema generated with `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`, then set `AUTOMATION_TEST_DATABASE_URL` and run the test command. The implementation was also tested by applying the new SQL migration on top of the original schema.

Live Google authorization, real-file playback, Render deployment, and production concurrency must be verified during rollout; offline fixtures do not establish these live prerequisites.

## Implementation verification

Verified locally: 28 automated tests (including the actual PostgreSQL migration, importer transactions, retries, admin authorization, and mocked private playback); full TypeScript checking; and a production Next.js build. The build completed with existing dependency warnings and optional database/release lookup warnings in the restricted build environment. Google API behavior is exercised with fixtures; no live Google credentials or production database were used.
