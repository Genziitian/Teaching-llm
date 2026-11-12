import Razorpay from 'razorpay'

// New env names so the class app's own Razorpay account is never mixed up with the storefront's.
export const getStorefrontRazorpay = () => {
  const keyId = process.env.STOREFRONT_RAZORPAY_KEY_ID?.trim()
  const keySecret = process.env.STOREFRONT_RAZORPAY_KEY_SECRET?.trim()

  if (!keyId || !keySecret) {
    throw new Error('Server configuration error (missing Razorpay keys)')
  }

  return new Razorpay({ key_id: keyId, key_secret: keySecret })
}

export const getStorefrontRazorpaySecret = () => {
  const secret = process.env.STOREFRONT_RAZORPAY_KEY_SECRET?.trim()
  if (!secret) {
    throw new Error('Server configuration error (missing Razorpay secret)')
  }
  return secret
}
