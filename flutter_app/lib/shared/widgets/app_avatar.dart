import 'package:material_ui/material_ui.dart';
import '../../config/api_config.dart';

/// Reusable user avatar widget matching Capacitor / Web UserAvatar.tsx.
/// Renders profile photo, gender-based default avatar, or stylish initial fallback.
class AppAvatar extends StatelessWidget {
  const AppAvatar({
    super.key,
    this.avatarUrl,
    this.name,
    this.gender,
    this.size = 40,
    this.border,
    this.backgroundColor,
  });

  final String? avatarUrl;
  final String? name;
  final String? gender;
  final double size;
  final BoxBorder? border;
  final Color? backgroundColor;

  /// Matches src/lib/avatar.ts getDefaultAvatar(gender)
  static String getDefaultAvatarAsset(String? gender) {
    final g = gender?.trim().toUpperCase();
    if (g == 'FEMALE') return 'assets/avatars/default-female.png';
    if (g == 'MALE') return 'assets/avatars/default-male.png';
    return 'assets/avatars/default-neutral.png';
  }

  Widget _buildInitialFallback(String initial) {
    return Container(
      width: size,
      height: size,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          colors: [Color(0xFF5856D6), Color(0xFF6E6CF0)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        initial.toUpperCase(),
        style: TextStyle(
          color: Colors.white,
          fontSize: size * 0.44,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final fallbackAsset = getDefaultAvatarAsset(gender);
    final url = avatarUrl?.trim();
    final initial = (name != null && name!.trim().isNotEmpty)
        ? name!.trim().characters.first
        : (gender == 'FEMALE' ? 'F' : 'U');

    Widget imageWidget;
    if (url != null && url.isNotEmpty) {
      if (url.startsWith('assets/')) {
        imageWidget = Image.asset(
          url,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Image.asset(
            fallbackAsset,
            width: size,
            height: size,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => _buildInitialFallback(initial),
          ),
        );
      } else if (url.startsWith('/avatars/')) {
        final assetPath = 'assets$url';
        imageWidget = Image.asset(
          assetPath,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Image.asset(
            fallbackAsset,
            width: size,
            height: size,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => _buildInitialFallback(initial),
          ),
        );
      } else {
        final fullUrl = (url.startsWith('http://') || url.startsWith('https://'))
            ? url
            : '${ApiConfig.baseUrl}$url';
        imageWidget = Image.network(
          fullUrl,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => Image.asset(
            fallbackAsset,
            width: size,
            height: size,
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => _buildInitialFallback(initial),
          ),
        );
      }
    } else {
      imageWidget = Image.asset(
        fallbackAsset,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (_, __, ___) => _buildInitialFallback(initial),
      );
    }

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: backgroundColor ?? const Color(0xFF5856D6).withOpacity(0.15),
        border: border,
      ),
      child: ClipOval(child: imageWidget),
    );
  }
}
