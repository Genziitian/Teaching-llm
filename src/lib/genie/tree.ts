// GenZie — guided support answers (English + Hinglish).
// Source: answers from the support team (Smart Support questions doc, 9–10 Nov 2026).
// Step 3 will move this into a manager-editable store; until then edit here.

export type GenZieLang = 'en' | 'hi'
export type GenieLang = GenZieLang
export type L = { en: string; hi: string }

export interface GenZieOption {
  id: string
  label: L
  next: GenZieNode
}

export interface GenZieNode {
  id: string
  /** Question shown with options (branch node). */
  q?: L
  options?: GenZieOption[]
  /** Answer text (leaf node). URLs are turned into links. */
  answer?: L
  /** Optional button under the answer that takes the student somewhere (internal path or full URL). */
  link?: { label: L; href: string }
  /** Leaf that can only be solved by the team: skip "Did this solve it?". */
  needsAgent?: boolean
  /** Ticket type to use if this ends up as a ticket. */
  ticketType?: 'GENERAL' | 'SUBJECT'
}
export type GenieNode = GenZieNode
export type GenieOption = GenZieOption

export const GENIE_NAME = 'GenZie'
export const WHATSAPP_URL = 'https://wa.me/917254926179'

export const UI: Record<string, L> = {
  hello: { en: "Hi, I'm GenZie 👋", hi: 'Hi, main GenZie hoon 👋' },
  helloSub: { en: 'Need help? Tap here.', hi: 'Help chahiye? Yahan tap karo.' },
  greeting: {
    en: "Hi {name}! I'm GenZie. Pick an option below for your doubts or exam help.",
    hi: 'Hi {name}! Main GenZie hoon. Apne doubts ya exam ki help ke liye neeche se ek option chuno.',
  },
  pickLang: {
    en: 'Which language would you like to use?\nAap kaunsi language use karna chahoge?',
    hi: 'Which language would you like to use?\nAap kaunsi language use karna chahoge?',
  },
  langAsk: { en: 'Would you like to continue in English or Hinglish?', hi: 'Aap English ya Hinglish mein continue karna chahoge?' },
  solved: { en: 'Did this solve it?', hi: 'Kya isse problem solve hui?' },
  yes: { en: 'Yes, solved', hi: 'Haan, ho gaya' },
  no: { en: 'No, I still need help', hi: 'Nahi, abhi bhi help chahiye' },
  glad: {
    en: "Great, glad that helped! Anything else?",
    hi: 'Badhiya, khushi hui ki help hui! Kuch aur?',
  },
  needHuman: {
    en: "Sorry about that. Let's get you to our team (available 10 AM – 10 PM, every day). How would you like to talk to them?",
    hi: 'Sorry! Chalo aapko hamari team se connect karte hain (team 10 AM – 10 PM, roz available hai). Kaise baat karna chahoge?',
  },
  agentHere: { en: 'Chat here with an agent (fastest)', hi: 'Yahin agent se chat karo (sabse fast)' },
  whatsapp: { en: 'Chat with an agent on WhatsApp', hi: 'WhatsApp par agent se chat karo' },
  whatsappSent: {
    en: 'Opening WhatsApp. Our team will reply there.',
    hi: 'WhatsApp khul raha hai. Hamari team wahin reply karegi.',
  },
  describe: {
    en: 'Please describe your problem in a few lines. Our team will see what you already tried here.',
    hi: 'Apni problem thode words mein batao. Aapne yahan jo try kiya, wo team ko dikhega.',
  },
  describePh: { en: 'Describe your problem…', hi: 'Apni problem likho…' },
  send: { en: 'Send', hi: 'Bhejo' },
  sending: { en: 'Sending…', hi: 'Bhej rahe hain…' },
  ticketMade: {
    en: 'Done! Your request is saved as ticket #{n}. Our team will reply there, and you can follow it on the Support page.',
    hi: 'Ho gaya! Aapki request ticket #{n} ke roop mein save ho gayi. Team wahin reply karegi, Support page par dekh sakte ho.',
  },
  ticketFail: {
    en: "Sorry, I couldn't send that ({e}). Please try WhatsApp instead.",
    hi: 'Sorry, bhej nahi paaya ({e}). Please WhatsApp try karo.',
  },
  startOver: { en: 'Start over', hi: 'Phir se shuru karo' },
  back: { en: 'Back', hi: 'Peeche' },
  waSolved: { en: 'Did that solve it?', hi: 'Kya isse problem solve ho gayi?' },
  improving: {
    en: "Sorry about that. We're improving our support every day and will do better. You can still chat with an agent here.",
    hi: 'Sorry iske liye. Hum apna support roz behtar bana rahe hain. Aap yahin agent se chat bhi kar sakte ho.',
  },
  connecting: {
    en: 'Connecting you to a support agent… This can take up to 5 minutes. If nobody is free, your chat is saved as a ticket automatically.',
    hi: 'Aapko support agent se jod rahe hain… 5 minute tak lag sakte hain. Agar koi free nahi hua to chat apne aap ticket ban jayegi.',
  },
  joined: { en: 'A support agent joined the chat.', hi: 'Ek support agent chat mein aa gaye hain.' },
  movedTicket: {
    en: 'Your chat is now ticket #{n}. Our team will reply there — you can follow it from the Support page.',
    hi: 'Aapki chat ab ticket #{n} ban gayi hai. Hamari team wahin reply karegi — Support page par dekh sakte ho.',
  },
  chatEnded: { en: 'This chat has ended.', hi: 'Yeh chat khatam ho gayi hai.' },
  rateAsk: { en: 'Was the support helpful?', hi: 'Kya support helpful tha?' },
  thanks: { en: 'Thanks for the feedback!', hi: 'Feedback ke liye shukriya!' },
  continueChat: { en: 'Continue your chat · #{n}', hi: 'Chat jaari rakho · #{n}' },
  attach: { en: 'Attach photo', hi: 'Photo lagao' },
  photoBad: { en: 'Only JPG, PNG or WEBP photos up to 5 MB.', hi: 'Sirf JPG, PNG ya WEBP photo, 5 MB tak.' },
  mistakes: { en: 'GenZie can make mistakes.', hi: 'GenZie se galti ho sakti hai.' },
  close: { en: 'Close', hi: 'Band karo' },
  tooLong: { en: 'Please keep it under {n} characters.', hi: 'Please {n} characters se kam likho.' },
  slowDown: { en: 'Please wait a moment before sending again.', hi: 'Thoda ruko, phir bhejo.' },
}

const t = (en: string, hi: string): L => ({ en, hi })

