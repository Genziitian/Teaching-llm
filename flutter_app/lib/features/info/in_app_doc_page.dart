import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/bouncy_pressable.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_shadows.dart';
import '../../theme/app_theme_tokens.dart';

enum DocType {
  aboutUs,
  privacyPolicy,
  termsAndConditions,
  refundPolicy,
  copyrightPolicy,
  contactUs,
}

/// GET /api/company-pages/[slug] → fetches manager-customized content if any.
final companyPageContentProvider =
    FutureProvider.family<String?, String>((ref, slug) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.get<Map<String, dynamic>>('/api/company-pages/$slug');
    final content = res.data?['content'] as String?;
    return (content != null && content.trim().isNotEmpty) ? content : null;
  } catch (_) {
    return null;
  }
});

class InAppDocPage extends ConsumerWidget {
  const InAppDocPage({super.key, required this.docType});

  final DocType docType;

  String get _slug {
    switch (docType) {
      case DocType.aboutUs:
        return 'about-us';
      case DocType.privacyPolicy:
        return 'privacy-policy';
      case DocType.termsAndConditions:
        return 'terms-and-conditions';
      case DocType.refundPolicy:
        return 'refund-policy';
      case DocType.copyrightPolicy:
        return 'copyright-policy';
      case DocType.contactUs:
        return 'contact-us';
    }
  }

  String get _title {
    switch (docType) {
      case DocType.aboutUs:
        return 'About Us';
      case DocType.privacyPolicy:
        return 'Privacy Policy';
      case DocType.termsAndConditions:
        return 'Terms & Conditions';
      case DocType.refundPolicy:
        return 'Return & Refund Policy';
      case DocType.copyrightPolicy:
        return 'Copyright Policy';
      case DocType.contactUs:
        return 'Contact Us';
    }
  }

