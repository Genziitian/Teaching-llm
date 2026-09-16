import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/app_loading_wrapper.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_theme_tokens.dart';
import 'support_providers.dart';

class FeatureRequestsPage extends ConsumerStatefulWidget {
  const FeatureRequestsPage({super.key});

  @override
  ConsumerState<FeatureRequestsPage> createState() =>
      _FeatureRequestsPageState();
}

class _FeatureRequestsPageState extends ConsumerState<FeatureRequestsPage> {
  Future<void> _openNewRequestSheet(BuildContext context) async {
    await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const _NewFeatureRequestSheet(),
    );
  }

  Future<void> _updateStatus(String id, String status) async {
    try {
      final client = ref.read(apiClientProvider);
      await client.put('/api/support/feature-requests', body: {
        'id': id,
        'status': status,
      });
      ref.invalidate(featureRequestsProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to update feature status.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final role = ref.watch(authStateProvider).value?.role;
    final isManager = role == 'MANAGER' || role == 'ADMIN';
    final requestsAsync = ref.watch(featureRequestsProvider);

    return AppPageScaffold(
      title: 'Feature Requests',
      subtitle: isManager
          ? 'Review and manage community feature requests'
          : 'Share ideas and see what is being built',
      showBack: true,
      onBack: () => context.canPop() ? context.pop() : context.go('/more'),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(featureRequestsProvider);
          try {
            await ref.read(featureRequestsProvider.future);
          } catch (_) {}
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
          children: [
            FilledButton.icon(
              onPressed: () => _openNewRequestSheet(context),
              icon: const Icon(Icons.lightbulb_outline_rounded, size: 20),
              label: const Text(
                'Request a Feature',
                style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
              ),
              style: FilledButton.styleFrom(
                backgroundColor: const Color(0xFF8B5CF6),
                foregroundColor: Colors.white,
                minimumSize: const Size.fromHeight(50),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
            ),
            const SizedBox(height: 20),

            requestsAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 36),
                child: AppLoadingWrapper(isLoading: true),
              ),
              error: (error, _) => Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 36),
                  child: Column(
                    children: [
                      Text(
                        'Failed to load feature requests.',
                        style: TextStyle(color: tokens.textSecondary),
                      ),
                      const SizedBox(height: 8),
                      TextButton(
                        onPressed: () => ref.invalidate(featureRequestsProvider),
                        child: const Text('Try again'),
                      ),
                    ],
                  ),
                ),
              ),
              data: (requests) {
                if (requests.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 48),
                    child: Center(
                      child: Column(
                        children: [
                          Icon(
                            Icons.lightbulb_outline_rounded,
                            size: 44,
                            color: tokens.textMuted,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'No feature requests yet',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: tokens.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Be the first to share an idea with us!',
                            style: TextStyle(
                              fontSize: 13,
                              color: tokens.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }

                return Column(
                  children: [
                    for (final item in requests)
                      _FeatureRequestCard(
                        item: item,
                        isManager: isManager,
                        onStatusChanged: (newStatus) =>
                            _updateStatus(item['id'] as String, newStatus),
                      ),
                  ],
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _FeatureRequestCard extends StatelessWidget {
  const _FeatureRequestCard({
    required this.item,
    required this.isManager,
    required this.onStatusChanged,
  });

  final Map<String, dynamic> item;
  final bool isManager;
  final ValueChanged<String> onStatusChanged;

  Color _statusColor(String status) {
    switch (status.toUpperCase()) {
      case 'ACCEPTED':
        return const Color(0xFF10B981);
      case 'REJECTED':
        return const Color(0xFFEF4444);
      case 'IN_PROGRESS':
        return const Color(0xFF6366F1);
      case 'PENDING':
      default:
        return const Color(0xFFF59E0B);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final title = (item['title'] as String?) ?? 'Untitled Feature';
    final description = (item['description'] as String?) ?? '';
    final status = ((item['status'] as String?) ?? 'PENDING').toUpperCase();
    final createdAt = item['createdAt'] != null
        ? DateTime.tryParse(item['createdAt'].toString())
        : null;
    final dateStr = createdAt != null
        ? DateFormat('MMM d, yyyy').format(createdAt)
        : '';
    final userName = item['user']?['name'] as String? ?? 'User';
    final userRole = item['user']?['role'] as String? ?? '';
    final statusColor = _statusColor(status);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: tokens.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.w800,
                    color: tokens.textPrimary,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              if (isManager)
                DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: ['PENDING', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS']
                            .contains(status)
                        ? status
                        : 'PENDING',
                    style: TextStyle(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w700,
                      color: statusColor,
                    ),
                    dropdownColor: tokens.cardBg,
                    items: const [
                      DropdownMenuItem(
                        value: 'PENDING',
                        child: Text('Pending', style: TextStyle(color: Color(0xFFF59E0B))),
                      ),
                      DropdownMenuItem(
                        value: 'IN_PROGRESS',
                        child: Text('In Progress', style: TextStyle(color: Color(0xFF6366F1))),
                      ),
                      DropdownMenuItem(
                        value: 'ACCEPTED',
                        child: Text('Accepted', style: TextStyle(color: Color(0xFF10B981))),
                      ),
                      DropdownMenuItem(
                        value: 'REJECTED',
                        child: Text('Rejected', style: TextStyle(color: Color(0xFFEF4444))),
                      ),
                    ],
                    onChanged: (val) {
                      if (val != null && val != status) {
                        onStatusChanged(val);
                      }
                    },
                  ),
                )
              else
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: statusColor.withOpacity(0.3)),
                  ),
                  child: Text(
                    status.replaceAll('_', ' '),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: statusColor,
                    ),
                  ),
                ),
            ],
          ),
          if (description.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              description,
              style: TextStyle(
                fontSize: 13,
                height: 1.45,
                color: tokens.textSecondary,
              ),
            ),
          ],
          const SizedBox(height: 12),
          Divider(height: 1, thickness: 1, color: tokens.border.withOpacity(0.5)),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '$userName${userRole.isNotEmpty ? ' ($userRole)' : ''}',
                style: TextStyle(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  color: tokens.textSecondary,
                ),
              ),
              if (dateStr.isNotEmpty)
                Text(
                  dateStr,
                  style: TextStyle(
                    fontSize: 11.5,
                    color: tokens.textMuted,
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _NewFeatureRequestSheet extends ConsumerStatefulWidget {
  const _NewFeatureRequestSheet();

  @override
  ConsumerState<_NewFeatureRequestSheet> createState() =>
      _NewFeatureRequestSheetState();
}

class _NewFeatureRequestSheetState
    extends ConsumerState<_NewFeatureRequestSheet> {
  final _titleController = TextEditingController();
  final _descriptionController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final title = _titleController.text.trim();
    final desc = _descriptionController.text.trim();

    if (title.isEmpty || desc.isEmpty) {
      setState(() => _error = 'Please provide both a title and description.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final client = ref.read(apiClientProvider);
      await client.post('/api/support/feature-requests', body: {
        'title': title,
        'description': desc,
      });

      ref.invalidate(featureRequestsProvider);

      if (mounted) {
        Navigator.of(context).pop(true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Feature request submitted successfully!'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _submitting = false;
          _error = 'Failed to submit request. Please try again.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return Container(
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: EdgeInsets.fromLTRB(
        20,
        14,
        20,
        MediaQuery.of(context).viewInsets.bottom + 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 36,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: tokens.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '💡 Request a Feature',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w900,
                  color: tokens.textPrimary,
                ),
              ),
              IconButton(
                onPressed: () => Navigator.of(context).pop(),
                icon: Icon(Icons.close_rounded, color: tokens.textMuted),
              ),
            ],
          ),
          const SizedBox(height: 12),

          if (_error != null) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: tokens.danger.withOpacity(0.12),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: tokens.danger.withOpacity(0.3)),
              ),
              child: Text(
                _error!,
                style: TextStyle(
                  color: tokens.danger,
                  fontSize: 12.5,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(height: 12),
          ],

          Text(
            'Feature Title *',
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              color: tokens.textSecondary,
            ),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _titleController,
            maxLength: 120,
            style: TextStyle(fontSize: 14, color: tokens.textPrimary),
            decoration: InputDecoration(
              hintText: 'e.g. Dark mode for lectures',
              hintStyle: TextStyle(fontSize: 13, color: tokens.textMuted),
              filled: true,
              fillColor: tokens.surfaceSecondary,
              counterText: '',
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: tokens.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: tokens.border),
              ),
            ),
          ),
          const SizedBox(height: 14),

          Text(
            'Description *',
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w700,
              color: tokens.textSecondary,
            ),
          ),
          const SizedBox(height: 6),
          TextField(
            controller: _descriptionController,
            maxLines: 4,
            maxLength: 2000,
            style: TextStyle(fontSize: 14, color: tokens.textPrimary),
            decoration: InputDecoration(
              hintText: "Describe the feature you'd like to see...",
              hintStyle: TextStyle(fontSize: 13, color: tokens.textMuted),
              filled: true,
              fillColor: tokens.surfaceSecondary,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: tokens.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: tokens.border),
              ),
            ),
          ),
          const SizedBox(height: 20),

          ElevatedButton(
            onPressed: _submitting ? null : _submit,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF8B5CF6),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(14),
              ),
              elevation: 0,
            ),
            child: _submitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.2,
                      color: Colors.white,
                    ),
                  )
                : const Text(
                    'Submit Feature Request',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
                  ),
          ),
        ],
      ),
    );
  }
}
