/// Maps to the User shape returned by /api/auth/me and /api/auth/google.
class User {
  const User({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    this.firstName,
    this.lastName,
    this.gender,
    this.avatar,
    this.mobileNumber,
    this.securityNumber,
    this.bio,
    this.iitmJoinYear,
    this.iitmJoinMonth,
    this.iitmLevel,
    this.iitmUserType,
    this.createdAt,
    this.hasUpdatedProgressSept26 = false,
    this.previousMobileNumber,
    this.instagramUrl,
    this.linkedinUrl,
    this.isSept26ProgressUpdateActive = false,
    this.isIdentityUpdated = false,
    this.isProfileComplete = false,
    this.appTourCompleted = false,
    this.appTourCompletedAt,
    this.completedTourVersion = 0,
  });

  final String id;
  final String name;
  final String email;
  final String role; // STUDENT | ADMIN | MANAGER
  final String? firstName;
  final String? lastName;
  final String? gender;
  final String? avatar;
  final String? mobileNumber;
  final String? securityNumber;
  final String? bio;
  final String? iitmJoinYear;
  final String? iitmJoinMonth;
  final String? iitmLevel;
  final String? iitmUserType;
  final String? createdAt;
  final bool hasUpdatedProgressSept26;
  final String? previousMobileNumber;
  final String? instagramUrl;
  final String? linkedinUrl;
  final bool isSept26ProgressUpdateActive;
  final bool isIdentityUpdated;
  final bool isProfileComplete;
  final bool appTourCompleted;
  final String? appTourCompletedAt;
  final int completedTourVersion;

  bool get isManager => role == 'MANAGER';
  bool get isAdmin => role == 'ADMIN';
  bool get isStudent => role == 'STUDENT';
  bool get needsIdentitySetup => !isManager && !isAdmin && !isIdentityUpdated;

  bool get isOldUser {
    if (createdAt == null || createdAt!.isEmpty) return false;
    final created = DateTime.tryParse(createdAt!);
    if (created == null) return false;
    return DateTime.now().difference(created).inDays >= 30;
  }

  bool get needsSept26ProgressUpdate =>
      isSept26ProgressUpdateActive &&
      !isManager &&
      !isAdmin &&
      isOldUser &&
      !hasUpdatedProgressSept26;

  User copyWith({
    String? id,
    String? name,
    String? email,
    String? role,
    String? firstName,
    String? lastName,
    String? gender,
    String? avatar,
    String? mobileNumber,
    String? securityNumber,
    String? bio,
    String? iitmJoinYear,
    String? iitmJoinMonth,
    String? iitmLevel,
    String? iitmUserType,
    String? createdAt,
    bool? hasUpdatedProgressSept26,
    String? previousMobileNumber,
    String? instagramUrl,
    String? linkedinUrl,
    bool? isSept26ProgressUpdateActive,
    bool? isIdentityUpdated,
    bool? isProfileComplete,
    bool? appTourCompleted,
    String? appTourCompletedAt,
    int? completedTourVersion,
  }) {
    return User(
      id: id ?? this.id,
      name: name ?? this.name,
      email: email ?? this.email,
      role: role ?? this.role,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      gender: gender ?? this.gender,
      avatar: avatar ?? this.avatar,
      mobileNumber: mobileNumber ?? this.mobileNumber,
      securityNumber: securityNumber ?? this.securityNumber,
      bio: bio ?? this.bio,
      iitmJoinYear: iitmJoinYear ?? this.iitmJoinYear,
      iitmJoinMonth: iitmJoinMonth ?? this.iitmJoinMonth,
      iitmLevel: iitmLevel ?? this.iitmLevel,
      iitmUserType: iitmUserType ?? this.iitmUserType,
      createdAt: createdAt ?? this.createdAt,
      hasUpdatedProgressSept26:
          hasUpdatedProgressSept26 ?? this.hasUpdatedProgressSept26,
      previousMobileNumber: previousMobileNumber ?? this.previousMobileNumber,
      instagramUrl: instagramUrl ?? this.instagramUrl,
      linkedinUrl: linkedinUrl ?? this.linkedinUrl,
      isSept26ProgressUpdateActive:
          isSept26ProgressUpdateActive ?? this.isSept26ProgressUpdateActive,
      isIdentityUpdated: isIdentityUpdated ?? this.isIdentityUpdated,
      isProfileComplete: isProfileComplete ?? this.isProfileComplete,
      appTourCompleted: appTourCompleted ?? this.appTourCompleted,
      appTourCompletedAt: appTourCompletedAt ?? this.appTourCompletedAt,
      completedTourVersion: completedTourVersion ?? this.completedTourVersion,
    );
  }

  factory User.fromJson(Map<String, dynamic> j) {
    return User(
      id: j['id'] as String,
      name: (j['name'] as String?) ?? '',
      email: (j['email'] as String?) ?? '',
      role: (j['role'] as String?) ?? 'STUDENT',
      firstName: j['firstName'] as String?,
      lastName: j['lastName'] as String?,
      gender: j['gender'] as String?,
      avatar: j['avatar'] as String?,
      mobileNumber: j['mobileNumber'] as String?,
      securityNumber: j['securityNumber'] as String?,
      bio: j['bio'] as String?,
      iitmJoinYear: j['iitmJoinYear'] as String?,
      iitmJoinMonth: j['iitmJoinMonth'] as String?,
      iitmLevel: j['iitmLevel'] as String?,
      iitmUserType: j['iitmUserType'] as String?,
      createdAt: j['createdAt'] as String?,
      hasUpdatedProgressSept26:
          (j['hasUpdatedProgressSept26'] as bool?) ?? false,
      previousMobileNumber: j['previousMobileNumber'] as String?,
      instagramUrl: j['instagramUrl'] as String?,
      linkedinUrl: j['linkedinUrl'] as String?,
      isSept26ProgressUpdateActive:
          (j['isSept26ProgressUpdateActive'] as bool?) ?? false,
      isIdentityUpdated: (j['isIdentityUpdated'] as bool?) ?? false,
      isProfileComplete: (j['isProfileComplete'] as bool?) ?? false,
      appTourCompleted: (j['appTourCompleted'] as bool?) ?? false,
      appTourCompletedAt: j['appTourCompletedAt'] as String?,
      completedTourVersion: (j['completedTourVersion'] as int?) ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'role': role,
      'firstName': firstName,
      'lastName': lastName,
      'gender': gender,
      'avatar': avatar,
      'mobileNumber': mobileNumber,
      'securityNumber': securityNumber,
      'bio': bio,
      'iitmJoinYear': iitmJoinYear,
      'iitmJoinMonth': iitmJoinMonth,
      'iitmLevel': iitmLevel,
      'iitmUserType': iitmUserType,
      'createdAt': createdAt,
      'hasUpdatedProgressSept26': hasUpdatedProgressSept26,
      'previousMobileNumber': previousMobileNumber,
      'instagramUrl': instagramUrl,
      'linkedinUrl': linkedinUrl,
      'isSept26ProgressUpdateActive': isSept26ProgressUpdateActive,
      'isIdentityUpdated': isIdentityUpdated,
      'isProfileComplete': isProfileComplete,
      'appTourCompleted': appTourCompleted,
      'appTourCompletedAt': appTourCompletedAt,
      'completedTourVersion': completedTourVersion,
    };
  }
}
