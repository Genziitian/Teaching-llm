import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/auth/auth_providers.dart';
import '../../core/models/course.dart';
import '../../shared/widgets/section_head.dart';
import '../../shared/widgets/sub_page_header.dart';
import '../../theme/app_theme_tokens.dart';
import '../../shared/widgets/app_refresh.dart';
import '../courses/courses_page.dart' show coursesProvider;

String _formatAmPm(String? value) {
  if (value == null || value.trim().isEmpty) return '';
  final parts = value.trim().split(':');
  if (parts.length < 2) return value;
  final hour = int.tryParse(parts[0]);
  final minute = int.tryParse(parts[1]);
  if (hour == null || minute == null) return value;
  final suffix = hour >= 12 ? 'PM' : 'AM';
  final displayHour = hour % 12 == 0 ? 12 : hour % 12;
  return '$displayHour:${minute.toString().padLeft(2, '0')} $suffix';
}

/// Family is (year, month) — server filters by `month=YYYY-MM`. Switching months
/// in the UI triggers a fresh fetch via Riverpod's family cache.
final calendarEventsProvider =
    FutureProvider.family<List<Map<String, dynamic>>, ({int year, int month})>(
        (ref, key) async {
  final api = ref.watch(apiClientProvider);
  try {
    final monthParam = '${key.year}-${key.month.toString().padLeft(2, '0')}';
    final res = await api.get<dynamic>('/api/events?month=$monthParam');
    final list = res.data is List ? res.data as List : const [];
    return [for (final j in list) j as Map<String, dynamic>];
  } catch (e) {
    return const [];
  }
});

class CalendarPage extends ConsumerStatefulWidget {
  const CalendarPage({super.key});
  @override
  ConsumerState<CalendarPage> createState() => _CalendarPageState();
}

enum _CalendarView { week, month }

class _CalendarPageState extends ConsumerState<CalendarPage> {
  late DateTime _focused = DateTime.now();
  late DateTime _selected = DateTime.now();
  _CalendarView _view = _CalendarView.week;
  bool _syncing = false;

  Future<void> _syncLiveSessions() async {
    if (_syncing) return;
    setState(() => _syncing = true);
    try {
      final api = ref.read(apiClientProvider);
      await api.post<dynamic>('/api/live-sessions/sync');
      if (mounted) {
        ref.invalidate(calendarEventsProvider(
          (year: _focused.year, month: _focused.month),
        ));
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Live sessions synced successfully')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Sync failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _syncing = false);
    }
  }

  Future<void> _showEventEditSheet({Map<String, dynamic>? existing}) async {
    final result = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _EventEditSheet(
        ref: ref,
        existing: existing,
        selectedDate: _selected,
      ),
    );
    if (result == true && mounted) {
      ref.invalidate(calendarEventsProvider(
        (year: _focused.year, month: _focused.month),
      ));
    }
  }

