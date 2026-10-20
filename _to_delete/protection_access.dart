// Exam Protection limited rollout: managers plus these student accounts only.
const protectionPreviewEmails = {'pay.laxmikant@gmail.com'};

bool canUseProtection(String? role, String? email) =>
    role == 'MANAGER' ||
    (role == 'STUDENT' &&
        email != null &&
        protectionPreviewEmails.contains(email.trim().toLowerCase()));
