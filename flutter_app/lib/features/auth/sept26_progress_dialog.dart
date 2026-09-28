import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/app_avatar.dart';
import '../../shared/widgets/party_pips.dart';
import '../../theme/app_shadows.dart';
import '../../theme/app_theme_tokens.dart';
import '../profile/profile_page.dart';

/// Full-screen required Sept '26 Term progress update — mirrors Sept26ProgressBlocker.tsx.
/// Blocks students who joined $\ge$ 30 days ago when manager activates the campaign.
/// Cannot be skipped or dismissed.
class Sept26ProgressDialog extends ConsumerStatefulWidget {
  const Sept26ProgressDialog({super.key});

  @override
  ConsumerState<Sept26ProgressDialog> createState() =>
      _Sept26ProgressDialogState();
}

class _Sept26ProgressDialogState extends ConsumerState<Sept26ProgressDialog> {
  final _mobileController = TextEditingController();
  final _instagramController = TextEditingController();
  final _linkedinController = TextEditingController();

  String? _selectedLevel;
  String? _selectedCategory;
  String? _avatarUrl;
  bool _saving = false;
  String? _error;
  bool _showCelebrationModal = false;

  final Set<String> _poppedFields = {};

  static const List<String> _levels = [
    'Qualifier',
    'Foundation',
    'Diploma',
    'Degree',
  ];

  @override
  void initState() {
    super.initState();
    final user = ref.read(authStateProvider).value;
    if (user != null) {
      _avatarUrl = user.avatar;
      _selectedLevel = user.iitmLevel;
      _selectedCategory = user.iitmUserType;
      if (user.mobileNumber != null && user.mobileNumber!.isNotEmpty) {
        final digits = user.mobileNumber!.replaceAll(RegExp(r'\D'), '');
        _mobileController.text = digits.length > 10
            ? digits.substring(digits.length - 10)
            : digits;
      }
      if (user.instagramUrl != null) {
        _instagramController.text = user.instagramUrl!;
      }
      if (user.linkedinUrl != null) {
        _linkedinController.text = user.linkedinUrl!;
      }
    }
  }

  @override
  void dispose() {
    _mobileController.dispose();
    _instagramController.dispose();
    _linkedinController.dispose();
    super.dispose();
  }

  void _triggerCelebration(String fieldKey, {Offset? origin}) {
    if (!_poppedFields.contains(fieldKey)) {
      _poppedFields.add(fieldKey);
      PartyPips.pop(context, origin: origin);
    }
  }

