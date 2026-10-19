/// Maps a content item's type and ID to the correct backend proxy endpoint
/// so the Flutter app can download PDF bytes through our authenticated proxy
/// rather than hitting Google Drive directly.
///
/// This is the single place that decides which URL to use for a given item.
/// Adding a new content source (e.g. Supabase Storage) only requires adding
/// a case here — callers don't need to change.
class UrlResolver {
  UrlResolver._();

  /// The content sources the app currently supports.
  static const typeContent = 'CONTENT';
  static const typeMaterial = 'MATERIAL';
  static const typeStoreNote = 'STORE_NOTE';
  static const typeVideo = 'VIDEO';

  /// Returns the proxy endpoint path (relative to [ApiConfig.baseUrl]) for
  /// streaming / downloading the given item.
  ///
  /// Examples:
  ///   resolve('abc123', 'CONTENT')    → '/api/drive-doc/abc123'
  ///   resolve('abc123', 'VIDEO')      → '/api/drive-stream/abc123'
  ///   resolve('def456', 'MATERIAL')   → '/api/drive-material/def456'
  ///   resolve('ghi789', 'STORE_NOTE') → '/api/store/notes/ghi789/download'
  static String resolve(String id, String contentType) {
    switch (contentType.toUpperCase()) {
      case typeVideo:
        return '/api/drive-stream/$id';
      case typeContent:
        return '/api/drive-doc/$id';
      case typeStoreNote:
        // Notes with several files use "<noteId>__<fileId>" as the content id.
        if (id.contains('__')) {
          final parts = id.split('__');
          return '/api/store/notes/${parts.first}/download?fileId=${parts.last}';
        }
        return '/api/store/notes/$id/download';
      case typeMaterial:
        return '/api/drive-material/$id';
      default:
        return '/api/drive-doc/$id';
    }
  }

  /// Classifies a raw URL or ID to determine whether it's a Drive-backed
  /// item that can be proxied, a direct PDF URL, or something we can't
  /// handle in-app.
  static UrlKind classify(String? url) {
    if (url == null || url.trim().isEmpty) return UrlKind.unsupported;
    final s = url.trim().toLowerCase();

    // Drive URLs — always proxy
    if (s.contains('drive.google.com') || s.contains('docs.google.com')) {
      return UrlKind.proxy;
    }
    // Bare Drive file IDs (25-80 char alphanumeric + dashes/underscores)
    if (RegExp(r'^[A-Za-z0-9_-]{15,80}$').hasMatch(url.trim())) {
      return UrlKind.proxy;
    }
    // Direct PDF URL
    if (s.endsWith('.pdf') || s.contains('.pdf?')) {
      return UrlKind.directPdf;
    }

    return UrlKind.unsupported;
  }
}

enum UrlKind {
  /// Can be proxied through our backend Drive endpoints.
  proxy,

  /// A direct HTTP(S) link to a .pdf file.
  directPdf,

  /// Not a downloadable PDF (e.g. a web page, YouTube link, etc.).
  unsupported,
}
