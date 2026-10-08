import { PRIVACY_POLICY_HTML } from './privacy-policy'
import { TERMS_AND_CONDITIONS_HTML } from './terms-and-conditions'

/**
 * Default HTML content for /company/[slug] pages.
 * Used as fallback when no content exists in the database
 * (managers can still override via the Edit UI on the page).
 *
 * Rendered via `dangerouslySetInnerHTML` inside `.custom-page-content`
 * which styles h1/h2/p/ul/li/etc. — keep markup simple.
 */

const LAST_UPDATED = 'April 2026'

function sectionHeader(num: string, title: string): string {
  return `<h2><span style="display:inline-block; min-width:42px; color:#94a3b8; font-weight:700; letter-spacing:-0.01em;">${num}.</span> ${title}</h2>`
}

function lastUpdated(): string {
  return `<p style="color:#94a3b8; font-size:0.95em; margin-top:-8px; margin-bottom:24px;">Last Updated: ${LAST_UPDATED}</p>`
}

function contactFooter(prompt: string): string {
  return `<div style="margin-top:32px; padding:20px 24px; background:linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08)); border:1px solid rgba(99,102,241,0.18); border-radius:18px;">
    <p style="margin:0 0 6px; font-weight:700; color:#1e1e3a;">${prompt}</p>
    <p style="margin:0;"><a href="/support" style="color:#3636e8; font-weight:700; text-decoration:none;">Contact Support →</a></p>
  </div>`
}

const REFUND_POLICY = `
${lastUpdated()}

<p>At <strong>Gen-Z IITian</strong>, we aim to provide high-quality educational content and resources to our students. Because our products are digital and delivered instantly, we maintain a clear refund and cancellation policy.</p>

${sectionHeader('01', 'No Refund Policy')}
<p style="padding:14px 18px; background:#f8fafc; border-left:4px solid #3636e8; border-radius:6px; font-style:italic; color:#475569;">"All purchases are final. We do not offer refunds once a course is purchased."</p>
<p>As our products are digital educational courses and access is granted immediately upon payment, we cannot provide any refunds or returns. Once the course material is accessed, the value is considered delivered.</p>

${sectionHeader('02', 'No Cancellation Policy')}
<p style="padding:14px 18px; background:#f8fafc; border-left:4px solid #3636e8; border-radius:6px; font-style:italic; color:#475569;">"Orders cannot be cancelled once placed."</p>
<p>Due to the automated nature of our enrollment process, once a payment is successful, the order cannot be reversed or cancelled. Access is linked to your account immediately.</p>

${sectionHeader('03', 'Reason for this Policy')}
<p>We provide access to proprietary educational content, downloadable resources, and curriculum-specific study materials. Since these materials are accessible instantly to anyone after purchase, we cannot revoke access once the content has been viewed.</p>

${sectionHeader('04', 'Duplicate Payment Resolution')}
<p>In case of a technical glitch leading to a duplicate payment for the same course, users should contact our support team immediately. Upon verification, we will initiate a refund for the duplicate transaction through the original payment method. The refund process may take <strong>5–7 business days</strong> depending on the payment gateway and your bank.</p>

${contactFooter('Still have questions?')}
`.trim()

const PRIVACY_POLICY = PRIVACY_POLICY_HTML
const TERMS_AND_CONDITIONS = TERMS_AND_CONDITIONS_HTML
const ABOUT_US = `
${lastUpdated()}

<p>Welcome to <strong>Gen-Z IITian</strong> — a learning platform built by IIT alumni for the next generation of IIT aspirants. Our mission is simple: make high-quality, no-fluff exam preparation accessible, affordable, and effective for every serious student.</p>

${sectionHeader('01', 'Who We Are')}
<p>We are a team of IIT graduates, full-time educators, and engineers who understand both the demands of competitive exams and how today's students learn. We started Gen-Z IITian to bridge the gap between expensive coaching and self-study with a single, focused offering — disciplined live batches paired with on-demand lecture recordings, premium notes, and PYQs.</p>

${sectionHeader('02', 'What We Offer')}
<ul>
  <li><strong>Qualifier Batches</strong> — complete syllabus coverage with daily live classes, doubt sessions, and unlimited re-attempt support.</li>
  <li><strong>Term Courses (Live + Recorded)</strong> — structured Term 1, Term 2, and Diploma tracks aligned with the IITM BS curriculum.</li>
  <li><strong>Foundation Courses</strong> — for students building core concepts from the ground up.</li>
  <li><strong>Premium Notes, PYQs &amp; Formula Sheets</strong> — concise, exam-ready resources curated by top scorers.</li>
  <li><strong>Mentorship</strong> — book 1:1 sessions with IIT mentors for strategy, doubt resolution, and study plans.</li>
</ul>

${sectionHeader('03', 'Our Approach')}
<p>We believe the best learning happens when content is <strong>structured, interactive, and revisitable</strong>. Every live class is recorded and indexed, every concept is paired with practice problems, and every student gets dedicated support channels — community chat, ticketed help, and live mentorship — so no doubt goes unanswered.</p>

${sectionHeader('04', 'Why Students Choose Us')}
<ul>
  <li>Taught by educators who have cleared the same exams they teach.</li>
  <li>Transparent pricing — no hidden fees, no upsells inside the classroom.</li>
  <li>Lifetime access to recordings within the validity of your enrollment.</li>
  <li>Active student community with peer support and instructor presence.</li>
  <li>Designed for serious learners — not entertainment, just outcomes.</li>
</ul>

${sectionHeader('05', 'Get in Touch')}
<p>Have a question, suggestion, or partnership idea? We'd love to hear from you. Reach out through our support channel and a real team member will get back to you within one business day.</p>

${contactFooter('Want to talk to us?')}
`.trim()

export const COMPANY_PAGE_DEFAULTS: Record<string, string> = {
  'refund-policy': REFUND_POLICY,
  'privacy-policy': PRIVACY_POLICY,
  'terms-and-conditions': TERMS_AND_CONDITIONS,
  'about-us': ABOUT_US,
}

export function getDefaultCompanyContent(slug: string): string {
  return COMPANY_PAGE_DEFAULTS[slug] || ''
}
