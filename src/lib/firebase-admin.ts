import admin from 'firebase-admin'

/**
 * Initialise Firebase Admin SDK (singleton).
 * Uses environment variables so no JSON key file is needed in the repo.
 */
function getFirebaseAdmin(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  let privateKey = process.env.FIREBASE_PRIVATE_KEY
  if (privateKey) {
    privateKey = privateKey.trim()
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.slice(1, -1)
    }
    privateKey = privateKey.replace(/\\n/g, '\n')
  }

  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      'Firebase Admin SDK credentials not configured — FCM push notifications disabled. ' +
      'Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in your environment.'
    )
    return null as any
  }

  try {
    return admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    })
  } catch (err) {
    console.warn('Failed to initialize Firebase Admin SDK (invalid private key format):', err)
    return null as any
  }
}

export const firebaseAdmin = getFirebaseAdmin()
