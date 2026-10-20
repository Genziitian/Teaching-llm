/** Where a payment was made. Google Play order ids look like "GPA.1234-5678-9012-34567". */
export type PaymentSource = 'GOOGLE_PLAY' | 'RAZORPAY'

export function paymentSource(...ids: (string | null | undefined)[]): PaymentSource {
  for (const id of ids) {
    if (id && (id.startsWith('GPA.') || id.startsWith('play_'))) return 'GOOGLE_PLAY'
  }
  return 'RAZORPAY'
}
