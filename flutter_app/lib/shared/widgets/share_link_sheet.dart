import 'package:flutter/services.dart';
import 'package:material_symbols_icons/symbols.dart';
import 'package:material_ui/material_ui.dart';
import 'package:share_plus/share_plus.dart';

import '../../theme/app_theme_tokens.dart';
import 'apple_pressable.dart';

/// Apple-style sheet with a shareable link: copy it or hand it to the system
/// share sheet (WhatsApp, Telegram, Messages, ...).
Future<void> showShareLinkSheet(
  BuildContext context, {
  required String title,
  required String message,
  required String link,
}) {
  return showModalBottomSheet<void>(
    context: context,
    useRootNavigator: true,
    backgroundColor: Colors.transparent,
    isScrollControlled: true,
    builder: (_) => _ShareLinkSheet(title: title, message: message, link: link),
  );
}

class _ShareLinkSheet extends StatefulWidget {
  const _ShareLinkSheet({
    required this.title,
    required this.message,
    required this.link,
  });
  final String title;
  final String message;
  final String link;

  @override
  State<_ShareLinkSheet> createState() => _ShareLinkSheetState();
}

class _ShareLinkSheetState extends State<_ShareLinkSheet> {
  bool _copied = false;

  String get _text => '${widget.message}\n\n${widget.link}';

  Future<void> _copy() async {
    HapticFeedback.selectionClick();
    await Clipboard.setData(ClipboardData(text: widget.link));
    if (!mounted) return;
    setState(() => _copied = true);
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _copied = false);
    });
  }

  Future<void> _share() async {
    try {
      await Share.share(_text, subject: widget.title);
    } catch (_) {
      await Clipboard.setData(ClipboardData(text: _text));
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Link copied to clipboard.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final bottom = MediaQuery.of(context).padding.bottom;
    return Container(
      padding: EdgeInsets.fromLTRB(20, 10, 20, 20 + bottom),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 5,
              decoration: BoxDecoration(
                color: tokens.textMuted.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(3),
              ),
            ),
          ),
          const SizedBox(height: 18),
          Text(
            'Share with friends',
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.5,
              color: tokens.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            widget.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 15, color: tokens.textSecondary),
          ),
          const SizedBox(height: 16),
          ApplePressable(
            onTap: _copy,
            child: Container(
              padding: const EdgeInsets.fromLTRB(14, 12, 12, 12),
              decoration: BoxDecoration(
                color: tokens.isDark
                    ? const Color(0xFF2C2C2E)
                    : const Color(0xFFF2F2F7),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      widget.link,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          fontSize: 15, color: tokens.textSecondary),
                    ),
                  ),
                  const SizedBox(width: 8),
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 180),
                    child: Icon(
                      _copied
                          ? Symbols.check_circle_rounded
                          : Symbols.content_copy_rounded,
                      key: ValueKey(_copied),
                      fill: _copied ? 1 : 0,
                      size: 20,
                      color:
                          _copied ? tokens.success : tokens.primaryAccent,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 14),
          ApplePressable(
            onTap: _share,
            child: Container(
              height: 52,
              decoration: BoxDecoration(
                color: tokens.primaryAccent,
                borderRadius: BorderRadius.circular(16),
              ),
              alignment: Alignment.center,
              child: const Text(
                'Share',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 17,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
