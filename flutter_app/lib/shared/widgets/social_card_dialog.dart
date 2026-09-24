import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/auth/auth_providers.dart';
import '../../theme/app_theme_tokens.dart';
import 'app_avatar.dart';
import 'bouncy_pressable.dart';

/// Opens the high-fidelity Gen-Z IITian Social Card dialog.
Future<void> showSocialCard(BuildContext context, {required String userId}) {
  return showDialog<void>(
    context: context,
    barrierDismissible: true,
    barrierColor: Colors.black.withOpacity(0.70),
    builder: (ctx) => _SocialCardDialog(initialUserId: userId),
  );
}

class _SocialCardDialog extends ConsumerStatefulWidget {
  const _SocialCardDialog({required this.initialUserId});
  final String initialUserId;

  @override
  ConsumerState<_SocialCardDialog> createState() => _SocialCardDialogState();
}

class _SocialCardDialogState extends ConsumerState<_SocialCardDialog> {
  late String _activeUserId;
  String? _returnUserId;
  String? _returnUserName;

  bool _loading = true;
  String? _error;
  Map<String, dynamic>? _cardData;

  @override
  void initState() {
    super.initState();
    _activeUserId = widget.initialUserId;
    _fetchCardData(_activeUserId);
  }

  Future<void> _fetchCardData(String uid) async {
    setState(() {
      _loading = true;
      _error = null;
    });

    final currentUser = ref.read(authStateProvider).value;
    final currentUserId = currentUser?.id;

    try {
      final api = ref.read(apiClientProvider);
      final res = await api.get<dynamic>('/api/social-card/$uid');
      if (res.data is Map && (res.data['user'] != null)) {
        setState(() {
          _cardData = Map<String, dynamic>.from(res.data as Map);
          _loading = false;
        });
        return;
      }
    } catch (_) {
      // Fall through to offline demo fallback
    }

    // Graceful fallback for offline / mock dev users
    final isSelf = currentUserId != null && currentUserId == uid;
    final isDemoManager = currentUser?.isManager == true || uid.contains('manager');
    final name = isSelf ? (currentUser?.name ?? 'GENZ ADMIN') : 'GENZ ADMIN';

    setState(() {
      _cardData = {
        'user': {
          'id': uid,
          'name': name.isNotEmpty ? name : 'GENZ ADMIN',
          'role': isDemoManager ? 'MANAGER' : 'STUDENT',
          'avatar': isSelf ? currentUser?.avatar : null,
          'gender': isSelf ? (currentUser?.gender ?? 'MALE') : 'MALE',
          'aboutMe': (isSelf && currentUser?.bio != null && currentUser!.bio!.isNotEmpty)
              ? currentUser.bio
              : "Hey, I'm Tushar Singh, an IITM BS student just like you. Focused on Data Science & AI. Let's connect and build amazing things together!",
          'publicFields': [
            {'key': 'state', 'label': 'State', 'value': 'Goa'},
            {'key': 'age', 'label': 'Age', 'value': '22'},
            {'key': 'cgpa', 'label': 'CGPA', 'value': '8.93'},
            {'key': 'iitmLevel', 'label': 'IITM Level', 'value': 'Diploma'},
          ],
          'badges': [
            {'id': '1', 'badgeId': 'gold_contributor', 'label': 'Gold Member', 'category': 'SYSTEM'},
            {'id': '2', 'badgeId': 'math_wizard', 'label': 'Math Wizard', 'category': 'ACADEMIC'},
            {'id': '3', 'badgeId': 'community_lead', 'label': 'Community Lead', 'category': 'GENERAL'},
          ],
          'instagramUrl': 'https://instagram.com/genziitian',
          'linkedinUrl': 'https://linkedin.com/company/genziitian',
        },
        'viewer': {
          'isSelf': isSelf,
          'isStaff': true,
          'canReport': !isSelf,
          'canTalkToManager': !isSelf,
          'canViewFullAvatar': true,
        }
      };
      _loading = false;
    });
  }

