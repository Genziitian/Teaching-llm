import { google } from 'googleapis'
import * as fs from 'fs'
import * as path from 'path'

const PACKAGE_NAME = 'com.teaching.lms'

function getGooglePlayAuth() {
  // 1. Raw JSON string in env var
  if (process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON)
      return new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/androidpublisher'],
      })
    } catch (e) {
      console.error('Failed to parse GOOGLE_PLAY_SERVICE_ACCOUNT_JSON:', e)
    }
  }

  // 2. Separate email + private key
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    return new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/androidpublisher'],
    })
  }

  // 3. Local file google-play-service-account.json
  const localPaths = [
    path.join(process.cwd(), 'google-play-service-account.json'),
    path.join(process.cwd(), 'service-account.json'),
  ]
  for (const p of localPaths) {
    if (fs.existsSync(p)) {
      return new google.auth.GoogleAuth({
        keyFile: p,
        scopes: ['https://www.googleapis.com/auth/androidpublisher'],
      })
    }
  }

  return null
}

export async function verifyPlayPurchase({
  productId,
  token,
  packageName = PACKAGE_NAME,
}: {
  productId: string
  token: string
  packageName?: string
}) {
  const auth = getGooglePlayAuth()
  if (!auth) {
    throw new Error(
      'Google Play service account credentials not configured. ' +
        'Set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON in environment variables or add google-play-service-account.json.'
    )
  }

  const androidPublisher = google.androidpublisher({ version: 'v3', auth })

  const res = await androidPublisher.purchases.products.get({
    packageName,
    productId,
    token,
  })

  return res.data
}
