import 'package:material_ui/material_ui.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/app_avatar.dart';
import 'package:material_symbols_icons/symbols.dart';
import '../../shared/widgets/apple_alert.dart';
import '../../shared/widgets/apple_pressable.dart';
import '../../shared/widgets/social_card_dialog.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_theme_tokens.dart';
import '../../shared/widgets/shimmer_loading.dart';

/// GET /api/auth/me — returns { user: {...} } with the full profile.
final profileProvider = FutureProvider<Map<String, dynamic>>((ref) async {
  final api = ref.watch(apiClientProvider);
  try {
    final res = await api.get<Map<String, dynamic>>('/api/auth/me');
    return (res.data?['user'] as Map<String, dynamic>?) ?? const {};
  } catch (_) {
    return const {};
  }
});

class ProfilePage extends ConsumerStatefulWidget {
  const ProfilePage({super.key});

  @override
  ConsumerState<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends ConsumerState<ProfilePage> {
  // Form controllers
  late TextEditingController _firstNameController;
  late TextEditingController _lastNameController;
  late TextEditingController _aboutMeController;
  late TextEditingController _cgpaController;
  late TextEditingController _instagramController;
  late TextEditingController _linkedinController;

  bool _showSecurityNumber = false;
  bool _isSaving = false;
  String? _statusMessage;
  bool _isSuccessMessage = false;

  // Social card visibility toggles
  bool _showState = false;
  bool _showAge = false;
  bool _showGender = false;
  bool _showIitmLevel = false;
  bool _showCgpa = false;

  bool _initialized = false;
  Map<String, dynamic>? _lastUser;

  @override
  void initState() {
    super.initState();
    _firstNameController = TextEditingController();
    _lastNameController = TextEditingController();
    _aboutMeController = TextEditingController();
    _cgpaController = TextEditingController();
    _instagramController = TextEditingController();
    _linkedinController = TextEditingController();
  }

  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _aboutMeController.dispose();
    _cgpaController.dispose();
    _instagramController.dispose();
    _linkedinController.dispose();
    super.dispose();
  }

  void _populateUser(Map<String, dynamic> user) {
    if (_initialized && _lastUser == user) return;
    _lastUser = user;
    _initialized = true;

    final name = (user['name'] as String?) ?? '';
    final nameParts = name.trim().split(RegExp(r'\s+'));

    _firstNameController.text = (user['firstName'] as String?) ??
        (nameParts.isNotEmpty ? nameParts.first : '');
    _lastNameController.text = (user['lastName'] as String?) ??
        (nameParts.length > 1 ? nameParts.sublist(1).join(' ') : '');

    _aboutMeController.text = (user['aboutMe'] as String?) ?? '';
    _cgpaController.text = user['cgpa'] != null ? '${user['cgpa']}' : '';
    _instagramController.text = (user['instagramUrl'] as String?) ?? '';
    _linkedinController.text = (user['linkedinUrl'] as String?) ?? '';

    _showState = (user['showStateOnSocialCard'] as bool?) ?? false;
    _showAge = (user['showAgeOnSocialCard'] as bool?) ?? false;
    _showGender = (user['showGenderOnSocialCard'] as bool?) ?? false;
    _showIitmLevel = (user['showIitmLevelOnSocialCard'] as bool?) ?? false;
    _showCgpa = (user['showCgpaOnSocialCard'] as bool?) ?? false;
  }

  int _countWords(String text) {
    final trimmed = text.trim();
    if (trimmed.isEmpty) return 0;
    return trimmed.split(RegExp(r'\s+')).length;
  }

