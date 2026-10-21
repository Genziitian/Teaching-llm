import '../api/api_client.dart';

/// Records every checkout attempt on the server so managers can follow up with
/// students whose payment failed or who never finished paying. Never throws:
/// logging must not get in the way of a payment.
class PaymentAttemptLogger {
  PaymentAttemptLogger(this.api);
  final ApiClient api;

  /// [kind]: COURSE, BUNDLE, NOTE, PROTECTION, MENTORSHIP or OTHER.
  Future<String?> start({
    required String kind,
    required String itemName,
    String? itemRef,
    double? amount,
    String gateway = 'RAZORPAY',
  }) async {
    try {
      final r = await api.post<dynamic>('/api/payment-attempts', body: {
        'kind': kind,
        'itemName': itemName,
        'itemRef': itemRef,
        'amount': amount,
        'gateway': gateway,
        'platform': 'APP',
        'status': 'STARTED',
      });
      final d = r.data;
      if (d is Map && d['attempt'] is Map) {
        return (d['attempt'] as Map)['id']?.toString();
      }
    } catch (_) {}
    return null;
  }

  /// [status]: FAILED, CANCELLED, PENDING_VERIFY or SUCCESS.
  Future<void> finish(
    String? id, {
    required String status,
    String? reason,
    String? orderRef,
    String? paymentRef,
  }) async {
    if (id == null) return;
    try {
      await api.post<dynamic>('/api/payment-attempts', body: {
        'id': id,
        'status': status,
        'reason': reason,
        'orderRef': orderRef,
        'paymentRef': paymentRef,
      });
    } catch (_) {}
  }
}
