import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/app_avatar.dart';
import '../../shared/widgets/bouncy_pressable.dart';
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

  static const List<Map<String, String>> _categories = [
    {'key': 'STANDALONE', 'label': 'STANDALONE'},
    {'key': 'DUAL DEGREE', 'label': 'DUAL DEGREE'},
    {'key': 'WORKING PROFESSIONAL', 'label': 'WORKING PROFESSIONAL'},
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

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: tokens.bg,
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 580),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 24, vertical: 28),
                  decoration: BoxDecoration(
                    color: tokens.cardBg,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(isDark ? 0.35 : 0.08),
                        blurRadius: 36,
                        offset: const Offset(0, 16),
                      ),
                    ],
                    border: Border.all(color: tokens.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Header Badge
                      Center(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 6),
                          decoration: BoxDecoration(
                            color: const Color(0xFF6366F1).withOpacity(0.12),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: const Color(0xFF6366F1).withOpacity(0.3),
                            ),
                          ),
                          child: const Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text('✨', style: TextStyle(fontSize: 14)),
                              SizedBox(width: 6),
                              Text(
                                "Sept '26 Term Update",
                                style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF6366F1),
                                  letterSpacing: 0.2,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),

                      // Title
                      Text(
                        "Welcome to Sept '26 Term! 🎉",
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w900,
                          color: tokens.textPrimary,
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 8),

                      // Subtitle
                      Text(
                        "Let's update your progress to tailor your upcoming courses, groups, and mentorship sessions.",
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 14,
                          height: 1.5,
                          color: tokens.textSecondary,
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Live Progress Bar
                      Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: tokens.surface,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: tokens.border),
                        ),
                        child: Column(
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Progress',
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w700,
                                    color: tokens.textSecondary,
                                  ),
                                ),
                                Text(
                                  '${(_progressPercent * 100).toInt()}% Complete ($_requiredCompletedCount/3 required)',
                                  style: const TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w800,
                                    color: Color(0xFF6366F1),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            ClipRRect(
                              borderRadius: BorderRadius.circular(6),
                              child: LinearProgressIndicator(
                                value: _progressPercent,
                                minHeight: 7,
                                backgroundColor: isDark
                                    ? const Color(0xFF1E293B)
                                    : const Color(0xFFE2E8F0),
                                valueColor: const AlwaysStoppedAnimation<Color>(
                                  Color(0xFF6366F1),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Error message if any
                      if (_error != null) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 14, vertical: 11),
                          decoration: BoxDecoration(
                            color: tokens.danger.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(
                              color: tokens.danger.withOpacity(0.3),
                            ),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.error_outline,
                                  color: tokens.danger, size: 16),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  _error!,
                                  style: TextStyle(
                                    color: tokens.danger,
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 20),
                      ],

                      // ── FIELD 1: Profile Photo (Optional) ──
                      Center(
                        child: Column(
                          children: [
                            Stack(
                              children: [
                                AppAvatar(
                                  avatarUrl: _avatarUrl,
                                  gender: user?.gender,
                                  size: 82,
                                  border: Border.all(
                                    color: const Color(0xFF6366F1)
                                        .withOpacity(0.35),
                                    width: 2.5,
                                  ),
                                ),
                                Positioned(
                                  bottom: 0,
                                  right: 0,
                                  child: Container(
                                    padding: const EdgeInsets.all(5),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF6366F1),
                                      shape: BoxShape.circle,
                                      border: Border.all(
                                          color: tokens.cardBg, width: 2),
                                    ),
                                    child: const Icon(
                                      Icons.camera_alt,
                                      size: 13,
                                      color: Colors.white,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 10),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                BouncyPressable(
                                  onTap: _showPhotoSheet,
                                  scaleDown: 0.96,
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 14, vertical: 6),
                                    decoration: BoxDecoration(
                                      color: tokens.surfaceSecondary,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(color: tokens.border),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(Icons.photo_camera_outlined,
                                            size: 14,
                                            color: tokens.textPrimary),
                                        const SizedBox(width: 6),
                                        Text(
                                          _avatarUrl != null
                                              ? 'Change Photo'
                                              : 'Add Photo (Optional)',
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.w700,
                                            color: tokens.textPrimary,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                                if (_avatarUrl != null) ...[
                                  const SizedBox(width: 8),
                                  BouncyPressable(
                                    onTap: () =>
                                        setState(() => _avatarUrl = null),
                                    scaleDown: 0.96,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                          horizontal: 10, vertical: 6),
                                      decoration: BoxDecoration(
                                        color: tokens.danger.withOpacity(0.1),
                                        borderRadius:
                                            BorderRadius.circular(10),
                                        border: Border.all(
                                          color: tokens.danger.withOpacity(0.3),
                                        ),
                                      ),
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Icon(Icons.close,
                                              size: 13, color: tokens.danger),
                                          const SizedBox(width: 4),
                                          Text(
                                            'Remove',
                                            style: TextStyle(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w700,
                                              color: tokens.danger,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                            const SizedBox(height: 5),
                            Text(
                              'Profile photo is optional',
                              style: TextStyle(
                                fontSize: 11.5,
                                color: tokens.textMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // ── FIELD 2: IITM Level ──
                      _buildSectionHeader('Current IITM Level *', tokens),
                      const SizedBox(height: 10),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: _levels.map((level) {
                          final isSelected = _selectedLevel == level;
                          return InkWell(
                            onTap: () {
                              setState(() => _selectedLevel = level);
                              _triggerCelebration('level');
                            },
                            borderRadius: BorderRadius.circular(10),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 180),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 10),
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? const Color(0xFF6366F1)
                                    : tokens.surface,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: isSelected
                                      ? const Color(0xFF6366F1)
                                      : tokens.border,
                                  width: isSelected ? 2 : 1,
                                ),
                              ),
                              child: Text(
                                level,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: isSelected
                                      ? Colors.white
                                      : tokens.textSecondary,
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 24),

                      // ── FIELD 3: IITM Category ──
                      _buildSectionHeader('IITM Category *', tokens),
                      const SizedBox(height: 10),
                      Column(
                        children: _categories.map((cat) {
                          final key = cat['key']!;
                          final label = cat['label']!;
                          final isSelected = _selectedCategory == key;

                          return Padding(
                            padding: const EdgeInsets.only(bottom: 8),
                            child: InkWell(
                              onTap: () {
                                setState(() => _selectedCategory = key);
                                _triggerCelebration('category');
                              },
                              borderRadius: BorderRadius.circular(12),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 180),
                                width: double.infinity,
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 16, vertical: 12),
                                decoration: BoxDecoration(
                                  color: isSelected
                                      ? (isDark
                                          ? const Color(0xFF312E81)
                                          : const Color(0xFFEEF2FF))
                                      : tokens.surface,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: isSelected
                                        ? const Color(0xFF6366F1)
                                        : tokens.border,
                                    width: isSelected ? 2 : 1,
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Icon(
                                      isSelected
                                          ? Icons.radio_button_checked
                                          : Icons.radio_button_off,
                                      size: 18,
                                      color: isSelected
                                          ? const Color(0xFF6366F1)
                                          : tokens.textMuted,
                                    ),
                                    const SizedBox(width: 10),
                                    Text(
                                      label,
                                      style: TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                        color: isSelected
                                            ? const Color(0xFF6366F1)
                                            : tokens.textPrimary,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                      const SizedBox(height: 20),

                      // ── FIELD 4: Mobile Number ──
                      _buildSectionHeader('Mobile Number *', tokens),
                      const SizedBox(height: 6),
                      TextField(
                        controller: _mobileController,
                        keyboardType: TextInputType.phone,
                        inputFormatters: [
                          FilteringTextInputFormatter.digitsOnly,
                          LengthLimitingTextInputFormatter(10),
                        ],
                        onChanged: (val) {
                          if (val.length == 10) {
                            _triggerCelebration('mobile');
                          }
                        },
                        style: TextStyle(
                            fontSize: 14, color: tokens.textPrimary),
                        decoration: _inputDecoration('10-digit number', tokens),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(Icons.shield_outlined,
                              size: 13, color: tokens.textMuted),
                          const SizedBox(width: 5),
                          Expanded(
                            child: Text(
                              oldMobile.isNotEmpty
                                  ? 'Current registered: +91 $oldMobile. Old numbers are archived for security.'
                                  : 'Used for instant SMS & batch notifications.',
                              style: TextStyle(
                                fontSize: 11.5,
                                color: tokens.textMuted,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),

                      // ── FIELD 5: Social Card Links (Optional) ──
                      _buildSectionHeader(
                          'Social Links (Optional for Student Card)', tokens),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _instagramController,
                        style: TextStyle(
                            fontSize: 14, color: tokens.textPrimary),
                        decoration: _inputDecoration(
                          'Instagram username or URL',
                          tokens,
                          prefixIcon: Icons.camera_alt_outlined,
                        ),
                      ),
                      const SizedBox(height: 10),
                      TextField(
                        controller: _linkedinController,
                        style: TextStyle(
                            fontSize: 14, color: tokens.textPrimary),
                        decoration: _inputDecoration(
                          'LinkedIn profile URL',
                          tokens,
                          prefixIcon: Icons.link_rounded,
                        ),
                      ),
                      const SizedBox(height: 32),

                      // Submit Button
                      SizedBox(
                        height: 52,
                        child: ElevatedButton(
                          onPressed: _saving ? null : _submit,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF6366F1),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(14),
                            ),
                            elevation: 0,
                            shadowColor: const Color(0x4D6366F1),
                          ),
                          child: _saving
                              ? const SizedBox(
                                  width: 22,
                                  height: 22,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2.4,
                                    color: Colors.white,
                                  ),
                                )
                              : const Text(
                                  "Confirm & Update for Sept '26 🚀",
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
    );
  }

  Widget _buildSectionHeader(String title, AppThemeTokens tokens) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w700,
        color: tokens.textPrimary,
        letterSpacing: 0.1,
      ),
    );
  }

  InputDecoration _inputDecoration(
    String hint,
    AppThemeTokens tokens, {
    IconData? prefixIcon,
  }) {
    return InputDecoration(
      hintText: hint,
      prefixIcon: prefixIcon != null
          ? Icon(prefixIcon, size: 18, color: tokens.textMuted)
          : null,
      hintStyle: TextStyle(fontSize: 14, color: tokens.textMuted),
      filled: true,
      fillColor: tokens.surface,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: tokens.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: BorderSide(color: tokens.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(10),
        borderSide: const BorderSide(color: Color(0xFF6366F1), width: 1.8),
      ),
    );
  }

  Widget _buildCelebrationView(AppThemeTokens tokens, bool isDark) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 480),
      child: Container(
        margin: const EdgeInsets.all(24),
        padding: const EdgeInsets.all(32),
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
              width: 72,
              height: 72,
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withOpacity(0.15),
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: Text('🎉', style: TextStyle(fontSize: 34)),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              "You're all set for Sept '26! 🚀",
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w900,
                color: tokens.textPrimary,
                letterSpacing: -0.4,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              "Your academic profile and contact details have been successfully refreshed. Let's make this term great!",
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                height: 1.55,
                color: tokens.textSecondary,
              ),
            ),
            const SizedBox(height: 28),
            SizedBox(
              width: double.infinity,
              height: 50,
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
                  'Let’s Go to Dashboard',
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
