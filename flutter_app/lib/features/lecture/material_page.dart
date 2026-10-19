import 'package:material_ui/material_ui.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/pdf/secure_pdf_viewer.dart';
import '../../shared/widgets/secure_window.dart';

/// Wrapper route for the PDF viewer. Owns the FLAG_SECURE lifecycle and
/// pulls the logged-in user's email so the watermark is anchored to a
/// specific account — same shape as the WatchPage wraps the video player.
class MaterialPage extends ConsumerStatefulWidget {
  const MaterialPage({
    super.key,
    required this.contentId,
    this.contentType = 'CONTENT',
    this.title,
    this.courseId,
    this.courseName,
    this.localPathOverride,
  });

  final String contentId;
  final String contentType;
  final String? title;
  final String? courseId;
  final String? courseName;
  final String? localPathOverride;

  static MaterialPage? fromQuery(Map<String, String> query) {
    final id = query['contentId'] ?? query['id'];
    if (id == null || id.isEmpty) return null;
    return MaterialPage(
      contentId: id,
      contentType: query['contentType'] ?? 'CONTENT',
      title: query['title'],
      courseId: query['courseId'],
      courseName: query['courseName'],
      localPathOverride: query['localPath'],
    );
  }

  @override
  ConsumerState<MaterialPage> createState() => _MaterialPageState();
}

class _MaterialPageState extends ConsumerState<MaterialPage> {
  @override
  void initState() {
    super.initState();
    SecureWindow.enable();
  }

  @override
  void dispose() {
    SecureWindow.disable();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authStateProvider).value;
    final watermark = user?.email ?? user?.name ?? 'Gen-Z IITian';
    return SecurePdfViewer(
      contentId: widget.contentId,
      contentType: widget.contentType,
      title: widget.title,
      courseId: widget.courseId,
      courseName: widget.courseName,
      localPathOverride: widget.localPathOverride,
      watermark: watermark,
    );
  }
}
