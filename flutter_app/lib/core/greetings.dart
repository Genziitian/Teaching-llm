// GENERATED from src/lib/greetings.ts. Keep in sync with the web app.
// Records are (title, subtext); {name} is replaced with the first name.
typedef Greeting = (String, String);

const _weekday = <List<Greeting>>[
  [
    ('Happy Sunday, {name}.', 'Plan the week ahead.'),
    ('Easy Sunday, {name}.', 'A little revision goes a long way.'),
    ('Recharge today, {name}.', 'Get ready for a strong week.'),
    ('Sunday reset, {name}.', 'Set your goals for the week.'),
  ],
  [
    ('Happy Monday, {name}!', 'Fresh week, fresh start.'),
    ('Monday\'s here, {name}.', 'Let\'s set the tone for the week.'),
    ('New week, new goals, {name}.', 'Let\'s go!'),
    ('Rise and grind, {name}.', 'It\'s Monday.'),
    ('Monday mode: on.', 'Let\'s make it count, {name}.'),
  ],
  [
    ('Happy Tuesday, {name}.', 'Keep the momentum going.'),
    ('Tuesday already? You\'re on a roll, {name}.', 'Keep it up.'),
    ('Two days in, {name}.', 'Let\'s build on it.'),
    ('Tuesday focus, {name}.', 'One topic at a time.'),
  ],
  [
    ('Happy Wednesday, {name}!', 'Halfway there.'),
    ('Midweek check-in, {name}.', 'How\'s the prep going?'),
    ('Hump day, {name}.', 'Push through, the best is ahead.'),
    ('Wednesday vibes, {name}.', 'Stay consistent.'),
  ],
  [
    ('Happy Thursday, {name}.', 'Almost there!'),
    ('Thursday, {name}.', 'One more push before the weekend.'),
    ('Finish strong this week, {name}.', 'Thursday\'s yours.'),
    ('Nearly Friday, {name}.', 'Keep your streak alive.'),
  ],
  [
    ('Happy Friday, {name}!', 'Wrap the week on a high.'),
    ('Friday\'s here, {name}.', 'Revise what you learned this week.'),
    ('TGIF, {name}.', 'A quick revision session before the weekend?'),
    ('End the week strong, {name}.', 'You\'ve earned it.'),
  ],
  [
    ('Happy Saturday, {name}.', 'Great day for a mock test.'),
    ('Weekend mode, {name}.', 'Time to catch up and revise.'),
    ('Saturday study session, {name}?', 'Make it a good one.'),
    ('No classes today, {name}.', 'Perfect for practice.'),
  ],
];

const _period = <String, List<Greeting>>{
  'morning': [
    ('Good morning, {name}.', 'Hope you\'re ready for a productive day ahead.'),
    ('Rise and shine, {name}!', 'Let\'s make today count.'),
    ('Early bird, {name}.', 'Let\'s get started.'),
    ('Good morning, {name}.', 'Today\'s a great day to learn something new.'),
  ],
  'afternoon': [
    ('Good afternoon, {name}.', 'Keep that focus going.'),
    ('Afternoon, {name}.', 'Time for a quick revision round?'),
    ('Halfway through the day, {name}.', 'You\'re doing great.'),
    ('Good afternoon, {name}.', 'Take a short break, then dive back in.'),
  ],
  'evening': [
    ('Good evening, {name}.', 'How did today go?'),
    ('Evening, {name}.', 'A good time to revise today\'s lectures.'),
    ('Wind down with a quick quiz, {name}?', 'Take a moment to review your day.'),
    ('Good evening, {name}.', 'Proud of the effort you\'ve put in today.'),
  ],
  'night': [
    ('Burning the midnight oil, {name}?', 'Don\'t forget to rest.'),
    ('Good night, owl, {name}.', 'Study smart, sleep well.'),
    ('Late night session, {name}.', 'Keep it short and sleep on time.'),
    ('Still up, {name}?', 'One last topic, then rest.'),
  ],
};