  Future<void> _deleteEvent(String id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Event'),
        content: const Text('Are you sure you want to delete this event?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirm != true) return;
    try {
      final api = ref.read(apiClientProvider);
      await api.delete<dynamic>('/api/events/$id');
      if (mounted) {
        ref.invalidate(calendarEventsProvider(
          (year: _focused.year, month: _focused.month),
        ));
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Event deleted')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Delete failed: $e')),
        );
      }
    }
  }

  void _prev() {
    setState(() {
      _focused = _view == _CalendarView.week
          ? _focused.subtract(const Duration(days: 7))
          : DateTime(_focused.year, _focused.month - 1, 1);
    });
  }

  void _next() {
    setState(() {
      _focused = _view == _CalendarView.week
          ? _focused.add(const Duration(days: 7))
          : DateTime(_focused.year, _focused.month + 1, 1);
    });
  }

  String get _monthLabel {
    const months = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ];
    return '${months[_focused.month - 1]} ${_focused.year}';
  }

  String _weekLabel(DateTime d) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];
    final monday = d.subtract(Duration(days: (d.weekday - 1) % 7));
    final sunday = monday.add(const Duration(days: 6));
    if (monday.month == sunday.month) {
      return '${months[monday.month - 1]} ${monday.day} – ${sunday.day}, ${sunday.year}';
    }
    return '${months[monday.month - 1]} ${monday.day} – ${months[sunday.month - 1]} ${sunday.day}, ${sunday.year}';
  }

  String _selectedLabel(DateTime d) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];
    const days = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday'
    ];
    return '${days[d.weekday - 1]}, ${months[d.month - 1]} ${d.day}';
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final user = ref.watch(authStateProvider).value;
    final isManagerOrAdmin = user?.isManager == true || user?.isAdmin == true;
    final eventsAsync = ref.watch(calendarEventsProvider(
      (year: _focused.year, month: _focused.month),
    ));
    final allEvents = eventsAsync.valueOrNull ?? const [];
    final selectedKey =
        '${_selected.year}-${_selected.month.toString().padLeft(2, '0')}-${_selected.day.toString().padLeft(2, '0')}';
    final eventsForSelected = allEvents.where((e) {
      final d = (e['date'] as String?) ?? '';
      return d == selectedKey;
    }).toList();
    final now = DateTime.now();
    final upcomingDeadlines = allEvents.where((e) {
      final iso = e['startTime'] as String?;
      if (iso == null) return false;
      final dt = DateTime.tryParse(iso);
      if (dt == null) return false;
      return dt.isAfter(now) && dt.isBefore(now.add(const Duration(days: 14)));
    }).toList()
      ..sort((a, b) {
        final ad = DateTime.tryParse(a['startTime'] as String? ?? '');
        final bd = DateTime.tryParse(b['startTime'] as String? ?? '');
        if (ad == null || bd == null) return 0;
        return ad.compareTo(bd);
      });

    return AppPageScaffold(
      title: 'Calendar',
      subtitle: _monthLabel,
      showBack: true,
      right: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (isManagerOrAdmin) ...[
            _syncing
                ? SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: tokens.primaryAccent,
                    ),
                  )
                : CircleIconBtn(
                    icon: Icons.sync,
                    onTap: _syncLiveSessions,
                  ),
            const SizedBox(width: 6),
          ],
          eventsAsync.isLoading
              ? SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: tokens.primaryAccent,
                  ),
                )
              : CircleIconBtn(
                  icon: Icons.refresh,
                  onTap: () => ref.invalidate(calendarEventsProvider(
                    (year: _focused.year, month: _focused.month),
                  )),
                ),
        ],
      ),
      floatingActionButton: isManagerOrAdmin
          ? FloatingActionButton(
              onPressed: () => _showEventEditSheet(),
              backgroundColor: tokens.primaryAccent,
              child: const Icon(Icons.add, color: Colors.white),
            )
          : null,
      body: AppRefresh(
        onRefresh: () async => ref.invalidate(calendarEventsProvider(
          (year: _focused.year, month: _focused.month),
        )),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(0, 16, 0, 24),
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: _MonthSwitcher(
                label: _view == _CalendarView.week
                    ? _weekLabel(_focused)
                    : _monthLabel,
                onPrev: _prev,
                onNext: _next,
                view: _view,
                onView: (v) => setState(() => _view = v),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: _CalendarGrid(
                view: _view,
                focused: _focused,
                selected: _selected,
                events: allEvents,
                onSelect: (d) => setState(() => _selected = d),
              ),
            ),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 22),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.end,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _selectedLabel(_selected),
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: tokens.textPrimary,
                                letterSpacing: -0.3,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              eventsForSelected.isEmpty
                                  ? 'No events scheduled'
                                  : '${eventsForSelected.length} event${eventsForSelected.length == 1 ? '' : 's'} scheduled',
                              style: TextStyle(
                                fontSize: 12.5,
                                fontWeight: FontWeight.w500,
                                color: tokens.textSecondary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (_selected.year == now.year &&
                          _selected.month == now.month &&
                          _selected.day == now.day)
                        Text(
                          'Today',
                          style: TextStyle(
                            color: tokens.primaryAccent,
                            fontWeight: FontWeight.w700,
                            fontSize: 12,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  if (eventsForSelected.isEmpty)
                    const _EmptyDay()
                  else
                    ...eventsForSelected.map((e) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: isManagerOrAdmin
                              ? GestureDetector(
                                  onTap: () => _showEventEditSheet(existing: e),
                                  onLongPress: () {
                                    final id = e['id'] as String?;
                                    if (id != null) _deleteEvent(id);
                                  },
                                  child: _EventRow(event: e),
                                )
                              : _EventRow(event: e),
                        )),
                  const SectionHead(
                    title: 'Upcoming (next 14 days)',
                  ),
                  const SizedBox(height: 14),
                  if (upcomingDeadlines.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      child: Text(
                        'Nothing scheduled in the next two weeks.',
                        style: TextStyle(
                          fontSize: 13,
                          color: tokens.textMuted,
                        ),
                      ),
                    )
                  else
                    ...upcomingDeadlines.take(5).map((e) => Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: _DeadlineRow(event: e),
                        )),
                ],
              ),
            ),
            if (eventsAsync.hasError)
              Padding(
                padding: const EdgeInsets.all(20),
                child: Text(
                  'Could not load events: ${eventsAsync.error}',
                  style: TextStyle(
                    fontSize: 13,
                    color: tokens.textSecondary,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _MonthSwitcher extends StatelessWidget {
  const _MonthSwitcher({
    required this.label,
    required this.onPrev,
    required this.onNext,
    required this.view,
    required this.onView,
  });
  final String label;
  final VoidCallback onPrev;
  final VoidCallback onNext;
  final _CalendarView view;
  final ValueChanged<_CalendarView> onView;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: tokens.border),
      ),
      child: Row(
        children: [
          CircleIconBtn(icon: Icons.chevron_left, onTap: onPrev),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: tokens.textPrimary,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(width: 8),
          CircleIconBtn(icon: Icons.chevron_right, onTap: onNext),
          const SizedBox(width: 10),
          _Seg(
            label: 'Month',
            active: view == _CalendarView.month,
            onTap: () => onView(_CalendarView.month),
          ),
          const SizedBox(width: 6),
          _Seg(
            label: 'Week',
            active: view == _CalendarView.week,
            onTap: () => onView(_CalendarView.week),
          ),
        ],
      ),
    );
  }
}

