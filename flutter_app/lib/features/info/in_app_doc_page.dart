import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/bouncy_pressable.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_shadows.dart';
import '../../theme/app_theme_tokens.dart';
import 'legal_policy_text.dart';

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
        return '';
      case DocType.termsAndConditions:
        return '';
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
        return const _Paragraph(privacyPolicyText);

      case DocType.termsAndConditions:
        return const _TermsAndConditionsDocument();

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

class _TermsAndConditionsDocument extends StatelessWidget {
  const _TermsAndConditionsDocument();

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final children = <Widget>[];
    for (final block in termsAndConditionsText.split('\n\n')) {
      if (block.isEmpty) continue;
      if (block == 'Terms & Conditions') {
        children.add(Text(
          block,
          style: TextStyle(
            fontSize: 17,
            fontWeight: FontWeight.w800,
            color: tokens.textPrimary,
          ),
        ));
      } else if (block.startsWith('Last Updated:')) {
        children.add(Text(
          block,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: tokens.textMuted,
          ),
        ));
      } else if (RegExp(r'^0[1-6] ').hasMatch(block)) {
        children.add(Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Text(
            block,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: tokens.textPrimary,
            ),
          ),
        ));
      } else if (block.startsWith('- ')) {
        children.add(Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: block.split('\n').map((line) => _Bullet(line.substring(2))).toList(),
        ));
      } else if (block == 'Questions about our Terms?') {
        children.add(Text(
          block,
          style: TextStyle(
            fontSize: 13.5,
            fontWeight: FontWeight.w700,
            height: 1.55,
            color: tokens.textPrimary,
          ),
        ));
      } else if (block == 'Contact Support') {
        children.add(InkWell(
          onTap: () => launchUrl(
            Uri.parse('https://genziitian.in/contact'),
            mode: LaunchMode.externalApplication,
          ),
          child: Text(
            block,
            style: TextStyle(
              fontSize: 13.5,
              height: 1.55,
              color: tokens.primaryAccent,
              decoration: TextDecoration.underline,
            ),
          ),
        ));
      } else {
        children.add(_Paragraph(block));
      }
      children.add(const SizedBox(height: 10));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: children,
    );
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
