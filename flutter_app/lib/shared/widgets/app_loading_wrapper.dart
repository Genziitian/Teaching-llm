import 'package:material_ui/material_ui.dart';

import '../../core/facts/loading_fact_service.dart';
import '../../core/facts/loading_facts_data.dart';
import 'loading_fact_card.dart';

enum AppLoadingFactPosition {
  above,
  below,
  floating,
}

class AppLoadingWrapper extends StatefulWidget {
  const AppLoadingWrapper({
    super.key,
    required this.isLoading,
    this.child,
    this.loader = const CircularProgressIndicator(),
    this.position = AppLoadingFactPosition.below,
    this.allowCoupon = true,
    this.maxWidth = 440,
    this.spacing = 16,
  });

  final bool isLoading;
  final Widget? child;
  final Widget loader;
  final AppLoadingFactPosition position;
  final bool allowCoupon;
  final double maxWidth;
  final double spacing;

  @override
  State<AppLoadingWrapper> createState() => _AppLoadingWrapperState();
}

class _AppLoadingWrapperState extends State<AppLoadingWrapper> {
  LoadingFact? _fact;
  bool _wasLoading = false;

  @override
  void initState() {
    super.initState();
    _handleLoadingChange(widget.isLoading);
  }

  @override
  void didUpdateWidget(covariant AppLoadingWrapper oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.isLoading != widget.isLoading) {
      _handleLoadingChange(widget.isLoading);
    }
  }

  void _handleLoadingChange(bool isLoading) {
    if (isLoading && !_wasLoading) {
      // Transitioned to loading: acquire fact immediately
      final nextFact = LoadingFactService.instance.getNextFact(
        allowCoupon: widget.allowCoupon,
      );
      setState(() {
        _fact = nextFact;
        _wasLoading = true;
      });
    } else if (!isLoading && _wasLoading) {
      // Finished loading: dismiss fact immediately
      setState(() {
        _fact = null;
        _wasLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.isLoading) {
      return widget.child ?? const SizedBox.shrink();
    }

    if (widget.position == AppLoadingFactPosition.floating) {
      return Stack(
        children: [
          Center(child: widget.loader),
          if (_fact != null)
            Positioned(
              left: 20,
              right: 20,
              bottom: 30,
              child: LoadingFactCard(
                fact: _fact,
                maxWidth: widget.maxWidth,
              ),
            ),
        ],
      );
    }

    return Center(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (widget.position == AppLoadingFactPosition.above && _fact != null) ...[
              LoadingFactCard(
                fact: _fact,
                maxWidth: widget.maxWidth,
              ),
              SizedBox(height: widget.spacing),
            ],
            widget.loader,
            if (widget.position == AppLoadingFactPosition.below && _fact != null) ...[
              SizedBox(height: widget.spacing),
              LoadingFactCard(
                fact: _fact,
                maxWidth: widget.maxWidth,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
