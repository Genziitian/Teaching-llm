import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:teaching_llm/features/launch/play_store_launch_overlay.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets('shows on open with no login, until Enter is tapped', (tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          playStoreLaunchSeenProvider.overrideWith((_) => false),
        ],
        child: const MaterialApp(
          home: PlayStoreLaunchOverlay(
            child: Text('APP BODY'),
          ),
        ),
      ),
    );

    expect(find.text('Welcome to the new app'), findsOneWidget);
    expect(find.text('Thank you for supporting us. Because of you, we are here.'), findsOneWidget);
    expect(find.text('Please use this app.'), findsOneWidget);
    expect(find.text('Team GenZ IITian'), findsOneWidget);
    expect(find.text('ENTER'), findsOneWidget);
    expect(find.text('APP BODY'), findsOneWidget);

    await tester.tap(find.byKey(const Key('play-store-launch-enter')));
    await tester.pump();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    expect(find.text('Welcome to the new app'), findsNothing);
    expect(find.text('APP BODY'), findsOneWidget);

    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getBool('genz_flutter_playstore_launch_seen'), isTrue);
  });

  testWidgets('stays hidden on platforms other than the Android app', (tester) async {
    debugDefaultTargetPlatformOverride = TargetPlatform.iOS;
    SharedPreferences.setMockInitialValues({});
    try {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            playStoreLaunchSeenProvider.overrideWith((_) => false),
          ],
          child: const MaterialApp(
            home: PlayStoreLaunchOverlay(
              child: Text('APP BODY'),
            ),
          ),
        ),
      );

      expect(find.text('Welcome to the new app'), findsNothing);
      expect(find.text('APP BODY'), findsOneWidget);
    } finally {
      debugDefaultTargetPlatformOverride = null;
    }
  });

  testWidgets('stays hidden once it has already been seen', (tester) async {
    SharedPreferences.setMockInitialValues({
      'genz_flutter_playstore_launch_seen': true,
    });

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          playStoreLaunchSeenProvider.overrideWith((_) => true),
        ],
        child: const MaterialApp(
          home: PlayStoreLaunchOverlay(
            child: Text('APP BODY'),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Welcome to the new app'), findsNothing);
    expect(find.text('ENTER'), findsNothing);
    expect(find.text('APP BODY'), findsOneWidget);
  });
}
