import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../theme/app_theme_tokens.dart';
import 'app_avatar.dart';
import 'bouncy_pressable.dart';

/// /api/unread → { community: bool, support: bool, announcements: bool }.
/// We sum the boolean flags into a single badge dot — the server returns
/// boolean unread per channel, not counts.
final unreadProvider = FutureProvider<int>((ref) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.get<Map<String, dynamic>>('/api/unread');
    final data = res.data ?? const <String, dynamic>{};
    var n = 0;
    if (data['community'] == true) n++;
    if (data['support'] == true) n++;
    if (data['announcements'] == true) n++;
    return n;
  } catch (_) {
    return 0;
  }
});

/// Top-of-screen header used on bottom-nav pages. Real-data bound:
///   - avatar initial + greeting → /api/auth/me via authStateProvider
///   - notif badge → /api/unread via unreadProvider
class AppTopBar extends ConsumerWidget {
  const AppTopBar({
    super.key,
    required this.name,
    this.eyebrow = 'WELCOME TO GENZ IITIAN',
    this.onTapBell,
  });

  final String name;
  final String eyebrow;
  final VoidCallback? onTapBell;

  String _initial(String s) {
    final t = s.trim();
    return t.isEmpty ? 'S' : t[0].toUpperCase();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authStateProvider).value;
    final notif = ref.watch(unreadProvider).value ?? 0;
    final tokens = context.tokens;

    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 14, 20, 0),
      child: Row(
        children: [
          AppAvatar(
            avatarUrl: user?.avatar,
            gender: user?.gender,
            size: 42,
            border: Border.all(color: tokens.border),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  eyebrow,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.2,
                    color: tokens.textMuted,
                  ),
                ),
                const SizedBox(height: 1),
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: tokens.textPrimary,
                    letterSpacing: -0.2,
                  ),
                ),
              ],
            ),
          ),
          _IconBtn(
            icon: Icons.notifications_none_outlined,
            badge: notif,
            onTap: onTapBell ?? () => context.go('/notifications'),
          ),
        ],
      ),
    );
  }
}

class _IconBtn extends StatelessWidget {
  const _IconBtn({required this.icon, required this.badge, this.onTap});
  final IconData icon;
  final int badge;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return BouncyPressable(
      onTap: onTap,
      scaleDown: 0.90,
      duration: const Duration(milliseconds: 90),
      reverseDuration: const Duration(milliseconds: 160),
      child: Stack(
        alignment: Alignment.center,
        clipBehavior: Clip.none,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: tokens.surfaceSecondary,
              shape: BoxShape.circle,
              border: Border.all(color: tokens.border),
            ),
            child: Icon(icon, size: 18, color: tokens.textPrimary),
          ),
          if (badge > 0)
            Positioned(
              top: 4,
              right: 4,
              child: Container(
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: tokens.danger,
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: tokens.bg,
                    width: 2,
                  ),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0x66FF3B30),
                      blurRadius: 6,
                      offset: Offset(0, 2),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