const FLAT_TREE: GenZieNode = {
  id: 'root',
  q: UI.greeting,
  options: [
    {
      id: 'course', label: t('Course access', 'Course access'),
      next: {
        id: 'course', q: t("What's happening with your course?", 'Course ke saath kya ho raha hai?'),
        options: [
          {
            id: 'course.not-visible', label: t("I bought a course but it's not showing", 'Course kharida par dikh nahi raha'),
            next: {
              id: 'course.not-visible', ticketType: 'GENERAL',
              answer: t(
                "Courses unlock instantly after payment, so let's check the basics first.\n\nAre you sure you're logged in with the same email you purchased with? We send a confirmation email as soon as a purchase is done, so please check that inbox.\n\nIf you find that email, take a screenshot of it and keep your payment proof ready. We'll raise a ticket and connect you with an agent.\n\nThis doesn't normally happen, and we're sorry for the trouble!",
                'Payment ke baad course turant unlock ho jata hai, to pehle basic cheezein check karte hain.\n\nKya aap pakka usi email se login ho jisse course kharida tha? Purchase hote hi hum ek confirmation email bhejte hain, to apna inbox check karo.\n\nAgar wo email mil jaye, to uska screenshot lo aur apna payment proof ready rakho. Hum ticket raise karke aapko agent se connect karenge.\n\nYe normally nahi hota, aur trouble ke liye sorry!'
              ),
            },
          },
          {
            id: 'course.expired', label: t('My course disappeared / expired', 'Mera course gayab ho gaya / expire ho gaya'),
            next: {
              id: 'course.expired', ticketType: 'GENERAL',
              answer: t(
                "When a course's access period ends, it expires and disappears from your courses. Extensions usually aren't possible, but our team does review special cases.",
                'Jab course ka access period khatam hota hai, course expire hokar aapke courses se hat jata hai. Extension usually nahi hota, par special cases team dekhti hai.'
              ),
            },
          },
          {
            id: 'course.switch', label: t('I want to switch to another course', 'Mujhe dusre course mein switch karna hai'),
            next: {
              id: 'course.switch', ticketType: 'GENERAL',
              answer: t(
                "Switching courses after purchase usually isn't possible, but our team does review special cases.",
                'Purchase ke baad course switch usually nahi hota, par special cases team dekhti hai.'
              ),
            },
          },
        ],
      },
    },
    {
      id: 'buy', label: t('Buying a course', 'Course kharidna'),
      next: {
        id: 'buy', q: t('What would you like to know?', 'Kya jaanna hai?'),
        options: [
          {
            id: 'buy.how', label: t('How do I buy more courses?', 'Aur courses kaise kharidun?'),
            next: {
              id: 'buy.how', ticketType: 'GENERAL',
              answer: t(
                "You can buy courses at https://genziitian.in. We're also working on letting you buy right inside this app and website, but that takes some time.",
                'Courses aap https://genziitian.in par kharid sakte ho. Hum isi app aur website ke andar kharidne ki facility bhi bana rahe hain, par isme time lagega.'
              ),
            },
          },
          {
            id: 'buy.upgrade', label: t('Upgrade from PLUS to PRO', 'PLUS se PRO upgrade'),
            next: {
              id: 'buy.upgrade', ticketType: 'GENERAL',
              answer: t(
                'Yes, you can upgrade. Depending on the course, you either pay the price difference or a fixed upgrade price.',
                'Haan, upgrade kar sakte ho. Course ke hisaab se ya to price ka difference dena hota hai, ya ek fixed upgrade price.'
              ),
            },
          },
          {
            id: 'buy.bundle', label: t('Do you have bundles?', 'Kya bundles milte hain?'),
            next: {
              id: 'buy.bundle', ticketType: 'GENERAL',
              answer: t(
                'Yes! Bundles give you an extra discount compared to buying the courses separately. Check them out at https://class.genziitian.in/courses/explore',
                'Haan! Bundles mein alag-alag courses lene se extra discount milta hai. Yahan dekho: https://class.genziitian.in/courses/explore'
              ),
            },
          },
          {
            id: 'buy.coupon', label: t('Is there a discount code?', 'Koi discount code hai?'),
            next: {
              id: 'buy.coupon', ticketType: 'GENERAL',
              answer: t(
                "Yes! When you buy, you'll see a box to enter a discount code. Use GENZ5, it works anytime.",
                'Haan! Kharidte waqt discount code daalne ka box dikhega. GENZ5 use karo, ye kabhi bhi chalta hai.'
              ),
            },
          },
        ],
      },
    },
    {
      id: 'pay', label: t('Payments & refunds', 'Payment aur refund'),
      next: {
        id: 'pay', q: t("What's the payment issue?", 'Payment mein kya issue hai?'),
        options: [
          {
            id: 'pay.failed', label: t('Payment failed but money was deducted', 'Payment fail hua par paise kat gaye'),
            next: {
              id: 'pay.failed', ticketType: 'GENERAL',
              answer: t(
                "Usually your bank reverses a failed payment automatically. Still, please let our team confirm it. Keep your transaction screenshot ready.",
                'Usually bank failed payment apne aap wapas kar deta hai. Phir bhi team se confirm kar lo. Apna transaction screenshot ready rakho.'
              ),
            },
          },
          {
            id: 'pay.no-course', label: t('I paid but got no course', 'Payment ho gaya par course nahi mila'),
            next: {
              id: 'pay.no-course', ticketType: 'GENERAL', needsAgent: true,
              answer: t(
                "This is rare, so our team checks it in the backend. Please share your transaction screenshot with them.",
                'Ye rare hai, isliye team backend mein check karti hai. Apna transaction screenshot team ke saath share karo.'
              ),
            },
          },
          {
            id: 'pay.twice', label: t('I paid twice by mistake', 'Galti se do baar payment ho gaya'),
            next: {
              id: 'pay.twice', ticketType: 'GENERAL', needsAgent: true,
              answer: t(
                'Our support team will confirm this and sort it out for you. Keep both transaction screenshots ready.',
                'Support team ise confirm karke solve karegi. Dono transaction screenshots ready rakho.'
              ),
            },
          },
          {
            id: 'pay.refund', label: t('I want a refund', 'Mujhe refund chahiye'),
            next: {
              id: 'pay.refund', ticketType: 'GENERAL',
              answer: t(
                "Sorry, we have a no-refund policy. You can read the full policy here: https://genziitian.in/refund",
                'Sorry, hamari no-refund policy hai. Poori policy yahan padho: https://genziitian.in/refund'
              ),
            },
          },
          {
            id: 'pay.history', label: t('Where can I see my past payments?', 'Purane payments kahan dekhun?'),
            next: {
              id: 'pay.history', ticketType: 'GENERAL',
              answer: t(
                'Open My Transactions to see all your payments.',
                'Apne saare payments dekhne ke liye My Transactions kholo.'
              ),
              link: { label: t('Open My Transactions', 'My Transactions kholo'), href: '/my-transactions' },
            },
          },
          {
            id: 'pay.emi', label: t('EMI or part payment?', 'EMI ya part payment?'),
            next: {
              id: 'pay.emi', ticketType: 'GENERAL',
              answer: t("Sorry, EMI and part payment aren't available right now.", 'Sorry, abhi EMI aur part payment available nahi hai.'),
            },
          },
          {
            id: 'pay.invoice', label: t('Can I get an invoice?', 'Invoice mil sakta hai?'),
            next: {
              id: 'pay.invoice', ticketType: 'GENERAL',
              answer: t("Sorry, we don't issue invoices at the moment.", 'Sorry, abhi hum invoice issue nahi karte.'),
            },
          },
        ],
      },
    },
    {
      id: 'video', label: t('Videos & live classes', 'Videos aur live classes'),
      next: {
        id: 'video', q: t("What's wrong?", 'Kya problem hai?'),
        options: [
          {
            id: 'video.not-playing', label: t('My video is not playing', 'Video play nahi ho raha'),
            next: {
              id: 'video.not-playing', q: t('What do you see when you open the lecture?', 'Lecture kholne par kya dikhta hai?'),
              options: [
                {
                  id: 'video.signin', label: t('It asks me to sign in to my Google account', 'Google account se sign in karne ko bol raha hai'),
                  next: {
                    id: 'video.signin', ticketType: 'GENERAL',
                    answer: t(
                      "This is the most common one, and it's easy to fix. In your browser:\n1. Go to Chrome Settings.\n2. Select Privacy and security.\n3. Allow third-party cookies.\n\nPlease try this once. If the problem still persists, someone from our team will reach out to you directly.",
                      'Ye sabse common problem hai aur aasaan fix hai. Browser mein:\n1. Chrome Settings kholo.\n2. Privacy and security chuno.\n3. Third-party cookies allow karo.\n\nEk baar try karo. Agar phir bhi problem rahe, to hamari team se koi aapse seedha contact karega.'
                    ),
                  },
                },
                {
                  id: 'video.access', label: t('It says I need access', 'Bol raha hai ki access chahiye'),
                  next: {
                    id: 'video.access', ticketType: 'GENERAL', needsAgent: true,
                    answer: t(
                      "This can be a problem on our side. Tell us more about what you see, and we'll turn it into a ticket so our team can sort out your access.",
                      'Ye hamari side ki problem ho sakti hai. Batao kya dikh raha hai, hum ise ticket bana denge taaki team aapka access theek kar sake.'
                    ),
                  },
                },
                {
                  id: 'video.youtube', label: t('It shows a YouTube error', 'YouTube error dikh raha hai'),
                  next: {
                    id: 'video.youtube', ticketType: 'GENERAL',
                    answer: t(
                      "You may be trying to open something that isn't available in the app right now.",
                      'Ho sakta hai aap kuch aisa khol rahe ho jo abhi app mein available nahi hai.'
                    ),
                  },
                },
                {
                  id: 'video.other', label: t('Something else', 'Kuch aur'),
                  next: {
                    id: 'video.other', ticketType: 'GENERAL',
                    answer: t(
                      'Try refreshing the page first. If that does not help, clear cookies for this site or try another browser. If it still does not work, talk to our team.',
                      'Pehle page refresh karo. Agar na chale, to is site ki cookies clear karo ya dusra browser try karo. Phir bhi na chale to team se baat karo.'
                    ),
                  },
                },
              ],
            },
          },
          {
            id: 'video.join-live', label: t('When can I join a live class?', 'Live class kab join kar sakte hain?'),
            next: {
              id: 'video.join-live', ticketType: 'GENERAL',
              answer: t(
                'The Join button appears 5 minutes before the class starts and stays until the class ends.',
                'Join button class shuru hone se 5 minute pehle aata hai aur class khatam hone tak rehta hai.'
              ),
            },
          },
          {
            id: 'video.live-issue', label: t("Live class link won't open / no sound", 'Live class ka link nahi khul raha / awaaz nahi aa rahi'),
            next: {
              id: 'video.live-issue', ticketType: 'GENERAL',
              answer: t(
                "Quick fixes: 1) refresh the page, 2) check your internet, 3) try another browser or the app. If the class is live and it still doesn't work, talk to our team right away.",
                'Quick fixes: 1) page refresh karo, 2) internet check karo, 3) dusra browser ya app try karo. Agar class chal rahi hai aur phir bhi na chale, to turant team se baat karo.'
              ),
            },
          },
          {
            id: 'video.plus-live', label: t('Can PLUS students join live classes?', 'Kya PLUS students live class join kar sakte hain?'),
            next: {
              id: 'video.plus-live', ticketType: 'GENERAL',
              answer: t(
                'Live classes are for PRO students only. PLUS students get the recordings. You can upgrade to PRO from the store anytime.',
                'Live classes sirf PRO students ke liye hain. PLUS students ko recordings milti hain. Store se kabhi bhi PRO mein upgrade kar sakte ho.'
              ),
            },
          },
          {
            id: 'video.recording', label: t("The class recording isn't up yet", 'Class ki recording abhi tak nahi aayi'),
            next: {
              id: 'video.recording', ticketType: 'GENERAL',
              answer: t(
                'Recordings are uploaded within 4–6 hours after the live class ends.',
                'Live class khatam hone ke 4–6 ghante ke andar recording upload ho jati hai.'
              ),
            },
          },
          {
            id: 'video.download', label: t('Can I download videos?', 'Kya videos download kar sakte hain?'),
            next: {
              id: 'video.download', ticketType: 'GENERAL',
              answer: t(
                'Videos can only be streamed online. PDFs and notes can be downloaded.',
                'Videos sirf online stream hote hain. PDFs aur notes download kar sakte ho.'
              ),
            },
          },
        ],
      },
    },
    {
      id: 'account', label: t('Account & login', 'Account aur login'),
      next: {
        id: 'account', q: t('What do you need?', 'Kya chahiye?'),
        options: [
          {
            id: 'account.login', label: t("I can't see my stuff after logging in", 'Login ke baad mera data nahi dikh raha'),
            next: {
              id: 'account.login', ticketType: 'GENERAL',
              answer: t(
                "Check which Google account you're logged in with. Your courses are linked to the account you used when you paid.",
                'Check karo kaunse Google account se login ho. Aapke courses usi account se jude hain jisse payment kiya tha.'
              ),
            },
          },
          {
            id: 'account.profile', label: t('Update my name / mobile / IITM details', 'Naam / mobile / IITM details update karna hai'),
            next: {
              id: 'account.profile', ticketType: 'GENERAL',
              answer: t(
                'You can edit your name yourself from your Profile. For anything beyond that (mobile number, IITM details, etc.), please raise a ticket and explain what you want changed.',
                'Apna naam aap khud Profile se edit kar sakte ho. Iske alawa kuch bhi (mobile number, IITM details, etc.) ke liye ticket raise karo aur batao kya change karna hai.'
              ),
              link: { label: t('Go to Profile', 'Profile par jao'), href: '/profile' },
            },
          },
          {
            id: 'account.suspended', label: t('My account was suspended / blocked', 'Mera account suspend / block ho gaya'),
            next: {
              id: 'account.suspended', ticketType: 'GENERAL', needsAgent: true,
              answer: t(
                'Sorry about that. Please raise a ticket and our team will review your account.',
                'Sorry! Please ticket raise karo, hamari team aapka account review karegi.'
              ),
            },
          },
          {
            id: 'account.email', label: t('Change my registered email', 'Registered email change karna hai'),
            next: {
              id: 'account.email', ticketType: 'GENERAL', needsAgent: true,
              answer: t(
                'Email changes need a manual check by our team, because your courses are tied to your account.',
                'Email change ke liye team ko manually check karna padta hai, kyunki courses aapke account se jude hain.'
              ),
            },
          },
          {
            id: 'account.sharing', label: t('Can I share my account?', 'Kya account share kar sakte hain?'),
            next: {
              id: 'account.sharing', ticketType: 'GENERAL',
              answer: t(
                "No, account sharing isn't allowed. Unusual logins are monitored, and shared accounts may get blocked.",
                'Nahi, account share karna allowed nahi hai. Unusual logins monitor hote hain, aur shared accounts block ho sakte hain.'
              ),
            },
          },
        ],
      },
    },
    {
      id: 'study', label: t('Notes, mentors & progress', 'Notes, mentors aur progress'),
      next: {
        id: 'study', q: t('What are you looking for?', 'Kya dhoondh rahe ho?'),
        options: [
          {
            id: 'study.notes', label: t('Where are notes / PYQs / materials?', 'Notes / PYQs / materials kahan hain?'),
            next: {
              id: 'study.notes', ticketType: 'GENERAL',
              answer: t(
                "For a course you bought: open the Courses tab, pick the course and the topic. Every lecture that has materials shows a button for them. For free stuff, open the Free Resources tab.",
                'Jo course kharida hai: Courses tab kholo, course aur topic chuno. Jis lecture mein materials hain, wahan uska button dikhega. Free cheezon ke liye Free Resources tab kholo.'
              ),
              link: { label: t('Open Free Resources', 'Free Resources kholo'), href: '/free-resources' },
            },
          },
          {
            id: 'study.mentor', label: t('How do I connect with a mentor?', 'Mentor se kaise connect karun?'),
            next: {
              id: 'study.mentor', ticketType: 'GENERAL',
              answer: t(
                "Mentors are available through your course's community. Open the Community tab and post your question in your course's group.",
                'Mentors aapke course ki community mein milte hain. Community tab kholo aur apne course ke group mein sawaal post karo.'
              ),
            },
          },
          {
            id: 'study.community', label: t('How do I use Community?', 'Community kaise use karun?'),
            next: {
              id: 'study.community', ticketType: 'GENERAL',
              answer: t(
                'Open the Community tab, pick your course group and post there. Please be respectful and avoid spam.',
                'Community tab kholo, apne course ka group chuno aur wahan post karo. Please respectful raho aur spam mat karo.'
              ),
              link: { label: t('Open Community', 'Community kholo'), href: '/community' },
            },
          },
          {
            id: 'study.missing', label: t("I can't find my quiz / homework", 'Mujhe apna quiz / homework nahi mil raha'),
            next: {
              id: 'study.missing', ticketType: 'GENERAL',
              answer: t(
                "If you can't find it, it may not exist for your course. Ask your batchmates in Community to confirm.",
                'Agar nahi mil raha, to ho sakta hai aapke course mein hai hi nahi. Community mein apne batchmates se confirm kar lo.'
              ),
              link: { label: t('Open Community', 'Community kholo'), href: '/community' },
            },
          },
          {
            id: 'study.test', label: t("My test result / score isn't showing", 'Test ka result / score nahi dikh raha'),
            next: {
              id: 'study.test', ticketType: 'GENERAL',
              answer: t(
                "We don't have tests on this platform, so there are no test results. If you're asking about something else, tell us and we'll help.",
                'Is platform par tests nahi hote, isliye test results bhi nahi hain. Agar aap kuch aur pooch rahe ho, to batao, hum help karenge.'
              ),
            },
          },
          {
            id: 'study.quizlab', label: t('What is Quiz Lab?', 'Quiz Lab kya hai?'),
            next: {
              id: 'study.quizlab', ticketType: 'GENERAL',
              answer: t(
                "Quiz Lab is where you practice quizzes to test what you've learned.",
                'Quiz Lab mein aap practice quizzes kar sakte ho, jisse pata chale kitna seekha.'
              ),
              link: { label: t('Open Quiz Lab', 'Quiz Lab kholo'), href: 'https://quiz.genziitian.in/' },
            },
          },
          {
            id: 'study.progress', label: t('How do I see my progress?', 'Apni progress kaise dekhun?'),
            next: {
              id: 'study.progress', ticketType: 'GENERAL',
              answer: t("Progress tracking isn't available yet. It's coming soon!", 'Progress tracking abhi available nahi hai. Jaldi aa raha hai!'),
            },
          },
          {
            id: 'study.certificate', label: t('Do you give certificates?', 'Kya certificate milta hai?'),
            next: {
              id: 'study.certificate', ticketType: 'GENERAL',
              answer: t("Certificates aren't available yet. They're coming soon!", 'Certificates abhi available nahi hain. Jaldi aa rahe hain!'),
            },
          },
        ],
      },
    },
    {
      id: 'app', label: t('App & devices', 'App aur devices'),
      next: {
        id: 'app', q: t("What's the issue?", 'Kya issue hai?'),
        options: [
          {
            id: 'app.ios', label: t('Is there an iPhone app?', 'Kya iPhone app hai?'),
            next: {
              id: 'app.ios', ticketType: 'GENERAL',
              answer: t(
                "The iPhone app is coming soon. Until then, use the website in Safari: https://class.genziitian.in",
                'iPhone app jaldi aa raha hai. Tab tak Safari mein website use karo: https://class.genziitian.in'
              ),
            },
          },
          {
            id: 'app.notifications', label: t('Notifications are not coming', 'Notifications nahi aa rahe'),
            next: {
              id: 'app.notifications', ticketType: 'GENERAL',
              answer: t(
                "Open your phone's Settings → Apps → Gen-Z IITian → Notifications and make sure they're allowed. Also keep the app updated from the Play Store.",
                'Phone ki Settings → Apps → Gen-Z IITian → Notifications mein jaake allow karo. App ko Play Store se updated bhi rakho.'
              ),
            },
          },
          {
            id: 'app.crash', label: t('The app is crashing / not opening', 'App crash ho raha hai / khul nahi raha'),
            next: {
              id: 'app.crash', ticketType: 'GENERAL',
              answer: t(
                "Try these in order: 1) update the app from the Play Store, 2) clear the app's cache (Settings → Apps → Gen-Z IITian → Storage → Clear cache), 3) uninstall and reinstall the app.",
                'Ye order mein try karo: 1) Play Store se app update karo, 2) app ka cache clear karo (Settings → Apps → Gen-Z IITian → Storage → Clear cache), 3) app uninstall karke dobara install karo.'
              ),
            },
          },
        ],
      },
    },
    {
      id: 'doubt', label: t('Doubt in a subject', 'Subject mein doubt'),
      next: {
        id: 'doubt', ticketType: 'SUBJECT', needsAgent: true,
        answer: t(
          'Our team will connect you with the right person for your subject.',
          'Hamari team aapko aapke subject ke sahi person se connect karegi.'
        ),
      },
    },
    {
      id: 'other', label: t('Something else', 'Kuch aur'),
      next: {
        id: 'other', ticketType: 'GENERAL', needsAgent: true,
        answer: t('No problem, our team can help with that.', 'Koi baat nahi, hamari team isme help kar sakti hai.'),
      },
    },
  ],
}