  String get _subtitle {
    switch (docType) {
      case DocType.aboutUs:
        return 'Learn more about GenZ IITian and our team';
      case DocType.privacyPolicy:
        return 'How we respect and protect your data';
      case DocType.termsAndConditions:
        return 'Last Updated: April 2026';
      case DocType.refundPolicy:
        return 'Policy regarding online course purchases';
      case DocType.copyrightPolicy:
        return 'Intellectual property & content rights';
      case DocType.contactUs:
        return 'Get in touch with the GenZ IITian team';
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tokens = context.tokens;
    final cardBg = tokens.cardBg;
    final borderColor = tokens.border;

    return Scaffold(
      backgroundColor: tokens.bg,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SubPageHeader(
              title: _title,
              subtitle: _subtitle,
              showBack: true,
              onBack: () {
                if (context.canPop()) {
                  context.pop();
                } else {
                  final isSignedIn = ref.read(authStateProvider).value != null;
                  context.go(isSignedIn ? '/more' : '/login');
                }
              },
            ),
            Expanded(
              child: ListView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(0, 16, 0, 80),
                children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Container(
                padding: const EdgeInsets.all(22),
                decoration: BoxDecoration(
                  color: cardBg,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: borderColor),
                  boxShadow: AppShadows.sm,
                ),
                child: _buildDocContent(context),
              ),
            ),
            if (docType == DocType.aboutUs) ...[
              const SizedBox(height: 20),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Policies & Guidelines',
                      style: TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w800,
                        color: tokens.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 10),
                    _PolicyLinkTile(
                      icon: Icons.shield_outlined,
                      title: 'Privacy Policy',
                      subtitle: 'Data protection and usage guidelines',
                      onTap: () => context.push('/privacy-policy'),
                    ),
                    const SizedBox(height: 8),
                    _PolicyLinkTile(
                      icon: Icons.replay_outlined,
                      title: 'Return & Refund Policy',
                      subtitle: '100% digital content terms',
                      onTap: () => context.push('/refund-policy'),
                    ),
                    const SizedBox(height: 8),
                    _PolicyLinkTile(
                      icon: Icons.copyright_rounded,
                      title: 'Copyright Policy',
                      subtitle: 'Ownership and IP rights',
                      onTap: () => context.push('/copyright-policy'),
                    ),
                    const SizedBox(height: 8),
                    _PolicyLinkTile(
                      icon: Icons.gavel_outlined,
                      title: 'Terms & Conditions',
                      subtitle: 'User license & platform rules',
                      onTap: () => context.push('/terms-and-conditions'),
                    ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    ),
  ),
);
}

  Widget _buildDocContent(BuildContext context) {
    switch (docType) {
      case DocType.aboutUs:
        return const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Paragraph(
              'GenZ IITian was built on a clear idea: make IIT-level education accessible to anyone, anywhere.',
            ),
            SizedBox(height: 16),
            _Paragraph(
              'We saw a real problem online and hybrid degree students often struggle with unstructured learning, lack of mentorship, and isolation. So we built a platform that fixes that. Structured courses, practical guidance, and a community that actually supports you.',
            ),
            SizedBox(height: 16),
            _Paragraph(
              'We’re not a big institution. We’re students ourselves figuring things out, improving every day, and building something we wish existed earlier.',
            ),
            SizedBox(height: 16),
            _Paragraph(
              'This isn’t perfect. But it’s real, and it’s getting better.',
            ),
            SizedBox(height: 16),
            _Paragraph(
              'We hope this effort adds real value to your learning journey.',
            ),
            SizedBox(height: 24),
            Text(
              'Team',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: Color(0xFF94A3B8),
              ),
            ),
            SizedBox(height: 2),
            Text(
              'GenZ IITian',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
          ],
        );

      case DocType.privacyPolicy:
        return const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Last updated August 25, 2026',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF94A3B8),
              ),
            ),
            SizedBox(height: 14),
            _Paragraph(
              'This Privacy Notice for GENZ IITIAN ("we," "us," or "our"), describes how and why we might access, collect, store, use, and/or share ("process") your personal information when you use our services ("Services"), including when you:\n'
              '• Visit our website at https://class.genziitian.in/ or any website of ours that links to this Privacy Notice\n'
              '• Download and use our mobile application (GENZ IITIAN), or any other application of ours that links to this Privacy Notice\n'
              '• Use GENZ IITIAN- The ultimate ecosystem for IIT Madras Online Degree students. Mastery made simple.. Gen-Z IITian was founded with a simple yet powerful vision: to make high-quality, IIT-level education accessible to everyone, regardless of their background or location. We recognized the challenges faced by online and hybrid degree students—lack of structured resources, limited mentorship, and isolation. Our platform bridges this gap by providing comprehensive courses, expert guidance, and a thriving community.\n'
              '• Engage with us in other related ways, including any marketing or events',
            ),
            SizedBox(height: 12),
            _Paragraph(
              'Questions or concerns? Reading this Privacy Notice will help you understand your privacy rights and choices. We are responsible for making decisions about how your personal information is processed. If you do not agree with our policies and practices, please do not use our Services. If you still have any questions or concerns, please contact us at ADMIN@GENZIITIAN.ORG , GENZIITIAN@GMAIL.COM.',
            ),
            SizedBox(height: 20),

            _SectionHeader(num: '00', title: 'Summary of Key Points'),
            SizedBox(height: 8),
            _Paragraph(
              'This summary provides key points from our Privacy Notice, but you can find out more details about any of these topics in the sections below.\n\n'
              '• What personal information do we process? When you visit, use, or navigate our Services, we may process personal information depending on how you interact with us and the Services, the choices you make, and the products and features you use.\n'
              '• Do we process any sensitive personal information? Some of the information may be considered "special" or "sensitive" in certain jurisdictions, for example your racial or ethnic origins, sexual orientation, and religious beliefs. We do not process sensitive personal information.\n'
              '• Do we collect any information from third parties? We do not collect any information from third parties.\n'
              '• How do we process your information? We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes with your consent. We process your information only when we have a valid legal reason to do so.\n'
              '• In what situations and with which parties do we share personal information? We may share information in specific situations and with specific third parties.\n'
              '• How do we keep your information safe? We have adequate organizational and technical processes and procedures in place to protect your personal information. However, no electronic transmission over the internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information.\n'
              '• What are your rights? Depending on where you are located geographically, the applicable privacy law may mean you have certain rights regarding your personal information.\n'
              '• How do you exercise your rights? The easiest way to exercise your rights is by visiting USER HAVE TO VISIT SUPPORT BUILT IN APP /WEBSITE FOR THIS , or by contacting us. We will consider and act upon any request in accordance with applicable data protection laws.',
            ),
            SizedBox(height: 20),

            _SectionHeader(num: '01', title: 'What Information Do We Collect?'),
            SizedBox(height: 8),
            _Paragraph(
              'Personal information you disclose to us\n'
              'In Short: We collect personal information that you provide to us.\n\n'
              'We collect personal information that you voluntarily provide to us when you register on the Services, express an interest in obtaining information about us or our products and Services, when you participate in activities on the Services, or otherwise when you contact us.\n\n'
              'Personal Information Provided by You. The personal information that we collect depends on the context of your interactions with us and the Services, the choices you make, and the products and features you use. The personal information we collect may include the following:\n'
              '• names\n'
              '• phone numbers\n'
              '• email addresses\n'
              '• mailing addresses\n'
              '• usernames\n'
              '• contact preferences\n'
              '• contact or authentication data\n'
              '• debit/credit card numbers\n'
              '• education\n\n'
              'Sensitive Information. We do not process sensitive information.\n\n'
              'Payment Data. We may collect data necessary to process your payment if you choose to make purchases, such as your payment instrument number, and the security code associated with your payment instrument. All payment data is handled and stored by RAZORPAY. You may find their privacy notice link(s) here: https://razorpay.com/privacy-policy/.\n\n'
              'WE USE PAYMENT IN OUR WEBSITE ONLY\n\n'
              'Application Data. If you use our application(s), we also may collect the following information if you choose to provide us with access or permission:\n'
              '• Mobile Device Access. We may request access or permission to certain features from your mobile device, including your mobile device\'s storage, and other features. If you wish to change our access or permissions, you may do so in your device\'s settings.\n\n'
              'This information is primarily needed to maintain the security and operation of our application(s), for troubleshooting, and for our internal analytics and reporting purposes.\n\n'
              'All personal information that you provide to us must be true, complete, and accurate, and you must notify us of any changes to such personal information.\n\n'
              'Information automatically collected\n'
              'In Short: Some information — such as your Internet Protocol (IP) address and/or browser and device characteristics — is collected automatically when you visit our Services.\n\n'
              'We automatically collect certain information when you visit, use, or navigate the Services. This information does not reveal your specific identity (like your name or contact information) but may include device and usage information, such as your IP address, browser and device characteristics, operating system, language preferences, referring URLs, device name, country, location, information about how and when you use our Services, and other technical information. This information is primarily needed to maintain the security and operation of our Services, and for our internal analytics and reporting purposes.\n\n'
              'The information we collect includes:\n'
              '• Log and Usage Data. Log and usage data is service-related, diagnostic, usage, and performance information our servers automatically collect when you access or use our Services and which we record in log files. Depending on how you interact with us, this log data may include your IP address, device information, browser type, and settings and information about your activity in the Services (such as the date/time stamps associated with your usage, pages and files viewed, searches, and other actions you take such as which features you use), device event information (such as system activity, error reports (sometimes called "crash dumps"), and hardware settings).\n'
              '• Device Data. We collect device data such as information about your computer, phone, tablet, or other device you use to access the Services. Depending on the device used, this device data may include information such as your IP address (or proxy server), device and application identification numbers, location, browser type, hardware model, Internet service provider and/or mobile carrier, operating system, and system configuration information.\n\n'
              'Google API\n'
              'Our use of information received from Google APIs will adhere to Google API Services User Data Policy, including the Limited Use requirements.',
            ),
            SizedBox(height: 20),

            _SectionHeader(num: '02', title: 'How Do We Process Your Information?'),
            SizedBox(height: 8),
            _Paragraph(
              'In Short: We process your information to provide, improve, and administer our Services, communicate with you, for security and fraud prevention, and to comply with law. We may also process your information for other purposes with your consent.\n\n'
              'We process your personal information for a variety of reasons, depending on how you interact with our Services, including:\n'
              '• To facilitate account creation and authentication and otherwise manage user accounts. We may process your information so you can create and log in to your account, as well as keep your account in working order.\n'
              '• To deliver and facilitate delivery of services to the user. We may process your information to provide you with the requested service.\n'
              '• To enable user-to-user communications. We may process your information if you choose to use any of our offerings that allow for communication with another user.\n'
              '• To request feedback. We may process your information when necessary to request feedback and to contact you about your use of our Services.\n'
              '• To send you marketing and promotional communications. We may process the personal information you send to us for our marketing purposes, if this is in accordance with your marketing preferences. You can opt out of our marketing emails at any time.\n'
              '• To protect our Services. We may process your information as part of our efforts to keep our Services safe and secure, including fraud monitoring and prevention.\n'
              '• To identify usage trends. We may process information about how you use our Services to better understand how they are being used so we can improve them.\n'
              '• To comply with our legal obligations. We may process your information to comply with our legal obligations, respond to legal requests, and exercise, establish, or defend our legal rights.',
            ),
            SizedBox(height: 20),

            _SectionHeader(num: '03', title: 'When and With Whom Do We Share Your Personal Information?'),
            SizedBox(height: 8),
            _Paragraph(
              'In Short: We may share information in specific situations described in this section and/or with the following third parties.\n\n'
              'Vendors, Consultants, and Other Third-Party Service Providers. We may share your data with third-party vendors, service providers, contractors, or agents ("third parties") who perform services for us or on our behalf and require access to such information to do that work.\n\n'
              'The third parties we may share personal information with are as follows:\n'
              '• Data Backup and Security: SUPERBASE\n'
              '• User Account Registration and Authentication: Google Sign-In\n'
              '• Web and Mobile Analytics: POSTHOG\n\n'
              'We also may need to share your personal information in the following situations:\n'
              '• Business Transfers. We may share or transfer your information in connection with, or during negotiations of, any merger, sale of company assets, financing, or acquisition of all or a portion of our business to another company.\n'
              '• Other Users. When you share personal information (for example, by posting comments, contributions, or other content to the Services) or otherwise interact with public areas of the Services, such personal information may be viewed by all users and may be publicly made available outside the Services in perpetuity. Similarly, other users will be able to view descriptions of your activity, communicate with you within our Services, and view your profile.',
            ),
            SizedBox(height: 20),

            _SectionHeader(num: '04', title: 'How Long Do We Keep Your Information?'),
            SizedBox(height: 8),
            _Paragraph(
              'In Short: We keep your information for as long as necessary to fulfill the purposes outlined in this Privacy Notice unless otherwise required by law.\n\n'
              'We will only keep your personal information for as long as it is necessary for the purposes set out in this Privacy Notice, unless a longer retention period is required or permitted by law (such as tax, accounting, or other legal requirements). No purpose in this notice will require us keeping your personal information for longer than the period of time in which users have an account with us.\n\n'
              'When we have no ongoing legitimate business need to process your personal information, we will either delete or anonymize such information, or, if this is not possible (for example, because your personal information has been stored in backup archives), then we will securely store your personal information and isolate it from any further processing until deletion is possible.',
            ),
            SizedBox(height: 20),

            _SectionHeader(num: '05', title: 'How Do We Keep Your Information Safe?'),
            SizedBox(height: 8),
            _Paragraph(
              'In Short: We aim to protect your personal information through a system of organizational and technical security measures.\n\n'
              'We have implemented appropriate and reasonable technical and organizational security measures designed to protect the security of any personal information we process. However, despite our safeguards and efforts to secure your information, no electronic transmission over the Internet or information storage technology can be guaranteed to be 100% secure, so we cannot promise or guarantee that hackers, cybercriminals, or other unauthorized third parties will not be able to defeat our security and improperly collect, access, steal, or modify your information. Although we will do our best to protect your personal information, transmission of personal information to and from our Services is at your own risk. You should only access the Services within a secure environment.',
            ),
            SizedBox(height: 20),

            _SectionHeader(num: '06', title: 'What Are Your Privacy Rights?'),
            SizedBox(height: 8),
            _Paragraph(
              'In Short: You may review, change, or terminate your account at any time, depending on your country, province, or state of residence.\n\n'
              'Withdrawing your consent: If we are relying on your consent to process your personal information, which may be express and/or implied consent depending on the applicable law, you have the right to withdraw your consent at any time. You can withdraw your consent at any time by contacting us by using the contact details provided in the section "HOW CAN YOU CONTACT US ABOUT THIS NOTICE?" below.\n\n'
              'However, please note that this will not affect the lawfulness of the processing before its withdrawal nor, when applicable law allows, will it affect the processing of your personal information conducted in reliance on lawful processing grounds other than consent.\n\n'
              'Opting out of marketing and promotional communications: You can unsubscribe from our marketing and promotional communications at any time by clicking on the unsubscribe link in the emails that we send, or by contacting us using the details provided in the section "HOW CAN YOU CONTACT US ABOUT THIS NOTICE?" below. You will then be removed from the marketing lists. However, we may still communicate with you — for example, to send you service-related messages that are necessary for the administration and use of your account, to respond to service requests, or for other non-marketing purposes.\n\n'
              'Account Information:\n'
              'If you would at any time like to review or change the information in your account or terminate your account, you can:\n'
              '• Log in to your account settings and update your user account.\n'
              '• Contact us using the contact information provided.\n\n'
              'Upon your request to terminate your account, we will deactivate or delete your account and information from our active databases. However, we may retain some information in our files to prevent fraud, troubleshoot problems, assist with any investigations, enforce our legal terms and/or comply with applicable legal requirements.\n\n'
              'If you have questions or comments about your privacy rights, you may email us at ADMIN@GENZIITIAN.ORG , GENZIITIAN@GMAIL.COM.',
            ),
            SizedBox(height: 20),

            _SectionHeader(num: '07', title: 'Controls for Do-Not-Track Features'),
            SizedBox(height: 8),
            _Paragraph(
              'Most web browsers and some mobile operating systems and mobile applications include a Do-Not-Track ("DNT") feature or setting you can activate to signal your privacy preference not to have data about your online browsing activities monitored and collected. At this stage, no uniform technology standard for recognizing and implementing DNT signals has been finalized. As such, we do not currently respond to DNT browser signals or any other mechanism that automatically communicates your choice not to be tracked online. If a standard for online tracking is adopted that we must follow in the future, we will inform you about that practice in a revised version of this Privacy Notice.',
            ),
            SizedBox(height: 20),

            _SectionHeader(num: '08', title: 'Service Description'),
            SizedBox(height: 8),
            _Paragraph(
              'Gen-Z IITian provides access to premium digital educational courses designed specifically for students. Our services are delivered entirely online. Access to the courses is granted immediately upon successful completion of the payment process.',
            ),
            SizedBox(height: 20),

            _SectionHeader(num: '09', title: 'User Account & Security'),
            SizedBox(height: 8),
            _Paragraph(
              'To access our courses, users must sign in via their Google account. You are solely responsible for maintaining the confidentiality of your account information and for all activities that occur under your account. We reserve the right to terminate accounts that violate our security protocols.',
            ),
            SizedBox(height: 20),

            _SectionHeader(num: '10', title: 'Course & Material Access & Usage'),
            SizedBox(height: 8),
            _Paragraph(
              'Access is granted exclusively to the email address used during the purchase. Course/MATERIAL access is non-transferable and intended for personal use only. Sharing account credentials or course content with third parties is strictly prohibited.',
            ),
            SizedBox(height: 20),

            _SectionHeader(num: '11', title: 'Prohibited Use & Copyright'),
            SizedBox(height: 8),
            _Paragraph(
              'All content on this platform, including videos, documents, and code samples, is the intellectual property of Gen-Z IITian. Any form of piracy, unauthorized redistribution, or commercial use of our content will result in legal action and immediate termination of access without notice.',
            ),
            SizedBox(height: 20),

            _SectionHeader(num: '12', title: 'Limitation of Liability'),
            SizedBox(height: 8),
            _Paragraph(
              'Gen-Z IITian is an educational platform. While we strive for excellence, we do not guarantee specific academic results or career outcomes. The platform is not responsible for any misuse of the information provided or for any technical issues arising from the user\'s internet connection or device.',
            ),
            SizedBox(height: 20),

            _SectionHeader(num: '13', title: 'Return & Refund Policy'),
            SizedBox(height: 8),
            _Paragraph(
              'At GenZ IITian, we provide 100% digital educational services in the form of online courses. There is no physical product, shipment, or delivery involved. Due to the nature of digital content, all purchases are final. We do not offer refunds, returns, or exchanges under any circumstances once a course has been purchased. We strongly recommend reviewing course details before making a purchase. In case of any technical issues, payment errors, or access-related problems, you can contact our support team. We will ensure that you receive proper access to your purchased course. We reserve the right to update or modify this policy at any time without prior notice. Changes will be effective immediately upon posting.',
            ),
            SizedBox(height: 20),

            _SectionHeader(num: '14', title: 'Do We Make Updates to This Notice?'),
            SizedBox(height: 8),
            _Paragraph(
              'In Short: Yes, we will update this notice as necessary to stay compliant with relevant laws.\n\n'
              'We may update this Privacy Notice from time to time. The updated version will be indicated by an updated "Revised" date at the top of this Privacy Notice. If we make material changes to this Privacy Notice, we may notify you either by prominently posting a notice of such changes or by directly sending you a notification. We encourage you to review this Privacy Notice frequently to be informed of how we are protecting your information.',
            ),
            SizedBox(height: 20),

            _SectionHeader(num: '15', title: 'How Can You Contact Us About This Notice?'),
            SizedBox(height: 8),
            _Paragraph(
              'If you have questions or comments about this notice, you may email us at ADMIN@GENZIITIAN.ORG or contact us by post at:\n\n'
              'GENZ IITIAN\n'
              'BIHAR , INDIA\n'
              'PATNA, BIHAR 800001\n'
              'India',
            ),
            SizedBox(height: 20),

            _SectionHeader(num: '16', title: 'How Can You Review, Update, or Delete the Data We Collect From You?'),
            SizedBox(height: 8),
            _Paragraph(
              'You have the right to request access to the personal information we collect from you, details about how we have processed it, correct inaccuracies, or delete your personal information. You may also have the right to withdraw your consent to our processing of your personal information. These rights may be limited in some circumstances by applicable law. To request to review, update, or delete your personal information, please visit: USER HAVE TO VISIT SUPPORT BUILT IN APP /WEBSITE FOR THIS .',
            ),
          ],
        );

      case DocType.termsAndConditions:
        return const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _SectionHeader(num: '01', title: 'Service Description'),
            SizedBox(height: 8),
            _Paragraph(
              'Gen-Z IITian provides access to premium digital educational courses designed specifically for students. Our services are delivered entirely online. Access to the courses is granted immediately upon successful completion of the payment process.',
            ),
            SizedBox(height: 20),
            _SectionHeader(num: '02', title: 'User Account & Security'),
            SizedBox(height: 8),
            _Paragraph(
              'To access our courses, users must sign in via their Google account. You are solely responsible for maintaining the confidentiality of your account information and for all activities that occur under your account. We reserve the right to terminate accounts that violate our security protocols.',
            ),
            SizedBox(height: 20),
            _SectionHeader(num: '03', title: 'Course Access & Usage'),
            SizedBox(height: 8),
            _Bullet('Access is granted exclusively to the email address used during the purchase.'),
            _Bullet('Course access is non-transferable and intended for personal use only.'),
            _Bullet('Sharing account credentials or course content with third parties is strictly prohibited.'),
            SizedBox(height: 20),
            _SectionHeader(num: '04', title: 'Payment Terms'),
            SizedBox(height: 8),
            _Paragraph(
              'All prices are clearly displayed before the final checkout. By proceeding with the payment, you agree to the price and terms of the specific course. All payments are processed through secure third-party payment gateways (Razorpay, Stripe, or Cashfree).',
            ),
            SizedBox(height: 20),
            _SectionHeader(num: '05', title: 'Prohibited Use & Copyright'),
            SizedBox(height: 8),
            _Paragraph(
              'All content on this platform, including videos, documents, and code samples, is the intellectual property of Gen-Z IITian. Any form of piracy, unauthorized redistribution, or commercial use of our content will result in legal action and immediate termination of access without notice.',
            ),
            SizedBox(height: 20),
            _SectionHeader(num: '06', title: 'Limitation of Liability'),
            SizedBox(height: 8),
            _Paragraph(
              'Gen-Z IITian is an educational platform. While we strive for excellence, we do not guarantee specific academic results or career outcomes. The platform is not responsible for any misuse of the information provided or for any technical issues arising from the user\'s internet connection or device.',
            ),
          ],
        );

      case DocType.refundPolicy:
        return const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _Paragraph(
              'At GenZ IITian, we provide 100% digital educational services in the form of online courses. There is no physical product, shipment, or delivery involved.',
            ),
            SizedBox(height: 16),
            _Paragraph(
              'Due to the nature of digital content, all purchases are final. We do not offer refunds, returns, or exchanges under any circumstances once a course has been purchased.',
            ),
            SizedBox(height: 16),
            _Paragraph(
              'We strongly recommend reviewing course details before making a purchase.',
            ),
            SizedBox(height: 16),
            _Paragraph(
              'In case of any technical issues, payment errors, or access-related problems, you can contact our support team. We will ensure that you receive proper access to your purchased course.',
            ),
            SizedBox(height: 16),
            _Paragraph(
              'We reserve the right to update or modify this policy at any time without prior notice. Changes will be effective immediately upon posting.',
            ),
          ],
        );

      case DocType.copyrightPolicy:
        return const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '© 2026 GenZ IITian. All rights reserved.',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: Color(0xFF6366F1),
              ),
            ),
            SizedBox(height: 14),
            _Paragraph(
              'All content available on GenZ IITian, including but not limited to courses, video lectures, notes, study materials, designs, graphics, branding, and platform features, is the exclusive property of GenZ IITian.',
            ),
            SizedBox(height: 16),
            _Paragraph(
              'Any content created, uploaded, or shared by teachers, mentors, or students on this platform becomes part of the GenZ IITian ecosystem and is protected under this policy.',
            ),
            SizedBox(height: 16),
            _Paragraph(
              'Access to courses and content is provided on a limited, non-exclusive, non-transferable basis for a specific duration. Purchase of any course does not grant ownership of the content. All courses are time bound and may expire after the validity period.',
            ),
            SizedBox(height: 16),
            _Paragraph(
              'Users are strictly prohibited from copying, recording, reproducing, distributing, modifying, selling, or sharing any content outside the platform without prior written permission from GenZ IITian.',
            ),
            SizedBox(height: 16),
            _Paragraph(
              'Any unauthorized use of content may result in immediate suspension or termination of access, along with potential legal action.',
            ),
            SizedBox(height: 16),
            _Paragraph(
              'GenZ IITian reserves the right to modify, update, or remove any content or policy at any time without prior notice.',
            ),
            SizedBox(height: 16),
            _Paragraph(
              'All rights not expressly granted are reserved by GenZ IITian.',
            ),
          ],
        );

      case DocType.contactUs:
        return const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _SectionHeader(num: '01', title: 'Get in Touch'),
            SizedBox(height: 10),
            _Paragraph(
              'We are here to help you excel in your learning journey. Contact us via email or support:',
            ),
            SizedBox(height: 16),
            _ContactChannelTile(
              icon: Icons.mail_outline_rounded,
              title: 'Email Us',
              description: 'For queries & support: help@genziitian.in',
              actionLabel: 'help@genziitian.in',
            ),
          ],
        );
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// STYLING COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
class _LastUpdatedBadge extends StatelessWidget {
  const _LastUpdatedBadge(this.date);
  final String date;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: tokens.surfaceSecondary,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: tokens.border),
      ),
      child: Text(
        'Last Updated: $date',
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: tokens.textMuted,
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.num, required this.title});
  final String num;
  final String title;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Row(
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        Text(
          '$num. ',
          style: TextStyle(
            fontSize: 14.5,
            fontWeight: FontWeight.w800,
            color: tokens.primaryAccent,
            letterSpacing: -0.2,
          ),
        ),
        Expanded(
          child: Text(
            title,
            style: TextStyle(
              fontSize: 15.5,
              fontWeight: FontWeight.w800,
              color: tokens.textPrimary,
              letterSpacing: -0.2,
            ),
          ),
        ),
      ],
    );
  }
}

