import 'dart:async';
import 'dart:convert';

import 'package:material_ui/material_ui.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../api/api_client.dart';

/// Result of the Razorpay checkout once /verify confirms the payment.
class RazorpayPaymentResult {
  RazorpayPaymentResult.success({required this.orderId, required this.message})
      : isSuccess = true,
        errorMessage = null;
  RazorpayPaymentResult.failed(this.errorMessage)
      : isSuccess = false,
        orderId = null,
        message = null;

  final bool isSuccess;
  final String? orderId;
  final String? message;
  final String? errorMessage;
}

/// Razorpay checkout implemented via WebView (Razorpay's hosted JS bundle),
/// not the native `razorpay_flutter` SDK. This avoids the duplicate-namespace
/// build conflict (`com.razorpay:standard-core` + `com.razorpay:core`) that
/// AGP 9 enforces against. The flow is identical: create-order on our
/// server, open the Razorpay UI, send the signature back to /verify.
class RazorpayCheckoutService {
  RazorpayCheckoutService({required this.api});
  final ApiClient api;

  /// Pushes a full-screen WebView page for the checkout, awaits the result,
  /// then verifies the signature against our backend. Caller stays on the
  /// product page while this future resolves.
  Future<RazorpayPaymentResult> purchaseOffering({
    required BuildContext context,
    required String offeringId,
    required String accessType, // 'RECORDED' | 'LIVE' | 'CHAMPION'
    String? couponCode,
  }) async {
    // 1. Server mints the Razorpay order and returns the public key + amount.
    final Map<String, dynamic> orderData;
    try {
      final res = await api.post<Map<String, dynamic>>(
        '/api/course-offerings/$offeringId/create-order',
        body: {
          'accessType': accessType,
          if (couponCode != null && couponCode.trim().isNotEmpty)
            'couponCode': couponCode.trim().toUpperCase(),
        },
      );
      orderData = res.data ?? const <String, dynamic>{};
    } catch (e) {
      // The Dio interceptor surfaces `{ error: "..." }` payloads as the
      // exception message, so this often contains the real reason
      // (e.g. "Live access is not available" when prices aren't set, or
      // "RAZORPAY_KEY_ID is not configured" if Render env vars are missing).
      return RazorpayPaymentResult.failed(e.toString());
    }

    final keyId = orderData['keyId'] as String?;
    final rzpOrderId = orderData['razorpayOrderId'] as String?;
    final amount = (orderData['amount'] as num?)?.toInt();
    if (keyId == null) {
      return RazorpayPaymentResult.failed(
          'Razorpay public key not configured on the server. '
          'Set NEXT_PUBLIC_RAZORPAY_KEY_ID in Render → Environment.');
    }
    if (rzpOrderId == null) {
      return RazorpayPaymentResult.failed(
          'Server did not return a Razorpay order id. '
          'Set RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET on Render and retry.');
    }
    if (amount == null) {
      return RazorpayPaymentResult.failed(
          'This course offering has no price set for the selected access '
          'type. Ask the manager to set it in the admin panel.');
    }

    // 2. Hand off to a full-screen WebView. It resolves with the Razorpay
    //    callback payload (or null on dismissal).
    if (!context.mounted) {
      return RazorpayPaymentResult.failed('Context unmounted');
    }
    final raw = await Navigator.of(context).push<Map<String, dynamic>?>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => _RazorpayCheckoutPage(
          keyId: keyId,
          orderId: rzpOrderId,
          amount: amount,
          currency: (orderData['currency'] as String?) ?? 'INR',
          description: orderData['courseName'] as String? ?? '',
          name: (orderData['bundleName'] ?? orderData['courseName']) as String? ??
              'Course',
          userName: (orderData['userName'] as String?) ?? '',
          userEmail: (orderData['userEmail'] as String?) ?? '',
        ),
      ),
    );

    if (raw == null) {
      return RazorpayPaymentResult.failed('Checkout was cancelled.');
    }
    if (raw['error'] != null) {
      return RazorpayPaymentResult.failed(raw['error'] as String);
    }

    // 3. Send the signature triple to our backend for HMAC verification.
    try {
      final verify = await api.post<Map<String, dynamic>>(
        '/api/course-offerings/$offeringId/verify',
        body: {
          'razorpay_payment_id': raw['razorpay_payment_id'],
          'razorpay_order_id': raw['razorpay_order_id'],
          'razorpay_signature': raw['razorpay_signature'],
        },
      );
      final data = verify.data ?? const <String, dynamic>{};
      return RazorpayPaymentResult.success(
        orderId: (data['orderId'] as String?) ?? rzpOrderId,
        message: (data['message'] as String?) ?? 'Purchase successful',
      );
    } catch (e) {
      return RazorpayPaymentResult.failed(
          'Signature verification failed: $e');
    }
  }

  /// Buys (or restores) a Premium Note. Same flow as [purchaseOffering]:
  /// create-order → Razorpay WebView → verify. Free notes skip checkout.
  Future<RazorpayPaymentResult> purchaseNote({
    required BuildContext context,
    required String noteId,
  }) async {
    final Map<String, dynamic> orderData;
    try {
      final res = await api.post<Map<String, dynamic>>(
        '/api/store/notes/$noteId/create-order',
      );
      orderData = res.data ?? const <String, dynamic>{};
    } catch (e) {
      return RazorpayPaymentResult.failed(e.toString());
    }

    if (orderData['isFree'] == true) {
      return RazorpayPaymentResult.success(
          orderId: '', message: 'Added to your library');
    }

    final keyId = (orderData['keyId'] ?? orderData['key']) as String?;
    final rzpOrderId = orderData['razorpayOrderId'] as String?;
    final amount = (orderData['amount'] as num?)?.toInt();
    if (keyId == null || rzpOrderId == null || amount == null) {
      return RazorpayPaymentResult.failed(
          'Payments are not set up for this note yet. Please try again later.');
    }

    if (!context.mounted) {
      return RazorpayPaymentResult.failed('Context unmounted');
    }
    final raw = await Navigator.of(context).push<Map<String, dynamic>?>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => _RazorpayCheckoutPage(
          keyId: keyId,
          orderId: rzpOrderId,
          amount: amount,
          currency: (orderData['currency'] as String?) ?? 'INR',
          description: (orderData['noteTitle'] as String?) ?? 'Premium Notes',
          name: 'GenZ IITian',
          userName: (orderData['userName'] as String?) ?? '',
          userEmail: (orderData['userEmail'] as String?) ?? '',
        ),
      ),
    );

    if (raw == null) return RazorpayPaymentResult.failed('Checkout was cancelled.');
    if (raw['error'] != null) {
      return RazorpayPaymentResult.failed(raw['error'] as String);
    }

    try {
      final verify = await api.post<Map<String, dynamic>>(
        '/api/store/notes/$noteId/verify-payment',
        body: {
          'razorpay_payment_id': raw['razorpay_payment_id'],
          'razorpay_order_id': raw['razorpay_order_id'],
          'razorpay_signature': raw['razorpay_signature'],
        },
      );
      final data = verify.data ?? const <String, dynamic>{};
      return RazorpayPaymentResult.success(
        orderId: (data['orderId'] as String?) ?? rzpOrderId,
        message: (data['message'] as String?) ?? 'Purchase successful',
      );
    } catch (e) {
      return RazorpayPaymentResult.failed('Signature verification failed: $e');
    }
  }

  /// Kept for API parity with the old native-SDK service. Nothing to dispose
  /// because each checkout creates and tears down its own WebView page.
  void dispose() {}
}

