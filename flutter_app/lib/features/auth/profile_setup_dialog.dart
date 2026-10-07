import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/app_avatar.dart';
import '../../shared/widgets/bouncy_pressable.dart';
import '../../theme/app_theme_tokens.dart';
import '../profile/profile_page.dart';

const List<String> kIndianStates = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
  'Other'
];

/// Full-screen required profile setup — mirrors ProfileSetupBlocker.tsx.
/// Submits to `/api/profile/setup`. Cannot be dismissed.
class ProfileSetupDialog extends ConsumerStatefulWidget {
  const ProfileSetupDialog({super.key});

  @override
  ConsumerState<ProfileSetupDialog> createState() => _ProfileSetupDialogState();
}

class _ProfileSetupDialogState extends ConsumerState<ProfileSetupDialog> {
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _mobileController = TextEditingController();
  final _ageController = TextEditingController();

  String? _selectedGender;
  String? _selectedState;
  String? _avatarUrl;
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authStateProvider).value;
    if (user != null) {
      if (user.avatar != null && user.avatar!.isNotEmpty) {
        _avatarUrl = user.avatar;
      }
      if (user.firstName != null && user.firstName!.isNotEmpty) {
        _firstNameController.text = user.firstName!;
      } else if (user.name.isNotEmpty) {
        final parts = user.name.split(' ');
        _firstNameController.text = parts.first;
        if (parts.length > 1) {
          _lastNameController.text = parts.sublist(1).join(' ');
        }
      }
      if (user.lastName != null && user.lastName!.isNotEmpty) {
        _lastNameController.text = user.lastName!;
      }
      if (user.mobileNumber != null && user.mobileNumber!.isNotEmpty) {
        final digits = user.mobileNumber!.replaceAll(RegExp(r'\D'), '');
        _mobileController.text = digits.length > 10
            ? digits.substring(digits.length - 10)
            : digits;
      }
      if (user.gender != null && user.gender!.isNotEmpty) {
        _selectedGender = user.gender!.toUpperCase();
      }
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
                child: const Icon(Icons.camera_alt_outlined, color: Color(0xFF8B5CF6)),
              ),
              title: Text('Click Photo', style: TextStyle(fontWeight: FontWeight.w700, color: tokens.textPrimary)),
              subtitle: Text('Take a photo with your camera', style: TextStyle(color: tokens.textSecondary, fontSize: 12)),
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
                child: const Icon(Icons.photo_library_outlined, color: Color(0xFF3B82F6)),
              ),
              title: Text('Choose Image', style: TextStyle(fontWeight: FontWeight.w700, color: tokens.textPrimary)),
              subtitle: Text('Select from your device gallery', style: TextStyle(color: tokens.textSecondary, fontSize: 12)),
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
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: tokens.textPrimary),
        ),
        content: Text(
          'Maximum image size: 10 MB. Supported formats: JPG, PNG, WEBP. Profile photo is completely optional and can be updated anytime.',
          style: TextStyle(fontSize: 13.5, height: 1.45, color: tokens.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text('Cancel', style: TextStyle(color: tokens.textMuted, fontWeight: FontWeight.w700)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              setState(() {
                _avatarUrl ??= AppAvatar.getDefaultAvatarAsset(_selectedGender);
              });
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Profile photo selected! (Optional)')),
              );
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: tokens.primaryAccent,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              elevation: 0,
            ),
            child: const Text('Select', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _mobileController.dispose();
    _ageController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    setState(() => _error = null);

    final first = _firstNameController.text.trim();
    final last = _lastNameController.text.trim();
    final mobile = _mobileController.text.trim();
    final ageText = _ageController.text.trim();

    if (first.isEmpty || last.isEmpty) {
      setState(() => _error = 'Please enter both your first and last name.');
      return;
    }

    if (!RegExp(r'^\d{10}$').hasMatch(mobile)) {
      setState(() => _error = 'Mobile number must be exactly 10 digits.');
      return;
    }

    if (!RegExp(r'^[6789]').hasMatch(mobile)) {
      setState(() => _error = 'Please enter a valid mobile number.');
      return;
    }

    if (_selectedGender == null || _selectedGender!.isEmpty) {
      setState(() => _error = 'Please select a gender option.');
      return;
    }

    final ageInt = int.tryParse(ageText);
    if (ageInt == null || ageInt < 15 || ageInt > 120) {
      setState(() => _error = 'Age must be at least 15.');
      return;
    }

    if (_selectedState == null || _selectedState!.isEmpty) {
      setState(() => _error = 'Please choose your state from the dropdown.');
      return;
    }

    final confirmed = await _showConfirmationDialog(
      first: first,
      last: last,
      mobile: mobile,
      gender: _selectedGender!,
      age: ageInt,
      state: _selectedState!,
    );

    if (confirmed == true && mounted) {
      await _doSubmit(
        first: first,
        last: last,
        mobile: mobile,
        gender: _selectedGender!,
        age: ageInt,
        state: _selectedState!,
      );
    }
  }

  Future<bool?> _showConfirmationDialog({
    required String first,
    required String last,
    required String mobile,
    required String gender,
    required int age,
    required String state,
  }) {
    final tokens = context.tokens;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final genderDisplay = gender.isNotEmpty
        ? '${gender[0].toUpperCase()}${gender.substring(1).toLowerCase()}'
        : gender;

    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: tokens.cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        contentPadding: const EdgeInsets.fromLTRB(32, 36, 32, 32),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 60,
              height: 60,
              decoration: BoxDecoration(
                color: isDark ? const Color(0x33F59E0B) : const Color(0xFFFFF8E1),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.warning_amber_rounded,
                color: Color(0xFFF59E0B),
                size: 28,
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'Please check all details carefully',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.w900,
                color: tokens.textPrimary,
              ),
            ),
            const SizedBox(height: 12),
            RichText(
              textAlign: TextAlign.center,
              text: TextSpan(
                style: TextStyle(
                  fontSize: 14,
                  color: tokens.textSecondary,
                  height: 1.65,
                ),
                children: [
                  const TextSpan(text: 'These details '),
                  TextSpan(
                    text: 'cannot be changed',
                    style: TextStyle(
                      color: tokens.danger,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const TextSpan(
                    text:
                        ' once submitted. Make sure everything is correct before continuing.',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),
            Container(
              width: double.infinity,
              decoration: BoxDecoration(
                color: tokens.surface,
                borderRadius: BorderRadius.circular(12),
              ),
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  _summaryRow('Photo', _avatarUrl != null ? 'Uploaded' : 'Default / None (Optional)', tokens),
                  _summaryRow('Name', '$first $last', tokens),
                  _summaryRow('Mobile', mobile, tokens),
                  _summaryRow('Age', '$age', tokens),
                  _summaryRow('Gender', genderDisplay, tokens),
                  _summaryRow('State', state, tokens, isLast: true),
                ],
              ),
            ),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(ctx).pop(false),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      side: BorderSide(
                        color: isDark ? tokens.border : const Color(0xFFE0E3EA),
                        width: 2,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: Text(
                      'Go Back',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: tokens.textSecondary,
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => Navigator.of(ctx).pop(true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF6366F1),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      elevation: 0,
                    ),
                    child: const Text(
                      'Continue',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _summaryRow(
    String label,
    String value,
    AppThemeTokens tokens, {
    bool isLast = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 5),
      decoration: BoxDecoration(
        border: isLast
            ? null
            : Border(
                bottom: BorderSide(
                  color: tokens.border.withOpacity(0.7),
                ),
              ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w600,
              color: tokens.textSecondary,
            ),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 13.5,
                fontWeight: FontWeight.w700,
                color: tokens.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Future<void> _doSubmit({
    required String first,
    required String last,
    required String mobile,
    required String gender,
    required int age,
    required String state,
  }) async {
    setState(() => _saving = true);

    try {
      final client = ref.read(apiClientProvider);
      await client.put('/api/profile/setup', body: {
        'firstName': first,
        'lastName': last,
        'mobileNumber': mobile,
        'gender': gender,
        'age': age,
        'state': state,
        if (_avatarUrl != null) 'avatar': _avatarUrl,
      });

      final currentUser = ref.read(authStateProvider).value;
      if (currentUser != null) {
        ref.read(authStateProvider.notifier).updateCurrentUser(
          currentUser.copyWith(
            name: '$first $last',
            firstName: first,
            lastName: last,
            mobileNumber: mobile,
            gender: gender,
            avatar: _avatarUrl ?? currentUser.avatar,
            isProfileComplete: true,
          ),
        );
      }

      ref.invalidate(profileProvider);
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = 'Failed to complete profile setup.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: tokens.bg,
        body: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 540),
                child: Container(
                  padding: const EdgeInsets.all(32),
                  decoration: BoxDecoration(
                    color: tokens.cardBg,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(isDark ? 0.28 : 0.08),
                        blurRadius: 40,
                        offset: const Offset(0, 20),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          'Welcome back to GenZ IITian!',
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.4,
                            color: tokens.textPrimary,
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          'Please update your details so we can serve you better.',
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          style: TextStyle(
                            fontSize: 13,
                            color: tokens.textSecondary,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      const SizedBox(height: 30),
                      if (_error != null) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                          decoration: BoxDecoration(
                            color: tokens.danger.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(12),
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
                      // Profile Photo (Optional)
                      Center(
                        child: Column(
                          children: [
                            Stack(
                              children: [
                                AppAvatar(
                                  avatarUrl: _avatarUrl,
                                  gender: _selectedGender,
                                  size: 84,
                                  border: Border.all(
                                    color: const Color(0xFF6366F1).withOpacity(0.35),
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
                                        color: tokens.cardBg,
                                        width: 2,
                                      ),
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
                                      horizontal: 14,
                                      vertical: 6,
                                    ),
                                    decoration: BoxDecoration(
                                      color: tokens.surfaceSecondary,
                                      borderRadius: BorderRadius.circular(10),
                                      border: Border.all(color: tokens.border),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(
                                          Icons.photo_camera_outlined,
                                          size: 14,
                                          color: tokens.textPrimary,
                                        ),
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
                                    onTap: () => setState(() => _avatarUrl = null),
                                    scaleDown: 0.96,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 10,
                                        vertical: 6,
                                      ),
                                      decoration: BoxDecoration(
                                        color: tokens.danger.withOpacity(0.1),
                                        borderRadius: BorderRadius.circular(10),
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
                            const SizedBox(height: 6),
                            Text(
                              'Photo is optional and can be updated anytime.',
                              style: TextStyle(
                                fontSize: 11.5,
                                color: tokens.textMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),
                      Row(
                        children: [
                          Expanded(
                            child: _LabeledField(
                              label: 'First Name',
                              child: TextField(
                                controller: _firstNameController,
                                style: TextStyle(
                                  fontSize: 14,
                                  color: tokens.textPrimary,
                                ),
                                decoration: _inputDecoration('John', tokens),
                              ),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: _LabeledField(
                              label: 'Last Name',
                              child: TextField(
                                controller: _lastNameController,
                                style: TextStyle(
                                  fontSize: 14,
                                  color: tokens.textPrimary,
                                ),
                                decoration: _inputDecoration('Doe', tokens),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      Row(
                        children: [
                          Expanded(
                            child: _LabeledField(
                              label: 'Mobile Number',
                              child: TextField(
                                controller: _mobileController,
                                keyboardType: TextInputType.phone,
                                inputFormatters: [
                                  FilteringTextInputFormatter.digitsOnly,
                                  LengthLimitingTextInputFormatter(10),
                                ],
                                style: TextStyle(
                                  fontSize: 14,
                                  color: tokens.textPrimary,
                                ),
                                decoration: _inputDecoration(
                                  '10 digit number',
                                  tokens,
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: _LabeledField(
                              label: 'Age',
                              child: TextField(
                                controller: _ageController,
                                keyboardType: TextInputType.number,
                                inputFormatters: [
                                  FilteringTextInputFormatter.digitsOnly,
                                  LengthLimitingTextInputFormatter(3),
                                ],
                                style: TextStyle(
                                  fontSize: 14,
                                  color: tokens.textPrimary,
                                ),
                                decoration:
                                    _inputDecoration('e.g. 21', tokens),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 20),
                      _LabeledField(
                        label: 'State / Territory',
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          decoration: BoxDecoration(
                            color: tokens.cardBg,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(color: tokens.border),
                          ),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<String>(
                              value: _selectedState,
                              hint: Text(
                                'Select your state',
                                style: TextStyle(
                                  fontSize: 14,
                                  color: tokens.textMuted,
                                ),
                              ),
                              isExpanded: true,
                              dropdownColor: tokens.cardBg,
                              icon: Icon(
                                Icons.arrow_drop_down,
                                color: tokens.textMuted,
                              ),
                              items: kIndianStates
                                  .map(
                                    (s) => DropdownMenuItem(
                                      value: s,
                                      child: Text(
                                        s,
                                        style: TextStyle(
                                          fontSize: 14,
                                          color: tokens.textPrimary,
                                        ),
                                      ),
                                    ),
                                  )
                                  .toList(),
                              onChanged: (v) =>
                                  setState(() => _selectedState = v),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      _LabeledField(
                        label: 'Gender',
                        child: Row(
                          children: [
                            for (final g in [
                              {'key': 'MALE', 'label': 'male'},
                              {'key': 'FEMALE', 'label': 'female'},
                              {'key': 'OTHER', 'label': 'other'},
                            ]) ...[
                              if (g['key'] != 'MALE') const SizedBox(width: 12),
                              Expanded(
                                child: InkWell(
                                  onTap: () => setState(
                                    () => _selectedGender = g['key'],
                                  ),
                                  borderRadius: BorderRadius.circular(12),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      vertical: 12,
                                    ),
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(
                                      color: _selectedGender == g['key']
                                          ? (isDark
                                              ? const Color(0xFF312E81)
                                              : const Color(0xFFEFF0FE))
                                          : tokens.surface,
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(
                                        color: _selectedGender == g['key']
                                            ? const Color(0xFF6366F1)
                                            : (isDark
                                                ? tokens.border
                                                : const Color(0xFFE0E3EA)),
                                        width: 2,
                                      ),
                                    ),
                                    child: Text(
                                      g['label']!,
                                      style: TextStyle(
                                        fontSize: 14,
                                        fontWeight: FontWeight.w700,
                                        color: _selectedGender == g['key']
                                            ? tokens.primaryAccent
                                            : tokens.textSecondary,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      const SizedBox(height: 30),
                      SizedBox(
                        height: 52,
                        child: ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF6366F1),
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            elevation: 0,
                            shadowColor: const Color(0x4D6366F1),
                          ),
                          onPressed: _saving ? null : _submit,
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
                                  'Submit',
                                  style: TextStyle(
                                    fontSize: 16,
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

  InputDecoration _inputDecoration(String hint, AppThemeTokens tokens) {
    return InputDecoration(
      hintText: hint,
      hintStyle: TextStyle(fontSize: 14, color: tokens.textMuted),
      filled: true,
      fillColor: tokens.cardBg,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
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
        borderSide: const BorderSide(color: Color(0xFF6366F1), width: 1.5),
      ),
    );
  }
}

class _LabeledField extends StatelessWidget {
  const _LabeledField({required this.label, required this.child});

  final String label;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: tokens.textPrimary,
          ),
        ),
        const SizedBox(height: 6),
        child,
      ],
    );
  }
}
