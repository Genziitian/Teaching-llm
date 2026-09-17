import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../config/api_config.dart';
import 'admin_content_url.dart';

/// Null means the destination belongs in a browser or another app.
String? nativeCtaRoute(String rawLink) {
  final uri = resolveAdminContentUrl(rawLink);
  if (uri == null) return null;
  final appHosts = {
    Uri.parse(ApiConfig.baseUrl).host,
    'class.genziitian.in',
    'teaching-llm.onrender.com',
  };
  if (!appHosts.contains(uri.host)) return null;
  var path = uri.path;
  if (path == '/') path = '/dashboard';
  if (path == '/menu') path = '/more';
  if (path == '/courses/explore') path = '/courses';
  if (path == '/materials') {
    path = '/free-resources';
  }
  const roots = {
    '/dashboard',
    '/courses',
    '/academics',
    '/community',
    '/more',
    '/free-resources',
    '/free-resources/courses',
    '/free-resources/materials',
    '/free-resources/purchased',
    '/calendar',
    '/announcements',
    '/feedback',
    '/live',
    '/support',
    '/profile',
    '/downloads',
    '/downloaded-notes',
    '/transactions',
    '/faq',
    '/notifications',
    '/settings',
    '/settings/notifications',
    '/about-us',
    '/privacy-policy',
    '/refund-policy',
    '/terms',
    '/terms-and-conditions',
    '/copyright',
    '/copyright-policy',
    '/contact-us',
  };
  if (!roots.contains(path) &&
      !RegExp(r'^/(courses|community)/[^/]+$').hasMatch(path)) {
    return null;
  }
  return Uri(
    path: path,
    query: uri.hasQuery ? uri.query : null,
    fragment: uri.hasFragment ? uri.fragment : null,
  ).toString();
}

/// Opens CTA destinations consistently across Flutter announcement surfaces.
Future<void> openCtaLink(BuildContext context, String rawLink) async {
  final link = rawLink.trim();
  if (link.isEmpty) return;

  final uri = Uri.tryParse(link);
  if (uri == null) return;

  final route = nativeCtaRoute(link);
  if (route != null) {
    if (context.mounted) context.go(route);
    return;
  }
  final destination = (uri.scheme == 'mailto' || uri.scheme == 'tel')
      ? uri
      : resolveAdminContentUrl(link);
  if (destination == null) throw const FormatException('Unsupported link');
  if (!await launchUrl(destination, mode: LaunchMode.externalApplication)) {
    throw StateError('Could not open link');
  }
}
