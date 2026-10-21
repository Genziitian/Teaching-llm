import { sendPaymentMail, paymentMailEnabled } from '@/lib/payment-mail'
import nodemailer from 'nodemailer'

/**
 * Creates a nodemailer transporter from SMTP environment variables if present.
 */
function getTransporter() {
  const host = process.env.SMTP_HOST || process.env.EMAIL_SERVER_HOST
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_SERVER_PORT || 587)
  const user = process.env.SMTP_USER || process.env.EMAIL_SERVER_USER || process.env.GMAIL_USER
  const pass = process.env.SMTP_PASS || process.env.EMAIL_SERVER_PASSWORD || process.env.GMAIL_PASS || process.env.GMAIL_APP_PASSWORD

  if (!host && !user) {
    return null
  }

  if (user && !host && (user.includes('@gmail.com') || process.env.GMAIL_USER)) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    })
  }

  return nodemailer.createTransport({
    host: host || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
  })
}

/**
 * Generic email sender that tries SMTP transporter first, then falls back to App Script webhook.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  action = 'raw_email',
  metadata = {},
}: {
  to: string
  subject: string
  html: string
  text?: string
  action?: string
  metadata?: any
}) {
  const fromAddress = process.env.SMTP_FROM || process.env.EMAIL_FROM || 'GENZ IITIAN <ADMIN@GENZIITIAN.ORG>'
  const transporter = getTransporter()

  if (transporter) {
    try {
      await transporter.sendMail({
        from: fromAddress,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]+>/g, ' '),
      })
      console.log(`[EmailService:SMTP] Sent email "${subject}" to ${to}`)
      return { success: true, method: 'smtp' }
    } catch (smtpErr) {
      console.error('[EmailService:SMTP] Failed to send via SMTP:', smtpErr)
    }
  }

  // Fallback to Google Apps Script webhook if available
  const appScriptUrl = process.env.APP_SCRIPT_URL
  if (appScriptUrl) {
    try {
      const response = await fetch(appScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          to,
          userEmail: to,
          subject,
          html,
          timestamp: new Date().toISOString(),
          ...metadata,
        }),
      })
      if (response.ok) {
        console.log(`[EmailService:AppScript] Sent email "${subject}" to ${to} (action: ${action})`)
        return { success: true, method: 'app_script' }
      }
    } catch (appScriptErr) {
      console.error('[EmailService:AppScript] Failed to trigger App Script:', appScriptErr)
    }
  }

  console.log(`[EmailService:Simulated] Email to: ${to} | Subject: "${subject}" (Configure SMTP or APP_SCRIPT_URL for live delivery)`)
  return { success: true, method: 'simulated' }
}

/**
 * Utility to trigger Google App Script webhooks for existing order/mentorship email notifications.
 */