class _Paragraph extends StatelessWidget {
  const _Paragraph(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Text(
      text,
      style: TextStyle(
        fontSize: 13.5,
        height: 1.55,
        color: tokens.textSecondary,
      ),
    );
  }
}

class _Bullet extends StatelessWidget {
  const _Bullet(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.only(top: 6, right: 10),
            width: 5,
            height: 5,
            decoration: BoxDecoration(
              color: tokens.primaryAccent,
              shape: BoxShape.circle,
            ),
          ),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 13.5,
                height: 1.45,
                color: tokens.textSecondary,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _QuoteCallout extends StatelessWidget {
  const _QuoteCallout(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: tokens.surfaceSecondary,
        border: Border(
          left: BorderSide(color: tokens.primaryAccent, width: 4),
        ),
        borderRadius: const BorderRadius.horizontal(right: Radius.circular(8)),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 13,
          fontStyle: FontStyle.italic,
          fontWeight: FontWeight.w600,
          color: tokens.textPrimary,
          height: 1.4,
        ),
      ),
    );
  }
}

class _ContactCard extends StatelessWidget {
  const _ContactCard({required this.prompt});
  final String prompt;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: tokens.primaryAccent.withOpacity(0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: tokens.primaryAccent.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  prompt,
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: tokens.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  'Our support team is active 6 days a week.',
                  style: TextStyle(
                    fontSize: 12,
                    color: tokens.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          BouncyPressable(
            onTap: () => context.push('/support'),
            scaleDown: 0.96,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                color: tokens.primaryAccent,
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Text(
                'Support →',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PolicyLinkTile extends StatelessWidget {
  const _PolicyLinkTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: tokens.cardBg,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: tokens.border),
          boxShadow: AppShadows.sm,
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: tokens.primaryAccent.withOpacity(0.12),
                borderRadius: BorderRadius.circular(10),
              ),
              alignment: Alignment.center,
              child: Icon(icon, color: tokens.primaryAccent, size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: tokens.textPrimary,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 11.5,
                      color: tokens.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Icon(Icons.chevron_right, color: tokens.textMuted, size: 18),
          ],
        ),
      ),
    );
  }
}

class _ContactChannelTile extends StatelessWidget {
  const _ContactChannelTile({
    required this.icon,
    required this.title,
    required this.description,
    required this.actionLabel,
    this.route,
  });

  final IconData icon;
  final String title;
  final String description;
  final String actionLabel;
  final String? route;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.surfaceSecondary,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: tokens.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: tokens.primaryAccent.withOpacity(0.14),
              borderRadius: BorderRadius.circular(8),
            ),
            alignment: Alignment.center,
            child: Icon(icon, color: tokens.primaryAccent, size: 18),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w800,
                    color: tokens.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  description,
                  style: TextStyle(
                    fontSize: 12,
                    height: 1.4,
                    color: tokens.textSecondary,
                  ),
                ),
                const SizedBox(height: 6),
                if (route != null)
                  GestureDetector(
                    onTap: () => context.push(route!),
                    child: Text(
                      actionLabel,
                      style: TextStyle(
                        fontSize: 12.5,
                        fontWeight: FontWeight.w800,
                        color: tokens.primaryAccent,
                      ),
                    ),
                  )
                else
                  SelectableText(
                    actionLabel,
                    style: TextStyle(
                      fontSize: 12.5,
                      fontWeight: FontWeight.w800,
                      color: tokens.primaryAccent,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
