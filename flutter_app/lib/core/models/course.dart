/// Maps to the Course shape returned by /api/courses and /api/courses/[id].
class Course {
  const Course({
    required this.id,
    required this.name,
    required this.color,
    this.description,
    this.subject,
    this.teacherName,
    this.enrollmentType,
    this.tag,
    this.packageName,
    this.expiresAt,
    this.isExpiredField = false,
    this.topicsCount = 0,
    this.lecturesCount = 0,
    this.materialsCount = 0,
  });

  final String id;
  final String name;
  final String color;
  final String? description;
  final String? subject;
  final String? teacherName;
  final String? enrollmentType; // LIVE | RECORDED | FREE | DEMO
  final String? tag; // PLUS | PRO | GENERAL | etc.
  final String? packageName;
  final DateTime? expiresAt;
  final bool isExpiredField;
  final int topicsCount;
  final int lecturesCount;
  final int materialsCount;

  int? get accessDays {
    if (isExpired) return 0;
    final exp = expiresAt;
    if (exp == null) return null;
    final diff = exp.difference(DateTime.now()).inDays;
    return diff > 0 ? diff : 0;
  }

  bool get isExpired =>
      isExpiredField ||
      (expiresAt != null && expiresAt!.isBefore(DateTime.now()));

  factory Course.fromJson(Map<String, dynamic> j) {
    final count = j['_count'] as Map<String, dynamic>?;
    return Course(
      id: j['id'] as String,
      name: (j['name'] as String?) ?? '',
      color: (j['color'] as String?) ?? '#6366F1',
      description: j['description'] as String?,
      subject: j['subject'] as String?,
      teacherName: j['teacherName'] as String?,
      enrollmentType: j['enrollmentType'] as String?,
      tag: (j['tag'] as String?) ??
          (j['courseTag'] as String?) ??
          (j['packageName'] as String?) ??
          (j['tier'] as String?),
      packageName: j['packageName'] as String?,
      expiresAt: j['expiresAt'] != null
          ? DateTime.tryParse(j['expiresAt'] as String)
          : null,
      isExpiredField: (j['isExpired'] as bool?) ?? false,
      topicsCount: (count?['topics'] as int?) ?? 0,
      lecturesCount: (count?['lectures'] as int?) ?? 0,
      materialsCount: (count?['materials'] as int?) ?? 0,
    );
  }
}
