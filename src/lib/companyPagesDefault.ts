/**
 * Default HTML content for /company/[slug] pages.
 * Used as fallback when no content exists in the database
 * (managers can still override via the Edit UI on the page).
 *
 * Rendered via `dangerouslySetInnerHTML` inside `.custom-page-content`
 * which styles h1/h2/p/ul/li/etc. — keep markup simple.
 */

const LAST_UPDATED = 'April 2026'

function sectionHeader(num: string, title: string): string {
  return `<h2><span style="display:inline-block; min-width:42px; color:#94a3b8; font-weight:700; letter-spacing:-0.01em;">${num}.</span> ${title}</h2>`
}

function lastUpdated(): string {
  return `<p style="color:#94a3b8; font-size:0.95em; margin-top:-8px; margin-bottom:24px;">Last Updated: ${LAST_UPDATED}</p>`
}

function contactFooter(prompt: string): string {
  return `<div style="margin-top:32px; padding:20px 24px; background:linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08)); border:1px solid rgba(99,102,241,0.18); border-radius:18px;">
    <p style="margin:0 0 6px; font-weight:700; color:#1e1e3a;">${prompt}</p>
    <p style="margin:0;"><a href="/support" style="color:#3636e8; font-weight:700; text-decoration:none;">Contact Support →</a></p>
  </div>`
}

const REFUND_POLICY = `
${lastUpdated()}

<p>At <strong>Gen-Z IITian</strong>, we aim to provide high-quality educational content and resources to our students. Because our products are digital and delivered instantly, we maintain a clear refund and cancellation policy.</p>

${sectionHeader('01', 'No Refund Policy')}
<p style="padding:14px 18px; background:#f8fafc; border-left:4px solid #3636e8; border-radius:6px; font-style:italic; color:#475569;">"All purchases are final. We do not offer refunds once a course is purchased."</p>
<p>As our products are digital educational courses and access is granted immediately upon payment, we cannot provide any refunds or returns. Once the course material is accessed, the value is considered delivered.</p>

${sectionHeader('02', 'No Cancellation Policy')}
<p style="padding:14px 18px; background:#f8fafc; border-left:4px solid #3636e8; border-radius:6px; font-style:italic; color:#475569;">"Orders cannot be cancelled once placed."</p>
<p>Due to the automated nature of our enrollment process, once a payment is successful, the order cannot be reversed or cancelled. Access is linked to your account immediately.</p>

${sectionHeader('03', 'Reason for this Policy')}
<p>We provide access to proprietary educational content, downloadable resources, and curriculum-specific study materials. Since these materials are accessible instantly to anyone after purchase, we cannot revoke access once the content has been viewed.</p>

${sectionHeader('04', 'Duplicate Payment Resolution')}
<p>In case of a technical glitch leading to a duplicate payment for the same course, users should contact our support team immediately. Upon verification, we will initiate a refund for the duplicate transaction through the original payment method. The refund process may take <strong>5–7 business days</strong> depending on the payment gateway and your bank.</p>

${contactFooter('Still have questions?')}
`.trim()

