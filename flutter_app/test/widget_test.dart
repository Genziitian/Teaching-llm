import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:teaching_llm/features/dashboard/dashboard_page.dart';
import 'package:teaching_llm/shared/widgets/video_watermark.dart';

void main() {
  group('Video Watermark Widget Tests', () {
    testWidgets('FloatingVideoWatermark displays student name and email',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: Stack(
              children: [
                SizedBox(width: 800, height: 600),
                FloatingVideoWatermark(
                  userText: 'Aarav Sharma • student@study.iitm.ac.in',
                ),
              ],
            ),
          ),
        ),
      );

      // Verify that the watermark text is rendered
      expect(find.textContaining('Aarav Sharma'), findsOneWidget);
      expect(find.textContaining('student@study.iitm.ac.in'), findsOneWidget);
    });
  });

  group('QuickActionGridCard Shortcut Tests', () {
    testWidgets('Displays Free Resources, Support, Downloads, Settings and not Community/Calendar',
        (WidgetTester tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: QuickActionGridCard(),
          ),
        ),
      );

      // Verify replaced shortcuts are present
      expect(find.text('Free Resources'), findsOneWidget);
      expect(find.text('Support'), findsOneWidget);
      expect(find.text('Downloads'), findsOneWidget);
      expect(find.text('Settings'), findsOneWidget);

      // Verify old shortcuts are gone
      expect(find.text('Community'), findsNothing);
      expect(find.text('Calendar'), findsNothing);
    });
  });
}