/// Full-screen page that loads Razorpay's Checkout JS bundle inside a
/// WebView, opens it with the order params, and posts the result back to
/// Flutter via a `RazorpayBridge` JavaScript channel.
class _RazorpayCheckoutPage extends StatefulWidget {
  const _RazorpayCheckoutPage({
    required this.keyId,
    required this.orderId,
    required this.amount,
    required this.currency,
    required this.name,
    required this.description,
    required this.userName,
    required this.userEmail,
  });

  final String keyId;
  final String orderId;
  final int amount;
  final String currency;
  final String name;
  final String description;
  final String userName;
  final String userEmail;

  @override
  State<_RazorpayCheckoutPage> createState() => _RazorpayCheckoutPageState();
}

class _RazorpayCheckoutPageState extends State<_RazorpayCheckoutPage> {
  late final WebViewController _web;
  bool _settled = false;

  @override
  void initState() {
    super.initState();
    _web = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(Colors.white)
      ..addJavaScriptChannel(
        'RazorpayBridge',
        onMessageReceived: _onBridgeMessage,
      )
      ..loadHtmlString(_buildHtml(), baseUrl: 'https://checkout.razorpay.com/');
  }

  String _escape(String input) =>
      const HtmlEscape(HtmlEscapeMode.attribute).convert(input);