const PRIVACY_POLICY = `
<p style="color:#94a3b8; font-size:0.95em; margin-top:-8px; margin-bottom:24px;">Last updated August 25, 2026</p>

<p>This Privacy Notice for <strong>GENZ IITIAN</strong> ("we," "us," or "our"), describes how and why we might access, collect, store, use, and/or share ("process") your personal information when you use our services ("Services"), including when you:</p>
<ul>
  <li>Visit our website at <a href="https://class.genziitian.in/" target="_blank" rel="noopener noreferrer" style="color:#3636e8;">https://class.genziitian.in/</a> or any website of ours that links to this Privacy Notice</li>
  <li>Download and use our mobile application (<strong>GENZ IITIAN</strong>), or any other application of ours that links to this Privacy Notice</li>
  <li>Use <strong>GENZ IITIAN</strong> - The ultimate ecosystem for IIT Madras Online Degree students. Mastery made simple.. Gen-Z IITian was founded with a simple yet powerful vision: to make high-quality, IIT-level education accessible to everyone, regardless of their background or location. We recognized the challenges faced by online and hybrid degree students—lack of structured resources, limited mentorship, and isolation. Our platform bridges this gap by providing comprehensive courses, expert guidance, and a thriving community.</li>
  <li>Engage with us in other related ways, including any marketing or events</li>
</ul>

<p><strong>Questions or concerns?</strong> Reading this Privacy Notice will help you understand your privacy rights and choices. We are responsible for making decisions about how your personal information is processed. If you do not agree with our policies and practices, please do not use our Services. If you still have any questions or concerns, please contact us at <a href="mailto:ADMIN@GENZIITIAN.ORG" style="color:#3636e8;">ADMIN@GENZIITIAN.ORG</a> , <a href="mailto:GENZIITIAN@GMAIL.COM" style="color:#3636e8;">GENZIITIAN@GMAIL.COM</a>.</p>

<div style="margin:28px 0; padding:22px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px;">
  <h3 style="margin-top:0; color:#1e293b; font-size:1.15em;">SUMMARY OF KEY POINTS</h3>
  <p><em>This summary provides key points from our Privacy Notice, but you can find out more details about any of these topics by clicking the link following each key point or by using our table of contents below to find the section you are looking for.</em></p>
  
  <p><strong>What personal information do we process?</strong> When you visit, use, or navigate our Services, we may process personal information depending on how you interact with us and the Services, the choices you make, and the products and features you use. <a href="#section-1" style="color:#3636e8;">Learn more about personal information you disclose to us.</a></p>
  
  <p><strong>Do we process any sensitive personal information?</strong> Some of the information may be considered "special" or "sensitive" in certain jurisdictions, for example your racial or ethnic origins, sexual orientation, and religious beliefs. We do not process sensitive personal information.</p>
  
  <p><strong>Do we collect any information from third parties?</strong> We do not collect any information from third parties.</p>
  
  <p><strong>How do we process your information?</strong> We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes with your consent. We process your information only when we have a valid legal reason to do so. <a href="#section-2" style="color:#3636e8;">Learn more about how we process your information.</a></p>
  
  <p><strong>In what situations and with which parties do we share personal information?</strong> We may share information in specific situations and with specific third parties. <a href="#section-3" style="color:#3636e8;">Learn more about when and with whom we share your personal information.</a></p>
  
  <p><strong>How do we keep your information safe?</strong> We have adequate organizational and technical processes and procedures in place to protect your personal information. However, no electronic transmission over the internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information. <a href="#section-5" style="color:#3636e8;">Learn more about how we keep your information safe.</a></p>
  
  <p><strong>What are your rights?</strong> Depending on where you are located geographically, the applicable privacy law may mean you have certain rights regarding your personal information. <a href="#section-6" style="color:#3636e8;">Learn more about your privacy rights.</a></p>
  
  <p><strong>How do you exercise your rights?</strong> The easiest way to exercise your rights is by visiting USER HAVE TO VISIT SUPPORT BUILT IN APP /WEBSITE FOR THIS , or by contacting us. We will consider and act upon any request in accordance with applicable data protection laws.</p>
  
  <p style="margin-bottom:0;"><strong>Want to learn more about what we do with any information we collect?</strong> Review the Privacy Notice in full below.</p>
</div>

<div style="margin:24px 0; padding:18px 22px; background:var(--surface-2, #f1f5f9); border-radius:14px;">
  <h3 style="margin-top:0; color:#1e293b; font-size:1.05em;">TABLE OF CONTENTS</h3>
  <ol style="margin-bottom:0; padding-left:20px; line-height:1.8; font-size:0.95em;">
    <li><a href="#section-1" style="color:#3636e8; text-decoration:none;">1. WHAT INFORMATION DO WE COLLECT?</a></li>
    <li><a href="#section-2" style="color:#3636e8; text-decoration:none;">2. HOW DO WE PROCESS YOUR INFORMATION?</a></li>
    <li><a href="#section-3" style="color:#3636e8; text-decoration:none;">3. WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?</a></li>
    <li><a href="#section-4" style="color:#3636e8; text-decoration:none;">4. HOW LONG DO WE KEEP YOUR INFORMATION?</a></li>
    <li><a href="#section-5" style="color:#3636e8; text-decoration:none;">5. HOW DO WE KEEP YOUR INFORMATION SAFE?</a></li>
    <li><a href="#section-6" style="color:#3636e8; text-decoration:none;">6. WHAT ARE YOUR PRIVACY RIGHTS?</a></li>
    <li><a href="#section-7" style="color:#3636e8; text-decoration:none;">7. CONTROLS FOR DO-NOT-TRACK FEATURES</a></li>
    <li><a href="#section-8" style="color:#3636e8; text-decoration:none;">8. SERVICE DESCRIPTION</a></li>
    <li><a href="#section-9" style="color:#3636e8; text-decoration:none;">9. USER ACCOUNT &amp; SECURITY</a></li>
    <li><a href="#section-10" style="color:#3636e8; text-decoration:none;">10. COURSE &amp; MATERIAL ACCESS &amp; USAGE</a></li>
    <li><a href="#section-11" style="color:#3636e8; text-decoration:none;">11. PROHIBITED USE &amp; COPYRIGHT</a></li>
    <li><a href="#section-12" style="color:#3636e8; text-decoration:none;">12. LIMITATION OF LIABILITY</a></li>
    <li><a href="#section-13" style="color:#3636e8; text-decoration:none;">13. RETURN &amp; REFUND POLICY</a></li>
    <li><a href="#section-14" style="color:#3636e8; text-decoration:none;">14. DO WE MAKE UPDATES TO THIS NOTICE?</a></li>
    <li><a href="#section-15" style="color:#3636e8; text-decoration:none;">15. HOW CAN YOU CONTACT US ABOUT THIS NOTICE?</a></li>
    <li><a href="#section-16" style="color:#3636e8; text-decoration:none;">16. HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?</a></li>
  </ol>
</div>

<div id="section-1">${sectionHeader('01', 'WHAT INFORMATION DO WE COLLECT?')}</div>
<p><strong>Personal information you disclose to us</strong></p>
<p><em>In Short: We collect personal information that you provide to us.</em></p>
<p>We collect personal information that you voluntarily provide to us when you register on the Services, express an interest in obtaining information about us or our products and Services, when you participate in activities on the Services, or otherwise when you contact us.</p>

<p><strong>Personal Information Provided by You.</strong> The personal information that we collect depends on the context of your interactions with us and the Services, the choices you make, and the products and features you use. The personal information we collect may include the following:</p>
<ul>
  <li>names</li>
  <li>phone numbers</li>
  <li>email addresses</li>
  <li>mailing addresses</li>
  <li>usernames</li>
  <li>contact preferences</li>
  <li>contact or authentication data</li>
  <li>debit/credit card numbers</li>
  <li>education</li>
</ul>

<p><strong>Sensitive Information.</strong> We do not process sensitive information.</p>

<p><strong>Payment Data.</strong> We may collect data necessary to process your payment if you choose to make purchases, such as your payment instrument number, and the security code associated with your payment instrument. All payment data is handled and stored by <strong>RAZORPAY</strong>. You may find their privacy notice link(s) here: <a href="https://razorpay.com/privacy-policy/" target="_blank" rel="noopener noreferrer" style="color:#3636e8;">https://razorpay.com/privacy-policy/</a>.</p>

<p style="padding:10px 14px; background:rgba(99,102,241,0.08); border-radius:8px; font-weight:700; color:#3636e8;">WE USE PAYMENT IN OUR WEBSITE ONLY</p>

<p><strong>Application Data.</strong> If you use our application(s), we also may collect the following information if you choose to provide us with access or permission:</p>
<ul>
  <li><em>Mobile Device Access.</em> We may request access or permission to certain features from your mobile device, including your mobile device's storage, and other features. If you wish to change our access or permissions, you may do so in your device's settings.</li>
</ul>
<p>This information is primarily needed to maintain the security and operation of our application(s), for troubleshooting, and for our internal analytics and reporting purposes.</p>

<p>All personal information that you provide to us must be true, complete, and accurate, and you must notify us of any changes to such personal information.</p>

<p><strong>Information automatically collected</strong></p>
<p><em>In Short: Some information — such as your Internet Protocol (IP) address and/or browser and device characteristics — is collected automatically when you visit our Services.</em></p>

<p>We automatically collect certain information when you visit, use, or navigate the Services. This information does not reveal your specific identity (like your name or contact information) but may include device and usage information, such as your IP address, browser and device characteristics, operating system, language preferences, referring URLs, device name, country, location, information about how and when you use our Services, and other technical information. This information is primarily needed to maintain the security and operation of our Services, and for our internal analytics and reporting purposes.</p>

<p>The information we collect includes:</p>
<ul>
  <li><strong>Log and Usage Data.</strong> Log and usage data is service-related, diagnostic, usage, and performance information our servers automatically collect when you access or use our Services and which we record in log files. Depending on how you interact with us, this log data may include your IP address, device information, browser type, and settings and information about your activity in the Services (such as the date/time stamps associated with your usage, pages and files viewed, searches, and other actions you take such as which features you use), device event information (such as system activity, error reports (sometimes called "crash dumps"), and hardware settings).</li>
  <li><strong>Device Data.</strong> We collect device data such as information about your computer, phone, tablet, or other device you use to access the Services. Depending on the device used, this device data may include information such as your IP address (or proxy server), device and application identification numbers, location, browser type, hardware model, Internet service provider and/or mobile carrier, operating system, and system configuration information.</li>
</ul>

<p><strong>Google API</strong></p>
<p>Our use of information received from Google APIs will adhere to Google API Services User Data Policy, including the Limited Use requirements.</p>

<div id="section-2">${sectionHeader('02', 'HOW DO WE PROCESS YOUR INFORMATION?')}</div>
<p><em>In Short: We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes with your consent.</em></p>

<p>We process your personal information for a variety of reasons, depending on how you interact with our Services, including:</p>
<ul>
  <li><strong>To facilitate account creation and authentication and otherwise manage user accounts.</strong> We may process your information so you can create and log in to your account, as well as keep your account in working order.</li>
  <li><strong>To deliver and facilitate delivery of services to the user.</strong> We may process your information to provide you with the requested service.</li>
  <li><strong>To enable user-to-user communications.</strong> We may process your information if you choose to use any of our offerings that allow for communication with another user.</li>
  <li><strong>To request feedback.</strong> We may process your information when necessary to request feedback and to contact you about your use of our Services.</li>
  <li><strong>To send you marketing and promotional communications.</strong> We may process the personal information you send to us for our marketing purposes, if this is in accordance with your marketing preferences. You can opt out of our marketing emails at any time. For more information, see "WHAT ARE YOUR PRIVACY RIGHTS?" below.</li>
  <li><strong>To protect our Services.</strong> We may process your information as part of our efforts to keep our Services safe and secure, including fraud monitoring and prevention.</li>
  <li><strong>To identify usage trends.</strong> We may process information about how you use our Services to better understand how they are being used so we can improve them.</li>
  <li><strong>To comply with our legal obligations.</strong> We may process your information to comply with our legal obligations, respond to legal requests, and exercise, establish, or defend our legal rights.</li>
</ul>

<div id="section-3">${sectionHeader('03', 'WHEN AND WITH WHOM DO WE SHARE YOUR PERSONAL INFORMATION?')}</div>
<p><em>In Short: We may share information in specific situations described in this section and/or with the following third parties.</em></p>

<p><strong>Vendors, Consultants, and Other Third-Party Service Providers.</strong> We may share your data with third-party vendors, service providers, contractors, or agents ("third parties") who perform services for us or on our behalf and require access to such information to do that work.</p>

<p>The third parties we may share personal information with are as follows:</p>
<ul>
  <li><strong>Data Backup and Security:</strong> SUPERBASE</li>
  <li><strong>User Account Registration and Authentication:</strong> Google Sign-In</li>
  <li><strong>Web and Mobile Analytics:</strong> POSTHOG</li>
</ul>

<p>We also may need to share your personal information in the following situations:</p>
<ul>
  <li><strong>Business Transfers.</strong> We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.</li>
  <li><strong>Other Users.</strong> When you share personal information (for example, by posting comments, contributions, or other content to the Services) or otherwise interact with public areas of the Services, such personal information may be viewed by all users and may be publicly made available outside the Services in perpetuity. Similarly, other users will be able to view descriptions of your activity, communicate with you within our Services, and view your profile.</li>
</ul>

<div id="section-4">${sectionHeader('04', 'HOW LONG DO WE KEEP YOUR INFORMATION?')}</div>
<p><em>In Short: We keep your information for as long as necessary to fulfill the purposes outlined in this Privacy Notice unless otherwise required by law.</em></p>

<p>We will only keep your personal information for as long as it is necessary for the purposes set out in this Privacy Notice, unless a longer retention period is required or permitted by law (such as tax, accounting, or other legal requirements). No purpose in this notice will require us keeping your personal information for longer than the period of time in which users have an account with us.</p>

<p>When we have no ongoing legitimate business need to process your personal information, we will either delete or anonymize such information, or, if this is not possible (for example, because your personal information has been stored in backup archives), then we will securely store your personal information and isolate it from any further processing until deletion is possible.</p>

<div id="section-5">${sectionHeader('05', 'HOW DO WE KEEP YOUR INFORMATION SAFE?')}</div>
<p><em>In Short: We aim to protect your personal information through a system of organizational and technical security measures.</em></p>

<p>We have implemented appropriate and reasonable technical and organizational security measures designed to protect the security of any personal information we process. However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information. Although we will do our best to protect your personal information, transmission of personal information to and from our Services is at your own risk. You should only access the Services within a secure environment.</p>

<div id="section-6">${sectionHeader('06', 'WHAT ARE YOUR PRIVACY RIGHTS?')}</div>
<p><em>In Short: You may review, change, or terminate your account at any time, depending on your country, province, or state of residence.</em></p>

<p><strong>Withdrawing your consent:</strong> If we are relying on your consent to process your personal information, which may be express and/or implied consent depending on the applicable law, you have the right to withdraw your consent at any time. You can withdraw your consent at any time by contacting us by using the contact details provided in the section "HOW CAN YOU CONTACT US ABOUT THIS NOTICE?" below.</p>

<p>However, please note that this will not affect the lawfulness of the processing before its withdrawal nor, when applicable law allows, will it affect the processing of your personal information conducted in reliance on lawful processing grounds other than consent.</p>

<p><strong>Opting out of marketing and promotional communications:</strong> You can unsubscribe from our marketing and promotional communications at any time by clicking on the unsubscribe link in the emails that we send, or by contacting us using the details provided in the section "HOW CAN YOU CONTACT US ABOUT THIS NOTICE?" below. You will then be removed from the marketing lists. However, we may still communicate with you — for example, to send you service-related messages that are necessary for the administration and use of your account, to respond to service requests, or for other non-marketing purposes.</p>

<p><strong>Account Information</strong><br/>
If you would at any time like to review or change the information in your account or terminate your account, you can:</p>
<ul>
  <li>Log in to your account settings and update your user account.</li>
  <li>Contact us using the contact information provided.</li>
</ul>

<p>Upon your request to terminate your account, we will deactivate or delete your account and information from our active databases. However, we may retain some information in our files to prevent fraud, troubleshoot problems, assist with any investigations, enforce our legal terms and/or comply with applicable legal requirements.</p>

<p>If you have questions or comments about your privacy rights, you may email us at <a href="mailto:ADMIN@GENZIITIAN.ORG" style="color:#3636e8;">ADMIN@GENZIITIAN.ORG</a> , <a href="mailto:GENZIITIAN@GMAIL.COM" style="color:#3636e8;">GENZIITIAN@GMAIL.COM</a>.</p>

<div id="section-7">${sectionHeader('07', 'CONTROLS FOR DO-NOT-TRACK FEATURES')}</div>
<p>Most web browsers and some mobile operating systems and mobile applications include a Do-Not-Track ("DNT") feature or setting you can activate to signal your privacy preference not to have data about your online browsing activities monitored and collected. At this stage, no uniform technology standard for recognizing and implementing DNT signals has been finalized. As such, we do not currently respond to DNT browser signals or any other mechanism that automatically communicates your choice not to be tracked online. If a standard for online tracking is adopted that we must follow in the future, we will inform you about that practice in a revised version of this Privacy Notice.</p>

<div id="section-8">${sectionHeader('08', 'SERVICE DESCRIPTION')}</div>
<p>Gen-Z IITian provides access to premium digital educational courses designed specifically for students. Our services are delivered entirely online. Access to the courses is granted immediately upon successful completion of the payment process.</p>

<div id="section-9">${sectionHeader('09', 'USER ACCOUNT &amp; SECURITY')}</div>
<p>To access our courses, users must sign in via their Google account. You are solely responsible for maintaining the confidentiality of your account information and for all activities that occur under your account. We reserve the right to terminate accounts that violate our security protocols.</p>

<div id="section-10">${sectionHeader('10', 'COURSE &amp; MATERIAL ACCESS &amp; USAGE')}</div>
<p>Access is granted exclusively to the email address used during the purchase. Course/MATERIAL access is non-transferable and intended for personal use only. Sharing account credentials or course content with third parties is strictly prohibited.</p>

<div id="section-11">${sectionHeader('11', 'PROHIBITED USE &amp; COPYRIGHT')}</div>
<p>All content on this platform, including videos, documents, and code samples, is the intellectual property of Gen-Z IITian. Any form of piracy, unauthorized redistribution, or commercial use of our content will result in legal action and immediate termination of access without notice.</p>

<div id="section-12">${sectionHeader('12', 'LIMITATION OF LIABILITY')}</div>
<p>Gen-Z IITian is an educational platform. While we strive for excellence, we do not guarantee specific academic results or career outcomes. The platform is not responsible for any misuse of the information provided or for any technical issues arising from the user's internet connection or device.</p>

<div id="section-13">${sectionHeader('13', 'RETURN &amp; REFUND POLICY')}</div>
<p>At GenZ IITian, we provide 100% digital educational services in the form of online courses. There is no physical product, shipment, or delivery involved. Due to the nature of digital content, all purchases are final. We do not offer refunds, returns, or exchanges under any circumstances once a course has been purchased. We strongly recommend reviewing course details before making a purchase. In case of any technical issues, payment errors, or access-related problems, you can contact our support team. We will ensure that you receive proper access to your purchased course. We reserve the right to update or modify this policy at any time without prior notice. Changes will be effective immediately upon posting.</p>

<div id="section-14">${sectionHeader('14', 'DO WE MAKE UPDATES TO THIS NOTICE?')}</div>
<p><em>In Short: Yes, we will update this notice as necessary to stay compliant with relevant laws.</em></p>

<p>We may update this Privacy Notice from time to time. The updated version will be indicated by an updated "Revised" date at the top of this Privacy Notice. If we make material changes to this Privacy Notice, we may notify you either by prominently posting a notice of such changes or by directly sending you a notification. We encourage you to review this Privacy Notice frequently to be informed of how we are protecting your information.</p>

<div id="section-15">${sectionHeader('15', 'HOW CAN YOU CONTACT US ABOUT THIS NOTICE?')}</div>
<p>If you have questions or comments about this notice, you may email us at <a href="mailto:ADMIN@GENZIITIAN.ORG" style="color:#3636e8;">ADMIN@GENZIITIAN.ORG</a> or contact us by post at:</p>
<p style="padding:14px 18px; background:#f8fafc; border-radius:10px; line-height:1.6;">
  <strong>GENZ IITIAN</strong><br/>
  BIHAR , INDIA<br/>
  PATNA, BIHAR 800001<br/>
  India
</p>

<div id="section-16">${sectionHeader('16', 'HOW CAN YOU REVIEW, UPDATE, OR DELETE THE DATA WE COLLECT FROM YOU?')}</div>
<p>You have the right to request access to the personal information we collect from you, details about how we have processed it, correct inaccuracies, or delete your personal information. You may also have the right to withdraw your consent to our processing of your personal information. These rights may be limited in some circumstances by applicable law. To request to review, update, or delete your personal information, please visit: <strong>USER HAVE TO VISIT SUPPORT BUILT IN APP /WEBSITE FOR THIS .</strong></p>

${contactFooter('Have questions or need assistance?')}
`.trim()

