import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../theme/app_theme_tokens.dart';
import '../../shared/widgets/app_refresh.dart';
import '../../shared/widgets/sub_page_header.dart';

/// Fallback FAQ list — identical content to the web app's static defaults
/// in `src/app/(dashboard)/support/page.tsx`. Used when the API returns an
/// empty list (e.g. before the manager has seeded the DB) so students still
/// see useful guidance instead of an empty state.
const _fallbackFaqs = <Map<String, String>>[
  {
    'question': 'What is the difference between PLUS and PRO Batch?',
    'answer':
        'PLUS Batch includes full access to recorded lectures, course materials, and practice resources. PRO Batch includes everything in PLUS, plus direct entry to Live Classes, interactive Q&A sessions with teachers, and priority 1:1 doubt support.',
  },
  {
    'question': 'Can I upgrade from PLUS to PRO later?',
    'answer':
        "Yes, you can upgrade at any time! Simply visit the course store, find your course, and choose the 'Upgrade to PRO' option which only charges the price difference.",
  },
  {
    'question': 'How long do I have access to the course?',
    'answer':
        'Most courses provide access until the end of the academic term (e.g., End Term 1 or Term 2). You can view the exact validity and expiry date on your course card or details page.',
  },
  {
    'question': 'Is there a mobile app available?',
    'answer':
        'Yes! The official Gen-Z IITian Android app is live and available for download. You can also access the full learning platform on any web browser at app.genziitian.in. An iOS app is currently in our roadmap.',
  },
  {
    'question': 'What payment methods do you accept?',
    'answer':
        'We accept all major Credit/Debit cards, UPI (Google Pay, PhonePe, Paytm, BHIM), Net Banking, and popular Wallets through our secure Razorpay payment gateway.',
  },
  {
    'question': 'What should I do if my payment fails but money is deducted?',
    'answer':
        "Don't worry! Usually, failed bank transactions are automatically refunded within 24 to 48 hours by your bank. If your enrolled course does not appear in your dashboard within 2 hours, please raise a support ticket with your transaction reference ID.",
  },
  {
    'question': 'Can I get a refund?',
    'answer':
        "Refund policies vary by course. Generally, we offer a 2-day 'no questions asked' refund if you have not consumed more than 10% of the content. Please refer to our Return & Refund Policy for full terms.",
  },
  {
    'question': 'How do I access the Live Classes?',
    'answer':
        "If you are enrolled in a PRO Batch, navigate to the 'Live' tab in your dashboard or mobile app. You will see upcoming class schedules and a 'Join Now' button whenever a session is live.",
  },
  {
    'question': 'Where can I find my course certificates?',
    'answer':
        'Once you achieve 100% course completion and clear the final evaluation, your certificate will be automatically generated and available for download under your Profile or Course Details section.',
  },
  {
    'question': 'I forgot my password, how do I reset it?',
    'answer':
        "We use Google Sign-In for streamlined and secure authentication. You don't need to remember a separate password—simply log in with your registered Google account. If needed, password recovery is managed directly through your Google account.",
  },
  {
    'question': 'Can I share my account with a friend?',
    'answer':
        'No. Account sharing is strictly against our terms of service. Our security system monitors concurrent logins and abnormal device activity. Simultaneous unauthorized access may result in immediate and permanent account suspension.',
  },
  {
    'question': 'What are "Free Resources"?',
    'answer':
        'Free Resources include curated demo lectures, formula sheets, revision notes, and previous year question papers (PYQs) accessible to all registered students at zero cost.',
  },
  {
    'question': 'How can I contact my instructor?',
    'answer':
        "PRO Batch students can ask questions directly during interactive Live Classes or use the dedicated 'Doubt Support' feature inside each lesson. Our academic team reviews and responds to queries promptly.",
  },
  {
    'question': 'Do you provide offline access to videos and materials?',
    'answer':
        'Due to copyright protection, lecture videos stream online. However, course PDFs, formula sheets, notes, and study materials can be downloaded for offline viewing directly inside the app and web.',
  },
  {
    'question': 'What is the "Community" tab?',
    'answer':
        'The Community tab is a student collaboration forum where you can discuss concepts, share problem-solving strategies, solve PYQs together, and stay connected with fellow IITM BS peers.',
  },
  {
    'question': 'How do I track my study progress?',
    'answer':
        'Your learning progress updates automatically across both web and mobile app. You can monitor your overall completion percentage on your main dashboard and view module-by-module progress inside each course.',
  },
  {
    'question': 'Are recordings available after a Live Class concludes?',
    'answer':
        "Yes! High-definition recordings of every Live Class are processed and added to the 'Recorded' section of your course within 4 to 6 hours after the live session concludes.",
  },
  {
    'question': 'Can I change my registered email address?',
    'answer':
        'Because course enrollments and academic records are tied to your student account, email updates require manual verification. Please raise a support ticket requesting an email change, and our team will assist you.',
  },
  {
    'question': 'What devices and browsers are recommended?',
    'answer':
        'You can use our official Android app on mobile devices, or any modern web browser (Google Chrome, Microsoft Edge, Brave, Mozilla Firefox, or Safari) on desktop, laptop, or tablet.',
  },
  {
    'question': 'How do I report a technical bug or app issue?',
    'answer':
        "Please raise a 'Technical Support' ticket under the Support section with a description and screenshot of the issue. Our technical team will investigate and resolve it as quickly as possible.",
  },
];

