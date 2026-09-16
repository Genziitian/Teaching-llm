import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/auth/token_storage.dart';
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

/// ProfileSetupDialog — mirrors ProfileSetupBlocker.tsx from Next.js.
/// Prompts first-time users to complete their personal details (Name, Mobile, Gender, Age, State)
/// and submits to `/api/profile/setup`.
class ProfileSetupDialog extends ConsumerStatefulWidget {
  const ProfileSetupDialog({super.key});

  static bool _isShowing = false;

  static Future<bool?> show(BuildContext context) async {
    if (_isShowing) return null;
    _isShowing = true;
    try {
      return await showModalBottomSheet<bool>(
        context: context,
        useRootNavigator: true,
        isDismissible: false,
        enableDrag: false,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: Colors.transparent,
        builder: (_) => const ProfileSetupDialog(),
      );
    } finally {
      _isShowing = false;
    }
  }

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
  bool _saving = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    final user = ref.read(authStateProvider).value;
    if (user != null) {
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
      setState(() => _error = 'Please select your gender.');
      return;
    }

    final ageInt = int.tryParse(ageText);
    if (ageInt == null || ageInt < 15 || ageInt > 120) {
      setState(() => _error = 'Age must be at least 15.');
      return;
    }

    if (_selectedState == null || _selectedState!.isEmpty) {
      setState(() => _error = 'Please select your state.');
      return;
    }

    // Show confirmation review popup before submitting, matching Web
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
      useRootNavigator: true,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: tokens.cardBg,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        contentPadding: const EdgeInsets.fromLTRB(22, 24, 22, 20),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Warning Icon
            Container(
              width: 56,
              height: 56,
              decoration: BoxDecoration(
                color: isDark ? const Color(0x33F59E0B) : const Color(0xFFFEF3C7),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.warning_amber_rounded,
                color: Color(0xFFF59E0B),
                size: 32,
              ),
            ),
            const SizedBox(height: 16),

