import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/auth/auth_providers.dart';
import '../../shared/widgets/app_loading_wrapper.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_theme_tokens.dart';
import 'support_providers.dart';

class UserReportsPage extends ConsumerStatefulWidget {
  const UserReportsPage({super.key});

  @override
  ConsumerState<UserReportsPage> createState() => _UserReportsPageState();
}

class _UserReportsPageState extends ConsumerState<UserReportsPage> {
  String _selectedFilter = 'ALL';

  Future<void> _updateReportStatus(String reportId, String newStatus) async {
    try {
      final client = ref.read(apiClientProvider);
      await client.put('/api/support/user-reports/$reportId', body: {
        'status': newStatus,
      });
      ref.invalidate(userReportsProvider);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to update report status.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  Color _statusColor(String status) {
    switch (status.toUpperCase()) {
      case 'RESOLVED':
        return const Color(0xFF10B981);
      case 'UNDER_REVIEW':
        return const Color(0xFFF59E0B);
      case 'DISMISSED':
        return const Color(0xFF6B7280);
      case 'NEW':
      default:
        return const Color(0xFFEF4444);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final role = ref.watch(authStateProvider).value?.role;
    final isAuthorized = role == 'MANAGER' || role == 'ADMIN';

    if (!isAuthorized) {
      return AppPageScaffold(
        title: 'User Reports',
        showBack: true,
        onBack: () => context.pop(),
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              'Access restricted to managers and administrators.',
              style: TextStyle(color: tokens.textSecondary, fontSize: 14),
            ),
          ),
        ),
      );
    }

    final reportsAsync = ref.watch(userReportsProvider);

    return AppPageScaffold(
      title: 'User Reports',
      subtitle: 'Review and moderate community reports',
      showBack: true,
      onBack: () => context.canPop() ? context.pop() : context.go('/more'),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(userReportsProvider);
          try {
            await ref.read(userReportsProvider.future);
          } catch (_) {}
        },
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 40),
          children: [
            // Filter chips
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  for (final f in [
                    {'key': 'ALL', 'label': 'All'},
                    {'key': 'NEW', 'label': 'New'},
                    {'key': 'UNDER_REVIEW', 'label': 'Under Review'},
                    {'key': 'RESOLVED', 'label': 'Resolved'},
                    {'key': 'DISMISSED', 'label': 'Dismissed'},
                  ])
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: ChoiceChip(
                        label: Text(f['label']!),
                        selected: _selectedFilter == f['key'],
                        onSelected: (_) =>
                            setState(() => _selectedFilter = f['key']!),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            reportsAsync.when(
              loading: () => const Padding(
                padding: EdgeInsets.symmetric(vertical: 36),
                child: AppLoadingWrapper(isLoading: true),
              ),
              error: (err, _) => Center(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: 36),
                  child: Column(
                    children: [
                      Text(
                        'Failed to load user reports.',
                        style: TextStyle(color: tokens.textSecondary),
                      ),
                      const SizedBox(height: 8),
                      TextButton(
                        onPressed: () => ref.invalidate(userReportsProvider),
                        child: const Text('Try again'),
                      ),
                    ],
                  ),
                ),
              ),
              data: (reports) {
                final filtered = reports.where((r) {
                  if (_selectedFilter == 'ALL') return true;
                  return (r['status'] as String? ?? '').toUpperCase() ==
                      _selectedFilter;
                }).toList();

                if (filtered.isEmpty) {
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 48),
                    child: Center(
                      child: Column(
                        children: [
                          Icon(
                            Icons.check_circle_outline_rounded,
                            size: 44,
                            color: tokens.textMuted,
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'No reports found',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w800,
                              color: tokens.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _selectedFilter == 'ALL'
                                ? 'No incident reports have been submitted.'
                                : 'No reports matching this filter.',
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
                    for (final r in filtered)
                      _UserReportCard(
                        report: r,
                        statusColor: _statusColor(r['status'] ?? 'NEW'),
                        onStatusChanged: (next) =>
                            _updateReportStatus(r['id'] as String, next),
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

class _UserReportCard extends StatelessWidget {
  const _UserReportCard({
    required this.report,
    required this.statusColor,
    required this.onStatusChanged,
  });

  final Map<String, dynamic> report;
  final Color statusColor;
  final ValueChanged<String> onStatusChanged;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final reason = (report['reason'] as String?) ?? 'Incident Report';
    final subReason = (report['subReason'] as String?) ?? '';
    final details = (report['details'] as String?) ?? '';
    final status = ((report['status'] as String?) ?? 'NEW').toUpperCase();
    final reportedUser = report['reportedUser'] as Map<String, dynamic>?;
    final reporter = report['reporter'] as Map<String, dynamic>?;
    final createdAt = report['createdAt'] != null
        ? DateTime.tryParse(report['createdAt'].toString())
        : null;
    final dateStr = createdAt != null
        ? DateFormat('MMM d, yyyy · h:mm a').format(createdAt)
        : '';

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
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
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      reason.replaceAll('_', ' '),
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w800,
                        color: tokens.textPrimary,
                      ),
                    ),
                    if (subReason.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        subReason,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: tokens.textSecondary,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              DropdownButtonHideUnderline(
                child: DropdownButton<String>(
                  value: ['NEW', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED']
                          .contains(status)
                      ? status
                      : 'NEW',
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w800,
                    color: statusColor,
                  ),
                  dropdownColor: tokens.cardBg,
                  items: const [
                    DropdownMenuItem(
                      value: 'NEW',
                      child: Text('New', style: TextStyle(color: Color(0xFFEF4444))),
                    ),
                    DropdownMenuItem(
                      value: 'UNDER_REVIEW',
                      child: Text('Under Review', style: TextStyle(color: Color(0xFFF59E0B))),
                    ),
                    DropdownMenuItem(
                      value: 'RESOLVED',
                      child: Text('Resolved', style: TextStyle(color: Color(0xFF10B981))),
                    ),
                    DropdownMenuItem(
                      value: 'DISMISSED',
                      child: Text('Dismissed', style: TextStyle(color: Color(0xFF6B7280))),
                    ),
                  ],
                  onChanged: (val) {
                    if (val != null && val != status) {
                      onStatusChanged(val);
                    }
                  },
                ),
              ),
            ],
          ),

          if (details.isNotEmpty) ...[
            const SizedBox(height: 10),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: tokens.surfaceSecondary,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                details,
                style: TextStyle(
                  fontSize: 13,
                  height: 1.45,
                  color: tokens.textPrimary,
                ),
              ),
            ),
          ],

          const SizedBox(height: 12),
          Divider(height: 1, thickness: 1, color: tokens.border.withOpacity(0.5)),
          const SizedBox(height: 10),

          // Reported user & reporter info
          Row(
            children: [
              if (reportedUser != null)
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Reported User',
                        style: TextStyle(fontSize: 10.5, color: tokens.textMuted, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${reportedUser['name'] ?? 'Unknown'}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: tokens.textPrimary),
                      ),
                    ],
                  ),
                ),
              if (reporter != null)
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Text(
                        'Reporter',
                        style: TextStyle(fontSize: 10.5, color: tokens.textMuted, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${reporter['name'] ?? 'Anonymous'}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: tokens.textSecondary),
                      ),
                    ],
                  ),
                ),
            ],
          ),

          if (dateStr.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              dateStr,
              style: TextStyle(fontSize: 11, color: tokens.textMuted),
            ),
          ],
        ],
      ),
    );
  }
}
