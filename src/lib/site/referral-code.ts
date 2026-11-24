// Referral code rules shared by the landing client and the class genz server routes.
// Pure module (no browser or server APIs) so both sides can import it.

const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Generate a personalized 5-character referral code: up to 2 name initials + random A-Z/0-9. */
export function generateReferralCode(email: string, name?: string): string {
  // Extract up to 2 initials from the name (letters only)
  let initials = '';
  if (name) {
    const parts = name.trim().split(/\s+/);
    initials += (parts[0]?.[0] || '').replace(/[^A-Za-z]/g, '').toUpperCase();
    if (parts.length > 1) {
      initials += (parts[parts.length - 1]?.[0] || '').replace(/[^A-Za-z]/g, '').toUpperCase();
    }
  }

  // If no initials extracted, fallback to first letter of email
  if (!initials && email) {
    initials = email[0]?.replace(/[^A-Za-z]/g, '').toUpperCase() || 'X';
  }

  // Ensure initials is max 2 chars
  initials = initials.substring(0, 2);

  // Fill the rest (up to 5 total characters) with uppercase letters and numbers
  const requiredRandomChars = 5 - initials.length;
  let randomPart = '';
  for (let i = 0; i < requiredRandomChars; i++) {
    randomPart += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }

  return `${initials}${randomPart}`;
}

/** Collision suffix used by the storefront: 2 extra random uppercase base-36 characters. */
export function referralCodeCollisionSuffix(): string {
  return Math.random().toString(36).slice(2, 4).toUpperCase().padEnd(2, 'X');
}