class _Seg extends StatelessWidget {
  const _Seg({required this.label, required this.active, required this.onTap});
  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(999),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(999),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: active ? tokens.textPrimary : Colors.transparent,
            borderRadius: BorderRadius.circular(999),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 11.5,
              color: active ? tokens.bg : tokens.textMuted,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}

class _CalendarGrid extends StatelessWidget {
  const _CalendarGrid({
    required this.view,
    required this.focused,
    required this.selected,
    required this.events,
    required this.onSelect,
  });
  final _CalendarView view;
  final DateTime focused;
  final DateTime selected;
  final List<Map<String, dynamic>> events;
  final ValueChanged<DateTime> onSelect;

  Color _typeTone(String? type, AppThemeTokens tokens) {
    switch (type) {
      case 'live':
      case 'class':
        return tokens.primaryAccent;
      case 'test':
      case 'exam':
        return tokens.warning;
      case 'doubt':
      case 'event':
        return tokens.success;
      case 'deadline':
        return tokens.danger;
      default:
        return tokens.primaryAccent;
    }
  }

  Map<String, List<Color>> _byDay(AppThemeTokens tokens) {
    final out = <String, List<Color>>{};
    for (final e in events) {
      final d = (e['date'] as String?) ?? '';
      if (d.isEmpty) continue;
      out.putIfAbsent(d, () => []).add(_typeTone(e['type'] as String?, tokens));
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    final now = DateTime.now();
    final dayDots = _byDay(tokens);

    final List<Widget?> cells;
    if (view == _CalendarView.week) {
      final monday =
          focused.subtract(Duration(days: (focused.weekday - 1) % 7));
      cells = [
        for (var i = 0; i < 7; i++)
          _buildDay(monday.add(Duration(days: i)), now, dayDots, tokens),
      ];
    } else {
      final first = DateTime(focused.year, focused.month, 1);
      final daysInMonth = DateTime(focused.year, focused.month + 1, 0).day;
      final leading = (first.weekday + 6) % 7;
      cells = [
        for (var i = 0; i < leading; i++) null,
        for (var d = 1; d <= daysInMonth; d++)
          _buildDay(
            DateTime(focused.year, focused.month, d),
            now,
            dayDots,
            tokens,
          ),
      ];
    }

    final rows = <Widget>[];
    for (var i = 0; i < cells.length; i += 7) {
      final rowCells =
          cells.sublist(i, (i + 7 < cells.length) ? i + 7 : cells.length);
      while (rowCells.length < 7) {
        rowCells.add(null);
      }
      rows.add(Row(
        children: rowCells
            .map((c) => Expanded(child: c ?? const SizedBox(height: 36)))
            .toList(),
      ));
    }

    return Container(
      margin: const EdgeInsets.only(top: 16),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: tokens.border),
      ),
      child: Column(
        children: [
          Row(
            children: labels
                .map((l) => Expanded(
                      child: Center(
                        child: Text(
                          l,
                          style: TextStyle(
                            fontSize: 10.5,
                            letterSpacing: 0.5,
                            fontWeight: FontWeight.w700,
                            color: tokens.textMuted,
                          ),
                        ),
                      ),
                    ))
                .toList(),
          ),
          const SizedBox(height: 6),
          ...rows,
        ],
      ),
    );
  }

  Widget _buildDay(DateTime day, DateTime now, Map<String, List<Color>> dots,
      AppThemeTokens tokens) {
    final isToday =
        day.year == now.year && day.month == now.month && day.day == now.day;
    final isSelected = day.year == selected.year &&
        day.month == selected.month &&
        day.day == selected.day;
    final key =
        '${day.year}-${day.month.toString().padLeft(2, '0')}-${day.day.toString().padLeft(2, '0')}';
    final tones = (dots[key] ?? const <Color>[]).take(3).toList();
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2, horizontal: 2),
      child: InkWell(
        onTap: () => onSelect(day),
        borderRadius: BorderRadius.circular(10),
        child: Container(
          height: 38,
          decoration: BoxDecoration(
            color: isSelected
                ? tokens.primaryAccent
                : (isToday
                    ? tokens.primaryAccent.withOpacity(0.15)
                    : Colors.transparent),
            borderRadius: BorderRadius.circular(10),
          ),
          alignment: Alignment.center,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                '${day.day}',
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight:
                      isSelected || isToday ? FontWeight.w800 : FontWeight.w600,
                  color: isSelected
                      ? Colors.white
                      : (isToday ? tokens.primaryAccent : tokens.textPrimary),
                ),
              ),
              if (tones.isNotEmpty && !isSelected) ...[
                const SizedBox(height: 2),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (final t in tones)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 0.5),
                        child: Container(
                          width: 4,
                          height: 4,
                          decoration: BoxDecoration(
                            color: t,
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _EventRow extends StatelessWidget {
  const _EventRow({required this.event});
  final Map<String, dynamic> event;

  Color _toneOf(String? type, AppThemeTokens tokens) {
    switch (type) {
      case 'live':
      case 'class':
        return tokens.primaryAccent;
      case 'test':
      case 'exam':
        return tokens.warning;
      case 'doubt':
      case 'event':
        return tokens.success;
      case 'deadline':
        return tokens.danger;
      default:
        return tokens.primaryAccent;
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final type = (event['type'] as String?) ?? 'event';
    final tone = _toneOf(type, tokens);
    final title = (event['title'] as String?) ?? 'Event';
    final mentor = (event['instructor'] is Map
            ? (event['instructor'] as Map)['name']
            : null) as String? ??
        (event['course'] is Map
            ? (event['course'] as Map)['teacherName']
            : null) as String? ??
        'Faculty';
    final timeStr = _formatAmPm(event['time'] as String?);
    final endStr = _formatAmPm(event['endTime'] as String?);
    final dur =
        (timeStr.isNotEmpty && endStr.isNotEmpty) ? '$timeStr → $endStr' : '';
    final status = event['status'] as String?;
    final isLive = status == 'LIVE' || status == 'live';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: tokens.border),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 64,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                Text(
                  timeStr,
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: tone,
                    fontFeatures: const [FontFeature.tabularFigures()],
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  dur.isEmpty ? '' : '↗ $endStr',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w500,
                    color: tokens.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          Container(width: 1, height: 36, color: tokens.border),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: tone.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(5),
                  ),
                  child: Text(
                    type.toUpperCase(),
                    style: TextStyle(
                      fontSize: 9.5,
                      fontWeight: FontWeight.w700,
                      color: tone,
                      letterSpacing: 0.4,
                    ),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: tokens.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  mentor,
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w500,
                    color: tokens.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          if (isLive)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 7),
              decoration: BoxDecoration(
                color: tone,
                borderRadius: BorderRadius.circular(9),
              ),
              child: const Text(
                'Join',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                ),
              ),
            )
          else
            Icon(Icons.chevron_right, color: tokens.textMuted, size: 16),
        ],
      ),
    );
  }
}

