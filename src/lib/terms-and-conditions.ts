export const TERMS_AND_CONDITIONS_TEXT = "Terms & Conditions\n\nLast Updated: October 2026\n\n01 Service Description\n\nGen-Z IITian provides access to premium digital educational courses designed specifically for students. Our services are delivered entirely online. Access to the courses is granted immediately upon successful completion of the payment process.\n\n02 User Account & Security\n\nTo access our courses, users must sign in via their Google account. You are solely responsible for maintaining the confidentiality of your account information and for all activities that occur under your account. We reserve the right to terminate accounts that violate our security protocols.\n\n03 Course Access & Usage\n\n- Access is granted exclusively to the email address used during the purchase.\n- Course access is non-transferable and intended for personal use only.\n- Sharing account credentials or course content with third parties is strictly prohibited.\n\n04 Payment Terms\n\nAll prices are clearly displayed before the final checkout. By proceeding with the payment, you agree to the price and terms of the specific course. All payments are processed through secure third-party payment gateways (Razorpay, Stripe, or Cashfree).\n\n04.1 Google Play In-App Purchases (Android App)\n\nFor digital educational goods, study notes, and materials purchased within the Android mobile application, transactions are processed exclusively through Google Play In-App Billing in compliance with Google Play Developer Policies. By initiating an in-app purchase, you agree to Google Play's Terms of Service and payment terms.\n\n- Pricing & Currency: All prices are clearly stated in Indian Rupees (₹) or your local currency as configured in Google Play prior to confirmation.\n- Digital Delivery & Validity: Digital study materials and notes are delivered immediately upon confirmation of payment. Access is valid for the specified period (e.g., 90 days from the purchase date), after which access expires unless restored or repurchased.\n- Cross-Platform Synchronization: Digital notes purchased via Google Play Billing in the mobile app are automatically linked to your authenticated user account and are accessible across both the mobile application and the web platform.\n- Repurchase & Restoration: Note purchases are one-time consumable digital items. If your access period expires, you may repurchase the material to renew access for an additional validity period.\n\n04.2 Course & Bundle Purchases (Website and App)\n\n- Website: course and bundle payments are processed by Razorpay and may use valid coupon codes.\n- Android app: course and bundle payments are processed only through Google Play In-App Billing at fixed prices. Coupon codes do not apply inside the app, and the price shown at checkout is the final price.\n- Access: after a successful payment the enrolled courses appear in your Courses tab on both the app and the website. Access is valid until the end of the term unless the course page says otherwise.\n- Plans: a course or bundle may be offered as Recorded, Live Pro or Champion. The plan you choose applies to all courses in that purchase. Fixed bundles must be bought as a complete package.\n- Purchase records: every purchase is saved in your Purchase History and Transactions along with the payment source (Google Play or Razorpay).\n\n04.3 Champion Batch\n\nChampion includes everything in Live Pro plus extra promises. If you meet all of the conditions below and still do not qualify, you are eligible for a refund of the extra amount paid for Champion, which is the Champion price minus the Live Pro price (example: ₹1499 − ₹999 = ₹500), or free reattempt support. The Live Pro price is not refunded.\n\n- Attend at least 80% of live classes.\n- Score the minimum required marks in the weekly tests.\n- Regularly share your GA marks and progress with the team, and be eligible to give the Qualifier exam offline.\n\n04.4 Acceptance Record\n\nWhen you accept an update to these policies, we record the date, time and platform (website or app) in your account's activity log as proof of your agreement.\n\n05 Prohibited Use & Copyright\n\nAll content on this platform, including videos, documents, and code samples, is the intellectual property of Gen-Z IITian. Any form of piracy, unauthorized redistribution, or commercial use of our content will result in legal action and immediate termination of access without notice.\n\n06 Limitation of Liability\n\nGen-Z IITian is an educational platform. While we strive for excellence, we do not guarantee specific academic results or career outcomes. The platform is not responsible for any misuse of the information provided or for any technical issues arising from the user's internet connection or device.\n\nQuestions about our Terms?\n\nContact Support"

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const termsBlocks = TERMS_AND_CONDITIONS_TEXT.split('\n\n').map(block => {
  const safe = escapeHtml(block)
  if (block === 'Terms & Conditions') {
    return `<h2 style="font-size:1.25em; margin:0 0 12px; color:inherit;">${safe}</h2>`
  }
  if (block.startsWith('Last Updated:')) {
    return `<p style="font-size:0.9em; margin:0 0 18px; color:inherit;">${safe}</p>`
  }
  if (/^0\d(\.\d+)? /.test(block)) {
    return `<h3 style="font-size:1.05em; margin:18px 0 8px; color:inherit;">${safe}</h3>`
  }
  if (block.startsWith('- ')) {
    const items = block.split('\n').map(item => `<li>${escapeHtml(item.slice(2))}</li>`).join('')
    return `<ul style="margin:0 0 14px; padding-left:22px;">${items}</ul>`
  }
  if (block === 'Questions about our Terms?') {
    return `<p style="font-weight:700; margin:18px 0 8px;">${safe}</p>`
  }
  if (block === 'Contact Support') {
    return `<p style="margin:0;"><a href="https://genziitian.in/contact" target="_blank" rel="noopener noreferrer">${safe}</a></p>`
  }
  return `<p style="margin:0 0 14px;">${safe}</p>`
})

export const TERMS_AND_CONDITIONS_HTML = `<div>${termsBlocks.join('')}</div>`
