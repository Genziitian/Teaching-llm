import 'dart:async';
import 'package:in_app_purchase/in_app_purchase.dart';
import '../api/api_client.dart';

class PlayPaymentResult {
  PlayPaymentResult.success({required this.orderId, required this.message})
      : isSuccess = true,
        isCancelled = false,
        errorMessage = null;

  PlayPaymentResult.failed(this.errorMessage)
      : isSuccess = false,
        isCancelled = false,
        orderId = null,
        message = null;

  PlayPaymentResult.cancelled()
      : isSuccess = false,
        isCancelled = true,
        orderId = null,
        message = null,
        errorMessage = 'Checkout was cancelled.';

  final bool isSuccess;
  final bool isCancelled;
  final String? orderId;
  final String? message;
  final String? errorMessage;
}

class PlayBillingService {
  PlayBillingService({required this.api});
  final ApiClient api;

  final InAppPurchase _iap = InAppPurchase.instance;

  /// Purchases a note using Google Play Billing (consumable so it can be restored/repurchased).
  Future<PlayPaymentResult> purchaseNote({
    required String noteId,
    required double price,
    String? title,
  }) async {
    bool available = false;
    try {
      available = await _iap.isAvailable();
    } catch (e) {
      return PlayPaymentResult.failed(
        'Google Play Billing connection error: $e. If you just added the billing dependency, please rebuild and restart the app.',
      );
    }

    if (!available) {
      return PlayPaymentResult.failed(
        'Google Play Store is not available or not signed in on this device.',
      );
    }

    final productId = 'note_${price.round()}';

    // 1. Fetch product details from Google Play
    final ProductDetailsResponse response;
    try {
      response = await _iap.queryProductDetails({productId});
    } catch (e) {
      return PlayPaymentResult.failed('Failed to query product $productId: $e');
    }

    if (response.notFoundIDs.contains(productId) ||
        response.productDetails.isEmpty) {
      return PlayPaymentResult.failed(
        'Product $productId was not found in Google Play. '
        'Ensure it is active in Play Console.',
      );
    }

    final productDetails = response.productDetails.first;
    final purchaseParam = PurchaseParam(productDetails: productDetails);

    final completer = Completer<PlayPaymentResult>();
    StreamSubscription<List<PurchaseDetails>>? subscription;

    subscription = _iap.purchaseStream.listen(
      (List<PurchaseDetails> purchases) async {
        for (final purchase in purchases) {
          if (purchase.productID != productId) continue;

          switch (purchase.status) {
            case PurchaseStatus.purchased:
            case PurchaseStatus.restored:
              try {
                // Verify with backend
                final res = await api.post<Map<String, dynamic>>(
                  '/api/store/notes/$noteId/verify-play-purchase',
                  body: {
                    'purchaseToken':
                        purchase.verificationData.serverVerificationData,
                    'productId': purchase.productID,
                    'orderId': purchase.purchaseID,
                  },
                );

                final data = res.data ?? const <String, dynamic>{};
                if (data['error'] != null) {
                  if (!completer.isCompleted) {
                    completer.complete(
                      PlayPaymentResult.failed(data['error'].toString()),
                    );
                  }
                  break;
                }

                // Acknowledge/consume the purchase so it can be bought again later
                if (purchase.pendingCompletePurchase) {
                  await _iap.completePurchase(purchase);
                }

                if (!completer.isCompleted) {
                  completer.complete(
                    PlayPaymentResult.success(
                      orderId: (data['orderId'] as String?) ??
                          purchase.purchaseID ??
                          '',
                      message: (data['message'] as String?) ??
                          'Purchase successful',
                    ),
                  );
                }
              } catch (e) {
                if (!completer.isCompleted) {
                  completer.complete(
                    PlayPaymentResult.failed(
                      'Verification error: ${e.toString()}',
                    ),
                  );
                }
              }
              break;

            case PurchaseStatus.error:
              if (purchase.pendingCompletePurchase) {
                await _iap.completePurchase(purchase);
              }
              if (!completer.isCompleted) {
                completer.complete(
                  PlayPaymentResult.failed(
                    purchase.error?.message ?? 'Purchase failed',
                  ),
                );
              }
              break;

            case PurchaseStatus.canceled:
              if (purchase.pendingCompletePurchase) {
                await _iap.completePurchase(purchase);
              }
              if (!completer.isCompleted) {
                completer.complete(PlayPaymentResult.cancelled());
              }
              break;

            case PurchaseStatus.pending:
              // Waiting for user to complete Play Store flow
              break;
          }
        }
      },
      onError: (error) {
        if (!completer.isCompleted) {
          completer.complete(
            PlayPaymentResult.failed('Billing stream error: $error'),
          );
        }
      },
    );

    try {
      // Launch Google Play Billing sheet
      final launched = await _iap.buyConsumable(
        purchaseParam: purchaseParam,
        autoConsume: true,
      );

      if (!launched) {
        await subscription.cancel();
        return PlayPaymentResult.failed('Could not open Google Play payment dialog.');
      }

      // Await the user's action
      final result = await completer.future.timeout(
        const Duration(minutes: 10),
        onTimeout: () => PlayPaymentResult.failed('Checkout timed out.'),
      );

      await subscription.cancel();
      return result;
    } catch (e) {
      await subscription.cancel();
      return PlayPaymentResult.failed(e.toString());
    }
  }
}
