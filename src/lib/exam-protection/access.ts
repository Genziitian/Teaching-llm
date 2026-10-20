// Website rollout: Exam Protection is shown on the web only to managers and these student accounts.
// The phone app is unaffected (all students see it there).
export const WEB_PROTECTION_PREVIEW_EMAILS = ['pay.laxmikant@gmail.com'];
export const canSeeProtectionOnWeb = (role?: string | null, email?: string | null) =>
    role === 'MANAGER' || (role === 'STUDENT' && !!email && WEB_PROTECTION_PREVIEW_EMAILS.includes(email.trim().toLowerCase()));