const TERMS_AND_CONDITIONS = `
${lastUpdated()}

${sectionHeader('01', 'Service Description')}
<p><strong>Gen-Z IITian</strong> provides access to premium digital educational courses designed specifically for students. Our services are delivered entirely online. Access to the courses is granted immediately upon successful completion of the payment process.</p>

${sectionHeader('02', 'User Account &amp; Security')}
<p>To access our courses, users must sign in via their Google account. You are solely responsible for maintaining the confidentiality of your account information and for all activities that occur under your account. We reserve the right to terminate accounts that violate our security protocols.</p>

${sectionHeader('03', 'Course Access &amp; Usage')}
<ul>
  <li>Access is granted exclusively to the email address used during the purchase.</li>
  <li>Course access is non-transferable and intended for personal use only.</li>
  <li>Sharing account credentials or course content with third parties is strictly prohibited.</li>
</ul>

${sectionHeader('04', 'Payment Terms')}
<p>All prices are clearly displayed before the final checkout. By proceeding with the payment, you agree to the price and terms of the specific course. All payments are processed through secure third-party payment gateways (Razorpay, Stripe, or Cashfree).</p>

${sectionHeader('05', 'Prohibited Use &amp; Copyright')}
<p>All content on this platform — including videos, documents, and code samples — is the intellectual property of Gen-Z IITian. Any form of <strong>piracy, unauthorized redistribution, or commercial use</strong> of our content will result in legal action and immediate termination of access without notice.</p>

${sectionHeader('06', 'Limitation of Liability')}
<p>Gen-Z IITian is an educational platform. While we strive for excellence, we do not guarantee specific academic results or career outcomes. The platform is not responsible for any misuse of the information provided or for any technical issues arising from the user's internet connection or device.</p>

${contactFooter('Questions about our Terms?')}
`.trim()

