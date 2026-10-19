import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../config/api_config.dart';
import '../../theme/app_theme_tokens.dart';
import 'community_attachment_info.dart';

class CommunityAttachment extends StatelessWidget {
  const CommunityAttachment({super.key, required this.url, this.name});
  final String url;
  final String? name;

  @override
  Widget build(BuildContext context) {
    final attachment =
        CommunityAttachmentInfo.parse(url, baseUrl: ApiConfig.baseUrl);
    if (attachment == null) {
      return const Text('Attachment link is unavailable.');
    }
    final tokens = context.tokens;
    Future<void> openDocument() async {
      try {
        if (!await launchUrl(attachment.uri,
            mode: LaunchMode.externalApplication)) {
          throw StateError('No app could open this file');
        }
      } catch (_) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
              content:
                  Text('Could not open this attachment. Please try again.')));
        }
      }
    }

    Widget documentCard() => Material(
          color: tokens.surfaceSecondary,
          borderRadius: BorderRadius.circular(12),
          child: InkWell(
            onTap: openDocument,
            borderRadius: BorderRadius.circular(12),
            child: Padding(
                padding: const EdgeInsets.all(12),
                child: Row(children: [
                  Icon(Icons.description_outlined, color: tokens.primaryAccent),
                  const SizedBox(width: 10),
                  Expanded(
                      child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                        Text(name ?? attachment.name,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                                color: tokens.textPrimary,
                                fontWeight: FontWeight.w700)),
                        Text(
                            'Tap to open ${attachment.extension.toUpperCase()} file',
                            style: TextStyle(
                                fontSize: 11, color: tokens.textSecondary)),
                      ])),
                  Icon(Icons.open_in_new_rounded,
                      size: 18, color: tokens.primaryAccent),
                ])),
          ),
        );
    if (!attachment.isImage) return documentCard();
    return InkWell(
      onTap: () => showDialog<void>(
          context: context,
          builder: (context) => Dialog(
                  child: Column(mainAxisSize: MainAxisSize.min, children: [
                Align(
                    alignment: Alignment.centerRight,
                    child: IconButton(
                        onPressed: () => Navigator.pop(context),
                        icon: const Icon(Icons.close))),
                Flexible(
                    child: InteractiveViewer(
                        child: Image.network(attachment.uri.toString(),
                            errorBuilder: (_, __, ___) =>
                                const Text('Unable to load image')))),
              ]))),
      child: ClipRRect(
          borderRadius: BorderRadius.circular(12),
          child: Image.network(
            attachment.uri.toString(),
            fit: BoxFit.contain,
            height: 240,
            errorBuilder: (_, __, ___) => documentCard(),
          )),
    );
  }
}
