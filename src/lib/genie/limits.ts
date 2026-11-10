// Genie live-chat limits (single source of truth for client + server)
export { GENIE_MAX_MESSAGE } from './tree'

export const WAIT_FALLBACK_MS = 5 * 60 * 1000      // no manager joins -> becomes a ticket
export const QUIET_AGENT_MS = 10 * 60 * 1000       // agent silent while student waits -> ticket
export const SEND_GAP_MS = 2000                    // 1 message per 2 s
export const MAX_REQUESTS_PER_DAY = 5              // agent requests per student per day
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024     // 5 MB, images only
export const POLL_MS = 3000