const _anytime = <Greeting>[
  ('Welcome back, {name}.', 'Every step counts.'),
  ('Small steps every day, {name}.', 'That\'s how toppers are made.'),
  ('Consistency beats intensity, {name}.', 'Keep showing up.'),
  ('You\'ve got this, {name}.', 'Let\'s get to work.'),
  ('Ready to crush it today, {name}?', 'Your goal is closer than you think.'),
  ('Your future self will thank you, {name}.', 'Keep going.'),
  ('Great to see you, {name}.', 'Let\'s pick up where you left off.'),
  ('Hard work now, big wins later, {name}.', 'Stay on track.'),
  ('Stay curious, {name}.', 'Stay consistent.'),
  ('Another day, another step closer, {name}.', 'Keep your eyes on the goal.'),
  ('Hey {name}!', 'Let\'s make today legendary.'),
  ('Namaste, {name}.', 'Ready to learn?'),
  ('Welcome back, champ.', 'Let\'s get to work, {name}.'),
  ('Hello, {name}!', 'Your learning streak is waiting.'),
];

const _festival = <String, List<Greeting>>{
  'christmas': [
    ('Merry Christmas, {name}! 🎄', 'Enjoy the day, you deserve the break.'),
    ('Happy Christmas, {name}!', 'Wishing you joy and a little revision time.'),
  ],
  'christmasEve': [
    ('Merry Christmas Eve, {name}! 🎄', 'Festive mood, focused mind.'),
  ],
  'newYearEve': [
    ('Last day of the year, {name}! 🎆', 'Proud of how far you\'ve come.'),
    ('Happy New Year\'s Eve, {name}!', 'Wrap up the year on a high.'),
  ],
  'newYear': [
    ('Happy New Year, {name}! 🎉', 'New year, bigger goals. Let\'s do this.'),
    ('Welcome to the new year, {name}!', 'Make this your best one yet.'),
  ],
  'republic': [
    ('Happy Republic Day, {name}! 🇮🇳', 'Jai Hind.'),
  ],
  'independence': [
    ('Happy Independence Day, {name}! 🇮🇳', 'Jai Hind.'),
  ],
  'teachers': [
    ('Happy Teachers\' Day, {name}!', 'Thank a teacher today.'),
  ],
  'holi': [
    ('Happy Holi, {name}! 🎨', 'Wishing you a colourful day.'),
  ],
  'diwali': [
    ('Happy Diwali, {name}! 🪔', 'May your year shine bright.'),
  ],
};

const _moving = <String, List<String>>{
  'holi': ['2026-03-04', '2027-03-22', '2028-03-11', '2029-03-01', '2030-03-20'],
  'diwali': ['2026-11-08', '2027-10-29', '2028-10-17', '2029-11-05', '2030-10-26'],
};

const _fixed = <String, String>{
  '12-25': 'christmas',
  '12-24': 'christmasEve',
  '12-31': 'newYearEve',
  '01-01': 'newYear',
  '01-26': 'republic',
  '08-15': 'independence',
  '09-05': 'teachers',
};

int _hash(String s) {
  var h = 0;
  for (final c in s.codeUnits) {
    h = (h * 31 + c) & 0x7fffffff;
  }
  return h;
}

/// Same selection rules as the web greeting: festival, else weekday/period/anytime pool.
({String heading, String subtext}) greetingFor(String name, [DateTime? at]) {
  final now = at ?? DateTime.now();
  final ymd =
      '${now.year}-${now.month.toString().padLeft(2, '0')}-${now.day.toString().padLeft(2, '0')}';
  final h = now.hour;
  final period = h >= 5 && h < 12
      ? 'morning'
      : h >= 12 && h < 17
          ? 'afternoon'
          : h >= 17 && h < 21
              ? 'evening'
              : 'night';
  String? fest = _fixed[ymd.substring(5)];
  fest ??= _moving.entries
      .where((e) => e.value.contains(ymd))
      .map((e) => e.key)
      .firstOrNull;
  // Dart weekday is Mon=1..Sun=7; the table is Sun=0.
  final pool = fest != null
      ? _festival[fest]!
      : [..._weekday[now.weekday % 7], ..._period[period]!, ..._anytime];
  final (title, sub) = pool[_hash('$ymd-$period') % pool.length];
  return (
    heading: title.replaceAll('{name}', name),
    subtext: sub.replaceAll('{name}', name),
  );
}
