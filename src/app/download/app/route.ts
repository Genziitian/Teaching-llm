import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const userAgent = request.headers.get('user-agent') || ''
  const host = request.headers.get('host') || 'class.genziitian.in'
  
  // Standard protocol detection
  let protocol = 'https'
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    protocol = 'http'
  }
  const baseUrl = `${protocol}://${host}`

  const isAndroid = /android/i.test(userAgent)
  const isIOS = /iPad|iPhone|iPod/.test(userAgent)

  if (isAndroid) {
    // Redirect directly to official Google Play Store listing
    return NextResponse.redirect('https://play.google.com/store/apps/details?id=com.teaching.lms')
  } else if (isIOS) {
    return NextResponse.redirect(`${baseUrl}/download?device=ios`)
  } else {
    return NextResponse.redirect(`${baseUrl}/download?device=desktop`)
  }
}
