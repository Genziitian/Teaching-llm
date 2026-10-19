import 'package:flutter/gestures.dart';
import 'package:material_ui/material_ui.dart';
import 'package:html/dom.dart' as dom;
import 'package:html/parser.dart' as html;

import '../../theme/app_theme_tokens.dart';

/// Renders the web editor's formatting without executing HTML or scripts.
class UpdateRichText extends StatefulWidget {
  const UpdateRichText(
      {super.key, required this.content, required this.onLink});
  final String content;
  final ValueChanged<String> onLink;

  @override
  State<UpdateRichText> createState() => _UpdateRichTextState();
}

class _UpdateRichTextState extends State<UpdateRichText> {
  final _recognizers = <TapGestureRecognizer>[];

  void _clearRecognizers() {
    for (final recognizer in _recognizers) {
      recognizer.dispose();
    }
    _recognizers.clear();
  }

  @override
  void dispose() {
    _clearRecognizers();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    _clearRecognizers();
    final fragment = html.parseFragment(widget.content);
    return Text.rich(TextSpan(
      style: TextStyle(
          color: context.tokens.textSecondary, fontSize: 15, height: 1.6),
      children: [
        for (final node in fragment.nodes) _span(node, const TextStyle())
      ],
    ));
  }

  InlineSpan _span(dom.Node node, TextStyle inherited,
      [TapGestureRecognizer? link]) {
    if (node is dom.Text) {
      return TextSpan(text: node.text, style: inherited, recognizer: link);
    }
    if (node is! dom.Element) return const TextSpan();
    final tag = node.localName;
    if (const {'script', 'style', 'iframe', 'object', 'embed', 'form', 'input'}
        .contains(tag)) return const TextSpan();
    if (tag == 'br') return const TextSpan(text: '\n');

    var style = inherited;
    if (tag == 'b' || tag == 'strong') {
      style = style.copyWith(fontWeight: FontWeight.bold);
    }
    if (tag == 'i' || tag == 'em') {
      style = style.copyWith(fontStyle: FontStyle.italic);
    }
    final decorations = <TextDecoration>[
      if (style.decoration != null) style.decoration!,
      if (tag == 'u') TextDecoration.underline,
      if (tag == 's' || tag == 'strike' || tag == 'del')
        TextDecoration.lineThrough,
    ];
    final css = <String, String>{};
    for (final declaration in (node.attributes['style'] ?? '').split(';')) {
      final colon = declaration.indexOf(':');
      if (colon > 0) {
        css[declaration.substring(0, colon).trim()] =
            declaration.substring(colon + 1).trim();
      }
    }
    if (css['font-weight'] == 'bold' || css['font-weight'] == '700') {
      style = style.copyWith(fontWeight: FontWeight.bold);
    }
    if (css['font-style'] == 'italic') {
      style = style.copyWith(fontStyle: FontStyle.italic);
    }
    if (css['text-decoration']?.contains('underline') == true) {
      decorations.add(TextDecoration.underline);
    }
    if (css['text-decoration']?.contains('line-through') == true) {
      decorations.add(TextDecoration.lineThrough);
    }
    if (decorations.isNotEmpty) {
      style = style.copyWith(decoration: TextDecoration.combine(decorations));
    }
    final color = _color(css['color'] ?? node.attributes['color']);
    if (color != null) style = style.copyWith(color: color);
    if (const {'h1', 'h2', 'h3'}.contains(tag)) {
      style = style.copyWith(
          fontSize: tag == 'h1' ? 24 : 20, fontWeight: FontWeight.bold);
    }
    if (tag == 'a' && node.attributes['href'] != null) {
      final href = node.attributes['href']!;
      link = TapGestureRecognizer()..onTap = () => widget.onLink(href);
      _recognizers.add(link);
      style = style.copyWith(
          color: context.tokens.primaryAccent,
          decoration: TextDecoration.underline);
    }
    var prefix = '';
    if (tag == 'li') {
      final parent = node.parent;
      final ordered = parent is dom.Element && parent.localName == 'ol';
      final index = parent?.children.indexOf(node) ?? 0;
      prefix = ordered ? '${index + 1}. ' : '• ';
    }
    final block = const {
      'p',
      'div',
      'li',
      'ul',
      'ol',
      'h1',
      'h2',
      'h3',
      'blockquote'
    }.contains(tag);
    return TextSpan(style: style, children: [
      if (prefix.isNotEmpty) TextSpan(text: prefix),
      for (final child in node.nodes) _span(child, style, link),
      if (block) const TextSpan(text: '\n'),
    ]);
  }

  Color? _color(String? value) {
    if (value == null) return null;
    if (RegExp(r'^#[0-9a-fA-F]{6}$').hasMatch(value)) {
      return Color(0xFF000000 | int.parse(value.substring(1), radix: 16));
    }
    final rgb =
        RegExp(r'^rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)$').firstMatch(value);
    if (rgb == null) return null;
    return Color.fromRGBO(int.parse(rgb[1]!).clamp(0, 255),
        int.parse(rgb[2]!).clamp(0, 255), int.parse(rgb[3]!).clamp(0, 255), 1);
  }
}