  void _switchToUser(String uid, {String? fromName}) {
    HapticFeedback.selectionClick();
    if (_returnUserId == null && fromName != null) {
      _returnUserId = _activeUserId;
      _returnUserName = fromName;
    }
    _activeUserId = uid;
    _fetchCardData(uid);
  }

  void _switchBack() {
    if (_returnUserId != null) {
      HapticFeedback.selectionClick();
      final target = _returnUserId!;
      setState(() {
        _returnUserId = null;
        _returnUserName = null;
        _activeUserId = target;
      });
      _fetchCardData(target);
    }
  }

  Future<void> _openSocialLink(String url) async {
    final uri = Uri.tryParse(url);
    if (uri != null) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  void _shareCard(String name, String role, String about) async {
    HapticFeedback.lightImpact();
    final shareText = 'Check out $name\'s Gen-Z IITian Social Card ($role):\n$about\nhttps://class.genziitian.in';
    try {
      await Share.share(
        shareText,
        subject: '$name\'s Gen-Z IITian Social Card',
      );
    } catch (_) {
      Clipboard.setData(ClipboardData(text: shareText));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Social Card copied to clipboard!'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  IconData _getPublicFieldIcon(String key) {
    switch (key) {
      case 'state':
        return Icons.location_on_rounded;
      case 'age':
        return Icons.person_rounded;
      case 'cgpa':
        return Icons.military_tech_rounded;
      case 'iitmLevel':
        return Icons.school_rounded;
      case 'gender':
        return Icons.wc_rounded;
      default:
        return Icons.info_outline_rounded;
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final isDark = context.isDark;
    final isBlack = tokens.isBlack;
    final currentUser = ref.watch(authStateProvider).value;
    final currentUserId = currentUser?.id;

    final user = (_cardData?['user'] as Map<String, dynamic>?) ?? {};
    final viewer = (_cardData?['viewer'] as Map<String, dynamic>?) ?? {};

    final userName = (user['name'] as String?) ?? 'Student';
    final userRole = (user['role'] as String?) ?? 'STUDENT';
    final userAvatar = user['avatar'] as String?;
    final userGender = user['gender'] as String?;
    final aboutMe = (user['aboutMe'] as String?)?.trim() ?? '';
    final instagramUrl = user['instagramUrl'] as String?;
    final linkedinUrl = user['linkedinUrl'] as String?;

    final publicFields = (user['publicFields'] as List?)
            ?.map((f) => Map<String, dynamic>.from(f as Map))
            .toList() ??
        const [];

    final badges = (user['badges'] as List?)
            ?.map((b) => Map<String, dynamic>.from(b as Map))
            .toList() ??
        const [];

    final isSelf = viewer['isSelf'] == true ||
        (currentUserId != null && currentUserId == _activeUserId);
    final canTalkToManager = viewer['canTalkToManager'] == true &&
        (currentUser?.role == 'STUDENT' || currentUser?.role == 'MANAGER');

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 24),
      child: Container(
        constraints: const BoxConstraints(maxWidth: 480, maxHeight: 680),
        decoration: BoxDecoration(
          color: isBlack
              ? const Color(0xFF0D0D0D)
              : (isDark ? const Color(0xFF131127) : const Color(0xFF1E1B4B)),
          borderRadius: BorderRadius.circular(24),
          border: Border.all(
            color: isBlack
                ? const Color(0xFF27272A)
                : const Color(0xFF6366F1).withOpacity(0.35),
            width: 1.5,
          ),
          boxShadow: const [
            BoxShadow(
              color: Color(0x66000000),
              offset: Offset(0, 16),
              blurRadius: 36,
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // ── 1. Top Header ──────────────────────────────────────
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 16, 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          'GENZ IITIAN',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            letterSpacing: 1.2,
                            color: Color(0xFF818CF8),
                          ),
                        ),
                        const SizedBox(height: 1),
                        Text(
                          'SOCIAL CARD',
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.5,
                            color: Colors.white.withOpacity(0.6),
                          ),
                        ),
                      ],
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (!_loading && _error == null) ...[
                          InkWell(
                            onTap: () => _shareCard(userName, userRole, aboutMe),
                            borderRadius: BorderRadius.circular(50),
                            child: Container(
                              width: 32,
                              height: 32,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: Colors.white.withOpacity(0.10),
                                border: Border.all(
                                  color: Colors.white.withOpacity(0.15),
                                ),
                              ),
                              child: const Icon(Icons.share_rounded,
                                  size: 16, color: Colors.white),
                            ),
                          ),
                          const SizedBox(width: 8),
                        ],
                        InkWell(
                          onTap: () => Navigator.of(context).pop(),
                          borderRadius: BorderRadius.circular(50),
                          child: Container(
                            width: 32,
                            height: 32,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: Colors.white.withOpacity(0.10),
                              border: Border.all(
                                color: Colors.white.withOpacity(0.15),
                              ),
                            ),
                            child: const Icon(Icons.close,
                                size: 18, color: Colors.white),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Divider(
                color: Colors.white.withOpacity(0.10),
                height: 1,
              ),

              // ── 2. Content Body ────────────────────────────────────
              Expanded(
                child: _loading
                    ? const Center(
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          color: Color(0xFF818CF8),
                        ),
                      )
                    : _error != null
                        ? Center(
                            child: Padding(
                              padding: const EdgeInsets.all(24),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.error_outline_rounded,
                                      color: Colors.redAccent, size: 36),
                                  const SizedBox(height: 12),
                                  Text(
                                    _error!,
                                    textAlign: TextAlign.center,
                                    style: const TextStyle(
                                      color: Colors.white70,
                                      fontSize: 13.5,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          )
                        : SingleChildScrollView(
                            physics: const BouncingScrollPhysics(),
                            padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
                            child: Column(
                              children: [
                                // Profile Picture with Glow Ring
                                Container(
                                  padding: const EdgeInsets.all(5),
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    gradient: const LinearGradient(
                                      colors: [
                                        Color(0xFF6366F1),
                                        Color(0xFF10B981),
                                      ],
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(0xFF6366F1)
                                            .withOpacity(0.4),
                                        blurRadius: 20,
                                        offset: const Offset(0, 4),
                                      ),
                                    ],
                                  ),
                                  child: AppAvatar(
                                    avatarUrl: userAvatar,
                                    gender: userGender,
                                    size: 90,
                                    border: Border.all(
                                      color: isBlack
                                          ? const Color(0xFF141414)
                                          : const Color(0xFF131127),
                                      width: 3,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 12),

                                // User Name
                                Text(
                                  userName,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    fontSize: 22,
                                    fontWeight: FontWeight.w900,
                                    color: Colors.white,
                                    letterSpacing: -0.3,
                                  ),
                                ),
                                const SizedBox(height: 6),

                                // Role Badge
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 10, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF6366F1)
                                        .withOpacity(0.20),
                                    borderRadius: BorderRadius.circular(50),
                                    border: Border.all(
                                      color: const Color(0xFF6366F1)
                                          .withOpacity(0.40),
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Icon(
                                        userRole.toUpperCase() == 'MANAGER' ||
                                                userRole.toUpperCase() ==
                                                    'ADMIN'
                                            ? Icons.shield_outlined
                                            : Icons.school_outlined,
                                        size: 13,
                                        color: const Color(0xFFA5B4FC),
                                      ),
                                      const SizedBox(width: 5),
                                      Text(
                                        userRole.toUpperCase() == 'MANAGER'
                                            ? 'Manager'
                                            : userRole.toUpperCase() ==
                                                    'ADMIN'
                                                ? 'Admin'
                                                : 'Student',
                                        style: const TextStyle(
                                          fontSize: 11,
                                          fontWeight: FontWeight.w800,
                                          color: Color(0xFFA5B4FC),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),

                                // Medals & Badges (if any)
                                if (badges.isNotEmpty) ...[
                                  const SizedBox(height: 14),
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 6,
                                    alignment: WrapAlignment.center,
                                    children: badges.map((b) {
                                      final label =
                                          (b['label'] as String?) ?? 'Medal';
                                      return Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 10, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFF59E0B)
                                              .withOpacity(0.15),
                                          borderRadius:
                                              BorderRadius.circular(10),
                                          border: Border.all(
                                            color: const Color(0xFFF59E0B)
                                                .withOpacity(0.35),
                                          ),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            const Icon(Icons.military_tech,
                                                size: 14,
                                                color: Color(0xFFFBBF24)),
                                            const SizedBox(width: 4),
                                            Text(
                                              label,
                                              style: const TextStyle(
                                                fontSize: 11,
                                                fontWeight: FontWeight.w700,
                                                color: Color(0xFFFDE68A),
                                              ),
                                            ),
                                          ],
                                        ),
                                      );
                                    }).toList(),
                                  ),
                                ],

                                // Social Links (Instagram / LinkedIn)
                                if (instagramUrl != null ||
                                    linkedinUrl != null) ...[
                                  const SizedBox(height: 12),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      if (instagramUrl != null &&
                                          instagramUrl.isNotEmpty) ...[
                                        InkWell(
                                          onTap: () =>
                                              _openSocialLink(instagramUrl),
                                          borderRadius:
                                              BorderRadius.circular(10),
                                          child: Container(
                                            padding: const EdgeInsets.all(8),
                                            decoration: BoxDecoration(
                                              color: Colors.white
                                                  .withOpacity(0.08),
                                              borderRadius:
                                                  BorderRadius.circular(10),
                                            ),
                                            child: const Icon(
                                              Icons.camera_alt_outlined,
                                              color: Color(0xFFE1306C),
                                              size: 18,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                      ],
                                      if (linkedinUrl != null &&
                                          linkedinUrl.isNotEmpty) ...[
                                        InkWell(
                                          onTap: () =>
                                              _openSocialLink(linkedinUrl),
                                          borderRadius:
                                              BorderRadius.circular(10),
                                          child: Container(
                                            padding: const EdgeInsets.all(8),
                                            decoration: BoxDecoration(
                                              color: Colors.white
                                                  .withOpacity(0.08),
                                              borderRadius:
                                                  BorderRadius.circular(10),
                                            ),
                                            child: const Icon(
                                              Icons.work_outline_rounded,
                                              color: Color(0xFF0A66C2),
                                              size: 18,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ],
                                  ),
                                ],

                                const SizedBox(height: 18),

                                // ── ABOUT Section ───────────────────────
                                Align(
                                  alignment: Alignment.centerLeft,
                                  child: Text(
                                    'ABOUT',
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 1.1,
                                      color: Colors.white.withOpacity(0.7),
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Container(
                                  width: double.infinity,
                                  constraints:
                                      const BoxConstraints(maxHeight: 180),
                                  padding: const EdgeInsets.all(14),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withOpacity(0.06),
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(
                                      color: Colors.white.withOpacity(0.12),
                                    ),
                                  ),
                                  child: SingleChildScrollView(
                                    physics: const BouncingScrollPhysics(),
                                    child: Text(
                                      aboutMe.isNotEmpty
                                          ? aboutMe
                                          : 'No About Me yet.',
                                      style: TextStyle(
                                        fontSize: 13,
                                        color: aboutMe.isNotEmpty
                                            ? Colors.white.withOpacity(0.9)
                                            : Colors.white54,
                                        height: 1.45,
                                      ),
                                    ),
                                  ),
                                ),

                                // ── PUBLIC INFO Section ─────────────────
                                if (publicFields.isNotEmpty) ...[
                                  const SizedBox(height: 16),
                                  Align(
                                    alignment: Alignment.centerLeft,
                                    child: Text(
                                      'PUBLIC INFO',
                                      style: TextStyle(
                                        fontSize: 11,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: 1.1,
                                        color: Colors.white.withOpacity(0.7),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Wrap(
                                    spacing: 8,
                                    runSpacing: 8,
                                    children: publicFields.map((field) {
                                      final key =
                                          (field['key'] as String?) ?? '';
                                      final label =
                                          (field['label'] as String?) ?? '';
                                      final value = '${field['value'] ?? ''}';
                                      final icon = _getPublicFieldIcon(key);

                                      return Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 10, vertical: 6),
                                        decoration: BoxDecoration(
                                          color:
                                              Colors.white.withOpacity(0.08),
                                          borderRadius:
                                              BorderRadius.circular(12),
                                          border: Border.all(
                                            color: Colors.white
                                                .withOpacity(0.14),
                                          ),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Icon(icon,
                                                size: 14,
                                                color:
                                                    const Color(0xFF818CF8)),
                                            const SizedBox(width: 5),
                                            Text(
                                              label,
                                              style: TextStyle(
                                                fontSize: 11,
                                                color: Colors.white
                                                    .withOpacity(0.6),
                                                fontWeight: FontWeight.w700,
                                              ),
                                            ),
                                            const SizedBox(width: 5),
                                            Text(
                                              value,
                                              style: const TextStyle(
                                                fontSize: 12,
                                                color: Colors.white,
                                                fontWeight: FontWeight.w900,
                                              ),
                                            ),
                                          ],
                                        ),
                                      );
                                    }).toList(),
                                  ),
                                ],
                              ],
                            ),
                          ),
              ),

              // ── 3. Footer Action Buttons ───────────────────────────
              if (!_loading && _error == null) ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(18, 10, 18, 16),
                  child: Column(
                    children: [
                      // Switch to My Card / Back button
                      if (!isSelf && currentUserId != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: BouncyPressable(
                            onTap: () => _switchToUser(currentUserId,
                                fromName: userName),
                            child: Container(
                              width: double.infinity,
                              height: 44,
                              decoration: BoxDecoration(
                                color: const Color(0xFF6366F1),
                                borderRadius: BorderRadius.circular(14),
                              ),
                              alignment: Alignment.center,
                              child: const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Icon(Icons.person_outline_rounded,
                                      size: 17, color: Colors.white),
                                  SizedBox(width: 8),
                                  Text(
                                    'Switch to My Card',
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.white,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),

                      if (_returnUserId != null)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 8),
                          child: BouncyPressable(
                            onTap: _switchBack,
                            child: Container(
                              width: double.infinity,
                              height: 44,
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.10),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                  color: Colors.white.withOpacity(0.16),
                                ),
                              ),
                              alignment: Alignment.center,
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.arrow_back,
                                      size: 16, color: Colors.white),
                                  const SizedBox(width: 8),
                                  Text(
                                    'Back to ${_returnUserName ?? 'User'}',
                                    style: const TextStyle(
                                      fontSize: 13.5,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.white,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),

                      // Talk to Manager / Edit Profile
                      if (isSelf)
                        BouncyPressable(
                          onTap: () {
                            Navigator.of(context).pop();
                            context.push('/profile');
                          },
                          child: Container(
                            width: double.infinity,
                            height: 44,
                            decoration: BoxDecoration(
                              color: const Color(0xFF6366F1),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            alignment: Alignment.center,
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.edit_outlined,
                                    size: 16, color: Colors.white),
                                SizedBox(width: 8),
                                Text(
                                  'Edit Profile',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )
                      else if (canTalkToManager)
                        BouncyPressable(
                          onTap: () {
                            Navigator.of(context).pop();
                            context.push('/support');
                          },
                          child: Container(
                            width: double.infinity,
                            height: 44,
                            decoration: BoxDecoration(
                              color: const Color(0xFF4F46E5),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            alignment: Alignment.center,
                            child: const Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.send_rounded,
                                    size: 16, color: Colors.white),
                                SizedBox(width: 8),
                                Text(
                                  'Talk to Manager',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
