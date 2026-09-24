class AppTranslations {
  static const Map<String, Map<String, String>> _translations = {
    'en': {
      // Dashboard
      'dashboard.greeting.morning': 'Good Morning',
      'dashboard.greeting.afternoon': 'Good Afternoon',
      'dashboard.greeting.evening': 'Good Evening',
      'dashboard.greeting.night': 'Good Night',
      'dashboard.deletion.accepted': 'Manager Accepted Deletion',
      'dashboard.deletion.requested': 'Account Deletion Requested',
      'dashboard.deletion.scheduled': 'Scheduled for deletion • Tap to view timeline or cancel',
      'dashboard.deletion.review': '24h review active • Tap to view timeline or cancel',
      'dashboard.offline': 'Offline Mode • Showing saved content',
      'dashboard.upcomingSession': 'Upcoming Session',
      'dashboard.viewAll': 'View All →',
      'dashboard.recentLecture': 'Recent Lecture',
      'dashboard.announcements': 'Announcements',
      'dashboard.announcements.empty.title': 'No announcements',
      'dashboard.announcements.empty.sub': 'You are all caught up!',
      'dashboard.continueWatching': 'Continue Watching',

      // Settings
      'settings.title': 'Settings',
      'settings.preferences': 'Preferences & appearance',
      'settings.appearance': 'APPEARANCE',
      'settings.language': 'LANGUAGE',
      'settings.language.desc': 'Choose your display language',
      'settings.theme.system': 'System',
      'settings.theme.light': 'Light',
      'settings.theme.dark': 'Dark',
      'settings.theme.black': 'Black',
      'settings.pushNotifications': 'PUSH NOTIFICATIONS',
      'settings.notif.announcements': 'Announcements & News',
      'settings.notif.announcements.sub': 'Important notices from mentors and admins',
      'settings.notif.community': 'Community Messages',
      'settings.notif.community.sub': 'Course group discussions and threads',
      'settings.deleteAccount': 'DELETE ACCOUNT',
    },
    'hi': {
      // Dashboard
      'dashboard.greeting.morning': 'सुप्रभात',
      'dashboard.greeting.afternoon': 'शुभ दोपहर',
      'dashboard.greeting.evening': 'शुभ संध्या',
      'dashboard.greeting.night': 'शुभ रात्रि',
      'dashboard.deletion.accepted': 'मैनेजर ने डिलीट रिक्वेस्ट मान ली है',
      'dashboard.deletion.requested': 'अकाउंट डिलीट करने की रिक्वेस्ट भेजी गई है',
      'dashboard.deletion.scheduled': 'डिलीट करने के लिए शेड्यूल्ड है • टाइमलाइन देखने या कैंसिल करने के लिए टैप करें',
      'dashboard.deletion.review': '24h का रिव्यू चालू है • टाइमलाइन देखने या कैंसिल करने के लिए टैप करें',
      'dashboard.offline': 'ऑफ़लाइन मोड • सेव किया हुआ कंटेंट दिखाया जा रहा है',
      'dashboard.upcomingSession': 'अगला लाइव सेशन',
      'dashboard.viewAll': 'सभी देखें →',
      'dashboard.recentLecture': 'पिछला लेक्चर',
      'dashboard.announcements': 'अनाउंसमेंट्स',
      'dashboard.announcements.empty.title': 'कोई नई अनाउंसमेंट नहीं है',
      'dashboard.announcements.empty.sub': 'आप बिल्कुल अप-टू-डेट हैं!',
      'dashboard.continueWatching': 'देखना जारी रखें',

      // Settings
      'settings.title': 'सेटिंग्स',
      'settings.preferences': 'प्रिफरेंसेज और अपीयरेंस',
      'settings.appearance': 'अपीयरेंस (Theme)',
      'settings.language': 'भाषा (LANGUAGE)',
      'settings.language.desc': 'अपनी डिस्प्ले भाषा चुनें',
      'settings.theme.system': 'सिस्टम',
      'settings.theme.light': 'लाइट',
      'settings.theme.dark': 'डार्क',
      'settings.theme.black': 'ब्लैक',
      'settings.pushNotifications': 'पुश नोटिफिकेशंस (PUSH NOTIFICATIONS)',
      'settings.notif.announcements': 'अनाउंसमेंट्स और खबरें',
      'settings.notif.announcements.sub': 'मेंटर और एडमिन की ज़रूरी सूचनाएं',
      'settings.notif.community': 'कम्युनिटी मैसेजेस',
      'settings.notif.community.sub': 'कोर्स ग्रुप के डिस्कशन्स और थ्रेड्स',
      'settings.deleteAccount': 'अकाउंट डिलीट करें (DELETE ACCOUNT)',
    },
  };

  static String t(String key, String locale) {
    return _translations[locale]?[key] ?? _translations['en']?[key] ?? key;
  }
}