// ── Exams & eligibility + programme rules (from the IITM BS Student Handbook summary and the official student emails) ──
const leaf = (id: string, label: L, answer: L, link?: { label: L; href: string }) => ({ id, label, next: { id, ticketType: 'GENERAL' as const, answer, ...(link ? { link } : {}) } })
const sub = (id: string, label: L, options: GenieOption[]) => ({
  id, label,
  next: { id, q: t('Which one is closest?', 'Inme se kaunsa sabse close hai?'), options },
})

const HANDBOOK_LINK = { label: t('Open Student Handbook', 'Student Handbook kholo'), href: 'https://docs.google.com/document/u/2/d/e/2PACX-1vRxGnnDCVAO3KX2CGtMIcJQuDrAasVk2JHbDxkjsGrTP5ShhZK8N6ZSPX89lexKx86QPAUswSzGLsOA/pub#h.xmgbwcm99aop' }
const EXAM_OPTION: GenieOption = {
  id: 'exam', label: t('Exams & eligibility', 'Exam aur eligibility'),
  next: {
    id: 'exam', q: t('What do you want to know about exams?', 'Exam ke baare mein kya jaanna hai?'),
    options: [
      sub('exam.g-qual', t('Qualifier exam', 'Qualifier exam'), [
        leaf('exam.eligible', t('Am I eligible to write it?', 'Kya main exam de sakta/sakti hoon?'), t(
          'The Qualifier runs for 4 weeks. Each weekly assignment is scored out of 100 (not attempted = 0).\n\n• 1st attempt: your average of Week 1 and Week 2 must reach the cut-off in ALL 4 subjects.\n• If you miss it, the 2nd attempt uses the average of your best 2 of Weeks 1–3.\n\nCut-offs: General 40%, OBC-NCL / EWS 35%, SC / ST / PwD (40% disability) 30%.\n\nOnly eligible students get a hall ticket for the in-person proctored exam. Around 70% of applicants become eligible after the Week 2 stage, so start early.',
          'Qualifier 4 weeks ka hota hai. Har weekly assignment 100 mein se score hota hai (attempt nahi kiya = 0).\n\n• 1st attempt: Week 1 aur Week 2 ka average saare 4 subjects mein cut-off tak hona chahiye.\n• Agar cut-off nahi mila, to 2nd attempt mein Week 1–3 mein se best 2 ka average lagta hai.\n\nCut-off: General 40%, OBC-NCL / EWS 35%, SC / ST / PwD (40% disability) 30%.\n\nSirf eligible students ko in-person proctored exam ka hall ticket milta hai. Week 2 ke baad lagbhag 70% applicants hi eligible hote hain, isliye jaldi shuru karo.'
        )),
        leaf('exam.pass', t('How many marks to pass?', 'Pass hone ke liye kitne marks chahiye?'), t(
          'To clear the Qualifier exam you need a minimum per subject AND a minimum average:\n• General: 40% per subject, 50% average\n• OBC-NCL / EWS: 35% per subject, 45% average\n• SC / ST / PwD (40%): 30% per subject, 40% average',
          'Qualifier exam clear karne ke liye har subject mein minimum marks AUR minimum average chahiye:\n• General: har subject 40%, average 50%\n• OBC-NCL / EWS: har subject 35%, average 45%\n• SC / ST / PwD (40%): har subject 30%, average 40%'
        )),
        leaf('exam.hall', t('How do I get my hall ticket?', 'Hall ticket kaise milega?'), t(
          'If you meet the eligibility criteria, your hall ticket is made available on the course portal. Download it, check the exam centre and timings, and read the instructions on it before exam day.',
          'Agar aap eligibility criteria meet karte ho, to hall ticket course portal par milega. Use download karo, exam centre aur timings check karo, aur exam se pehle us par likhe instructions padho.'
        )),
        leaf('exam.after', t('After the Qualifier: what next?', 'Qualifier ke baad kya?'), t(
          'If you clear the Qualifier you can register for the Foundation Level.\n• 1st-attempt qualifiers can register in the same term (the Qualifier score counts as Quiz 1) or in the next 2 terms.\n• 2nd-attempt qualifiers register from the next term.\n• The Qualifier is valid for 3 terms. After that you repeat the process.\n• There is no limit on attempts.',
          'Qualifier clear karne par aap Foundation Level ke liye register kar sakte ho.\n• 1st attempt wale usi term mein (Qualifier score Quiz 1 ban jata hai) ya agle 2 terms mein register kar sakte hain.\n• 2nd attempt wale agle term se register karte hain.\n• Qualifier 3 terms tak valid rehta hai. Uske baad process dobara karna padta hai.\n• Attempts ki koi limit nahi.'
        )),
      ]),
      sub('exam.g-term', t('Quizzes & final exam', 'Quizzes aur final exam'), [
        leaf('exam.final', t('Am I eligible for the final exam?', 'Kya main final exam de sakta/sakti hoon?'), t(
          'To write the final exam, the average of your best 5 out of the first 7 weekly assignment scores must be 40/100 or more, AND you must attend at least one of the 2 quizzes. Please see the grading document for further details.',
          'Final exam likhne ke liye, pehle 7 weeks ke weekly assignments mein se aapke best 5 ka average 40/100 ya usse zyada hona chahiye, AUR 2 quizzes mein se kam se kam ek quiz attend karna zaroori hai. Zyada details ke liye grading document dekho.'
        )),
        leaf('exam.how', t('How do quizzes and the end-term work?', 'Quizzes aur end-term kaise hote hain?'), t(
          'Note: passing marks and score rules can change and we might be wrong, so please check the updated Student Handbook using the button above.\n\nEach course has:\n• Weekly assignments (best 5 of the first 7 decide your final-exam eligibility)\n• 2 proctored quizzes, after Week 4 (covers Weeks 1–4) and after Week 8 (covers Weeks 1–8). You must attend at least one. A missed quiz scores 0 and there is no make-up quiz.\n• End-term exam: 1.5 hours per course, held on a Sunday, worth 50% of your total score.',
          'Note: passing marks aur score ke rules badal sakte hain aur hamse galti ho sakti hai, isliye updated Student Handbook upar wale button se zaroor check karo.\n\nHar course mein:\n• Weekly assignments (pehle 7 mein se best 5 final exam ki eligibility decide karte hain)\n• 2 proctored quizzes: Week 4 ke baad (Week 1–4) aur Week 8 ke baad (Week 1–8). Kam se kam ek attend karna zaroori hai. Miss kiya to 0 milta hai aur make-up quiz nahi hota.\n• End-term exam: har course ka 1.5 ghanta, Sunday ko, total score ka 50%.'
        ), HANDBOOK_LINK),
        leaf('exam.missed', t('I missed the end-term exam', 'Mera end-term exam miss ho gaya'), t(
          'If you were absent only for the end-term exam you get an "I" (incomplete) and can write a make-up exam once. If you take it in the very next term, your quiz average carries over. If you skip it, you must repeat the whole course.',
          'Agar aap sirf end-term exam mein absent the, to "I" (incomplete) grade milta hai aur aap ek baar make-up exam de sakte ho. Agle hi term mein dene par quiz average carry over hota hai. Nahi diya to poora course dobara karna padega.'
        )),
        leaf('exam.prep', t('How do I prepare?', 'Preparation kaise karein?'), t(
          'Keep going with the course videos, practice questions and other resources on the portal. Join the live sessions to clear your doubts, and read the instructions on your hall ticket before the exam.',
          'Portal par course videos, practice questions aur baaki resources se padhte raho. Doubts clear karne ke liye live sessions attend karo, aur exam se pehle hall ticket ke instructions padho.'
        )),
      ]),
      sub('exam.g-grade', t('Grades & results', 'Grades aur results'), [
        leaf('exam.grades', t('Grading scale', 'Grading scale'), t(
          'Total score T (out of 100):\n• 90+ = S (10 points)\n• 80–89 = A (9)\n• 70–79 = B (8)\n• 60–69 = C (7)\n• 50–59 = D (6)\n• 40–49 = E (4)\n• Below 40 = U, fail (0)\nWA / WQ means your weekly average was below 40 or you attended no quiz, so you could not sit the final exam.',
          'Total score T (100 mein se):\n• 90+ = S (10 points)\n• 80–89 = A (9)\n• 70–79 = B (8)\n• 60–69 = C (7)\n• 50–59 = D (6)\n• 40–49 = E (4)\n• 40 se kam = U, fail (0)\nWA / WQ ka matlab weekly average 40 se kam tha ya koi quiz attend nahi kiya, isliye final exam nahi de sake.'
        )),
        leaf('exam.repeat', t('Repeat or improve a course', 'Course repeat ya improve karna'), t(
          '• Failed (U) or not eligible (WA / WQ): repeat the whole course and redo assignments, quizzes and the end-term.\n• Improving a pass grade (A–E): you redo everything and the highest score counts. Only allowed within the same level; once you move to the next level your CGPA freezes.',
          '• Fail (U) ya not eligible (WA / WQ): poora course dobara karo, assignments, quizzes aur end-term phir se.\n• Pass grade (A–E) improve karna: sab dobara karna hoga aur highest score count hota hai. Sirf usi level mein allowed hai; agle level mein jaane par CGPA freeze ho jata hai.'
        )),
        leaf('exam.drop', t('Dropping a course', 'Course drop karna'), t(
          'You can drop a course only within 4 weeks of the term start.',
          'Course sirf term shuru hone ke 4 hafte ke andar drop kar sakte ho.'
        )),
      ]),
      sub('exam.g-dates', t('Exam dates', 'Exam dates'), [
        leaf('exam.qdate', t('Qualifier date and syllabus', 'Qualifier ki date aur syllabus'), t(
          'The Qualifier exam is on 15 November 2026 (it is the Quiz 1 date of the Sep 2026 term). The syllabus is Week 1 to Week 4.',
          'Qualifier exam 15 November 2026 ko hai (yeh Sep 2026 term ke Quiz 1 ki date hai). Syllabus Week 1 se Week 4 tak hai.'
        )),
        leaf('exam.sep26', t('Sep 2026 term dates', 'Sep 2026 term ki dates'), t(
          'Sep 2026 term:\n• Term starts: 2 Oct 2026\n• Quiz 1: 15 Nov\n• Programming Quiz 1: 22 Nov\n• Quiz 2: 5 Dec (Saturday)\n• Programming Quiz 2: 20 Dec and 3 Jan 2027\n• End-term exam: 10 Jan 2027',
          'Sep 2026 term:\n• Term shuru: 2 Oct 2026\n• Quiz 1: 15 Nov\n• Programming Quiz 1: 22 Nov\n• Quiz 2: 5 Dec (Saturday)\n• Programming Quiz 2: 20 Dec aur 3 Jan 2027\n• End-term exam: 10 Jan 2027'
        )),
        leaf('exam.jan27', t('Jan 2027 term dates', 'Jan 2027 term ki dates'), t(
          'Qualifier applications for the Jan 2027 term are open. Last date to apply: 29 January 2027.\n\nJan 2027 term:\n• Term starts: 5 Feb 2027\n• Quiz 1: 14 Mar\n• Programming Quiz 1: 27 and 28 Mar\n• Quiz 2: 11 Apr\n• Programming Quiz 2: 25 Apr and 2 May\n• End-term exam: 9 May 2027',
          'Jan 2027 term ke Qualifier ke applications khule hain. Apply karne ki last date: 29 January 2027.\n\nJan 2027 term:\n• Term shuru: 5 Feb 2027\n• Quiz 1: 14 Mar\n• Programming Quiz 1: 27 aur 28 Mar\n• Quiz 2: 11 Apr\n• Programming Quiz 2: 25 Apr aur 2 May\n• End-term exam: 9 May 2027'
        )),
      ]),
    ],
  },
}
FLAT_TREE.options!.push(EXAM_OPTION)

