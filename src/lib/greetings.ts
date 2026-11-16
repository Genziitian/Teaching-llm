// [title, subtext]; "{name}" is replaced with the student's first name.
type G = [string, string]

const WEEKDAY: G[][] = [
  // Sunday
  [['Happy Sunday, {name}.', 'Plan the week ahead.'], ['Easy Sunday, {name}.', 'A little revision goes a long way.'], ['Recharge today, {name}.', 'Get ready for a strong week.'], ['Sunday reset, {name}.', 'Set your goals for the week.']],
  // Monday
  [['Happy Monday, {name}!', 'Fresh week, fresh start.'], ["Monday's here, {name}.", "Let's set the tone for the week."], ['New week, new goals, {name}.', "Let's go!"], ['Rise and grind, {name}.', "It's Monday."], ['Monday mode: on.', "Let's make it count, {name}."]],
  // Tuesday
  [['Happy Tuesday, {name}.', 'Keep the momentum going.'], ["Tuesday already? You're on a roll, {name}.", 'Keep it up.'], ['Two days in, {name}.', "Let's build on it."], ['Tuesday focus, {name}.', 'One topic at a time.']],
  // Wednesday
  [['Happy Wednesday, {name}!', "Halfway there."], ['Midweek check-in, {name}.', "How's the prep going?"], ['Hump day, {name}.', 'Push through, the best is ahead.'], ['Wednesday vibes, {name}.', 'Stay consistent.']],
  // Thursday
  [['Happy Thursday, {name}.', 'Almost there!'], ['Thursday, {name}.', 'One more push before the weekend.'], ['Finish strong this week, {name}.', "Thursday's yours."], ['Nearly Friday, {name}.', 'Keep your streak alive.']],
  // Friday
  [['Happy Friday, {name}!', 'Wrap the week on a high.'], ["Friday's here, {name}.", 'Revise what you learned this week.'], ['TGIF, {name}.', 'A quick revision session before the weekend?'], ['End the week strong, {name}.', "You've earned it."]],
  // Saturday
  [['Happy Saturday, {name}.', 'Great day for a mock test.'], ['Weekend mode, {name}.', 'Time to catch up and revise.'], ['Saturday study session, {name}?', 'Make it a good one.'], ['No classes today, {name}.', 'Perfect for practice.']],
]

const PERIOD: Record<string, G[]> = {
  morning: [['Good morning, {name}.', "Hope you're ready for a productive day ahead."], ['Rise and shine, {name}!', "Let's make today count."], ['Early bird, {name}.', "Let's get started."], ['Good morning, {name}.', "Today's a great day to learn something new."]],
  afternoon: [['Good afternoon, {name}.', 'Keep that focus going.'], ['Afternoon, {name}.', 'Time for a quick revision round?'], ['Halfway through the day, {name}.', "You're doing great."], ['Good afternoon, {name}.', 'Take a short break, then dive back in.']],
  evening: [['Good evening, {name}.', 'How did today go?'], ['Evening, {name}.', "A good time to revise today's lectures."], ['Wind down with a quick quiz, {name}?', 'Take a moment to review your day.'], ['Good evening, {name}.', "Proud of the effort you've put in today."]],
  night: [['Burning the midnight oil, {name}?', "Don't forget to rest."], ['Good night, owl, {name}.', 'Study smart, sleep well.'], ['Late night session, {name}.', 'Keep it short and sleep on time.'], ['Still up, {name}?', 'One last topic, then rest.']],
}

const ANYTIME: G[] = [
  ['Welcome back, {name}.', 'Every step counts.'], ['Small steps every day, {name}.', "That's how toppers are made."], ['Consistency beats intensity, {name}.', 'Keep showing up.'],
  ["You've got this, {name}.", "Let's get to work."], ['Ready to crush it today, {name}?', 'Your goal is closer than you think.'], ['Your future self will thank you, {name}.', 'Keep going.'],
  ['Great to see you, {name}.', "Let's pick up where you left off."], ['Hard work now, big wins later, {name}.', 'Stay on track.'], ['Stay curious, {name}.', 'Stay consistent.'],
  ['Another day, another step closer, {name}.', 'Keep your eyes on the goal.'], ['Hey {name}!', "Let's make today legendary."], ['Namaste, {name}.', 'Ready to learn?'],
  ['Welcome back, champ.', "Let's get to work, {name}."], ['Hello, {name}!', 'Your learning streak is waiting.'],
]

const FESTIVAL_TEXT: Record<string, G[]> = {
  christmas: [['Merry Christmas, {name}! 🎄', 'Enjoy the day, you deserve the break.'], ['Happy Christmas, {name}!', 'Wishing you joy and a little revision time.']],
  christmasEve: [['Merry Christmas Eve, {name}! 🎄', 'Festive mood, focused mind.']],
  newYearEve: [['Last day of the year, {name}! 🎆', "Proud of how far you've come."], ['Happy New Year\'s Eve, {name}!', 'Wrap up the year on a high.']],
  newYear: [['Happy New Year, {name}! 🎉', 'New year, bigger goals. Let\'s do this.'], ['Welcome to the new year, {name}!', 'Make this your best one yet.']],
  republic: [['Happy Republic Day, {name}! 🇮🇳', 'Jai Hind.']],
  independence: [['Happy Independence Day, {name}! 🇮🇳', 'Jai Hind.']],
  teachers: [["Happy Teachers' Day, {name}!", 'Thank a teacher today.']],
  holi: [['Happy Holi, {name}! 🎨', 'Wishing you a colourful day.']],
  diwali: [['Happy Diwali, {name}! 🪔', 'May your year shine bright.']],
}

// Lunar festivals move every year; add new years here. shortcut: dates hardcoded to 2030, extend yearly.
const MOVING: Record<string, string[]> = {
  holi: ['2026-03-04', '2027-03-22', '2028-03-11', '2029-03-01', '2030-03-20'],
  diwali: ['2026-11-08', '2027-10-29', '2028-10-17', '2029-11-05', '2030-10-26'],
}
const FIXED: Record<string, string> = { '12-25': 'christmas', '12-24': 'christmasEve', '12-31': 'newYearEve', '01-01': 'newYear', '01-26': 'republic', '08-15': 'independence', '09-05': 'teachers' }

function festivalKey(d: Date, ymd: string): string | undefined {
  const fixed = FIXED[ymd.slice(5)]
  if (fixed) return fixed
  return Object.keys(MOVING).find(k => MOVING[k].includes(ymd))
}

function hash(str: string) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

export function getGreeting(name: string, now: Date = new Date()): { heading: string; subtext: string } {
  const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const hour = now.getHours()
  const period = hour >= 5 && hour < 12 ? 'morning' : hour < 17 && hour >= 12 ? 'afternoon' : hour >= 17 && hour < 21 ? 'evening' : 'night'
  const fest = festivalKey(now, ymd)
  const pool = fest ? FESTIVAL_TEXT[fest] : [...WEEKDAY[now.getDay()], ...PERIOD[period], ...ANYTIME]
  // Stable within a period so the text doesn't flicker on re-render.
  const [title, sub] = pool[hash(`${ymd}-${period}`) % pool.length]
  return { heading: title.replace('{name}', name), subtext: sub.replace('{name}', name) }
}
