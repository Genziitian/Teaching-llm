export const TERMS_AND_CONDITIONS_TEXT = "Terms & Conditions\n\nLast Updated: April 2026\n\n01 Service Description\n\nGen-Z IITian provides access to premium digital educational courses designed specifically for students. Our services are delivered entirely online. Access to the courses is granted immediately upon successful completion of the payment process.\n\n02 User Account & Security\n\nTo access our courses, users must sign in via their Google account. You are solely responsible for maintaining the confidentiality of your account information and for all activities that occur under your account. We reserve the right to terminate accounts that violate our security protocols.\n\n03 Course Access & Usage\n\n- Access is granted exclusively to the email address used during the purchase.\n- Course access is non-transferable and intended for personal use only.\n- Sharing account credentials or course content with third parties is strictly prohibited.\n\n04 Payment Terms\n\nAll prices are clearly displayed before the final checkout. By proceeding with the payment, you agree to the price and terms of the specific course. All payments are processed through secure third-party payment gateways (Razorpay, Stripe, or Cashfree).\n\n05 Prohibited Use & Copyright\n\nAll content on this platform, including videos, documents, and code samples, is the intellectual property of Gen-Z IITian. Any form of piracy, unauthorized redistribution, or commercial use of our content will result in legal action and immediate termination of access without notice.\n\n06 Limitation of Liability\n\nGen-Z IITian is an educational platform. While we strive for excellence, we do not guarantee specific academic results or career outcomes. The platform is not responsible for any misuse of the information provided or for any technical issues arising from the user's internet connection or device.\n\nQuestions about our Terms?\n\nContact Support"

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
  if (/^0[1-6] /.test(block)) {
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