const PROG_OPTION: GenieOption = {
  id: 'prog', label: t('Programme rules', 'Programme ke rules'),
  next: {
    id: 'prog', q: t('What do you want to know?', 'Kya jaanna hai?'),
    options: [
      sub('prog.g-courses', t('Courses & timelines', 'Courses aur timelines'), [
        leaf('prog.ccc', t('How many courses per term?', 'Ek term mein kitne courses?'), t(
        'The number of courses you can take (CCC) depends on your results. Term 1 uses your Qualifier marks; later terms use the average of the courses you passed. Below 50 average: 2 courses. 50 to 69: 3 courses. 70 or more: 4 courses. For Foundation learners this is only a recommendation. At most 4 final exams can be taken in one term. From the Diploma level onwards your CCC is always 4.',
        'Aap kitne courses le sakte ho (CCC) yeh aapke results par depend karta hai. Term 1 mein Qualifier marks lagte hain; baad ke terms mein pass kiye courses ka average. 50 se kam average: 2 courses. 50 se 69: 3 courses. 70 ya zyada: 4 courses. Foundation learners ke liye yeh sirf recommendation hai. Ek term mein maximum 4 final exams de sakte ho. Diploma level se aage aapka CCC hamesha 4 hota hai.'
      )),
        leaf('prog.time', t('Time limits & checkpoints', 'Time limits aur checkpoints'), t(
        'Foundation (admitted from May 2024): finish all 8 courses within 9 terms. At least 4 courses by term 4 and 6 courses by term 6, otherwise you can be removed. Warnings start from term 3.\n\nDiploma: finish within 12 terms. Checkpoints: term 3 = 3 courses + 1 project (else a warning), term 6 = 6 + 2, term 9 = 9 + 3, term 12 = 12 + 4. Missing the checkpoints from term 6 can lead to removal. Skipped terms count.',
        'Foundation (May 2024 se admitted): saare 8 courses 9 terms ke andar poore karo. Term 4 tak kam se kam 4 courses aur term 6 tak 6 courses, nahi to removal ho sakta hai. Warning term 3 se shuru hoti hai.\n\nDiploma: 12 terms ke andar poora karo. Checkpoints: term 3 = 3 courses + 1 project (nahi to warning), term 6 = 6 + 2, term 9 = 9 + 3, term 12 = 12 + 4. Term 6 se checkpoints miss karne par removal ho sakta hai. Skip kiye terms bhi count hote hain.'
      )),
        leaf('prog.prereq', t('Course prerequisites & pace', 'Course prerequisites aur pace'), t(
          'Foundation prerequisites: Maths 2 needs Maths 1. Statistics 2 needs Statistics 1 and Maths 2 (Maths 2 first, or both together). English 2 needs English 1. Intro to Python needs Computational Thinking. All 8 Foundation courses must be done before any Year 2 Diploma course.\n\nDiploma pace: fastest is 4 terms (full-time, about 70 hours a week), comfortable is 6 terms (about 40 hours a week), and the maximum for both Diplomas is 12 terms.',
          'Foundation prerequisites: Maths 2 ke liye Maths 1. Statistics 2 ke liye Statistics 1 aur Maths 2 (pehle Maths 2, ya dono saath mein). English 2 ke liye English 1. Intro to Python ke liye Computational Thinking. Year 2 ka koi bhi Diploma course lene se pehle saare 8 Foundation courses poore hone chahiye.\n\nDiploma pace: sabse tez 4 terms (full-time, lagbhag 70 ghante hafta), aaram se 6 terms (lagbhag 40 ghante hafta), aur dono Diplomas ke liye maximum 12 terms.'
        )),
        leaf('prog.project', t('Projects & degree entry', 'Projects aur degree entry'), t(
          'MAD1, MAD2 and MLP projects: after your app or Kaggle checks you get an L1 viva. Below cut-off X you resubmit; between X and Y you get a D or E with no L2 viva; at Y or above you go to the L2 viva (one retry if you fail, then the grade comes from L1). A BDM project made from web-scraped data is capped at D.\n\nProject improvement is allowed only after all 12 Diploma courses are done and only if you missed the degree-entry cut-off. You can improve more than one project, even in the same term. If an attempt ends in U or I, your earlier pass grade stays.\n\nDegree entry needs a Diploma CGPA of 6.0 or more and a project CGPA of 7.0 or more. If you joined from May 2026, Foundation plus Diploma must be finished within 15 terms.',
          'MAD1, MAD2 aur MLP projects: app ya Kaggle checks ke baad L1 viva hota hai. Cut-off X se kam score par dobara submit karna hota hai; X aur Y ke beech D ya E milta hai bina L2 viva ke; Y ya usse upar L2 viva hota hai (fail hone par ek retry, phir grade L1 se aata hai). Web-scraped data wala BDM project maximum D tak hi jata hai.\n\nProject improvement sirf tab hota hai jab saare 12 Diploma courses ho chuke hon aur degree-entry cut-off miss hua ho. Ek se zyada project improve kar sakte ho, ek hi term mein bhi. Agar attempt U ya I mein khatam ho, to pehla pass grade hi rehta hai.\n\nDegree entry ke liye Diploma CGPA 6.0 ya zyada aur project CGPA 7.0 ya zyada chahiye. May 2026 se join karne walon ko Foundation aur Diploma 15 terms ke andar poora karna hoga.'
        )),
      ]),
      sub('prog.g-status', t('Status, certificates & alumni', 'Status, certificates aur alumni'), [
        leaf('prog.status', t('Probation & quitting', 'Probation aur quit karna'), t(
          '• Active: you are registered for courses in the term.\n• Academic probation: you registered for no courses. Up to 2 terms in a row are allowed.\n• Struck off the rolls: 2 consecutive probation terms with no registration. Email is suspended. Struck off twice means removal.\n• Quit: use the "I quit the programme" option on the dashboard. The official email is suspended and it cannot be reversed.\n• Alumnus: after completing BSc or BS and quitting. Foundation or Diploma completers get "FL certified" or "DS / DP / Both diplomas certified" instead. Diploma exit does not give alumni status. The exit form deadline (12 January) also applies to Diploma exit.',
          '• Active: aap us term mein courses ke liye registered ho.\n• Academic probation: aapne koi course register nahi kiya. Lagatar 2 terms tak allowed hai.\n• Struck off the rolls: lagatar 2 probation terms bina registration ke. Email suspend ho jata hai. Do baar struck off hone par removal.\n• Quit: dashboard par "I quit the programme" option use karo. Official email suspend ho jata hai aur wapas nahi hota.\n• Alumnus: BSc ya BS poora karke quit karne ke baad. Foundation ya Diploma poora karne walon ko "FL certified" ya "DS / DP / Both diplomas certified" milta hai. Diploma exit par alumni status nahi milta. Exit form ki deadline (12 January) Diploma exit par bhi lagti hai.'
        )),
        leaf('prog.cert', t('Original certificate & alumni card', 'Original certificate aur alumni card'), t(
          'The original certificate needs Senate approval. You need all credits and mandatory degree courses done, at least 9 terms (BSc) or 12 terms (BS), and an exit form with a professional photo and your Class X or XII certificate, plus alumni registration.\n\nSenate dates: 12 Jun 2026 (form closed 28 Apr, certificate about 15 Sep 2026); 21 Aug 2026 (form 20 Jun to 15 Jul, about 25 Nov 2026); 23 Oct 2026 (form 15 Aug to 15 Sep, about 28 Jan 2027).\n\nThe alumni card is for BSc / BS completers and takes about 30 days to arrive.',
          'Original certificate ke liye Senate approval chahiye. Saare credits aur mandatory degree courses poore hone chahiye, kam se kam 9 terms (BSc) ya 12 terms (BS), aur exit form professional photo aur Class X ya XII certificate ke saath, saath mein alumni registration.\n\nSenate dates: 12 Jun 2026 (form 28 Apr ko band, certificate lagbhag 15 Sep 2026); 21 Aug 2026 (form 20 Jun se 15 Jul, lagbhag 25 Nov 2026); 23 Oct 2026 (form 15 Aug se 15 Sep, lagbhag 28 Jan 2027).\n\nAlumni card BSc / BS poora karne walon ke liye hai aur aane mein lagbhag 30 din lagte hain.'
        )),
        leaf('prog.docs', t('Transcripts & Advanced Certificate', 'Transcripts aur Advanced Certificate'), t(
          'You get a term-wise progress card (every attempt) and a grade card (best grade per course). Transcripts and bonafide certificates are issued every Thursday after an eligibility check. From January 2026 a credit completion letter is issued for each completed level, and provisional certificates are available by writing to academic.documents@study.iitm.ac.in.\n\nIf you finish all 6 theory courses of a Diploma but a project is pending, you get an Advanced Certificate by default: "Advanced Certificate in Programming and Application Development" or "Advanced Certificate in Machine Learning and Data Science".',
          'Aapko term-wise progress card (har attempt) aur grade card (har course ka best grade) milta hai. Transcripts aur bonafide certificates har Thursday eligibility check ke baad issue hote hain. January 2026 se har complete level par credit completion letter milta hai, aur provisional certificate academic.documents@study.iitm.ac.in par likhkar mil sakta hai.\n\nAgar aap Diploma ke saare 6 theory courses poore kar lo par koi project pending ho, to default mein Advanced Certificate milta hai: "Advanced Certificate in Programming and Application Development" ya "Advanced Certificate in Machine Learning and Data Science".'
        )),
        leaf('prog.prize', t('Prizes & merit certificates', 'Prizes aur merit certificates'), t(
          'Awards are given at Foundation + 2 Diplomas (86 credits) and at BS completion (142 credits): Certificate of Merit for CGPA 9.00 to 9.50, Certificate of Academic Distinction for 9.50 and above, and Certificate of Academic Excellence for the highest CGPA (the number of awardees is set by the Steering Committee), with a medal. You need a clean academic and disciplinary record.',
          'Awards Foundation + 2 Diplomas (86 credits) aur BS completion (142 credits) par diye jate hain: CGPA 9.00 se 9.50 par Certificate of Merit, 9.50 aur upar par Certificate of Academic Distinction, aur sabse high CGPA par Certificate of Academic Excellence (kitne log honge, yeh Steering Committee tay karti hai), medal ke saath. Academic aur disciplinary record clean hona chahiye.'
        )),
      ]),
      sub('prog.g-future', t('After the programme', 'Programme ke baad'), [
        leaf('prog.masters', t('MTech, MS & PG Diploma routes', 'MTech, MS aur PG Diploma ke raaste'), t(
          'MTech is course and project based (2 years); MS is research based (2.5 to 3 years). Ways in:\n• GATE score: apply to IITM or other institutes (stipend, and PSU jobs too).\n• CFTI-based MS: BS CGPA of 8.0 or more, then a test or interview (stipend).\n• Project staff route: two approved IITM courses with CGPA 7.5 or more and at least a C in each.\n• Upgrade to on-campus MS: 106 credits and CGPA 8 or more.\n• Online PG Diploma or MTech: after 106 credits with CGPA 8.00 or more. PG Diploma needs 20 more credits; MTech needs 20 credits plus a 20-credit project.',
          'MTech course aur project based hai (2 saal); MS research based hai (2.5 se 3 saal). Raaste:\n• GATE score: IITM ya dusre institutes mein apply karo (stipend, aur PSU jobs bhi).\n• CFTI-based MS: BS CGPA 8.0 ya zyada, phir test ya interview (stipend).\n• Project staff route: do approved IITM courses CGPA 7.5 ya zyada aur har mein kam se kam C.\n• On-campus MS mein upgrade: 106 credits aur CGPA 8 ya zyada.\n• Online PG Diploma ya MTech: 106 credits ke baad CGPA 8.00 ya zyada ke saath. PG Diploma ke liye 20 aur credits; MTech ke liye 20 credits aur 20 credit ka project.'
        )),
        leaf('prog.apprentice', t('Apprenticeship', 'Apprenticeship'), t(
          'Apprenticeship at BS level is optional and can earn up to 12 credits: under 4 months gives 0, 4 to under 8 months gives 4, and 8 months gives 12. You can take at most 2 courses a term during it. Steps: company approval (pre-approved list, or the committee), reporting manager details, weekly work logs, a review after 4 weeks, and an exit after 4 months is possible with a company letter.',
          'BS level par apprenticeship optional hai aur 12 credits tak mil sakte hain: 4 mahine se kam par 0, 4 se 8 mahine se kam par 4, aur 8 mahine par 12. Iske dauran ek term mein maximum 2 courses le sakte ho. Steps: company approval (pre-approved list ya committee), reporting manager ki details, weekly work logs, 4 hafte baad review, aur 4 mahine ke baad company letter ke saath exit possible hai.'
        )),
        leaf('prog.reentry', t('Re-entry after exiting', 'Exit ke baad dobara join karna'), t(
          'If you exited with an original certificate and want to continue, you write re-admission final exams on the term final-exam date:\n• Programming Diploma to DS Diploma: MAD2, PDSA\n• DS Diploma to Programming Diploma: MLT, MLP\n• Both Diplomas to BSc: MAD2, PDSA, MLT, MLP\n• BSc to BS (or BS to PG Diploma): Deep Learning, AI, Software Engineering, Software Testing\n• PG Diploma to MTech: MLOps, Mathematical Foundations of GenAI, Algorithms for Data Science\nScoring below 50% in a subject makes it a pending course. Time away is not counted in your time limit.',
          'Agar aapne original certificate ke saath exit kiya tha aur aage badhna chahte ho, to term ki final-exam date par re-admission final exams dene hote hain:\n• Programming Diploma se DS Diploma: MAD2, PDSA\n• DS Diploma se Programming Diploma: MLT, MLP\n• Dono Diplomas se BSc: MAD2, PDSA, MLT, MLP\n• BSc se BS (ya BS se PG Diploma): Deep Learning, AI, Software Engineering, Software Testing\n• PG Diploma se MTech: MLOps, Mathematical Foundations of GenAI, Algorithms for Data Science\nKisi subject mein 50% se kam aane par woh pending course ban jata hai. Gap ke terms time limit mein count nahi hote.'
        )),
      ]),
      sub('prog.g-help', t('Transfers, system & contact', 'Transfers, system aur contact'), [
        leaf('prog.transfer', t('Credit transfer (NPTEL / campus)', 'Credit transfer (NPTEL / campus)'), t(
          'NPTEL: 4, 8 and 12 week courses give 1, 2 and 3 credits (only approved SWAYAM courses, pass / fail, no CGPA effect). Limits: 4 NPTEL credits at BSc, 4 HS / MG credits at BS, 8 NPTEL credits in total.\n\nOn-campus courses need Foundation + 2 Diplomas done and CGPA 8 or more: up to 4 courses from one institute and 24 credits overall (3 campus credits = 1 BS credit). Plan transfers one term before finishing a level.',
          'NPTEL: 4, 8 aur 12 hafte ke courses se 1, 2 aur 3 credits milte hain (sirf approved SWAYAM courses, pass / fail, CGPA par asar nahi). Limits: BSc mein 4 NPTEL credits, BS mein 4 HS / MG credits, kul 8 NPTEL credits.\n\nOn-campus courses ke liye Foundation + 2 Diplomas poore aur CGPA 8 ya zyada chahiye: ek institute se maximum 4 courses aur kul 24 credits (3 campus credits = 1 BS credit). Level poora karne se ek term pehle transfer plan karo.'
        )),
        leaf('prog.system', t('Laptop & internet needed', 'Laptop aur internet'), t(
          'Minimum: 8 GB RAM, Intel 8th Gen or AMD 4th Gen processor (or better), 500 GB storage (1 TB and SSD preferred), a 13 inch laptop or 15 inch desktop at 1080p, webcam, microphone and speaker. Windows 10, Ubuntu 20.04 LTS or macOS Mojave (or newer), the latest Chrome with a Google account, and internet of at least 2 Mbps. Proctored exams also need a phone with a front camera. The system compatibility test is mandatory.',
          'Minimum: 8 GB RAM, Intel 8th Gen ya AMD 4th Gen processor (ya behtar), 500 GB storage (1 TB aur SSD better), 13 inch laptop ya 15 inch desktop 1080p par, webcam, microphone aur speaker. Windows 10, Ubuntu 20.04 LTS ya macOS Mojave (ya naya), latest Chrome Google account ke saath, aur kam se kam 2 Mbps internet. Proctored exams ke liye front camera wala phone bhi chahiye. System compatibility test mandatory hai.'
        )),
        leaf('prog.escalate', t('Who do I contact for a problem?', 'Problem ke liye kisse contact karein?'), t(
        'Step 1: raise a ticket on the official Student Support Portal and wait at least 24 hours. Step 2: if there is no reply, follow up on the same ticket (do not open a new one). Step 3: if it is still unresolved, escalate in order: Level 1 support team, Level 2, then the BS Degree Programme Coordinators, the Dean (Academics) and the Director. Always quote your ticket number. The contact details are in the Student Handbook.',
        'Step 1: official Student Support Portal par ticket raise karo aur kam se kam 24 ghante ruko. Step 2: reply na aaye to usi ticket par follow up karo (naya ticket mat kholo). Step 3: phir bhi solve na ho to is order mein escalate karo: Level 1 support team, Level 2, phir BS Degree Programme Coordinators, Dean (Academics) aur Director. Escalate karte waqt hamesha apna ticket number likho. Contact details Student Handbook mein hain.'
      )),
        leaf('prog.contact', t('IITM programme contact details', 'IITM programme ke contact details'), t(
          'Email: support@study.iitm.ac.in\nPhone: 7850999966\nAddress: IITM BS Degree Office, 3rd Floor, ICSR Building, IIT Madras, Chennai 600036\n\nUse only these for programme queries. Response time is about 3 working days. In peak periods Google Meet links are shared and call waits can be longer.',
          'Email: support@study.iitm.ac.in\nPhone: 7850999966\nAddress: IITM BS Degree Office, 3rd Floor, ICSR Building, IIT Madras, Chennai 600036\n\nProgramme ke sawaalon ke liye sirf yahi use karo. Response time lagbhag 3 working days hai. Peak time mein Google Meet links share hote hain aur call par wait zyada ho sakta hai.'
        )),
      ]),
    ],
  },
}