class _DeadlineRow extends StatelessWidget {
  const _DeadlineRow({required this.event});
  final Map<String, dynamic> event;

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final title = (event['title'] as String?) ?? 'Event';
    final iso = event['startTime'] as String?;
    final dt = iso != null ? DateTime.tryParse(iso)?.toLocal() : null;
    final daysLeft = dt != null ? dt.difference(DateTime.now()).inDays : 0;
    final daysLabel = daysLeft <= 0 ? '0' : '$daysLeft';
    final daysWord = daysLeft == 1 ? 'DAY' : 'DAYS';
    final type = (event['type'] as String?) ?? 'event';
    final tone = type == 'test' || type == 'exam' || type == 'deadline'
        ? (daysLeft <= 1 ? tokens.danger : tokens.warning)
        : tokens.primaryAccent;
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec'
    ];
    final due = dt != null
        ? '${months[dt.month - 1]} ${dt.day} · ${_formatAmPm(event['time'] as String?)}'
        : '';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: tokens.cardBg,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: tokens.border),
      ),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: tone.withOpacity(0.12),
              borderRadius: BorderRadius.circular(11),
            ),
            alignment: Alignment.center,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  daysLabel,
                  style: TextStyle(
                    color: tone,
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                    height: 1,
                  ),
                ),
                Text(
                  daysWord,
                  style: TextStyle(
                    fontSize: 8.5,
                    fontWeight: FontWeight.w700,
                    color: tone,
                    letterSpacing: 0.4,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w700,
                    color: tokens.textPrimary,
                  ),
                ),
                if (due.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      Icon(Icons.access_time,
                          size: 12, color: tokens.textMuted),
                      const SizedBox(width: 4),
                      Text(
                        due,
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: FontWeight.w500,
                          color: tokens.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
          Icon(Icons.chevron_right, color: tokens.textMuted, size: 16),
        ],
      ),
    );
  }
}

