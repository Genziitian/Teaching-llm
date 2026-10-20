import 'dart:convert';

import 'package:material_ui/material_ui.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/api/api_client.dart';

/// Isolated checkout; does not alter the existing course/note payment services.
Future<void> purchaseProtection(
  BuildContext context,
  ApiClient api,
  String courseId,
) async {
  final response = await api.post<Map<String, dynamic>>(
    '/api/exam-protection/purchase',
    body: {'courseId': courseId, 'acceptedRules': true},
  );
  final order = response.data!;
  if (!context.mounted) return;
  final result = await Navigator.of(context).push<Map<String, dynamic>>(
    MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => _Checkout(order: order),
    ),
  );
  if (result == null) {
    throw const FormatException(
      'Checkout closed. If charged, refresh to confirm your protection.',
    );
  }
  if (result['error'] != null) throw FormatException('${result['error']}');
  await api.post('/api/exam-protection/verify', body: result);
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