  String _buildHtml() {
    // Razorpay's hosted Standard Checkout JS. Opens immediately on load,
    // pipes success/dismiss/error back to Flutter via RazorpayBridge.
    return '''
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no"/>
<title>Checkout</title>
<style>
  html,body { margin:0; padding:0; background:#fff; height:100%; font-family:system-ui,sans-serif; }
  #status { position:fixed; inset:0; display:flex; align-items:center; justify-content:center;
            color:#4F46E5; font-size:14px; font-weight:600; }
</style>
</head>
<body>
<div id="status">Opening secure checkout…</div>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  function send(payload) {
    if (window.RazorpayBridge && RazorpayBridge.postMessage) {
      RazorpayBridge.postMessage(JSON.stringify(payload));
    }
  }
  var options = {
    key: '${_escape(widget.keyId)}',
    amount: ${widget.amount},
    currency: '${_escape(widget.currency)}',
    name: '${_escape(widget.name)}',
    description: '${_escape(widget.description)}',
    order_id: '${_escape(widget.orderId)}',
    prefill: {
      name: '${_escape(widget.userName)}',
      email: '${_escape(widget.userEmail)}'
    },
    theme: { color: '#4F46E5' },
    modal: {
      ondismiss: function () {
        send({ type: 'dismiss' });
      }
    },
    handler: function (response) {
      send({
        type: 'success',
        razorpay_payment_id: response.razorpay_payment_id,
        razorpay_order_id: response.razorpay_order_id,
        razorpay_signature: response.razorpay_signature
      });
    }
  };
  var rzp = new Razorpay(options);
  rzp.on('payment.failed', function (resp) {
    send({ type: 'error', message: (resp && resp.error && resp.error.description) || 'Payment failed' });
  });
  rzp.open();
</script>
</body>
</html>
''';
  }

  void _onBridgeMessage(JavaScriptMessage message) {
    if (_settled) return;
    Map<String, dynamic> payload;
    try {
      payload = json.decode(message.message) as Map<String, dynamic>;
    } catch (_) {
      payload = const {'type': 'error', 'message': 'Bad bridge payload'};
    }
    _settled = true;
    final type = payload['type'];
    if (type == 'success') {
      Navigator.of(context).pop(payload);
    } else if (type == 'dismiss') {
      Navigator.of(context).pop(null);
    } else {
      Navigator.of(context).pop({
        'error': (payload['message'] as String?) ?? 'Payment failed',
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Secure Checkout'),
        backgroundColor: Colors.white,
        foregroundColor: const Color(0xFF0B1020),
        elevation: 0.5,
        actions: [
          IconButton(
            tooltip: 'Cancel',
            icon: const Icon(Icons.close),
            onPressed: () {
              if (!_settled) {
                _settled = true;
                Navigator.of(context).pop(null);
              }
            },
          ),
        ],
      ),
      body: WebViewWidget(controller: _web),
    );
  }
}