  void _showPhotoSheet() {
    final tokens = context.tokens;
    showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        decoration: BoxDecoration(
          color: tokens.cardBg,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          border: Border.all(color: tokens.border),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: tokens.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              'Profile Photo (Optional)',
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w800,
                color: tokens.textPrimary,
              ),
            ),
            const SizedBox(height: 16),
            ListTile(
              leading: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFF8B5CF6).withOpacity(0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.camera_alt_outlined,
                    color: Color(0xFF8B5CF6)),
              ),
              title: Text('Click Photo',
                  style: TextStyle(
                      fontWeight: FontWeight.w700, color: tokens.textPrimary)),
              subtitle: Text('Take a photo with your camera',
                  style: TextStyle(color: tokens.textSecondary, fontSize: 12)),
              onTap: () {
                Navigator.pop(ctx);
                _showPhotoGuidelines('Click Photo');
              },
            ),
            ListTile(
              leading: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFF3B82F6).withOpacity(0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.photo_library_outlined,
                    color: Color(0xFF3B82F6)),
              ),
              title: Text('Choose Image',
                  style: TextStyle(
                      fontWeight: FontWeight.w700, color: tokens.textPrimary)),
              subtitle: Text('Select from your device gallery',
                  style: TextStyle(color: tokens.textSecondary, fontSize: 12)),
              onTap: () {
                Navigator.pop(ctx);
                _showPhotoGuidelines('Choose Image');
              },
            ),
          ],
        ),
      ),
    );
  }

  void _showPhotoGuidelines(String actionLabel) {
    final tokens = context.tokens;
    showDialog<void>(
      context: context,
      useRootNavigator: true,
      builder: (ctx) => AlertDialog(
        backgroundColor: tokens.cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(
          'Profile Photo (Optional)',
          style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w800,
              color: tokens.textPrimary),
        ),
        content: Text(
          'Max image size is 10 MB. Supported formats: JPG, PNG, WEBP. Profile photo is optional and can be updated anytime.',
          style: TextStyle(
              fontSize: 13.5, height: 1.45, color: tokens.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel',
                style: TextStyle(
                    color: tokens.textMuted, fontWeight: FontWeight.w700)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              setState(() {
                _avatarUrl ??= AppAvatar.getDefaultAvatarAsset(
                    ref.read(authStateProvider).value?.gender);
              });
              _triggerCelebration('photo');
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                    content: Text('Profile photo updated! (Optional)')),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: tokens.primaryAccent,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10)),
              elevation: 0,
            ),
            child: const Text('Select',
                style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  int get _requiredCompletedCount {
    int count = 0;
    if (_selectedLevel != null && _selectedLevel!.isNotEmpty) count++;
    if (_selectedCategory != null && _selectedCategory!.isNotEmpty) count++;
    if (_mobileController.text.trim().length == 10) count++;
    return count;
  }

  double get _progressPercent => (_requiredCompletedCount / 3.0).clamp(0.0, 1.0);

  Future<void> _submit() async {
    setState(() => _error = null);

    if (_selectedLevel == null || _selectedLevel!.isEmpty) {
      setState(() => _error = 'Please select your current IITM Level.');
      return;
    }
    if (_selectedCategory == null || _selectedCategory!.isEmpty) {
      setState(() => _error = 'Please select your IITM Category.');
      return;
    }
    final mobile = _mobileController.text.trim();
    if (!RegExp(r'^\d{10}$').hasMatch(mobile)) {
      setState(() => _error = 'Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!RegExp(r'^[6789]').hasMatch(mobile)) {
      setState(
          () => _error = 'Mobile number must start with 6, 7, 8, or 9.');
      return;
    }

    setState(() => _saving = true);

    try {
      final client = ref.read(apiClientProvider);
      final payload = {
        'iitmLevel': _selectedLevel,
        'iitmUserType': _selectedCategory,
        'mobileNumber': mobile,
        'instagramUrl': _instagramController.text.trim(),
        'linkedinUrl': _linkedinController.text.trim(),
        if (_avatarUrl != null) 'avatar': _avatarUrl,
      };

      await client.put('/api/profile/sept26-progress', body: payload);

      ref.invalidate(profileProvider);

      if (mounted) {
        // Trigger grand celebration pips
        PartyPips.pop(context,
            origin: Offset(MediaQuery.of(context).size.width * 0.3,
                MediaQuery.of(context).size.height * 0.35));
        Future.delayed(const Duration(milliseconds: 200), () {
          if (mounted) {
            PartyPips.pop(context,
                origin: Offset(MediaQuery.of(context).size.width * 0.7,
                    MediaQuery.of(context).size.height * 0.35));
          }
        });

        setState(() {
          _saving = false;
          _showCelebrationModal = true;
        });
      }
    } on DioException catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = e.message ?? 'Something went wrong.';
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = 'Failed to save progress update. Please try again.';
        });
      }
    }
  }

  void _finish() {
    final currentUser = ref.read(authStateProvider).value;
    if (currentUser != null) {
      final oldMobile = currentUser.mobileNumber;
      final newMobile = _mobileController.text.trim();
      final hasMobileChanged =
          oldMobile != null && oldMobile.isNotEmpty && oldMobile != newMobile;

      ref.read(authStateProvider.notifier).updateCurrentUser(
            currentUser.copyWith(
              hasUpdatedProgressSept26: true,
              iitmLevel: _selectedLevel,
              iitmUserType: _selectedCategory,
              mobileNumber: newMobile,
              previousMobileNumber:
                  hasMobileChanged ? oldMobile : currentUser.previousMobileNumber,
              instagramUrl: _instagramController.text.trim(),
              linkedinUrl: _linkedinController.text.trim(),
              avatar: _avatarUrl ?? currentUser.avatar,
            ),
          );
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (_showCelebrationModal) {
      return PopScope(
        canPop: false,
        child: Scaffold(
          backgroundColor: const Color(0xA60F172A),
          body: Center(child: _buildCelebrationView(tokens, isDark)),
        ),
      );
    }

    final user = ref.watch(authStateProvider).value;
    final oldMobile = user?.mobileNumber ?? '';
    final isMobileChanged = oldMobile.isNotEmpty && oldMobile != _mobileController.text.trim();

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: const Color(0xFF0F172A),
        body: Container(
          decoration: const BoxDecoration(
            gradient: RadialGradient(
              center: Alignment.topRight,
              radius: 1.5,
              colors: [Color(0xFF1E1B4B), Color(0xFF0F172A)],
            ),
          ),
          child: SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
                physics: const BouncingScrollPhysics(),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 580),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                    decoration: BoxDecoration(
                      color: tokens.cardBg,
                      borderRadius: BorderRadius.circular(22),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.45),
                          blurRadius: 36,
                          offset: const Offset(0, 16),
                        ),
                      ],
                      border: Border.all(color: tokens.border.withOpacity(0.6)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Header Logo
                        Center(
                          child: Image.asset(
                            'assets/mobile-login-logo.png',
                            height: 32,
                            fit: BoxFit.contain,
                          ),
                        ),
                        const SizedBox(height: 10),

                        // Header Badge
                        Center(
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                colors: [Color(0xFFE0E7FF), Color(0xFFEDE9FE)],
                              ),
                              borderRadius: BorderRadius.circular(50),
                            ),
                            child: const Text(
                              "WELCOME TO SEPT '26 TERM",
                              style: TextStyle(
                                color: Color(0xFF4F46E5),
                                fontSize: 11.5,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.4,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),

                        // Title
                        Text(
                          "Let's Update Your Progress!",
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                            color: tokens.textPrimary,
                            letterSpacing: -0.3,
                          ),
                        ),
                        const SizedBox(height: 14),

                        // Progress Bar
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                            ),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          'TERM REFRESH PROGRESS',
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w800,
                                            color: tokens.textMuted,
                                          ),
                                        ),
                                        Text(
                                          '${(_progressPercent * 100).toInt()}% Completed',
                                          style: TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w800,
                                            color: _progressPercent == 1.0
                                                ? const Color(0xFF10B981)
                                                : const Color(0xFF6366F1),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 6),
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(4),
                                      child: LinearProgressIndicator(
                                        value: _progressPercent,
                                        minHeight: 6,
                                        backgroundColor: isDark
                                            ? const Color(0xFF334155)
                                            : const Color(0xFFE2E8F0),
                                        valueColor: AlwaysStoppedAnimation<Color>(
                                          _progressPercent == 1.0
                                              ? const Color(0xFF10B981)
                                              : const Color(0xFF6366F1),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              if (_progressPercent == 1.0) ...[
                                const SizedBox(width: 10),
                                Container(
                                  width: 24,
                                  height: 24,
                                  decoration: const BoxDecoration(
                                    color: Color(0xFFD1FAE5),
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(
                                    Icons.check_rounded,
                                    size: 16,
                                    color: Color(0xFF059669),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),

                        // Error message if any
                        if (_error != null) ...[
                          const SizedBox(height: 12),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                            decoration: BoxDecoration(
                              color: tokens.danger.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: tokens.danger.withOpacity(0.3)),
                            ),
                            child: Row(
                              children: [
                                Icon(Icons.error_outline, color: tokens.danger, size: 15),
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
                        ],
                        const SizedBox(height: 14),

                        // ── Photo Section ──
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: tokens.surfaceSecondary,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: tokens.border),
                          ),
                          child: Row(
                            children: [
                              GestureDetector(
                                onTap: _showPhotoSheet,
                                child: Stack(
                                  children: [
                                    AppAvatar(
                                      avatarUrl: _avatarUrl,
                                      gender: user?.gender,
                                      size: 56,
                                      border: Border.all(
                                        color: const Color(0xFF6366F1),
                                        width: 2.5,
                                      ),
                                    ),
                                    Positioned(
                                      bottom: 0,
                                      right: 0,
                                      child: Container(
                                        padding: const EdgeInsets.all(3),
                                        decoration: const BoxDecoration(
                                          color: Color(0xFF6366F1),
                                          shape: BoxShape.circle,
                                        ),
                                        child: const Icon(
                                          Icons.camera_alt,
                                          size: 10,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          'Profile Photo',
                                          style: TextStyle(
                                            fontSize: 13.5,
                                            fontWeight: FontWeight.w800,
                                            color: tokens.textPrimary,
                                          ),
                                        ),
                                        const SizedBox(width: 6),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFEFF0FE),
                                            borderRadius: BorderRadius.circular(12),
                                          ),
                                          child: const Text(
                                            'Optional',
                                            style: TextStyle(
                                              fontSize: 10.5,
                                              fontWeight: FontWeight.w700,
                                              color: Color(0xFF6366F1),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      'Optional — Keep your existing photo or upload a fresh one for the new term.',
                                      style: TextStyle(
                                        fontSize: 11.5,
                                        color: tokens.textMuted,
                                        height: 1.3,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    Row(
                                      children: [
                                        ElevatedButton(
                                          onPressed: _showPhotoSheet,
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: const Color(0xFF6366F1),
                                            foregroundColor: Colors.white,
                                            elevation: 0,
                                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                            minimumSize: const Size(0, 28),
                                            shape: RoundedRectangleBorder(
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                          ),
                                          child: Text(
                                            _avatarUrl != null ? 'Change Photo' : 'Upload Photo',
                                            style: const TextStyle(
                                              fontSize: 11.5,
                                              fontWeight: FontWeight.w700,
                                            ),
                                          ),
                                        ),
                                        if (_avatarUrl != null) ...[
                                          const SizedBox(width: 8),
                                          OutlinedButton(
                                            onPressed: () => setState(() => _avatarUrl = null),
                                            style: OutlinedButton.styleFrom(
                                              foregroundColor: tokens.danger,
                                              side: BorderSide(
                                                color: tokens.danger.withOpacity(0.3),
                                              ),
                                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                              minimumSize: const Size(0, 28),
                                              shape: RoundedRectangleBorder(
                                                borderRadius: BorderRadius.circular(8),
                                              ),
                                            ),
                                            child: const Text(
                                              'Remove',
                                              style: TextStyle(
                                                fontSize: 11.5,
                                                fontWeight: FontWeight.w600,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 14),

                        // ── Field 1: Which IITM Level are You in Now? ──
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              '1. Which IITM Level are You in Now?',
                              style: TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w800,
                                color: tokens.textPrimary,
                              ),
                            ),
                            if (_selectedLevel != null)
                              Text(
                                '$_selectedLevel ✓',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF6366F1),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        GridView.count(
                          crossAxisCount: 2,
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          mainAxisSpacing: 8,
                          crossAxisSpacing: 8,
                          childAspectRatio: 3.4,
                          children: _levels.map((level) {
                            final isSelected = _selectedLevel == level;
                            return InkWell(
                              onTap: () {
                                setState(() => _selectedLevel = level);
                                _triggerCelebration('level');
                              },
                              borderRadius: BorderRadius.circular(12),
                              child: Container(
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: isSelected ? const Color(0xFFEFF0FE) : tokens.surface,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: isSelected ? const Color(0xFF6366F1) : tokens.border,
                                    width: 2,
                                  ),
                                  boxShadow: isSelected
                                      ? [
                                          BoxShadow(
                                            color: const Color(0xFF6366F1).withOpacity(0.2),
                                            blurRadius: 8,
                                            offset: const Offset(0, 3),
                                          ),
                                        ]
                                      : null,
                                ),
                                child: Text(
                                  level,
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w700,
                                    color: isSelected ? const Color(0xFF4F46E5) : tokens.textSecondary,
                                  ),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                        const SizedBox(height: 14),

                        // ── Field 2: Are You Currently: ──
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              '2. Are You Currently:',
                              style: TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w800,
                                color: tokens.textPrimary,
                              ),
                            ),
                            if (_selectedCategory != null)
                              const Text(
                                'Selected ✓',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF6366F1),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            Expanded(
                              child: _buildCategoryButton(
                                key: 'STANDALONE',
                                label: 'Standalone',
                                tokens: tokens,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: _buildCategoryButton(
                                key: 'DUAL DEGREE',
                                label: 'Dual Degree',
                                tokens: tokens,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        _buildCategoryButton(
                          key: 'WORKING PROFESSIONAL',
                          label: 'Working Professional',
                          tokens: tokens,
                        ),
                        const SizedBox(height: 14),

                        // ── Field 3: Mobile Number ──
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              '3. Mobile Number (Update if Changed)',
                              style: TextStyle(
                                fontSize: 13.5,
                                fontWeight: FontWeight.w800,
                                color: tokens.textPrimary,
                              ),
                            ),
                            if (_mobileController.text.trim().length == 10 &&
                                RegExp(r'^[6789]\d{9}$').hasMatch(_mobileController.text.trim()))
                              const Text(
                                'Verified ✓',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF10B981),
                                ),
                              )
                            else if (_mobileController.text.isNotEmpty)
                              Text(
                                '${_mobileController.text.length}/10 digits',
                                style: const TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: Color(0xFF6366F1),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Container(
                          decoration: BoxDecoration(
                            color: tokens.surface,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: (_mobileController.text.trim().length == 10 &&
                                      RegExp(r'^[6789]\d{9}$').hasMatch(_mobileController.text.trim()))
                                  ? const Color(0xFF10B981)
                                  : tokens.border,
                              width: 2,
                            ),
                          ),
                          child: Row(
                            children: [
                              const Padding(
                                padding: EdgeInsets.only(left: 14, right: 6),
                                child: Text(
                                  '+91',
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF64748B),
                                  ),
                                ),
                              ),
                              Expanded(
                                child: TextField(
                                  controller: _mobileController,
                                  keyboardType: TextInputType.phone,
                                  maxLength: 10,
                                  buildCounter: (context, {required currentLength, required isFocused, maxLength}) => null,
                                  inputFormatters: [
                                    FilteringTextInputFormatter.digitsOnly,
                                    LengthLimitingTextInputFormatter(10),
                                  ],
                                  onChanged: (val) {
                                    setState(() {});
                                    if (val.length == 10 && RegExp(r'^[6789]').hasMatch(val)) {
                                      _triggerCelebration('mobile');
                                    }
                                  },
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: tokens.textPrimary,
                                    letterSpacing: 0.5,
                                  ),
                                  decoration: InputDecoration(
                                    hintText: 'Enter 10-digit number (starts with 6-9)',
                                    hintStyle: TextStyle(
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.w500,
                                      color: tokens.textMuted,
                                    ),
                                    border: InputBorder.none,
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 11),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (isMobileChanged) ...[
                          const SizedBox(height: 6),
                          const Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(Icons.warning_amber_rounded, size: 13, color: Color(0xFFD97706)),
                              SizedBox(width: 5),
                              Expanded(
                                child: Text(
                                  'Notice: Changing mobile number. Old number will be securely archived for audit.',
                                  style: TextStyle(
                                    fontSize: 11,
                                    color: Color(0xFFD97706),
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                        const SizedBox(height: 14),

                        // ── Field 4: Social Card Links (Optional) ──
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: tokens.surfaceSecondary,
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: tokens.border),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Text(
                                    '4. Social Card Links (Optional)',
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w800,
                                      color: tokens.textPrimary,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFEFF0FE),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: const Text(
                                      'Optional',
                                      style: TextStyle(
                                        fontSize: 10.5,
                                        fontWeight: FontWeight.w700,
                                        color: Color(0xFF6366F1),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 10),
                              Text(
                                'Instagram Profile Link',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: tokens.textSecondary,
                                ),
                              ),
                              const SizedBox(height: 4),
                              TextField(
                                controller: _instagramController,
                                style: TextStyle(fontSize: 12, color: tokens.textPrimary),
                                decoration: InputDecoration(
                                  hintText: 'https://instagram.com/...',
                                  hintStyle: TextStyle(fontSize: 12, color: tokens.textMuted),
                                  filled: true,
                                  fillColor: tokens.surface,
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(8),
                                    borderSide: BorderSide(color: tokens.border),
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(8),
                                    borderSide: BorderSide(color: tokens.border),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 10),
                              Text(
                                'LinkedIn Profile Link',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: tokens.textSecondary,
                                ),
                              ),
                              const SizedBox(height: 4),
                              TextField(
                                controller: _linkedinController,
                                style: TextStyle(fontSize: 12, color: tokens.textPrimary),
                                decoration: InputDecoration(
                                  hintText: 'https://linkedin.com/in/...',
                                  hintStyle: TextStyle(fontSize: 12, color: tokens.textMuted),
                                  filled: true,
                                  fillColor: tokens.surface,
                                  contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(8),
                                    borderSide: BorderSide(color: tokens.border),
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(8),
                                    borderSide: BorderSide(color: tokens.border),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),

                        // Submit Button
                        SizedBox(
                          width: double.infinity,
                          height: 48,
                          child: ElevatedButton(
                            onPressed: _saving ? null : _submit,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF6366F1),
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(14),
                              ),
                              elevation: 0,
                            ),
                            child: _saving
                                ? const Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: CircularProgressIndicator(
                                          strokeWidth: 2,
                                          color: Colors.white,
                                        ),
                                      ),
                                      SizedBox(width: 8),
                                      Text(
                                        'Saving Progress...',
                                        style: TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w800,
                                        ),
                                      ),
                                    ],
                                  )
                                : const Text(
                                    'Save Progress & Enter Dashboard',
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCategoryButton({
    required String key,
    required String label,
    required AppThemeTokens tokens,
  }) {
    final isSelected = _selectedCategory == key;
    return InkWell(
      onTap: () {
        setState(() => _selectedCategory = key);
        _triggerCelebration('category');
      },
      borderRadius: BorderRadius.circular(12),
      child: Container(
        height: 42,
        alignment: Alignment.center,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFEFF0FE) : tokens.surface,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? const Color(0xFF6366F1) : tokens.border,
            width: 2,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: const Color(0xFF6366F1).withOpacity(0.2),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ]
              : null,
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: isSelected ? const Color(0xFF4F46E5) : tokens.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _buildCelebrationView(AppThemeTokens tokens, bool isDark) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 440),
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 26),
        decoration: BoxDecoration(
          color: tokens.cardBg,
          borderRadius: BorderRadius.circular(24),
          boxShadow: AppShadows.lg,
          border: Border.all(color: tokens.border),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFF10B981), Color(0xFF059669)],
                ),
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: Icon(Icons.check_rounded, color: Colors.white, size: 32),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              "You're All Set for Sept '26!",
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                color: tokens.textPrimary,
                letterSpacing: -0.3,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              'Your current IITM Level has been updated to $_selectedLevel.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13.5,
                height: 1.5,
                color: tokens.textSecondary,
              ),
            ),
            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withOpacity(0.08),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: const Color(0xFF10B981).withOpacity(0.25),
                ),
              ),
              child: const Text(
                'Best of luck for an incredible new term with GenZ IITian!',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Color(0xFF059669),
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _finish,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF6366F1),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                child: const Text(
                  'Continue to Dashboard →',
                  style: TextStyle(
                    fontSize: 15,
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
