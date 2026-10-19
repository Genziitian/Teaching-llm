import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../theme/app_theme_tokens.dart';

/// Native renderer for the question types supported by the web prompt editor.
class PromptResult {
  const PromptResult({this.link});
  final String? link;
}

class DynamicPromptDialog extends StatefulWidget {
  const DynamicPromptDialog({
    super.key,
    required this.prompt,
    required this.onSubmit,
  });

  final Map<String, dynamic> prompt;
  final Future<void> Function(Map<String, String> answers) onSubmit;

  @override
  State<DynamicPromptDialog> createState() => _DynamicPromptDialogState();
}

class _DynamicPromptDialogState extends State<DynamicPromptDialog> {
  final Map<String, String> _answers = {};
  List<dynamic> _questions = [];
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final rawQuestions = widget.prompt['questions'];
    if (rawQuestions is String) {
      try {
        _questions = jsonDecode(rawQuestions) as List<dynamic>;
      } catch (_) {
        _questions = [];
      }
    } else if (rawQuestions is List) {
      _questions = rawQuestions;
    }
  }

  void _handleAnswerChange(String questionId, String val) {
    HapticFeedback.selectionClick();
    setState(() {
      _answers[questionId] = val;
      _error = null;
    });
  }

  Future<void> _handleCTAClick(String questionId, String? link) async {
    if (_submitting) return;
    _handleAnswerChange(questionId, 'CLICKED');
    await _onSubmitForm(link: link);
  }

  Future<void> _submitResponse({String? link}) async {
    if (_submitting) return;
    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await widget.onSubmit(Map<String, String>.from(_answers));
      if (mounted) Navigator.of(context).pop(PromptResult(link: link));
    } catch (_) {
      if (mounted) {
        setState(() {
          _submitting = false;
          _error = 'Failed to submit response. Please try again.';
        });
      }
    }
  }

  Future<void> _onSubmitForm({String? link}) async {
    for (final q in _questions) {
      if (q is Map) {
        final qId = q['id']?.toString() ?? '';
        final qType = q['type']?.toString() ?? '';
        if (qType != 'CTA_ONLY' &&
            (_answers[qId] == null || _answers[qId]!.isEmpty)) {
          setState(
              () => _error = 'Please answer all questions before continuing.');
          return;
        }
      }
    }

    await _submitResponse(link: link);
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    final title = (widget.prompt['title'] as String?) ?? 'Important Notice';
    final description = widget.prompt['description'] as String?;

    return PopScope(
      canPop: false,
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.90,
        ),
        decoration: BoxDecoration(
          color: tokens.cardBg,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Drag handle
            Center(
              child: Container(
                margin: const EdgeInsets.only(top: 10, bottom: 6),
                width: 36,
                height: 5,
                decoration: BoxDecoration(
                  color: tokens.textMuted.withOpacity(0.4),
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),

            Expanded(
              child: SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(
                  20,
                  10,
                  20,
                  MediaQuery.of(context).viewInsets.bottom + 24,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Title & Description
                    Center(
                      child: Column(
                        children: [
                          Container(
                            width: 58,
                            height: 58,
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFF7D7AFF), Color(0xFF5856D6)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              ),
                              borderRadius: BorderRadius.circular(18),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF5856D6)
                                      .withOpacity(0.28),
                                  blurRadius: 16,
                                  offset: const Offset(0, 7),
                                ),
                              ],
                            ),
                            child: const Icon(
                              Icons.rate_review_rounded,
                              color: Colors.white,
                              size: 24,
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            title,
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 23,
                              fontWeight: FontWeight.w800,
                              color: tokens.textPrimary,
                              letterSpacing: -0.6,
                            ),
                          ),
                          if (description != null &&
                              description.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Text(
                              description,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 13.5,
                                color: tokens.textSecondary,
                                height: 1.4,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),

                    const SizedBox(height: 20),

                    // Error alert
                    if (_error != null) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: tokens.danger.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(16),
                          border:
                              Border.all(color: tokens.danger.withOpacity(0.3)),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.error_outline,
                                color: tokens.danger, size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _error!,
                                style: TextStyle(
                                  color: tokens.danger,
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Dynamic Questions List
                    for (final q in _questions)
                      if (q is Map) _buildQuestionWidget(q, tokens, isDark),

                    const SizedBox(height: 24),

                    // Submit Button
                    SizedBox(
                      height: 54,
                      child: ElevatedButton(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF5856D6),
                          foregroundColor: Colors.white,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(27),
                          ),
                          elevation: 0,
                        ),
                        onPressed: _submitting ? null : _onSubmitForm,
                        child: _submitting
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.4,
                                  color: Colors.white,
                                ),
                              )
                            : const Text(
                                'Submit & Continue',
                                style: TextStyle(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuestionWidget(
      Map<dynamic, dynamic> q, AppThemeTokens tokens, bool isDark) {
    final qId = q['id']?.toString() ?? '';
    final text = q['text']?.toString() ?? '';
    final type = q['type']?.toString() ?? 'YES_NO';

    return Padding(
      padding: const EdgeInsets.only(bottom: 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            text,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: tokens.textPrimary,
            ),
          ),
          const SizedBox(height: 10),
          if (type == 'YES_NO') ...[
            Row(
              children: ['Yes', 'No'].map((opt) {
                final isSelected = _answers[qId] == opt;
                return Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    child: InkWell(
                      onTap: () => _handleAnswerChange(qId, opt),
                      borderRadius: BorderRadius.circular(16),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: isSelected
                              ? (isDark
                                  ? const Color(0xFF312E81)
                                  : const Color(0xFFEEF2FF))
                              : tokens.surfaceSecondary,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(
                            color: isSelected
                                ? const Color(0xFF5856D6)
                                : tokens.border,
                            width: isSelected ? 1.5 : 0.5,
                          ),
                        ),
                        child: Text(
                          opt,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: isSelected
                                ? (isDark
                                    ? const Color(0xFFA5B4FC)
                                    : const Color(0xFF4338CA))
                                : tokens.textSecondary,
                          ),
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ] else if (type == 'MULTIPLE_CHOICE') ...[
            Column(
              children: ((q['options'] as List<dynamic>?) ?? []).map((opt) {
                final optStr = opt.toString();
                final isSelected = _answers[qId] == optStr;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: InkWell(
                    onTap: () => _handleAnswerChange(qId, optStr),
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 14, vertical: 12),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? (isDark
                                ? const Color(0xFF312E81)
                                : const Color(0xFFEEF2FF))
                            : tokens.surfaceSecondary,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: isSelected
                              ? const Color(0xFF5856D6)
                              : tokens.border,
                          width: isSelected ? 1.5 : 0.5,
                        ),
                      ),
                      child: Row(
                        children: [
                          Expanded(
                            child: Text(
                              optStr,
                              style: TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w600,
                                color: isSelected
                                    ? (isDark
                                        ? const Color(0xFFA5B4FC)
                                        : const Color(0xFF4338CA))
                                    : tokens.textPrimary,
                              ),
                            ),
                          ),
                          if (isSelected)
                            Container(
                              width: 18,
                              height: 18,
                              decoration: const BoxDecoration(
                                color: Color(0xFF5856D6),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(
                                Icons.check,
                                color: Colors.white,
                                size: 12,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ] else if (type == 'CTA_ONLY') ...[
            SizedBox(
              width: double.infinity,
              height: 46,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: tokens.textPrimary,
                  foregroundColor: tokens.bg,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),
                  ),
                  elevation: 0,
                ),
                onPressed: _submitting
                    ? null
                    : () => _handleCTAClick(qId, q['link']?.toString()),
                child: Text(
                  q['linkText']?.toString() ?? 'Click Here',
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
