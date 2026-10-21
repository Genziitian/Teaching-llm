/** Client helpers: record checkout attempts so managers can follow up. Never throws. */
export type AttemptStatus = 'STARTED' | 'FAILED' | 'CANCELLED' | 'PENDING_VERIFY' | 'SUCCESS'

export async function startAttempt(input: {
  kind: string
  itemName: string
  amount?: number
  orderRef?: string
}): Promise<string | null> {
  try {
    const res = await fetch('/api/payment-attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input, platform: 'WEB', gateway: 'RAZORPAY', status: 'STARTED' }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.attempt?.id ?? null
  } catch {
    return null
  }
}

export async function finishAttempt(
  id: string | null,
  patch: { status: AttemptStatus; reason?: string; orderRef?: string; paymentRef?: string }
) {
  if (!id) return
  try {
    await fetch('/api/payment-attempts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    })
  } catch {
    /* logging must never break a payment */
  }
}
