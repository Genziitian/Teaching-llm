/// Translate public website addresses to their native counterparts. The
/// destination stays local; query parameters never select another host.
String appLinkLocation(Uri uri) {
  var path = uri.path.isEmpty ? '/' : uri.path;
  final query = Map<String, String>.from(uri.queryParameters);
  if (uri.hasScheme) query.remove('localPath');

  // The website may have already sent a signed-out visitor to /login?next=….
  if (path == '/login') {
    final next = Uri.tryParse(query['next'] ?? '');
    if (next != null &&
        !next.hasScheme &&
        !next.hasAuthority &&
        next.path.startsWith('/') &&
        next.path != '/login') {
      return appLinkLocation(next);
    }
  }

  const aliases = {
    '/': '/dashboard',
    '/menu': '/more',
    '/courses/explore': '/courses',
    '/store/courses': '/courses',
  };
  final sharedNote = query['note'];
  if (path == '/courses/explore' && sharedNote != null && sharedNote.isNotEmpty) {
    query.remove('note');
    path = '/store/notes/${Uri.encodeComponent(sharedNote)}';
  }
  path = aliases[path] ?? path;
  if (RegExp(r'^/store/courses/[^/]+$').hasMatch(path)) {
    path = path.substring('/store'.length);
  }

  final material = RegExp(r'^/material/([^/]+)/view$').firstMatch(path);
  final freeMaterial =
      RegExp(r'^/free-resources/materials/([^/]+)/view$').firstMatch(path);
  if (material != null || freeMaterial != null) {
    query['contentId'] =
        Uri.decodeComponent((material ?? freeMaterial)!.group(1)!);
    query['contentType'] = material != null ? 'CONTENT' : 'MATERIAL';
    path = '/material';
  }

  return Uri(
    path: path,
    queryParameters: query.isEmpty ? null : query,
    fragment: uri.hasFragment ? uri.fragment : null,
  ).toString();
}