FLAT_TREE.options!.push(PROG_OPTION)

// ── IITM courses & syllabus (from the official IITM BS Academics and course pages, 11 Nov 2026; no fee content) ──
const wk = (weeks: string[]) => weeks.map((w, i) => `Week ${i + 1}: ${w}`).join('\n')
const sylLeaf = (id: string, label: string, name: string, code: string, by: string, pre: L, weeks: string[]) => leaf(
  id, t(`${label} syllabus`, `${label} ka syllabus`),
  t(`${name} (${code})\n4 credits · ${pre.en} · by ${by}\n\n${wk(weeks)}`, `${name} (${code})\n4 credits · ${pre.hi} · ${by}\n\n${wk(weeks)}`)
)
const NO_PRE = t('No prerequisites', 'Koi prerequisite nahi')

const SYL_OPTION: GenieOption = {
  id: 'syl', label: t('IITM courses & syllabus', 'IITM courses aur syllabus'),
  next: {
    id: 'syl', q: t('What do you want to know?', 'Kya jaanna hai?'),
    options: [
      sub('syl.g-structure', t('Levels, credits & terms', 'Levels, credits aur terms'), [
        leaf('syl.levels', t('Levels of the programme', 'Programme ke levels'), t(
          'The IIT Madras BS programme has 6 levels. To earn the BS in Data Science and Applications you complete the first 4.\n\n1. Foundation: 32 credits, 8 courses (entry through the Qualifier)\n2. Diploma: 54 credits (Programming and Data Science, 27 credits each; direct admission to Diploma is also possible)\n3. BSc Degree: 28 credits\n4. BS Degree: 28 credits (optional apprenticeship)\n5. PG Diploma: 20 credits\n6. MTech: 20 credit project\n\nYou can exit at any level:\n• After Foundation: Foundation Certificate from IITM CODE\n• After Diploma: Diploma in Programming and / or Data Science\n• After BSc level: BSc in Programming and Data Science\n• After BS level: BS in Data Science and Applications\n• After PG Diploma: PG Diploma in AI and ML\n• After MTech: MTech in AI and ML',
          'IIT Madras BS programme mein 6 levels hain. BS in Data Science and Applications ke liye pehle 4 levels poore karne hote hain.\n\n1. Foundation: 32 credits, 8 courses (Qualifier ke through entry)\n2. Diploma: 54 credits (Programming aur Data Science, har ek 27 credits; Diploma mein direct admission bhi possible hai)\n3. BSc Degree: 28 credits\n4. BS Degree: 28 credits (optional apprenticeship)\n5. PG Diploma: 20 credits\n6. MTech: 20 credit ka project\n\nKisi bhi level par exit kar sakte ho:\n• Foundation ke baad: IITM CODE ka Foundation Certificate\n• Diploma ke baad: Diploma in Programming aur / ya Data Science\n• BSc level ke baad: BSc in Programming and Data Science\n• BS level ke baad: BS in Data Science and Applications\n• PG Diploma ke baad: PG Diploma in AI and ML\n• MTech ke baad: MTech in AI and ML'
        )),
        leaf('syl.credits', t('Credits & time to finish', 'Credits aur kitna time lagta hai'), t(
          'Total credits needed:\n• BSc Degree: 114\n• BS Degree: 142\n• PG Diploma in AI & ML: 162 (BS + PG Diploma)\n• MTech in AI & ML: 182 (BS + PG Diploma + MTech)\n\nTime: up to 8 years, at your own pace. Expect about 10 hours per course per week in Foundation and about 15 in later levels.\n• Foundation: 1 to 3 years\n• Diploma: 1 to 2 years each\n• BSc / BS Degree: 1 to 2 years each\n• PG Diploma: 1 to 2 years\n• MTech: up to 8 years from the start of Foundation\nTerm-wise limits are under Programme rules > Time limits & checkpoints.',
          'Total credits chahiye:\n• BSc Degree: 114\n• BS Degree: 142\n• PG Diploma in AI & ML: 162 (BS + PG Diploma)\n• MTech in AI & ML: 182 (BS + PG Diploma + MTech)\n\nTime: 8 saal tak, apni pace par. Foundation mein har course ke liye lagbhag 10 ghante hafta aur baad ke levels mein lagbhag 15 ghante.\n• Foundation: 1 se 3 saal\n• Diploma: har ek 1 se 2 saal\n• BSc / BS Degree: har ek 1 se 2 saal\n• PG Diploma: 1 se 2 saal\n• MTech: Foundation shuru karne se 8 saal tak\nTerm-wise limits Programme rules > Time limits & checkpoints mein hain.'
        )),
        leaf('syl.terms', t('How a term works', 'Ek term kaise chalta hai'), t(
          'A year has 3 terms of 4 months each: January, May and September.\n\nEvery term has:\n• 12 weeks of coursework: video lectures, practice questions, text transcripts and graded online assignments (about 2 to 3 hours of videos a week per course)\n• 2 in-person invigilated quizzes\n• End-term exams in the 4th month\nDepending on the course there can also be programming exams, mini projects, vivas or take-home assignments.',
          'Ek saal mein 3 terms hote hain, har ek 4 mahine ka: January, May aur September.\n\nHar term mein:\n• 12 hafte ka coursework: video lectures, practice questions, text transcripts aur graded online assignments (har course ke liye hafte mein lagbhag 2 se 3 ghante ke videos)\n• 2 in-person invigilated quizzes\n• 4th mahine mein end-term exams\nCourse ke hisaab se programming exams, mini projects, vivas ya take-home assignments bhi ho sakte hain.'
        )),
        leaf('syl.progress', t('Moving to the next level', 'Agle level mein kaise jayein'), t(
          '• Foundation: complete all 8 courses before any Diploma course.\n• Diploma: complete all courses and projects before any Degree level course.\n• BS Degree: complete all courses before the PG Diploma level (CGPA 8.0 or more is needed to upgrade).\n• PG Diploma: complete all courses before the MTech level.\n\nEach term you can register for up to 4 courses, depending on your CCC (Credit Clearing Capability). In Foundation your CCC comes from your Qualifier result or the previous end-term results. From the Diploma level onwards it is 4.',
          '• Foundation: kisi bhi Diploma course se pehle saare 8 courses poore karo.\n• Diploma: kisi bhi Degree level course se pehle saare courses aur projects poore karo.\n• BS Degree: PG Diploma level se pehle saare courses poore karo (upgrade ke liye CGPA 8.0 ya zyada chahiye).\n• PG Diploma: MTech level se pehle saare courses poore karo.\n\nHar term mein aap apne CCC (Credit Clearing Capability) ke hisaab se maximum 4 courses register kar sakte ho. Foundation mein CCC aapke Qualifier result ya pichhle end-term results se banta hai. Diploma level se aage yeh 4 hota hai.'
        )),
      ]),
      sub('syl.g-courses', t('Courses by level', 'Level ke hisaab se courses'), [
        leaf('syl.found', t('Foundation courses (8)', 'Foundation courses (8)'), t(
          'Foundation Level: 32 credits, 8 courses of 4 credits each.\n\n• Mathematics for Data Science I (BSMA1001): no prerequisite\n• Statistics for Data Science I (BSMA1002): no prerequisite\n• Computational Thinking (BSCS1001): no prerequisite\n• English I (BSHS1001): no prerequisite\n• Mathematics for Data Science II (BSMA1003): needs BSMA1001\n• Statistics for Data Science II (BSMA1004): needs BSMA1002 and BSMA1001, with BSMA1003 taken together\n• Programming in Python (BSCS1002): needs BSCS1001\n• English II (BSHS1002): needs BSHS1001\n\nPass all 8 to exit with a Foundation Certificate or move on to the Diploma level.',
          'Foundation Level: 32 credits, 8 courses, har ek 4 credits ka.\n\n• Mathematics for Data Science I (BSMA1001): koi prerequisite nahi\n• Statistics for Data Science I (BSMA1002): koi prerequisite nahi\n• Computational Thinking (BSCS1001): koi prerequisite nahi\n• English I (BSHS1001): koi prerequisite nahi\n• Mathematics for Data Science II (BSMA1003): BSMA1001 chahiye\n• Statistics for Data Science II (BSMA1004): BSMA1002 aur BSMA1001 chahiye, BSMA1003 saath mein\n• Programming in Python (BSCS1002): BSCS1001 chahiye\n• English II (BSHS1002): BSHS1001 chahiye\n\nSaare 8 pass karke Foundation Certificate ke saath exit kar sakte ho ya Diploma level mein ja sakte ho.'
        )),
        sub('syl.g-diploma', t('Diploma courses', 'Diploma courses'), [
          leaf('syl.dprog', t('Diploma in Programming', 'Diploma in Programming'), t(
            'Diploma in Programming: 27 credits, 6 courses + 2 projects. All 8 Foundation courses must be done first. It builds a base in databases and programming, with data structures and algorithms, and ends with building a web application.\n\n• Database Management Systems (BSCS2001), 4 credits\n• Programming, Data Structures and Algorithms using Python (BSCS2002), 4\n• Modern Application Development I (BSCS2003), 4, taken together with BSCS2001\n• Modern Application Development I - Project (BSCS2003P), 2, taken together with BSCS2003\n• Programming Concepts using Java (BSCS2005), 4\n• Modern Application Development II (BSCS2006), 4, needs BSCS2003\n• Modern Application Development II - Project (BSCS2006P), 2, needs BSCS2003P, taken together with BSCS2006\n• System Commands (BSSE2001), 3',
            'Diploma in Programming: 27 credits, 6 courses + 2 projects. Pehle saare 8 Foundation courses poore hone chahiye. Isme databases aur programming ki base banti hai, data structures aur algorithms ke saath, aur end mein web application banate ho.\n\n• Database Management Systems (BSCS2001), 4 credits\n• Programming, Data Structures and Algorithms using Python (BSCS2002), 4\n• Modern Application Development I (BSCS2003), 4, BSCS2001 ke saath\n• Modern Application Development I - Project (BSCS2003P), 2, BSCS2003 ke saath\n• Programming Concepts using Java (BSCS2005), 4\n• Modern Application Development II (BSCS2006), 4, BSCS2003 chahiye\n• Modern Application Development II - Project (BSCS2006P), 2, BSCS2003P chahiye, BSCS2006 ke saath\n• System Commands (BSSE2001), 3'
          )),
          leaf('syl.dds', t('Diploma in Data Science', 'Diploma in Data Science'), t(
            'Diploma in Data Science: 27 credits (September 2025 term onwards). All 8 Foundation courses must be done first.\n\nMandatory, 21 credits:\n• Machine Learning Foundations (BSCS2004), 4\n• Business Data Management (BSMS2001), 4\n• Machine Learning Techniques (BSCS2007), 4, taken together with BSCS2004\n• Machine Learning Practice (BSCS2008), 4, needs BSCS2004 and BSCS2007\n• Machine Learning Practice - Project (BSCS2008P), 2, taken together with BSCS2008\n• Tools in Data Science (BSSE2002), 3, taken together with BSCS2008\n\nRemaining 6 credits, choose one track:\n• Option 1: Business Analytics (BSMS2002, needs BSMS2001) + BDM Project (BSMS2001P)\n• Option 2: Introduction to Deep Learning and Generative AI (BSDA2001) + its Project (BSDA2001P)',
            'Diploma in Data Science: 27 credits (September 2025 term se). Pehle saare 8 Foundation courses poore hone chahiye.\n\nMandatory, 21 credits:\n• Machine Learning Foundations (BSCS2004), 4\n• Business Data Management (BSMS2001), 4\n• Machine Learning Techniques (BSCS2007), 4, BSCS2004 ke saath\n• Machine Learning Practice (BSCS2008), 4, BSCS2004 aur BSCS2007 chahiye\n• Machine Learning Practice - Project (BSCS2008P), 2, BSCS2008 ke saath\n• Tools in Data Science (BSSE2002), 3, BSCS2008 ke saath\n\nBaaki 6 credits ke liye ek track chuno:\n• Option 1: Business Analytics (BSMS2002, BSMS2001 chahiye) + BDM Project (BSMS2001P)\n• Option 2: Introduction to Deep Learning and Generative AI (BSDA2001) + uska Project (BSDA2001P)'
          )),
        ]),
        leaf('syl.degree', t('BSc & BS level courses', 'BSc aur BS level courses'), t(
          'BSc level (28 credits) and BS level (28 credits). BSc level needs all Foundation and Diploma courses and projects done. BS level needs 114 credits and the BSc level done. Finishing BS takes you to 142 credits.\n\nCompulsory (5 courses, 4 credits each):\n• Core pair I: Software Engineering (BSCS3001) and Software Testing (BSCS3002)\n• Core pair II: AI: Search Methods for Problem Solving (BSCS3003) and Deep Learning (BSCS3004)\n• Mandatory: Strategies for Professional Growth (BSGN3001)\n\nThe rest are electives of 4 credits each, for example: Large Language Models, Introduction to NLP, Deep Learning for Computer Vision, Reinforcement Learning, Operating Systems, Computer Networks, Programming in C, Theory of Computation, Linear Statistical Models, Data Visualization Design, Market Research, Corporate Finance, Machine Learning Operations, Data Science and AI Lab, App Dev Lab. The elective list can change every term depending on availability.\n\nApprenticeship and credit transfer are under Programme rules.',
          'BSc level (28 credits) aur BS level (28 credits). BSc level ke liye saare Foundation aur Diploma courses aur projects poore hone chahiye. BS level ke liye 114 credits aur BSc level poora hona chahiye. BS poora karne par 142 credits ho jate hain.\n\nCompulsory (5 courses, har ek 4 credits):\n• Core pair I: Software Engineering (BSCS3001) aur Software Testing (BSCS3002)\n• Core pair II: AI: Search Methods for Problem Solving (BSCS3003) aur Deep Learning (BSCS3004)\n• Mandatory: Strategies for Professional Growth (BSGN3001)\n\nBaaki electives hain, har ek 4 credits ka, jaise: Large Language Models, Introduction to NLP, Deep Learning for Computer Vision, Reinforcement Learning, Operating Systems, Computer Networks, Programming in C, Theory of Computation, Linear Statistical Models, Data Visualization Design, Market Research, Corporate Finance, Machine Learning Operations, Data Science and AI Lab, App Dev Lab. Elective list har term availability ke hisaab se badal sakti hai.\n\nApprenticeship aur credit transfer Programme rules mein hain.'
        )),
        leaf('syl.pg', t('PG Diploma & MTech courses', 'PG Diploma aur MTech courses'), t(
          'PG Diploma in AI & ML: 20 credits (3 core + 2 electives). You need all Degree level core requirements done and the CGPA requirement when you apply to upgrade.\n• Core (4 credits each): ML Ops (BSDA5014), Generative AI (BSDA5002), Algorithms for Data Science (BSDA5003)\n• Electives (pick 2, 8 credits): Large Language Models, Introduction to NLP, Deep Learning for Computer Vision, Reinforcement Learning, Responsible AI, Statistical Learning Theory, Deployability Aspects of AI, Sequential Decision Making, Information Theory and Learning, Speech Technology, Research Project. The list can change every term.\n\nMTech in AI & ML: 20 credits, one mandatory MTech Project (BSDA6901). You need the PG Diploma level done first. You can start the project after it, in a company or research lab, and it must be finished within 8 years of starting the programme. You then get a BS + MTech from IIT Madras.',
          'PG Diploma in AI & ML: 20 credits (3 core + 2 electives). Upgrade karte waqt saare Degree level core requirements aur CGPA requirement poori honi chahiye.\n• Core (har ek 4 credits): ML Ops (BSDA5014), Generative AI (BSDA5002), Algorithms for Data Science (BSDA5003)\n• Electives (2 chuno, 8 credits): Large Language Models, Introduction to NLP, Deep Learning for Computer Vision, Reinforcement Learning, Responsible AI, Statistical Learning Theory, Deployability Aspects of AI, Sequential Decision Making, Information Theory and Learning, Speech Technology, Research Project. List har term badal sakti hai.\n\nMTech in AI & ML: 20 credits, ek mandatory MTech Project (BSDA6901). Pehle PG Diploma level poora hona chahiye. Project uske baad shuru kar sakte ho, company ya research lab mein, aur programme shuru karne se 8 saal ke andar poora hona chahiye. Phir IIT Madras se BS + MTech milta hai.'
        )),
      ]),
      sub('syl.g-exams', t('Exam rules & centres', 'Exam rules aur centres'), [
        leaf('syl.quizrules', t('Quiz & end-term timing', 'Quiz aur end-term ka time'), t(
          '• Two in-person quizzes: end of Week 4 (covers Weeks 1 to 4) and end of Week 8 (covers Weeks 1 to 8).\n• Each quiz is one session: 4 hours for 4 subjects, 3 hours for 3 subjects, 2 hours for 2 or 1 subject.\n• A missed quiz scores 0 and there is no make-up quiz. You must attend at least one of the two to be eligible for the end-term.\n• The Qualifier marks count as Quiz 1 only for Foundation courses registered in the same term as the Qualifier.\n• End-term: 1.5 hours per course, held on Sundays.',
          '• Do in-person quizzes: Week 4 ke end mein (Week 1 se 4) aur Week 8 ke end mein (Week 1 se 8).\n• Har quiz ek session hota hai: 4 subjects ke liye 4 ghante, 3 subjects ke liye 3 ghante, 2 ya 1 subject ke liye 2 ghante.\n• Miss kiya hua quiz 0 hota hai aur make-up quiz nahi hota. End-term ke liye eligible hone ke liye 2 mein se kam se kam ek quiz dena zaroori hai.\n• Qualifier ke marks Quiz 1 tabhi ginte hain jab Foundation courses usi term mein register kiye ho jis term mein Qualifier diya.\n• End-term: har course ka 1.5 ghanta, Sunday ko.'
        )),
        leaf('syl.centres', t('Exam cities (India & abroad)', 'Exam cities (India aur abroad)'), t(
          '• In India: if you live in India or are physically in India on exam day, you must write at an exam centre in India. Quizzes and end-terms run in many cities across the country.\n• Bahrain, Kuwait, Oman and UAE: in-person exams are held there too.\n• Other countries: remote proctored (internet based) exams, and you are asked to pin your location on exam day.\n• If you live abroad but will be in India on exam day, tell the team ahead of time so they can arrange an Indian centre and a matching hall ticket. Breaking this is treated as malpractice and results can be withheld.\n• No centre in your city or country? Write to ge@study.iitm.ac.in.',
          '• India mein: agar aap India mein rehte ho ya exam wale din India mein ho, to India ke exam centre par hi exam dena hoga. Quizzes aur end-terms desh ke kai cities mein hote hain.\n• Bahrain, Kuwait, Oman aur UAE: wahan bhi in-person exams hote hain.\n• Baaki countries: remote proctored (internet based) exams, aur exam wale din apni location pin karni hoti hai.\n• Agar aap abroad rehte ho par exam wale din India mein hoge, to team ko pehle bata do taaki India ka centre aur sahi hall ticket arrange ho sake. Aisa na karna malpractice maana jata hai aur result roka ja sakta hai.\n• Apne city ya country mein centre nahi mila? ge@study.iitm.ac.in par likho.'
        )),
      ]),
      sub('syl.g-syllabus', t('Course-wise syllabus', 'Course ka syllabus'), [
        sub('syl.g-sy-math', t('Maths & Statistics', 'Maths aur Statistics'), [
          sylLeaf('syl.math1', 'Maths 1', 'Mathematics for Data Science I', 'BSMA1001', 'Neelesh Upadhye and Madhavan Mukund', NO_PRE, [
            'Set theory. Number systems, sets and their operations, relations and functions and their types',
            'Rectangular coordinate system and straight lines. Slope, parallel and perpendicular lines, representations and general equation of a line, straight-line fit',
            'Quadratic functions. Minima, maxima, vertex and slope, quadratic equations',
            'Algebra of polynomials. Addition, subtraction, multiplication, division, algorithms; graphs of polynomials (x-intercepts, multiplicities, end behaviour, turning points), graphing and polynomial creation',
            'Functions. Horizontal and vertical line tests, exponential functions, composite functions, inverse functions',
            'Logarithmic functions. Properties, graphs, exponential and logarithmic equations',
            'Sequences and limits. Functions of one variable, graphs and tangents, limits for sequences and functions, limits and continuity',
            "Derivatives, tangents and critical points. Differentiability, computing derivatives, L'Hopital's rule, linear approximation, local maxima and minima",
            'Integrals. Areas, areas under a curve, the integral of a function of one variable, derivatives and integrals',
            'Graph theory. Representation of graphs, BFS, DFS and their applications; directed acyclic graphs, complexity of BFS and DFS, topological sorting',
            'Graph algorithms. Longest path, transitive closure, matrix multiplication; shortest paths (Dijkstra, Bellman-Ford, Floyd-Warshall); minimum cost spanning trees (Prim, Kruskal)',
            'Revision',
          ]),
          sylLeaf('syl.stat1', 'Stats 1', 'Statistics for Data Science I', 'BSMA1002', 'Usha Mohan', NO_PRE, [
            'Introduction and types of data. Descriptive and inferential statistics, scales of measurement',
            'Describing categorical data. Frequency distributions, best practices for graphing, mode and median',
            'Describing numerical data. Frequency tables, mean, median and mode, quartiles and percentiles, range, variance, standard deviation, IQR, five number summary',
            'Association between two variables. Contingency tables with relative frequencies; scatterplot, covariance, Pearson correlation, point bi-serial correlation',
            'Basic counting. Addition rule, multiplication rule, factorials',
            'Permutations and combinations',
            'Probability. Basic definitions, events, properties of probability',
            "Conditional probability. Multiplication rule, independence, law of total probability, Bayes' theorem",
            'Random variables. Random experiment, sample space, discrete and continuous random variables, probability mass function, cumulative distribution function',
            'Expectation and variance. Expectation, variance and standard deviation of a discrete random variable',
            'Binomial and Poisson random variables. Bernoulli trials, i.i.d. random variables, binomial (expectation and variance), Poisson distribution',
            'Continuous random variables. Area under the curve, properties of the pdf, uniform and exponential distributions',
          ]),
          sylLeaf('syl.math2', 'Maths 2', 'Mathematics for Data Science II', 'BSMA1003', 'Sarang S Sane', t('Needs BSMA1001', 'BSMA1001 chahiye'), [
            'Vectors and matrices. Vectors, matrices, systems of linear equations, determinants',
            "Solving linear equations. Determinants, Cramer's rule, invertible coefficient matrix, echelon form, row reduction, Gaussian elimination",
            'Introduction to vector spaces. Properties of vector spaces, linear dependence and independence',
            'Basis and dimension. What a basis is, finding bases, rank and dimension using Gaussian elimination',
            'Rank and nullity; linear transformations. Null space (nullity and basis), linear mappings and transformations',
            'Kernel and image. Ordered bases and matrices, image and kernel of linear transformations, finding their bases',
            'Equivalent and similar matrices; inner products. Affine subspaces and mappings, lengths and angles, inner products and norms',
            'Orthogonality and Gram-Schmidt. Orthonormal basis, projections, the Gram-Schmidt process, orthogonal transformations and rotations',
            'Multivariable functions. Visualization, partial derivatives, directional derivatives, limits, continuity, gradient',
            'Steepest ascent and descent, tangent (hyper)plane, critical points',
            'Higher order partial derivatives, Hessian matrix and local extrema, differentiability, review of Maths 2 (this course runs 11 weeks)',
          ]),
          sylLeaf('syl.stat2', 'Stats 2', 'Statistics for Data Science II', 'BSMA1004', 'Prof. Andrew Thangaraj', t('Needs BSMA1002 and BSMA1001, with BSMA1003 together', 'BSMA1002 aur BSMA1001 chahiye, BSMA1003 saath mein'), [
            'Multiple random variables. Two random variables, multiple random variables and distributions',
            'Independence; functions of random variables (visualization, functions of multiple random variables)',
            'Expectations. Casino math, expected value, scatter plots and spread, variance and standard deviation, covariance and correlation, inequalities',
            'Continuous random variables. Discrete vs continuous, density functions, expectations',
            'Multiple continuous random variables. Two continuous random variables, averages, limit theorems, jointly Gaussian random variables; probability models for data (simple models, other distributions, multiple variables and dependency, models from data)',
            'Refresher week',
            'Estimation and inference I',
            'Estimation and inference II',
            'Bayesian estimation',
            'Hypothesis testing I',
            'Hypothesis testing II',
            'Revision week',
          ]),
        ]),
        sub('syl.g-sy-cs', t('Programming & English', 'Programming aur English'), [
          sylLeaf('syl.ct', 'Computational Thinking', 'Computational Thinking', 'BSCS1001', 'Madhavan Mukund and Dr. G Venkatesh', NO_PRE, [
            'Variables, initialization, iterators, filtering, datatypes, flowcharts, sanity of data',
            'Iteration, filtering, selection, pseudocode, finding max and min, AND operator',
            'Multiple (non-nested) iterations, three prizes problem, procedures, parameters, side effects, OR operator',
            'Nested iterations, birthday paradox, binning',
            'Lists, insertion sort',
            'Tables, dictionaries',
            'Graphs, matrices',
            'Adjacency matrix, edge labelled graph',
            'Backtracking, trees, depth first search (DFS), recursion',
            'Object oriented programming. Class, object, encapsulation, abstraction, information hiding, access specifiers',
            'Message passing, RPC, cache memory, parallelism, concurrency, polling, preemption, multithreading, producer-consumer, atomicity, consistency, race condition, deadlock, broadcasting',
            'Top-down and bottom-up approach, decision tree, numerical prediction, behaviour analysis, classification',
          ]),
          sylLeaf('syl.eng1', 'English I', 'English I', 'BSHS1001', 'Rajesh Kumar', NO_PRE, [
            'Sounds and words (vowel and consonant sounds)',
            'Parts of speech',
            'Sentences (phrases and idioms)',
            'Speaking skills (spoken English preliminaries)',
            'Tenses and agreement in English sentences',
            'Reading skills (skimming, scanning and comprehension)',
            'Listening skills',
            'Aspiration, word stress and syllabification',
            'Speaking skills (presentation and group discussion)',
            'Grammar (common errors in English) and writing skills',
            'Writing skills (basics of writing)',
            'Writing skills (professional writing)',
          ]),
          sylLeaf('syl.py', 'Python', 'Programming in Python', 'BSCS1002', 'Satyadev Nandakumar', t('Needs BSCS1001', 'BSCS1001 chahiye'), [
            'Introduction to algorithms',
            'Conditionals',
            'Conditionals (continued)',
            'Iterations and ranges',
            'Iterations and ranges (continued)',
            'Basic collections in Python',
            'Basic collections in Python (continued)',
            'Basic collections in Python (continued)',
            'File operations',
            'File operations (continued)',
            'Module system in Python',
            'Basic Pandas and NumPy processing of data',
          ]),
          sylLeaf('syl.eng2', 'English II', 'English II', 'BSHS1002', 'Rajesh Kumar', t('Needs BSHS1001', 'BSHS1001 chahiye'), [
            'Patterns in sentences',
            'Patterns in sentences (continued)',
            'Patterns in sentences (continued)',
            'Listening skills',
            'Listening skills (continued)',
            'Speaking skills',
            'Speaking skills (continued)',
            'Reading skills',
            'Writing skills',
            'Writing skills (continued)',
            'Social skills',
            'Social skills (continued)',
          ]),
        ]),
      ]),
    ],
  },
}
FLAT_TREE.options!.push(SYL_OPTION)