/// GET /api/support/faq → [{ id, question, answer, order }] (order asc).
/// Falls back to the bundled list when the API returns an empty array so the
/// page is never blank — same UX the web app provides at
/// `src/app/(dashboard)/support/page.tsx`.
final faqProvider = FutureProvider<List<Map<String, dynamic>>>((ref) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.get<dynamic>('/api/support/faq');
    final list = (res.data is List) ? res.data as List : const [];
    if (list.isNotEmpty) {
      return [for (final j in list) j as Map<String, dynamic>];
    }
  } catch (_) {
    // Network/API error → still show fallback so the user sees value.
  }
  return [
    for (var i = 0; i < _fallbackFaqs.length; i++)
      <String, dynamic>{
        'id': 'fallback-$i',
        'question': _fallbackFaqs[i]['question'],
        'answer': _fallbackFaqs[i]['answer'],
        'order': i,
      }
  ];
});

class FaqPage extends ConsumerWidget {
  const FaqPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(faqProvider);
    final tokens = context.tokens;

    return AppPageScaffold(
      title: 'FAQ',
      subtitle: 'Frequently Asked Questions',
      showBack: true,
      onBack: () => context.canPop() ? context.pop() : context.go('/more'),
      body: AppRefresh(
        onRefresh: () async => ref.invalidate(faqProvider),
        child: async.when(
          loading: () => Center(
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: tokens.primaryAccent,
            ),
          ),
          error: (e, _) => _Error(message: e.toString()),
          data: (list) {
            if (list.isEmpty) return const _Empty();
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _FaqTile(faq: list[i]),
            );
          },
        ),
      ),
    );
  }
}

class _FaqTile extends StatefulWidget {
  const _FaqTile({required this.faq});
  final Map<String, dynamic> faq;
  @override
  State<_FaqTile> createState() => _FaqTileState();
}

class _FaqTileState extends State<_FaqTile> {
  bool _open = false;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final q = (widget.faq['question'] as String?) ?? '';
    final a = (widget.faq['answer'] as String?) ?? '';

    return Container(
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: tokens.border),
      ),
      child: InkWell(
        onTap: () => setState(() => _open = !_open),
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      q,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: tokens.textPrimary,
                      ),
                    ),
                  ),
                  AnimatedRotation(
                    turns: _open ? 0.5 : 0,
                    duration: const Duration(milliseconds: 180),
                    child: Icon(Icons.expand_more,
                        color: tokens.textMuted),
                  ),
                ],
              ),
              AnimatedCrossFade(
                firstChild: const SizedBox(width: double.infinity),
                secondChild: Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    a,
                    style: TextStyle(
                      fontSize: 13,
                      height: 1.4,
                      color: tokens.textSecondary,
                    ),
                  ),
                ),
                crossFadeState:
                    _open ? CrossFadeState.showSecond : CrossFadeState.showFirst,
                duration: const Duration(milliseconds: 200),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty();

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return ListView(
      padding: const EdgeInsets.all(40),
      children: [
        Icon(Icons.help_outline,
            color: tokens.textMuted, size: 40),
        const SizedBox(height: 8),
        Text(
          'No FAQs yet',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: tokens.textPrimary,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 4),
        Text(
          'Help articles will appear here.',
          style: TextStyle(
            fontSize: 13,
            color: tokens.textSecondary,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}

class _Error extends StatelessWidget {
  const _Error({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return ListView(
      padding: const EdgeInsets.all(40),
      children: [
        Icon(Icons.cloud_off, color: tokens.textMuted, size: 40),
        const SizedBox(height: 8),
        Text(
          'Could not load FAQs',
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w700,
            color: tokens.textPrimary,
          ),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: 4),
        Text(
          message,
          style: TextStyle(
            fontSize: 13,
            color: tokens.textSecondary,
          ),
          textAlign: TextAlign.center,
        ),
      ],
    );
  }
}