            // Title
            Text(
              'Please check all details carefully',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 17.5,
                fontWeight: FontWeight.w900,
                color: tokens.textPrimary,
                letterSpacing: -0.3,
              ),
            ),
            const SizedBox(height: 8),

            // Subtitle with highlighted warning
            RichText(
              textAlign: TextAlign.center,
              text: TextSpan(
                style: TextStyle(
                  fontSize: 13,
                  color: tokens.textSecondary,
                  height: 1.5,
                ),
                children: [
                  const TextSpan(text: 'These details '),
                  TextSpan(
                    text: 'cannot be changed',
                    style: TextStyle(
                      color: tokens.danger,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const TextSpan(
                    text: ' once submitted. Make sure everything is correct before continuing.',
                  ),
                ],
              ),
            ),
            const SizedBox(height: 18),

            // Summary Box
            Container(
              decoration: BoxDecoration(
                color: tokens.surfaceSecondary,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: tokens.border.withOpacity(0.6)),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              child: Column(
                children: [
                  _summaryRow('Name', '$first $last', tokens),
                  _summaryDivider(tokens),
                  _summaryRow('Mobile', '+91 $mobile', tokens),
                  _summaryDivider(tokens),
                  _summaryRow('Age', '$age', tokens),
                  _summaryDivider(tokens),
                  _summaryRow('Gender', genderDisplay, tokens),
                  _summaryDivider(tokens),
                  _summaryRow('State', state, tokens),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(ctx).pop(false),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      side: BorderSide(color: tokens.border),
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
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () => Navigator.of(ctx).pop(true),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF2563EB),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      elevation: 0,
                    ),
                    child: const Text(
                      'Yes, Submit',
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

  Widget _summaryRow(String label, String value, AppThemeTokens tokens) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 12.5,
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
                fontSize: 13,
                fontWeight: FontWeight.w800,
                color: tokens.textPrimary,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _summaryDivider(AppThemeTokens tokens) {
    return Divider(height: 1, thickness: 1, color: tokens.border.withOpacity(0.4));
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
      });

      // Update in-memory user and persistent storage
      final currentUser = ref.read(authStateProvider).value;
      if (currentUser != null) {
        final updated = currentUser.copyWith(
          name: '$first $last',
          firstName: first,
          lastName: last,
          mobileNumber: mobile,
          gender: gender,
          isProfileComplete: true,
        );
        await const TokenStorage().saveUser(updated);
        ref.read(authStateProvider.notifier).updateCurrentUser(updated);
      }

      ref.invalidate(profileProvider);

      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = 'Failed to save profile. Please try again.';
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
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.90,
        ),
        decoration: BoxDecoration(
          color: tokens.cardBg,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 10, bottom: 6),
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: tokens.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(
                20,
                8,
                20,
                MediaQuery.of(context).viewInsets.bottom + 24,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Header
                  Center(
                    child: Column(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            gradient: const LinearGradient(
                              colors: [Color(0xFF3B82F6), Color(0xFF1D4ED8)],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: const Icon(
                            Icons.person_rounded,
                            color: Colors.white,
                            size: 26,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Complete Your Profile',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w900,
                            color: tokens.textPrimary,
                            letterSpacing: -0.3,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Please provide your basic details to continue',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 12.5,
                            color: tokens.textSecondary,
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 20),

                  // Error alert
                  if (_error != null) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: tokens.danger.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: tokens.danger.withOpacity(0.3)),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.error_outline, color: tokens.danger, size: 18),
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

                  // First Name & Last Name
                  Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'First Name',
                              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: tokens.textSecondary),
                            ),
                            const SizedBox(height: 6),
                            TextField(
                              controller: _firstNameController,
                              style: TextStyle(fontSize: 13.5, color: tokens.textPrimary),
                              decoration: _inputDecoration('First Name', tokens),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Last Name',
                              style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: tokens.textSecondary),
                            ),
                            const SizedBox(height: 6),
                            TextField(
                              controller: _lastNameController,
                              style: TextStyle(fontSize: 13.5, color: tokens.textPrimary),
                              decoration: _inputDecoration('Last Name', tokens),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 14),

                  // Mobile Number
                  Text(
                    'WhatsApp / Mobile Number',
                    style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: tokens.textSecondary),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _mobileController,
                    keyboardType: TextInputType.phone,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(10),
                    ],
                    style: TextStyle(fontSize: 13.5, color: tokens.textPrimary),
                    decoration: _inputDecoration('10-digit mobile number', tokens, prefix: '+91 '),
                  ),

                  const SizedBox(height: 14),

                  // Gender Selection
                  Text(
                    'Gender',
                    style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: tokens.textSecondary),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      {'key': 'MALE', 'label': 'Male'},
                      {'key': 'FEMALE', 'label': 'Female'},
                      {'key': 'OTHER', 'label': 'Other'},
                    ].map((g) {
                      final isSelected = _selectedGender == g['key'];
                      return Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 3),
                          child: InkWell(
                            onTap: () => setState(() => _selectedGender = g['key']),
                            borderRadius: BorderRadius.circular(10),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              alignment: Alignment.center,
                              decoration: BoxDecoration(
                                color: isSelected
                                    ? (isDark ? const Color(0xFF1E3A8A) : const Color(0xFFDBEAFE))
                                    : tokens.surfaceSecondary,
                                borderRadius: BorderRadius.circular(10),
                                border: Border.all(
                                  color: isSelected ? const Color(0xFF3B82F6) : tokens.border,
                                  width: isSelected ? 2 : 1,
                                ),
                              ),
                              child: Text(
                                g['label']!,
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w700,
                                  color: isSelected
                                      ? (isDark ? const Color(0xFF93C5FD) : const Color(0xFF1D4ED8))
                                      : tokens.textSecondary,
                                ),
                              ),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),

                  const SizedBox(height: 14),

                  // Age
                  Text(
                    'Age',
                    style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: tokens.textSecondary),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: _ageController,
                    keyboardType: TextInputType.number,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(3),
                    ],
                    style: TextStyle(fontSize: 13.5, color: tokens.textPrimary),
                    decoration: _inputDecoration('Enter your age (e.g. 20)', tokens),
                  ),

                  const SizedBox(height: 14),

                  // State Dropdown
                  Text(
                    'State / Union Territory',
                    style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: tokens.textSecondary),
                  ),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    decoration: BoxDecoration(
                      color: tokens.surfaceSecondary,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: tokens.border),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<String>(
                        value: _selectedState,
                        hint: Text('Select your State', style: TextStyle(fontSize: 13, color: tokens.textMuted)),
                        isExpanded: true,
                        dropdownColor: tokens.cardBg,
                        icon: Icon(Icons.arrow_drop_down, color: tokens.textMuted),
                        items: kIndianStates
                            .map((s) => DropdownMenuItem(
                                  value: s,
                                  child: Text(
                                    s,
                                    style: TextStyle(fontSize: 13.5, color: tokens.textPrimary),
                                  ),
                                ))
                            .toList(),
                        onChanged: (v) => setState(() => _selectedState = v),
                      ),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Submit Button
                  SizedBox(
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF2563EB),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                        elevation: 0,
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
                              'Save Profile',
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
        ],
      ),
    ),
  );
}

  InputDecoration _inputDecoration(String hint, AppThemeTokens tokens, {String? prefix}) {
    return InputDecoration(
      hintText: hint,
      prefixText: prefix,
      prefixStyle: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: tokens.textPrimary),
      hintStyle: TextStyle(fontSize: 13, color: tokens.textMuted),
      filled: true,
      fillColor: tokens.surfaceSecondary,
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
        borderSide: const BorderSide(color: Color(0xFF3B82F6), width: 1.5),
      ),
    );
  }
}