// ── GenZ IITian class schedule and syllabus coverage (given by the team, 11 Nov 2026) ──
findNode(FLAT_TREE, 'video')!.options!.push(
  leaf('sched.when', t('When are classes scheduled?', 'Classes kab hoti hain?'), t(
    'Classes are usually held at least 4 days a week, Monday to Friday. Sometimes there are classes on weekends too.',
    'Classes aam taur par hafte mein kam se kam 4 din hoti hain, Monday se Friday. Kabhi kabhi weekends par bhi hoti hain.'
  )),
  leaf('sched.time', t('What is the class timing?', 'Class ka timing kya hai?'), t(
    'Classes are usually between 5 PM and 10 PM.',
    'Classes aam taur par shaam 5 baje se raat 10 baje ke beech hoti hain.'
  )),
  leaf('sched.cover', t('How much is covered, and when?', 'Kitna syllabus kab cover hota hai?'), t(
    'It is covered in three blocks:\n• Quiz 1 / Qualifier: Week 1 to Week 4\n• Quiz 2: Week 5 to Week 8\n• End term: Week 9 to Week 12\nThe official exam syllabus can include earlier weeks as well (for example Quiz 2 covers Weeks 1 to 8), so keep revising the earlier weeks.',
    'Yeh teen blocks mein cover hota hai:\n• Quiz 1 / Qualifier: Week 1 se Week 4\n• Quiz 2: Week 5 se Week 8\n• End term: Week 9 se Week 12\nOfficial exam syllabus mein pehle ke weeks bhi aa sakte hain (jaise Quiz 2 mein Week 1 se 8), isliye pehle ke weeks ki revision karte raho.'
  )),
  leaf('sched.valid', t('How long is my course valid?', 'Mera course kab tak valid hai?'), t(
    'Every course you purchase is valid until the end-term exam of that term.',
    'Aapka kharida hua har course us term ke end-term exam tak valid rehta hai.'
  )),
)

