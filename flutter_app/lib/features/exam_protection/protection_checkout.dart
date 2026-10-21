import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:material_ui/material_ui.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/api/api_client.dart';
import '../../core/payments/payment_attempt_logger.dart';
import '../payments/payment_result_page.dart';

/// Isolated checkout; does not alter the existing course/note payment services.
/// Shows its own full-page result (success, failed, cancelled, confirming) and
/// records every attempt that does not finish so managers can follow up.
Future<void> purchaseProtection(
  BuildContext context,
  ApiClient api,
  String courseId, {
  String itemName = 'Exam Protection',
  num? fee,
}) async {
  final log = PaymentAttemptLogger(api);
  final name = 'Exam Protection: $itemName';
  final attempt = log.start(
    kind: 'PROTECTION',
    itemName: name,
    itemRef: courseId,
    amount: fee?.toDouble(),
  );

  String messageOf(Object e) {
    if (e is DioException) {
      final d = e.response?.data;
      if (d is Map && d['error'] is String) return d['error'] as String;
      if (e.response == null) {
        return 'Could not reach the server. Check your internet connection and try again.';
      }
    }
    if (e is FormatException) return e.message;
    return 'Something went wrong. Please try again.';
  }

  Future<void> show(PaymentOutcome o, String? reason,
      {String? orderId, String? paymentId, bool success = false}) async {
    final act = await showPaymentResult(
      context,
      outcome: o,
      title: name,
      amount: fee?.toDouble(),
      orderId: orderId,
      paymentId: paymentId,
      reason: reason,
      grants: success
          ? const [
              'Protection is active for this course',
              'Claims open after official results are declared',
              'Below 38%? Choose a refund or a bigger discount',
            ]
          : const [],
      primaryLabel: success ? 'Done' : null,
      secondaryLabel: success ? 'View my protection' : null,
      secondaryRoute: success ? '/exam-protection' : null,
    );
    if (act == PaymentResultAction.primary &&
        !success &&
        o != PaymentOutcome.pending &&
        context.mounted) {
      await purchaseProtection(context, api, courseId,
          itemName: itemName, fee: fee);
    }
  }

  Map<String, dynamic> order;
  try {
    final response = await api.post<Map<String, dynamic>>(
      '/api/exam-protection/purchase',
      body: {'courseId': courseId, 'acceptedRules': true},
    );
    order = response.data!;
  } catch (e) {
    final msg = messageOf(e);
    unawaited(log.finish(await attempt, status: 'FAILED', reason: msg));
    if (context.mounted) await show(PaymentOutcome.failed, msg);
    return;
  }
  if (!context.mounted) return;
  final orderId = '${order['razorpayOrderId'] ?? order['orderId'] ?? ''}';
  final result = await Navigator.of(context).push<Map<String, dynamic>>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => _Checkout(order: order),
    ),
  );
  final attemptId = await attempt;
  if (result == null) {
    unawaited(log.finish(attemptId,
        status: 'CANCELLED',
        reason: 'Closed checkout without paying',
        orderRef: orderId));
    if (context.mounted) await show(PaymentOutcome.cancelled, null, orderId: orderId);
    return;
  }
  if (result['error'] != null) {
    final msg = '${result['error']}';
    unawaited(log.finish(attemptId,
        status: 'FAILED', reason: msg, orderRef: orderId));
    if (context.mounted) await show(PaymentOutcome.failed, msg, orderId: orderId);
    return;
  }
  final paymentId = '${result['razorpay_payment_id'] ?? ''}';
  try {
    await api.post('/api/exam-protection/verify', body: result);
  } catch (e) {
    unawaited(log.finish(attemptId,
        status: 'PENDING_VERIFY',
        reason: 'Paid but verification failed: ${messageOf(e)}',
        orderRef: orderId,
        paymentRef: paymentId));
    if (context.mounted) {
      await show(PaymentOutcome.pending, null,
          orderId: orderId, paymentId: paymentId);
    }
    return;
  }
  unawaited(log.finish(attemptId,
      status: 'SUCCESS', orderRef: orderId, paymentRef: paymentId));
  if (context.mounted) {
    await show(PaymentOutcome.success, null,
        orderId: orderId, paymentId: paymentId, success: true);
  }
}

class _Checkout extends StatefulWidget {
  const _Checkout({required this.order});
  final Map<String, dynamic> order;
  @override
  State<_Checkout> createState() => _CheckoutState();
}

class _CheckoutState extends State<_Checkout> {
  late final WebViewController controller;
  bool finished = false;
  String? error;
  void finish(Map<String, dynamic>? value) {
    if (finished || !mounted) return;
    finished = true;
    Navigator.of(context).pop(value);
  }

  @override
  void initState() {
    super.initState();
    final data = jsonEncode(widget.order).replaceAll('<', r'\u003c');
    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..addJavaScriptChannel(
        'ProtectionCheckout',
        onMessageReceived: (message) {
          try {
            finish(
              Map<String, dynamic>.from(jsonDecode(message.message) as Map),
            );
          } catch (_) {
            finish({
              'error': 'Invalid payment response. Refresh to check protection status.',
            });
          }
        },
      )
      ..setNavigationDelegate(
        NavigationDelegate(
          onWebResourceError: (issue) {
            if (issue.isForMainFrame == true && mounted) {
              setState(
                () => error = 'Checkout could not load. Close and try again.',
              );
            }
          },
        ),
      )
      ..loadHtmlString(
        '''<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="font-family:system-ui;padding:24px"><p>Opening secure checkout…</p><script src="https://checkout.razorpay.com/v1/checkout.js"></script><script>const o=$data;const checkout=new Razorpay({key:o.keyId,order_id:o.razorpayOrderId,amount:o.amount,currency:'INR',name:'GenZ IITian',description:'Exam Protection · '+o.courseName,prefill:{name:o.userName,email:o.userEmail},handler:r=>ProtectionCheckout.postMessage(JSON.stringify(r)),modal:{ondismiss:()=>ProtectionCheckout.postMessage(JSON.stringify({error:'Checkout cancelled.'}))}});checkout.on('payment.failed',r=>ProtectionCheckout.postMessage(JSON.stringify({error:r.error.description||'Payment failed.'})));checkout.open();</script></body></html>''',
        baseUrl: 'https://checkout.razorpay.com',
      );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Protection payment')),
    body: error == null
        ? WebViewWidget(controller: controller)
        : Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Text(error!),
            ),
          ),
  );
}