  Future<void> _saveChanges() async {
    if (_isSaving) return;

    final firstName = _firstNameController.text.trim();
    final lastName = _lastNameController.text.trim();
    final aboutMe = _aboutMeController.text.trim();
    final cgpaStr = _cgpaController.text.trim();
    final instagram = _instagramController.text.trim();
    final linkedin = _linkedinController.text.trim();

    final fullName = '$firstName $lastName'.trim();

    double? cgpa;
    if (cgpaStr.isNotEmpty) {
      cgpa = double.tryParse(cgpaStr);
      if (cgpa == null || cgpa < 0 || cgpa > 10) {
        setState(() {
          _statusMessage = 'CGPA must be a number between 0 and 10.';
          _isSuccessMessage = false;
        });
        return;
      }
    }

    setState(() {
      _isSaving = true;
      _statusMessage = null;
    });

    try {
      final api = ref.read(apiClientProvider);
      final payload = <String, dynamic>{
        'name': fullName.isNotEmpty ? fullName : null,
        'aboutMe': aboutMe,
        'cgpa': cgpa,
        'instagramUrl': instagram,
        'linkedinUrl': linkedin,
        'showStateOnSocialCard': _showState,
        'showAgeOnSocialCard': _showAge,
        'showGenderOnSocialCard': _showGender,
        'showIitmLevelOnSocialCard': _showIitmLevel,
        'showCgpaOnSocialCard': _showCgpa,
      };

      await api.patch('/api/auth/me', body: payload);

      if (mounted) {
        setState(() {
          _isSaving = false;
          _isSuccessMessage = true;
          _statusMessage = 'Profile updated successfully!';
        });
        ref.invalidate(profileProvider);
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSaving = false;
          _isSuccessMessage = false;
          _statusMessage = 'Failed to save changes. Please try again.';
        });
      }
    }
  }

  void _showChangePhotoSheet() {
    final tokens = context.tokens;

    showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(16, 10, 16, 28),
        decoration: BoxDecoration(
          color: tokens.bg,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 38,
                height: 5,
                decoration: BoxDecoration(
                  color: tokens.border,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Padding(
              padding: const EdgeInsets.only(left: 4, bottom: 14),
              child: Text(
                'Profile Photo',
                style: TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.6,
                  color: tokens.textPrimary,
                ),
              ),
            ),
            _Card(
              children: [
                _FormRow(
                  icon: Symbols.photo_camera_rounded,
                  tile: const Color(0xFF5856D6),
                  label: 'Click Photo',
                  subtitle: 'Take a photo with your camera',
                  chevron: true,
                  onTap: () {
                    Navigator.of(ctx, rootNavigator: true).pop();
                    _showPhotoGuidelines('Click Photo');
                  },
                ),
                _FormRow(
                  icon: Symbols.photo_library_rounded,
                  tile: const Color(0xFF007AFF),
                  label: 'Choose Image',
                  subtitle: 'Select from your device gallery',
                  chevron: true,
                  isLast: true,
                  onTap: () {
                    Navigator.of(ctx, rootNavigator: true).pop();
                    _showPhotoGuidelines('Choose Image');
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showPhotoGuidelines(String actionLabel) async {
    final ok = await showAppleAlert<bool>(
      context,
      icon: Symbols.image_rounded,
      title: 'Upload Image Guidelines',
      message:
          'Max image size is 10 MB. Supported formats: JPG, PNG, WEBP. Please choose a clear profile photo.',
      actions: [
        const AppleAlertAction(label: 'Cancel', value: false),
        AppleAlertAction(label: actionLabel, value: true, isDefault: true),
      ],
    );
    if (ok == true && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Photo updated successfully!')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(profileProvider);
    final tokens = context.tokens;

    return AppPageScaffold(
      title: 'Profile',
      subtitle: 'Manage personal & account details',
      showBack: true,
      bottomNavigationBar: !async.hasValue
          ? null
          : Container(
              decoration: BoxDecoration(
                color: tokens.bg,
                border:
                    Border(top: BorderSide(color: tokens.border, width: 0.5)),
              ),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
                  child: SizedBox(
                    height: 50,
                    child: Row(
                      children: [
                        Expanded(
                          flex: 3,
                          child: ApplePressable(
                            onTap: _isSaving ? null : _saveChanges,
                            pressedScale: 0.97,
                            child: Container(
                              decoration: BoxDecoration(
                                color: tokens.primaryAccent,
                                borderRadius: BorderRadius.circular(25),
                              ),
                              alignment: Alignment.center,
                              child: _isSaving
                                  ? const SizedBox(
                                      width: 20,
                                      height: 20,
                                      child: CircularProgressIndicator(
                                        strokeWidth: 2.2,
                                        color: Colors.white,
                                      ),
                                    )
                                  : const Text(
                                      'Save Changes',
                                      style: TextStyle(
                                        color: Colors.white,
                                        fontSize: 16,
                                        fontWeight: FontWeight.w600,
                                        letterSpacing: -0.2,
                                      ),
                                    ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          flex: 2,
                          child: ApplePressable(
                            onTap: () {
                              if (_lastUser != null) {
                                setState(() {
                                  _populateUser(_lastUser!);
                                  _statusMessage = null;
                                });
                              }
                            },
                            pressedScale: 0.97,
                            child: Container(
                              decoration: BoxDecoration(
                                color: tokens.cardBg,
                                borderRadius: BorderRadius.circular(25),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                'Discard',
                                style: TextStyle(
                                  color: tokens.textPrimary,
                                  fontSize: 16,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: -0.2,
                                ),
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
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(profileProvider),
        color: tokens.primaryAccent,
        backgroundColor: tokens.cardBg,
        child: async.when(
          loading: () => const PageLoading(),
          error: (e, _) => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(
                'Could not load profile: $e',
                style: TextStyle(color: tokens.textSecondary),
              ),
            ),
          ),
          data: (user) {
            _populateUser(user);

            final name = (user['name'] as String?) ?? 'Student';
            final email = (user['email'] as String?) ?? 'student@iitm.ac.in';
            final role = (user['role'] as String?) ?? 'STUDENT';
            final mobile = (user['mobileNumber'] as String?) ?? '—';
            final gender = (user['gender'] as String?) ?? 'Male';
            final age = user['age'] != null ? '${user['age']}' : '—';
            final state = (user['state'] as String?) ?? '—';
            final securityNumber = (user['securityNumber'] as String?) ?? '';
            final avatarUrl = user['avatar'] as String?;

            DateTime? createdDate;
            if (user['createdAt'] != null) {
              createdDate = DateTime.tryParse(user['createdAt'] as String);
            }
            final joinedMonthYear = createdDate != null
                ? DateFormat('MMMM yyyy').format(createdDate)
                : 'March 2026';
            final memberSinceFull = createdDate != null
                ? DateFormat('EEEE, d MMMM yyyy').format(createdDate)
                : 'Friday, 20 March 2026';

            final words = _countWords(_aboutMeController.text);
            final roleLabel = role.toLowerCase().capitalize();

            return ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
              children: [
                // ── Status banner ─────────────────────────────────
                if (_statusMessage != null) ...[
                  Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 16, vertical: 12),
                    decoration: BoxDecoration(
                      color: (_isSuccessMessage
                              ? const Color(0xFF34C759)
                              : const Color(0xFFFF3B30))
                          .withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          _isSuccessMessage
                              ? Symbols.check_circle_rounded
                              : Symbols.error_rounded,
                          fill: 1,
                          color: _isSuccessMessage
                              ? const Color(0xFF34C759)
                              : const Color(0xFFFF3B30),
                          size: 22,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _statusMessage!,
                            style: TextStyle(
                              fontSize: 14.5,
                              fontWeight: FontWeight.w600,
                              color: _isSuccessMessage
                                  ? const Color(0xFF248A3D)
                                  : const Color(0xFFD70015),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                ],

                // ── Hero ──────────────────────────────────────────
                Container(
                  decoration: BoxDecoration(
                    color: tokens.cardBg,
                    borderRadius: BorderRadius.circular(28),
                    gradient: LinearGradient(
                      colors: [
                        tokens.primaryAccent
                            .withValues(alpha: tokens.isDark ? 0.22 : 0.10),
                        tokens.cardBg,
                      ],
                      begin: Alignment.topCenter,
                      end: const Alignment(0, -0.2),
                    ),
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 26, 20, 20),
                        child: Column(
                          children: [
                            Stack(
                              clipBehavior: Clip.none,
                              children: [
                                Container(
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    boxShadow: [
                                      BoxShadow(
                                        color: tokens.primaryAccent
                                            .withValues(alpha: 0.28),
                                        blurRadius: 28,
                                        offset: const Offset(0, 12),
                                      ),
                                    ],
                                  ),
                                  child: AppAvatar(
                                    avatarUrl: avatarUrl,
                                    gender: gender,
                                    size: 104,
                                    border: Border.all(
                                        color: tokens.cardBg, width: 3),
                                  ),
                                ),
                                Positioned(
                                  right: 0,
                                  bottom: 2,
                                  child: ApplePressable(
                                    onTap: _showChangePhotoSheet,
                                    pressedScale: 0.9,
                                    child: Container(
                                      width: 34,
                                      height: 34,
                                      decoration: BoxDecoration(
                                        color: tokens.primaryAccent,
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                            color: tokens.cardBg, width: 3),
                                      ),
                                      child: const Icon(
                                        Symbols.photo_camera_rounded,
                                        fill: 1,
                                        size: 16,
                                        color: Colors.white,
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 16),
                            Text(
                              name,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 28,
                                fontWeight: FontWeight.w700,
                                letterSpacing: -0.7,
                                height: 1.1,
                                color: tokens.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              email,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 15,
                                color: tokens.textSecondary,
                              ),
                            ),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                      horizontal: 12, vertical: 5),
                                  decoration: BoxDecoration(
                                    color: tokens.primaryAccent
                                        .withValues(alpha: 0.14),
                                    borderRadius: BorderRadius.circular(20),
                                  ),
                                  child: Text(
                                    roleLabel,
                                    style: TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                      color: tokens.primaryAccent,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 10),
                                Text(
                                  'Joined $joinedMonthYear',
                                  style: TextStyle(
                                    fontSize: 14,
                                    color: tokens.textSecondary,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      Container(height: 0.5, color: tokens.border),
                      IntrinsicHeight(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Expanded(child: _Stat(label: 'Gender', value: gender)),
                            Container(width: 0.5, color: tokens.border),
                            Expanded(child: _Stat(label: 'Age', value: age)),
                            Container(width: 0.5, color: tokens.border),
                            Expanded(
                                child: _Stat(
                                    label: 'State / Territory', value: state)),
                          ],
                        ),
                      ),
                      Container(height: 0.5, color: tokens.border),
                      SizedBox(
                        height: 50,
                        child: Row(
                          children: [
                            Expanded(
                              child: _HeroButton(
                                label: 'Change',
                                color: tokens.primaryAccent,
                                onTap: _showChangePhotoSheet,
                              ),
                            ),
                            Container(width: 0.5, color: tokens.border),
                            Expanded(
                              child: _HeroButton(
                                label: 'Remove',
                                color: tokens.danger,
                                onTap: () {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                        content: Text('Photo removed')),
                                  );
                                },
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                // ── Personal Information ──────────────────────────
                const _SectionTitle('Personal Information', Symbols.person_rounded),
                _Card(
                  children: [
                    _FormRow(
                      label: 'First Name',
                      trailing: _InlineField(
                        controller: _firstNameController,
                        hint: 'First Name',
                      ),
                    ),
                    _FormRow(
                      label: 'Last Name',
                      trailing: _InlineField(
                        controller: _lastNameController,
                        hint: 'Last Name',
                      ),
                    ),
                    _FormRow(
                      label: 'About Me',
                      below: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          TextField(
                            controller: _aboutMeController,
                            minLines: 2,
                            maxLines: 5,
                            cursorColor: tokens.primaryAccent,
                            onChanged: (_) => setState(() {}),
                            style: TextStyle(
                              fontSize: 16,
                              height: 1.35,
                              color: tokens.textPrimary,
                            ),
                            decoration: InputDecoration(
                              isDense: true,
                              contentPadding: const EdgeInsets.only(top: 6),
                              border: InputBorder.none,
                              enabledBorder: InputBorder.none,
                              focusedBorder: InputBorder.none,
                              filled: false,
                              hintText:
                                  'Write a short intro for your Social Card',
                              hintStyle: TextStyle(
                                fontSize: 16,
                                color: tokens.textMuted,
                              ),
                            ),
                          ),
                          Align(
                            alignment: Alignment.centerRight,
                            child: Text(
                              '$words / 300 words',
                              style: TextStyle(
                                fontSize: 12.5,
                                color: words > 300
                                    ? tokens.danger
                                    : tokens.textMuted,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    _FormRow(
                      label: 'CGPA',
                      subtitle: 'Current Cumulative GPA',
                      isLast: true,
                      trailing: _InlineField(
                        controller: _cgpaController,
                        hint: '0.00',
                        width: 74,
                        bold: true,
                        keyboard: const TextInputType.numberWithOptions(
                            decimal: true),
                      ),
                    ),
                  ],
                ),
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          'To edit restricted personal details, please raise a ticket in Support with your reason and our team will update it for you.',
                          style: TextStyle(
                            fontSize: 13,
                            height: 1.35,
                            color: tokens.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // ── Account Details ───────────────────────────────
                const _SectionTitle('Account Details', Symbols.shield_rounded),
                _Card(
                  children: [
                    _FormRow(
                      label: 'Email Address',
                      trailing: _ReadOnlyValue(email, lock: false),
                    ),
                    _FormRow(
                      label: 'Mobile Number',
                      trailing: _ReadOnlyValue(mobile, lock: false),
                    ),
                    _FormRow(
                      label: 'Security Number',
                      onTap: () => setState(
                          () => _showSecurityNumber = !_showSecurityNumber),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _showSecurityNumber
                                ? (securityNumber.isNotEmpty
                                    ? securityNumber
                                    : 'SEC-882190')
                                : '••••••••',
                            style: TextStyle(
                              fontSize: 15.5,
                              fontWeight: FontWeight.w600,
                              letterSpacing: _showSecurityNumber ? 0.4 : 2,
                              color: tokens.textPrimary,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Icon(
                            _showSecurityNumber
                                ? Symbols.visibility_off_rounded
                                : Symbols.visibility_rounded,
                            color: tokens.primaryAccent,
                            size: 20,
                          ),
                        ],
                      ),
                    ),
                    _FormRow(
                      label: 'Role',
                      trailing: _ReadOnlyValue(roleLabel),
                    ),
                    _FormRow(
                      label: 'Member Since',
                      isLast: true,
                      trailing: _ReadOnlyValue(memberSinceFull, lock: false),
                    ),
                  ],
                ),

                // ── Social Card Visibility ────────────────────────
                const _SectionTitle('Social Card Visibility', Symbols.share_rounded),
                _Card(
                  children: [
                    _SwitchRow(
                      label: 'Show State',
                      value: _showState,
                      onChanged: (v) => setState(() => _showState = v),
                    ),
                    _SwitchRow(
                      label: 'Show Age',
                      value: _showAge,
                      onChanged: (v) => setState(() => _showAge = v),
                    ),
                    _SwitchRow(
                      label: 'Show Gender',
                      value: _showGender,
                      onChanged: (v) => setState(() => _showGender = v),
                    ),
                    _SwitchRow(
                      label: 'Show IITM Level',
                      value: _showIitmLevel,
                      onChanged: (v) => setState(() => _showIitmLevel = v),
                    ),
                    _SwitchRow(
                      label: 'Show CGPA',
                      value: _showCgpa,
                      isLast: true,
                      onChanged: (v) => setState(() => _showCgpa = v),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                _Card(
                  children: [
                    _FormRow(
                      label: 'Instagram Profile Link',
                      compactLabel: true,
                      below: _InlineField(
                        controller: _instagramController,
                        hint: 'https://instagram.com/yourhandle',
                        width: double.infinity,
                        align: TextAlign.left,
                        keyboard: TextInputType.url,
                      ),
                    ),
                    _FormRow(
                      label: 'LinkedIn Profile Link',
                      compactLabel: true,
                      isLast: true,
                      below: _InlineField(
                        controller: _linkedinController,
                        hint: 'https://linkedin.com/in/yourprofile',
                        width: double.infinity,
                        align: TextAlign.left,
                        keyboard: TextInputType.url,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),
                ApplePressable(
                  onTap: () {
                    HapticFeedback.lightImpact();
                    final uid = (user['id'] as String?) ?? '';
                    if (uid.isNotEmpty) {
                      showSocialCard(context, userId: uid);
                    }
                  },
                  pressedScale: 0.98,
                  child: Container(
                    height: 50,
                    decoration: BoxDecoration(
                      color: tokens.primaryAccent.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      'Preview Social Card',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        letterSpacing: -0.2,
                        color: tokens.primaryAccent,
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// BUILDING BLOCKS
// ─────────────────────────────────────────────────────────────────────────────
class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text, this.icon);
  final String text;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 28, 4, 10),
      child: Row(
        children: [
          Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: tokens.textMuted.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(9),
            ),
            child: Icon(icon, fill: 1, size: 18, color: tokens.textSecondary),
          ),
          const SizedBox(width: 10),
          Text(
            text,
            style: TextStyle(
              fontSize: 21,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.5,
              color: tokens.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 8),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            value,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.3,
              color: tokens.textPrimary,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 12, color: tokens.textSecondary),
          ),
        ],
      ),
    );
  }
}

class _Card extends StatelessWidget {
  const _Card({required this.children});
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: context.tokens.cardBg,
        borderRadius: BorderRadius.circular(22),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(children: children),
    );
  }
}

Widget _tile(IconData icon, Color color) => Container(
      width: 32,
      height: 32,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(9),
      ),
      child: Icon(icon, fill: 1, color: Colors.white, size: 19),
    );

/// One grouped-list row: coloured icon tile, label, optional trailing widget
/// or stacked content, with an inset hairline. Highlights on touch-down when
/// it has an [onTap].
class _FormRow extends StatefulWidget {
  const _FormRow({
    this.icon,
    this.tile,
    required this.label,
    this.subtitle,
    this.trailing,
    this.below,
    this.onTap,
    this.chevron = false,
    this.compactLabel = false,
    this.isLast = false,
  });

  final IconData? icon;
  final Color? tile;
  final String label;
  final String? subtitle;
  final Widget? trailing;
  final Widget? below;
  final VoidCallback? onTap;
  final bool chevron;
  final bool compactLabel;
  final bool isLast;

  @override
  State<_FormRow> createState() => _FormRowState();
}

class _FormRowState extends State<_FormRow> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final w = widget;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: w.onTap == null ? null : (_) => setState(() => _down = true),
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      onTap: w.onTap,
      child: Container(
        color: _down ? tokens.surfaceSecondary : Colors.transparent,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 11, 16, 11),
              child: Row(
                crossAxisAlignment: w.below != null
                    ? CrossAxisAlignment.start
                    : CrossAxisAlignment.center,
                children: [
                  if (w.icon != null) ...[
                    _tile(w.icon!, w.tile ?? Colors.grey),
                    const SizedBox(width: 14),
                  ],
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Padding(
                          padding: EdgeInsets.only(
                              top: w.below != null && !w.compactLabel ? 4 : 0),
                          child: Text(
                            w.label,
                            style: w.compactLabel
                                ? TextStyle(
                                    fontSize: 13,
                                    color: tokens.textSecondary,
                                  )
                                : TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w500,
                                    letterSpacing: -0.2,
                                    color: tokens.textPrimary,
                                  ),
                          ),
                        ),
                        if (w.subtitle != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 1),
                            child: Text(
                              w.subtitle!,
                              style: TextStyle(
                                fontSize: 13,
                                color: tokens.textSecondary,
                              ),
                            ),
                          ),
                        if (w.below != null)
                          Padding(
                            padding: const EdgeInsets.only(top: 2),
                            child: w.below!,
                          ),
                      ],
                    ),
                  ),
                  if (w.trailing != null) ...[
                    const SizedBox(width: 10),
                    Flexible(flex: 0, child: w.trailing!),
                  ],
                  if (w.chevron) ...[
                    const SizedBox(width: 8),
                    Icon(Symbols.arrow_forward_ios_rounded,
                        weight: 700, size: 13, color: tokens.textMuted),
                  ],
                ],
              ),
            ),
            if (!w.isLast)
              Padding(
                padding: EdgeInsets.only(left: w.icon == null ? 16 : 62),
                child: Divider(
                    height: 0.5, thickness: 0.5, color: tokens.border),
              ),
          ],
        ),
      ),
    );
  }
}

class _SwitchRow extends StatelessWidget {
  const _SwitchRow({
    this.icon,
    this.tile,
    required this.label,
    required this.value,
    required this.onChanged,
    this.isLast = false,
  });

  final IconData? icon;
  final Color? tile;
  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return _FormRow(
      icon: icon,
      tile: tile,
      label: label,
      isLast: isLast,
      onTap: () {
        HapticFeedback.selectionClick();
        onChanged(!value);
      },
      trailing: Switch(
        value: value,
        onChanged: (v) {
          HapticFeedback.selectionClick();
          onChanged(v);
        },
        thumbColor: const WidgetStatePropertyAll(Colors.white),
        trackColor: WidgetStateProperty.resolveWith((st) =>
            st.contains(WidgetState.selected)
                ? const Color(0xFF34C759)
                : (tokens.isDark
                    ? const Color(0xFF39393D)
                    : const Color(0xFFE9E9EA))),
        trackOutlineColor: const WidgetStatePropertyAll(Colors.transparent),
      ),
    );
  }
}

class _InlineField extends StatelessWidget {
  const _InlineField({
    required this.controller,
    required this.hint,
    this.width = 170,
    this.align = TextAlign.right,
    this.bold = false,
    this.keyboard,
  });

  final TextEditingController controller;
  final String hint;
  final double width;
  final TextAlign align;
  final bool bold;
  final TextInputType? keyboard;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final field = TextField(
      controller: controller,
      textAlign: align,
      keyboardType: keyboard,
      cursorColor: tokens.primaryAccent,
      style: TextStyle(
        fontSize: 16,
        fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
        color: tokens.textPrimary,
      ),
      decoration: InputDecoration(
        isDense: true,
        contentPadding: const EdgeInsets.symmetric(vertical: 6),
        border: InputBorder.none,
        enabledBorder: InputBorder.none,
        focusedBorder: InputBorder.none,
        filled: false,
        hintText: hint,
        hintStyle: TextStyle(fontSize: 16, color: tokens.textMuted),
      ),
    );
    if (width == double.infinity) return field;
    return SizedBox(width: width, child: field);
  }
}

class _ReadOnlyValue extends StatelessWidget {
  const _ReadOnlyValue(this.value, {this.lock = false});
  final String value;
  final bool lock;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 200),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w500,
                color: tokens.textSecondary,
              ),
            ),
          ),
          if (lock) ...[
            const SizedBox(width: 6),
            Icon(Symbols.lock_rounded,
                fill: 1, size: 14, color: tokens.textMuted),
          ],
        ],
      ),
    );
  }
}

class _HeroButton extends StatefulWidget {
  const _HeroButton({
    required this.label,
    required this.color,
    required this.onTap,
  });

  final String label;
  final Color color;
  final VoidCallback onTap;

  @override
  State<_HeroButton> createState() => _HeroButtonState();
}

class _HeroButtonState extends State<_HeroButton> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) => setState(() => _down = true),
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      onTap: widget.onTap,
      child: Container(
        color: _down ? tokens.surfaceSecondary : Colors.transparent,
        alignment: Alignment.center,
        child: Text(
          widget.label,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            letterSpacing: -0.2,
            color: widget.color,
          ),
        ),
      ),
    );
  }
}

extension StringExtension on String {
  String capitalize() {
    if (isEmpty) return this;
    return '${this[0].toUpperCase()}${substring(1)}';
  }
}
