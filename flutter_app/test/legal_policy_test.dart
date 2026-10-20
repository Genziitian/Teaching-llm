import 'package:flutter_test/flutter_test.dart';
import 'package:teaching_llm/features/info/legal_policy_text.dart';

void main() {
  test('legal policy texts contain Google Play In-App Purchases terms and October 2026 date', () {
    expect(privacyPolicyText.contains('Last updated: October 20, 2026'), isTrue);
    expect(privacyPolicyText.contains('Google Play In-App Purchases'), isTrue);
    expect(privacyPolicyText.contains('Google Play In-App Purchases Refund Policy'), isTrue);

    expect(termsAndConditionsText.contains('Last Updated: October 2026'), isTrue);
    expect(termsAndConditionsText.contains('04.1 Google Play In-App Purchases (Android App)'), isTrue);
    expect(termsAndConditionsText.contains('90 days'), isTrue);
  });
}
