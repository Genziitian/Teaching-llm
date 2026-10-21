// One entry per error page. To swap in final artwork, replace the matching
// files in /public/desk-diorama/errors/ ({kind}.svg and {kind}-dark.svg).
export const ERROR_KINDS = {
  '401': {
    eyebrow: '401 / SESSION ENDED',
    title: ['Your session', 'ended.'],
    message: 'For your safety we signed you out. Head back home and sign in again.',
  },
  '403': {
    eyebrow: '403 / RESTRICTED',
    title: ['This area is', 'restricted.'],
    message: "Your account doesn't have permission to open this page. If you think that's a mistake, we're happy to help.",
  },
  '410': {
    eyebrow: '410 / REMOVED',
    title: ["This one's been", 'taken down.'],
    message: 'The page you were looking for was removed and is not coming back.',
  },
  '429': {
    eyebrow: '429 / SLOW DOWN',
    title: ['Easy there.'],
    message: 'Too many requests in a short time. Give it a minute, then try again.',
  },
  '500': {
    eyebrow: '500 / SERVER ERROR',
    title: ['Something broke', 'on our side.'],
    message: "It isn't you. Please try again in a moment.",
  },
  '502': {
    eyebrow: '502 / UNREACHABLE',
    title: ['Taking longer', 'than usual.'],
    message: "We couldn't reach the server just now. Please try again in a moment.",
  },
  offline: {
    eyebrow: 'OFFLINE',
    title: ["You're offline."],
    message: "Check your connection. Things will pick up again once you're back online.",
  },
  'link-expired': {
    eyebrow: 'LINK EXPIRED',
    title: ['This link has', 'expired.'],
    message: 'Links stop working after a while to keep your account safe. Head home and ask for a fresh one.',
  },
} as const

export type ErrorKind = keyof typeof ERROR_KINDS

export function isErrorKind(value: string): value is ErrorKind {
  return Object.prototype.hasOwnProperty.call(ERROR_KINDS, value)
}
