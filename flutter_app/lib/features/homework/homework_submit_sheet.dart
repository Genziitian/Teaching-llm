import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/auth/auth_providers.dart';
import '../../theme/app_theme_tokens.dart';
import '../community/community_file_upload.dart';
import 'homework_providers.dart';

class HomeworkSubmitSheet extends ConsumerStatefulWidget {
  const HomeworkSubmitSheet({
    super.key,
    required this.homework,
    required this.courseId,
    required this.accent,
  });

  final Map<String, dynamic> homework;
  final String courseId;
  final Color accent;

  static Future<void> show(
    BuildContext context, {
    required Map<String, dynamic> homework,
    required String courseId,
    required Color accent,
  }) {
    return showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => HomeworkSubmitSheet(
        homework: homework,
        courseId: courseId,
        accent: accent,
      ),
    );
  }

  @override
  ConsumerState<HomeworkSubmitSheet> createState() => _HomeworkSubmitSheetState();
}

class _HomeworkSubmitSheetState extends ConsumerState<HomeworkSubmitSheet> {
  final _noteController = TextEditingController();
  final List<String> _attachedFileUrls = [];
  bool _isUploading = false;
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final mySub = widget.homework['mySubmission'] as Map<String, dynamic>?;
    if (mySub != null) {
      final prevUrls = (mySub['fileUrls'] as List?)?.cast<String>() ?? [];
      _attachedFileUrls.addAll(prevUrls);
      final prevNote = mySub['note'] as String?;
      if (prevNote != null) {
        _noteController.text = prevNote;
      }
    }
  }

  @override
  void dispose() {
    _noteController.dispose();
    super.dispose();
  }

  Future<void> _pickAndUpload(bool images) async {
    setState(() {
      _isUploading = true;
      _errorMessage = null;
    });
    try {
      final api = ref.read(apiClientProvider);
      final uploaded = await pickCommunityAttachment(api, images: images);
      if (uploaded != null && uploaded['url'] != null) {
        setState(() {
          _attachedFileUrls.add(uploaded['url']!);
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = communityUploadError(e);
      });
    } finally {
      if (mounted) {
        setState(() {
          _isUploading = false;
        });
      }
    }
  }

  Future<void> _submit() async {
    if (_attachedFileUrls.isEmpty && _noteController.text.trim().isEmpty) {
      setState(() {
        _errorMessage = 'Please attach at least one photo/PDF or enter a note.';
      });
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final api = ref.read(apiClientProvider);
      final homeworkId = widget.homework['id'] as String;
      await api.post<dynamic>(
        '/api/homework/$homeworkId/submit',
        body: {
          'fileUrls': _attachedFileUrls,
          'note': _noteController.text.trim(),
        },
      );

      ref.invalidate(homeworkListProvider(widget.courseId));

      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Homework submitted successfully! 🎉'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Submission failed. Please try again.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final title = (widget.homework['title'] as String?) ?? 'Homework';
    final isSubmitted = widget.homework['isSubmitted'] == true;

    return Container(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      decoration: BoxDecoration(
        color: tokens.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: tokens.border,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 16),

            // Header
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isSubmitted ? 'Update Submission' : 'Submit Homework',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: tokens.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 13,
                          color: tokens.textSecondary,
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  color: tokens.textSecondary,
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: 16),

            if (_errorMessage != null)
              Container(
                margin: const EdgeInsets.only(bottom: 14),
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.red.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, color: Colors.red, size: 18),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        _errorMessage!,
                        style: const TextStyle(color: Colors.red, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),

            // Attachment buttons
            Text(
              'Attach Work (Photo or PDF)',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: tokens.textPrimary,
              ),
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _isUploading ? null : () => _pickAndUpload(true),
                    icon: const Icon(Icons.photo_camera_outlined, size: 18),
                    label: const Text('Add Photo'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: widget.accent,
                      side: BorderSide(color: widget.accent.withOpacity(0.4)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _isUploading ? null : () => _pickAndUpload(false),
                    icon: const Icon(Icons.picture_as_pdf_outlined, size: 18),
                    label: const Text('Add PDF'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: widget.accent,
                      side: BorderSide(color: widget.accent.withOpacity(0.4)),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                ),
              ],
            ),

            if (_isUploading)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation(widget.accent),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      'Uploading file...',
                      style: TextStyle(color: tokens.textSecondary, fontSize: 12),
                    ),
                  ],
                ),
              ),

            // List of attached files
            if (_attachedFileUrls.isNotEmpty) ...[
              const SizedBox(height: 12),
              Column(
                children: List.generate(_attachedFileUrls.length, (i) {
                  final url = _attachedFileUrls[i];
                  final name = url.split('/').last;
                  return Container(
                    margin: const EdgeInsets.only(bottom: 6),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: tokens.surfaceSecondary,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: tokens.border),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.insert_drive_file_outlined,
                            size: 16, color: widget.accent),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            name,
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: tokens.textPrimary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        InkWell(
                          onTap: () {
                            setState(() {
                              _attachedFileUrls.removeAt(i);
                            });
                          },
                          child: const Icon(Icons.close, size: 16, color: Colors.red),
                        ),
                      ],
                    ),
                  );
                }),
              ),
            ],

            const SizedBox(height: 14),

            // Note field
            Text(
              'Notes (Optional)',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: tokens.textPrimary,
              ),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _noteController,
              maxLines: 3,
              style: TextStyle(fontSize: 13, color: tokens.textPrimary),
              decoration: InputDecoration(
                hintText: 'Add remarks or answer details...',
                hintStyle: TextStyle(fontSize: 12.5, color: tokens.textMuted),
                filled: true,
                fillColor: tokens.surfaceSecondary,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: tokens.border),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: tokens.border),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide: BorderSide(color: widget.accent),
                ),
              ),
            ),

            const SizedBox(height: 20),

            // Submit Button
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _isSubmitting || _isUploading ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: widget.accent,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(50),
                  ),
                  elevation: 0,
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : Text(
                        isSubmitted ? 'Confirm Update' : 'Submit Homework',
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
