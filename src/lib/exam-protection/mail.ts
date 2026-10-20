// Email hook for Exam Protection. Not wired to any mail provider yet: a dedicated
// sender will be configured later. Keep the call sites; implement delivery here only.
export type ClaimWindowMail = { to: string; name: string; courseName: string; closesAt: Date };
export async function sendClaimWindowOpenedEmails(messages: ClaimWindowMail[]): Promise<{ sent: number; skipped: number }> {
    // TODO: connect the new protection mail sender here.
    return { sent: 0, skipped: messages.length };
}