// ── IITM answers: Qualifier support email + "please confirm with the IITM BS team" note ──
const QUALIFIER_IDS = ['exam.eligible', 'exam.pass', 'exam.hall', 'exam.after', 'exam.qdate']
const QUALIFIER_MAIL = t(
  'For any Qualifier queries, write to support-qualifier@study.iitm.ac.in',
  'Qualifier ke kisi bhi sawaal ke liye support-qualifier@study.iitm.ac.in par likho'
)
const CONFIRM_NOTE = t(
  'We have been in this field for 3+ years, but please confirm once with the IITM BS support team, as things may have changed. Thank you!',
  'Hum is field mein 3+ saal se hain, phir bhi ek baar IITM BS support team se confirm zaroor kar lo, kyunki cheezein badal sakti hain. Thank you!'
)
;(function addNotes(n: GenZieNode) {
  for (const o of n.options || []) addNotes(o.next)
  if (!n.answer || n.needsAgent || !/^(exam|prog|syl)\./.test(n.id) || n.id === 'prog.contact') return
  const extra = QUALIFIER_IDS.includes(n.id) ? [QUALIFIER_MAIL] : []
  n.answer = {
    en: [n.answer.en, ...extra.map(x => x.en), CONFIRM_NOTE.en].join('\n\n'),
    hi: [n.answer.hi, ...extra.map(x => x.hi), CONFIRM_NOTE.hi].join('\n\n'),
  }
})(FLAT_TREE)