export async function sendEmailNotification(type: 'mentorship_confirmed' | 'meet_invite' | 'purchase' | 'upgrade', data: any) {
  // Upgrade payments send no email.
  if (type === 'upgrade') return

  // New payment emails: when PAYMENT_MAIL_WEBHOOK_URL is set they replace the old purchase email.
  if (type === 'purchase' && paymentMailEnabled()) {
    await sendPaymentMail({
      status: 'SUCCESS',
      itemType: data.itemType,
      name: data.userName,
      email: data.userEmail || data.email,
      phone: data.phone,
      itemName: String(data.itemName || ''),
      amount: typeof data.amount === 'number' ? data.amount : Number(data.amount) || 0,
      paymentId: data.paymentId,
      orderId: data.orderId,
    })
    return
  }
  const url = process.env.APP_SCRIPT_URL;
  
  if (!url) {
    console.warn('[EmailService] APP_SCRIPT_URL not found in environment variables. Email will not be sent.');
    return;
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: type,
        timestamp: new Date().toISOString(),
        ...data
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[EmailService] Failed to trigger App Script: ${response.status} ${errorText}`);
    } else {
      console.log(`[EmailService] Successfully triggered ${type} email for ${data.userEmail || data.email}`);
    }
  } catch (error) {
    console.error('[EmailService] Error calling App Script webhook:', error);
  }
}

/**
 * Helper to generate brand-styled HTML email wrapper
 */
function renderEmailWrapper(title: string, bodyContent: string) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 24px 30px; background: linear-gradient(135deg, #1e1b4b, #312e81); border-bottom: 1px solid #4338ca; text-align: center;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">GenZ IITian</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 30px; font-size: 14.5px; line-height: 1.6; color: #e2e8f0;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 20px 30px; background-color: #0f172a; border-top: 1px solid #334155; text-align: center; font-size: 12px; color: #94a3b8;">
              <p style="margin: 0;">Questions? Contact us at <a href="mailto:ADMIN@GENZIITIAN.ORG" style="color: #818cf8; text-decoration: none;">ADMIN@GENZIITIAN.ORG</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`
}

/**
 * 1. Email sent immediately when a user raises an account deletion request.
 */
export async function sendDeletionRequestedEmail({
  userEmail,
  userName,
  requestedAt,
  cancelUntil,
  reasonLabel,
}: {
  userEmail: string
  userName: string
  requestedAt: Date
  cancelUntil: Date
  reasonLabel: string
}) {
  const cancelUntilFormatted = cancelUntil.toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  })

  const bodyContent = `
    <h2 style="font-size: 18px; font-weight: 700; color: #f87171; margin: 0 0 16px;">Account Deletion Request Received</h2>
    <p>Dear <strong>${userName}</strong>,</p>
    <p>We have received your request to permanently delete your GenZ IITian account.</p>
    
    <div style="background-color: #0f172a; border-left: 4px solid #ef4444; padding: 14px 18px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0 0 8px; font-size: 13px; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Request Summary</p>
      <p style="margin: 0 0 6px;"><strong>Reason:</strong> ${reasonLabel}</p>
      <p style="margin: 0;"><strong>24-Hour Cancellation Deadline:</strong> <span style="color: #f59e0b; font-weight: 700;">${cancelUntilFormatted}</span></p>
    </div>

    <p style="font-weight: 600; color: #f1f5f9;">What happens next?</p>
    <ul style="padding-left: 20px; margin: 10px 0 20px; color: #cbd5e1;">
      <li>You have a <strong>24-hour grace period</strong> to change your mind.</li>
      <li>To cancel this deletion request, simply log in to your account, visit <strong>Settings</strong>, and click <strong>Cancel Deletion Request</strong>.</li>
      <li>After the 24-hour window expires, platform managers will proceed with final deletion.</li>
    </ul>

    <div style="text-align: center; margin: 25px 0 10px;">
      <a href="https://class.genziitian.in/settings" style="display: inline-block; background-color: #4f46e5; color: #ffffff; font-weight: 700; font-size: 13.5px; padding: 12px 28px; border-radius: 50px; text-decoration: none;">Manage Account & Settings</a>
    </div>
  `

  return sendEmail({
    to: userEmail,
    action: 'deletion_requested',
    subject: 'Account Deletion Request Received - GenZ IITian',
    html: renderEmailWrapper('Account Deletion Request Received', bodyContent),
    metadata: {
      userName,
      reasonLabel,
      requestedAt: requestedAt.toISOString(),
      cancelUntil: cancelUntil.toISOString(),
    },
  })
}

/**
 * 2. Email sent when Manager accepts the deletion request.
 */
