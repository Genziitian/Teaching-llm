/** Fixed capacity for notification Google Group pools (not course groups). */
export const NOTIFICATION_MEMBERS_PER_GROUP = 700

export function serialToPoolIndex(serial: number, membersPerGroup = NOTIFICATION_MEMBERS_PER_GROUP): number {
  return Math.floor((Math.max(1, serial) - 1) / membersPerGroup)
}

export function poolIndexToSerialRange(
  poolIndex: number,
  totalUsers: number,
  membersPerGroup = NOTIFICATION_MEMBERS_PER_GROUP
): { serialFrom: number; serialTo: number } {
  const serialFrom = poolIndex * membersPerGroup + 1
  const serialTo = Math.min((poolIndex + 1) * membersPerGroup, totalUsers)
  return { serialFrom, serialTo }
}
