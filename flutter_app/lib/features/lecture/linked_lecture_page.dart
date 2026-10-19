import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/youtube/youtube_utils.dart';
import 'material_page.dart' as lecture_material;
import 'watch_page.dart';

typedef LinkedLecture = ({String contentId, String courseId});

// Resolve the content through the same authenticated, enrollment-checked API
// used by the website. Never trust a video URL supplied by a shared link.
final linkedLectureProvider = FutureProvider.autoDispose
    .family<Map<String, dynamic>, LinkedLecture>((ref, link) async {
  final response = await ref.watch(apiClientProvider).get<dynamic>(
    '/api/content/${Uri.encodeComponent(link.contentId)}',
    query: {'courseId': link.courseId},
  );
  if (response.data is! Map) throw const FormatException('Invalid lecture');
  return Map<String, dynamic>.from(response.data as Map);
});

class LinkedLecturePage extends ConsumerWidget {
  const LinkedLecturePage({
    super.key,
    required this.contentId,
    required this.courseId,
    this.preferDrive = false,
  });

  final String contentId;
  final String courseId;
  final bool preferDrive;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final link = (contentId: contentId, courseId: courseId);
    final lecture = ref.watch(linkedLectureProvider(link));
    return lecture.when(
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      ),
      error: (error, _) => _message(
        context,
        error is DioException && error.response?.statusCode == 403
            ? 'You do not have access to this lecture.'
            : error is DioException && error.response?.statusCode == 404
                ? 'This lecture is no longer available.'
                : 'Could not load this lecture. Please try again.',
        retry: () => ref.invalidate(linkedLectureProvider(link)),
      ),
      data: (content) {
        if (content['isDemoLocked'] == true) {
          return _message(context, 'This lecture requires full course access.');
        }
        final title = content['title'] as String?;
        final course = (content['topic'] as Map?)?['course'] as Map?;
        final courseName = course?['name'] as String?;
        String? youtubeId;
        for (final source in [content['youtubeUrl'], content['videoUrl']]) {
          if (source is String) {
            youtubeId = YouTubeUtils.extractVideoId(source);
            if (youtubeId != null) break;
          }
        }
        final driveUrl = content['videoUrl'] as String?;
        final hasDrive = driveUrl != null &&
            driveUrl.isNotEmpty &&
            YouTubeUtils.extractVideoId(driveUrl) == null;
        if (youtubeId != null && !(preferDrive && hasDrive)) {
          return WatchPage(
            source: VideoSource.youtube,
            youtubeVideoId: youtubeId,
            contentId: contentId,
            courseId: courseId,
            courseName: courseName,
            title: title,
          );
        }
        if (hasDrive) {
          return WatchPage(
            source: VideoSource.drive,
            driveContentId: contentId,
            contentId: contentId,
            courseId: courseId,
            courseName: courseName,
            title: title,
          );
        }
        if ((content['pptUrl'] as String?)?.isNotEmpty == true) {
          return lecture_material.MaterialPage(
            contentId: contentId,
            courseId: courseId,
            courseName: courseName,
            title: title,
          );
        }
        return _message(context, 'This lecture has no playable content.');
      },
    );
  }

  Widget _message(BuildContext context, String message, {VoidCallback? retry}) {
    return Scaffold(
      appBar: AppBar(title: const Text('Lecture')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(message, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              if (retry != null)
                TextButton(onPressed: retry, child: const Text('Try again')),
              TextButton(
                onPressed: () =>
                    context.go(Uri(path: '/courses/$courseId').toString()),
                child: const Text('Open course'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