// ── keep every screen to 5 options max: split big lists into sub-categories, end each with "Other" ──
function findNode(n: GenZieNode, id: string): GenZieNode | null {
  if (n.id === id && n.options) return n
  for (const o of n.options || []) { const f = findNode(o.next, id); if (f) return f }
  return null
}
const SUBGROUPS: Record<string, { id: string; label: L; ids: string[] }[]> = {
  video: [
    { id: 'video.g-videos', label: t('Videos', 'Videos'), ids: ['video.not-playing', 'video.download'] },
    { id: 'video.g-live', label: t('Live classes & recordings', 'Live classes aur recordings'), ids: ['video.join-live', 'video.live-issue', 'video.plus-live', 'video.recording'] },
    { id: 'video.g-sched', label: t('Class schedule & syllabus', 'Class schedule aur syllabus'), ids: ['sched.when', 'sched.time', 'sched.cover', 'sched.valid'] },
  ],
  study: [
    { id: 'study.g-notes', label: t('Notes & practice', 'Notes aur practice'), ids: ['study.notes', 'study.missing', 'study.test', 'study.quizlab'] },
    { id: 'study.g-mentor', label: t('Mentors & community', 'Mentors aur community'), ids: ['study.mentor', 'study.community'] },
    { id: 'study.g-progress', label: t('Progress & certificates', 'Progress aur certificates'), ids: ['study.progress', 'study.certificate'] },
  ],
  pay: [
    { id: 'pay.g-problem', label: t('Payment problems', 'Payment ki problem'), ids: ['pay.failed', 'pay.no-course', 'pay.twice'] },
    { id: 'pay.g-billing', label: t('Refunds & billing', 'Refund aur billing'), ids: ['pay.refund', 'pay.history', 'pay.emi', 'pay.invoice'] },
  ],
  account: [
    { id: 'account.g-login', label: t('Login & profile', 'Login aur profile'), ids: ['account.login', 'account.profile'] },
    { id: 'account.g-safety', label: t('Account safety', 'Account safety'), ids: ['account.suspended', 'account.email', 'account.sharing'] },
  ],
}
for (const [nodeId, groups] of Object.entries(SUBGROUPS)) {
  const n = findNode(FLAT_TREE, nodeId)
  if (!n || !n.options) continue
  const all = n.options
  n.options = groups.map(g => ({
    id: g.id, label: g.label,
    next: { id: g.id, q: t('Which one is closest?', 'Inme se kaunsa sabse close hai?'), options: all.filter(o => g.ids.includes(o.id)) },
  }))
}
const OTHER_LABELS = ['Something else', 'Other']
;(function addOther(n: GenZieNode) {
  if (!n.options) return
  n.options.forEach(o => addOther(o.next))
  if (n.id === 'root') return
  const last = n.options[n.options.length - 1]
  if (last && OTHER_LABELS.includes(last.label.en)) return
  n.options.push({
    id: `${n.id}.other-team`, label: t('Other', 'Other'),
    next: {
      id: `${n.id}.other-team`, ticketType: 'GENERAL', needsAgent: true,
      answer: t('No problem, our team can help with that.', 'Koi baat nahi, hamari team isme help kar sakti hai.'),
    },
  })
})(FLAT_TREE)

const pick = (ids: string[]) => ids.map(id => (FLAT_TREE.options || []).find(o => o.id === id)).filter((o): o is GenZieOption => !!o)
const group = (id: string, label: L, ids: string[], withOther = true) => ({
  id, label,
  next: {
    id, q: t('Which one is closest?', 'Inme se kaunsa sabse close hai?'),
    options: [
      ...pick(ids),
      ...(withOther ? [{
        id: `${id}.other-team`, label: t('Other', 'Other'),
        next: {
          id: `${id}.other-team`, ticketType: 'GENERAL' as const, needsAgent: true,
          answer: t('No problem, our team can help with that.', 'Koi baat nahi, hamari team isme help kar sakti hai.'),
        },
      }] : []),
    ],
  },
})

/** Top level shows three groups first; the detailed topics open inside them. */
export const GENIE_TREE: GenZieNode = {
  id: 'root',
  q: UI.greeting,
  options: [
    group('g-iitm', t('IITM BS', 'IITM BS'), ['exam', 'syl', 'prog']),
    group('g-academic', t('Academic', 'Academic'), ['video', 'study', 'doubt']),
    group('g-technical', t('Technical', 'Technical'), ['account', 'app', 'course']),
    group('g-other', t('Other', 'Other'), ['buy', 'pay', 'other'], false),
  ],
}

export const GENIE_MAX_MESSAGE = 1000
