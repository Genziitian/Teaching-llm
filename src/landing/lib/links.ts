// Where the class dashboard lives. Same variable the enrolment code uses, so changing the domain is one setting.
export const CLASS_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || 'https://class.genziitian.in').replace(/\/+$/, '');
// Host only (no https://), for text like "Visit class.genziitian.in".
export const CLASS_HOST = CLASS_URL.replace(/^https?:\/\//, '');