class _EmptyDay extends StatelessWidget {
  const _EmptyDay();

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Text(
        'No events on this day.',
        style: TextStyle(
          fontSize: 13,
          color: tokens.textMuted,
        ),
      ),
    );
  }
}

/// Bottom sheet form for creating / editing a calendar event.
class _EventEditSheet extends ConsumerStatefulWidget {
  const _EventEditSheet({
    required this.ref,
    this.existing,
    required this.selectedDate,
  });

  // ignore: unused_field — kept for ConsumerStatefulWidget pattern clarity
  final WidgetRef ref;
  final Map<String, dynamic>? existing;
  final DateTime selectedDate;

  @override
  ConsumerState<_EventEditSheet> createState() => _EventEditSheetState();
}

class _EventEditSheetState extends ConsumerState<_EventEditSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _titleCtrl;
  late final TextEditingController _meetLinkCtrl;
  late final TextEditingController _descCtrl;

  String _type = 'class';
  String? _courseId;
  late DateTime _date;
  TimeOfDay _startTime = const TimeOfDay(hour: 10, minute: 0);
  TimeOfDay _endTime = const TimeOfDay(hour: 11, minute: 0);
  String _streamProvider = 'MEET';
  bool _saving = false;

  static const _types = ['class', 'live', 'test', 'exam', 'doubt', 'event', 'deadline'];
  static const _streamProviders = ['MEET', 'YOUTUBE', 'DRIVE', 'AGORA'];

  bool get _isEditing => widget.existing != null;

  @override
  void initState() {
    super.initState();
    final e = widget.existing;
    _titleCtrl = TextEditingController(text: (e?['title'] as String?) ?? '');
    _meetLinkCtrl = TextEditingController(text: (e?['meetLink'] as String?) ?? '');
    _descCtrl = TextEditingController(text: (e?['description'] as String?) ?? '');
    _type = (e?['type'] as String?) ?? 'class';
    _courseId = e?['courseId'] as String?;
    _streamProvider = (e?['streamProvider'] as String?) ?? 'MEET';

    if (e != null) {
      final startIso = e['startTime'] as String?;
      if (startIso != null) {
        final dt = DateTime.tryParse(startIso)?.toLocal();
        if (dt != null) {
          _date = dt;
          _startTime = TimeOfDay(hour: dt.hour, minute: dt.minute);
        } else {
          _date = widget.selectedDate;
        }
      } else {
        _date = widget.selectedDate;
      }
      final endIso = e['endTime'] as String?;
      if (endIso != null) {
        final dt = DateTime.tryParse(endIso)?.toLocal();
        if (dt != null) {
          _endTime = TimeOfDay(hour: dt.hour, minute: dt.minute);
        }
      }
    } else {
      _date = widget.selectedDate;
    }
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _meetLinkCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _date,
      firstDate: DateTime(2024),
      lastDate: DateTime(2030),
    );
    if (picked != null) setState(() => _date = picked);
  }

  Future<void> _pickTime({required bool isStart}) async {
    final picked = await showTimePicker(
      context: context,
      initialTime: isStart ? _startTime : _endTime,
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startTime = picked;
        } else {
          _endTime = picked;
        }
      });
    }
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      final api = ref.read(apiClientProvider);
      final startDt = DateTime(
        _date.year, _date.month, _date.day,
        _startTime.hour, _startTime.minute,
      );
      final endDt = DateTime(
        _date.year, _date.month, _date.day,
        _endTime.hour, _endTime.minute,
      );
      final body = <String, dynamic>{
        'title': _titleCtrl.text.trim(),
        'type': _type,
        'startTime': startDt.toUtc().toIso8601String(),
        'endTime': endDt.toUtc().toIso8601String(),
        'date': DateFormat('yyyy-MM-dd').format(_date),
        'time': '${_startTime.hour.toString().padLeft(2, '0')}:${_startTime.minute.toString().padLeft(2, '0')}',
        'endTimeStr': '${_endTime.hour.toString().padLeft(2, '0')}:${_endTime.minute.toString().padLeft(2, '0')}',
        'streamProvider': _streamProvider,
      };
      if (_courseId != null) body['courseId'] = _courseId;
      if (_meetLinkCtrl.text.trim().isNotEmpty) {
        body['meetLink'] = _meetLinkCtrl.text.trim();
      }
      if (_descCtrl.text.trim().isNotEmpty) {
        body['description'] = _descCtrl.text.trim();
      }

      if (_isEditing) {
        final id = widget.existing!['id'] as String;
        await api.put<dynamic>('/api/events/$id', body: body);
      } else {
        await api.post<dynamic>('/api/events', body: body);
      }

      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = context.tokens;
    final courses = ref.watch(coursesProvider).valueOrNull ?? const <Course>[];

    return Container(
      decoration: BoxDecoration(
        color: tokens.bg,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Center(
                child: Container(
                  width: 40, height: 4,
                  decoration: BoxDecoration(
                    color: tokens.border,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                _isEditing ? 'Edit Event' : 'Add Event',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: tokens.textPrimary,
                ),
              ),
              const SizedBox(height: 20),

              // Title
              TextFormField(
                controller: _titleCtrl,
                decoration: InputDecoration(
                  labelText: 'Title',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                validator: (v) =>
                    (v == null || v.trim().isEmpty) ? 'Title is required' : null,
              ),
              const SizedBox(height: 14),

              // Type dropdown
              DropdownButtonFormField<String>(
                value: _type,
                decoration: InputDecoration(
                  labelText: 'Type',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                items: _types
                    .map((t) => DropdownMenuItem(
                          value: t,
                          child: Text(t[0].toUpperCase() + t.substring(1)),
                        ))
                    .toList(),
                onChanged: (v) {
                  if (v != null) setState(() => _type = v);
                },
              ),
              const SizedBox(height: 14),

              // Course dropdown
              DropdownButtonFormField<String?>(
                value: _courseId,
                decoration: InputDecoration(
                  labelText: 'Course (optional)',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                items: [
                  const DropdownMenuItem<String?>(
                    value: null,
                    child: Text('None / Global'),
                  ),
                  ...courses.map((c) => DropdownMenuItem<String?>(
                        value: c.id,
                        child: Text(c.name, overflow: TextOverflow.ellipsis),
                      )),
                ],
                onChanged: (v) => setState(() => _courseId = v),
              ),
              const SizedBox(height: 14),

              // Date picker
              InkWell(
                onTap: _pickDate,
                borderRadius: BorderRadius.circular(12),
                child: InputDecorator(
                  decoration: InputDecoration(
                    labelText: 'Date',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    suffixIcon: const Icon(Icons.calendar_today, size: 18),
                  ),
                  child: Text(DateFormat('EEE, MMM d yyyy').format(_date)),
                ),
              ),
              const SizedBox(height: 14),

              // Start / End time
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: () => _pickTime(isStart: true),
                      borderRadius: BorderRadius.circular(12),
                      child: InputDecorator(
                        decoration: InputDecoration(
                          labelText: 'Start Time',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          suffixIcon: const Icon(Icons.access_time, size: 18),
                        ),
                        child: Text(_startTime.format(context)),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: InkWell(
                      onTap: () => _pickTime(isStart: false),
                      borderRadius: BorderRadius.circular(12),
                      child: InputDecorator(
                        decoration: InputDecoration(
                          labelText: 'End Time',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                          suffixIcon: const Icon(Icons.access_time, size: 18),
                        ),
                        child: Text(_endTime.format(context)),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Meet link
              TextFormField(
                controller: _meetLinkCtrl,
                decoration: InputDecoration(
                  labelText: 'Meeting Link (optional)',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                keyboardType: TextInputType.url,
              ),
              const SizedBox(height: 14),

              // Stream provider
              DropdownButtonFormField<String>(
                value: _streamProvider,
                decoration: InputDecoration(
                  labelText: 'Stream Provider',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                items: _streamProviders
                    .map((s) => DropdownMenuItem(value: s, child: Text(s)))
                    .toList(),
                onChanged: (v) {
                  if (v != null) setState(() => _streamProvider = v);
                },
              ),
              const SizedBox(height: 14),

              // Description
              TextFormField(
                controller: _descCtrl,
                decoration: InputDecoration(
                  labelText: 'Description (optional)',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                maxLines: 3,
              ),
              const SizedBox(height: 20),

              // Submit button
              SizedBox(
                height: 48,
                child: ElevatedButton(
                  onPressed: _saving ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: tokens.primaryAccent,
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: _saving
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            strokeWidth: 2,
                            color: Colors.white,
                          ),
                        )
                      : Text(
                          _isEditing ? 'Update Event' : 'Create Event',
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            fontSize: 15,
                          ),
                        ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