export async function sendDeletionAcceptedEmail({
  userEmail,
  userName,
  cancelUntil,
}: {
  userEmail: string
  userName: string
  cancelUntil: Date
}) {
  const cancelUntilFormatted = cancelUntil.toLocaleString('en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
  })

  const bodyContent = `
    <h2 style="font-size: 18px; font-weight: 700; color: #60a5fa; margin: 0 0 16px;">Deletion Request Accepted by Manager</h2>
    <p>Dear <strong>${userName}</strong>,</p>
    <p>A platform manager has reviewed and accepted your account deletion request.</p>
    
    <div style="background-color: #0f172a; border-left: 4px solid #3b82f6; padding: 14px 18px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 13.5px; color: #e2e8f0;">
        Your account is scheduled for permanent deletion once your 24-hour cancellation period expires on:<br>
        <span style="color: #fbbf24; font-weight: 700; font-size: 14px;">${cancelUntilFormatted}</span>
      </p>
    </div>

    <p>If you wish to cancel this request before the timer ends, you can still cancel it at any time from your account settings.</p>

    <div style="text-align: center; margin: 25px 0 10px;">
      <a href="https://class.genziitian.in/settings" style="display: inline-block; background-color: #3b82f6; color: #ffffff; font-weight: 700; font-size: 13.5px; padding: 12px 28px; border-radius: 50px; text-decoration: none;">View Status in Settings</a>
    </div>
  `

  return sendEmail({
    to: userEmail,
    action: 'deletion_accepted',
    subject: 'Account Deletion Request Accepted - GenZ IITian',
    html: renderEmailWrapper('Account Deletion Request Accepted', bodyContent),
    metadata: {
      userName,
      cancelUntil: cancelUntil.toISOString(),
    },
  })
}

/**
 * 3. Email sent when the 24-hour cancellation window has ended.
 */
export async function sendDeletionWindowEndedEmail({
  userEmail,
  userName,
}: {
  userEmail: string
  userName: string
}) {
  const bodyContent = `
    <h2 style="font-size: 18px; font-weight: 700; color: #fbbf24; margin: 0 0 16px;">24-Hour Cancellation Period Ended</h2>
    <p>Dear <strong>${userName}</strong>,</p>
    <p>The 24-hour cancellation grace period for your account deletion request has now concluded.</p>
    
    <div style="background-color: #0f172a; border-left: 4px solid #f59e0b; padding: 14px 18px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 13.5px; color: #e2e8f0;">
        Your account is now queued in the final deletion pipeline and will be permanently removed by a platform manager shortly.
      </p>
    </div>

    <p style="color: #94a3b8; font-size: 13px;">If you have any urgent inquiries regarding your account or data, please reach out to our team immediately at <a href="mailto:ADMIN@GENZIITIAN.ORG" style="color: #818cf8;">ADMIN@GENZIITIAN.ORG</a>.</p>
  `

  return sendEmail({
    to: userEmail,
    action: 'deletion_window_ended',
    subject: '24-Hour Cancellation Period Ended - GenZ IITian',
    html: renderEmailWrapper('Cancellation Window Ended', bodyContent),
    metadata: {
      userName,
    },
  })
}

/**
 * 4. Email sent after Manager executes final deletion.
 */
export async function sendAccountDeletedEmail({
  userEmail,
  userName,
}: {
  userEmail: string
  userName: string
}) {
  const bodyContent = `
    <h2 style="font-size: 18px; font-weight: 700; color: #ef4444; margin: 0 0 16px;">Your Account Has Been Deleted</h2>
    <p>Dear <strong>${userName}</strong>,</p>
    <p>Your GenZ IITian account, course enrollments, and platform profile have been permanently deleted in accordance with your request.</p>
    
    <div style="background-color: #0f172a; border-left: 4px solid #ef4444; padding: 14px 18px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0; font-size: 13px; color: #cbd5e1;">
        Thank you for having been part of the GenZ IITian community. We wish you every success in your academic and professional endeavors.
      </p>
    </div>

    <p style="color: #94a3b8; font-size: 12.5px; margin-top: 20px;">
      If this deletion was made in error or if you wish to re-enroll in the future, you may register a new account anytime at <a href="https://class.genziitian.in" style="color: #818cf8;">class.genziitian.in</a>.
    </p>
  `

  return sendEmail({
    to: userEmail,
    action: 'account_deleted',
    subject: 'Your GenZ IITian Account Has Been Permanently Deleted',
    html: renderEmailWrapper('Account Deleted Confirmation', bodyContent),
    metadata: {
      userName,
    },
  })
}