const ABOUT_US = `
${lastUpdated()}

<p>Welcome to <strong>Gen-Z IITian</strong> — a learning platform built by IIT alumni for the next generation of IIT aspirants. Our mission is simple: make high-quality, no-fluff exam preparation accessible, affordable, and effective for every serious student.</p>

${sectionHeader('01', 'Who We Are')}
<p>We are a team of IIT graduates, full-time educators, and engineers who understand both the demands of competitive exams and how today's students learn. We started Gen-Z IITian to bridge the gap between expensive coaching and self-study with a single, focused offering — disciplined live batches paired with on-demand lecture recordings, premium notes, and PYQs.</p>

${sectionHeader('02', 'What We Offer')}
<ul>
  <li><strong>Qualifier Batches</strong> — complete syllabus coverage with daily live classes, doubt sessions, and unlimited re-attempt support.</li>
  <li><strong>Term Courses (Live + Recorded)</strong> — structured Term 1, Term 2, and Diploma tracks aligned with the IITM BS curriculum.</li>
  <li><strong>Foundation Courses</strong> — for students building core concepts from the ground up.</li>
  <li><strong>Premium Notes, PYQs &amp; Formula Sheets</strong> — concise, exam-ready resources curated by top scorers.</li>
  <li><strong>Mentorship</strong> — book 1:1 sessions with IIT mentors for strategy, doubt resolution, and study plans.</li>
</ul>

${sectionHeader('03', 'Our Approach')}
<p>We believe the best learning happens when content is <strong>structured, interactive, and revisitable</strong>. Every live class is recorded and indexed, every concept is paired with practice problems, and every student gets dedicated support channels — community chat, ticketed help, and live mentorship — so no doubt goes unanswered.</p>

${sectionHeader('04', 'Why Students Choose Us')}
<ul>
  <li>Taught by educators who have cleared the same exams they teach.</li>
  <li>Transparent pricing — no hidden fees, no upsells inside the classroom.</li>
  <li>Lifetime access to recordings within the validity of your enrollment.</li>
  <li>Active student community with peer support and instructor presence.</li>
  <li>Designed for serious learners — not entertainment, just outcomes.</li>
</ul>

${sectionHeader('05', 'Get in Touch')}
<p>Have a question, suggestion, or partnership idea? We'd love to hear from you. Reach out through our support channel and a real team member will get back to you within one business day.</p>

${contactFooter('Want to talk to us?')}
`.trim()

export const COMPANY_PAGE_DEFAULTS: Record<string, string> = {
  'refund-policy': REFUND_POLICY,
  'privacy-policy': PRIVACY_POLICY,
  'terms-and-conditions': TERMS_AND_CONDITIONS,
  'about-us': ABOUT_US,
}

export function getDefaultCompanyContent(slug: string): string {
  return COMPANY_PAGE_DEFAULTS[slug] || ''
}
