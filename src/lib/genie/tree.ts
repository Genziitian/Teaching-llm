// Genie — guided support answers (English + Hinglish).
// Source: answers from the support team (Smart Support questions doc, 9–10 Nov 2026).
// Step 3 will move this into a manager-editable store; until then edit here.

export type GenieLang = 'en' | 'hi'
export type L = { en: string; hi: string }

export interface GenieOption {
  id: string
  label: L
  next: GenieNode
}

export interface GenieNode {
  id: string
  /** Question shown with options (branch node). */
  q?: L
  options?: GenieOption[]
  /** Answer text (leaf node). URLs are turned into links. */
  answer?: L
  /** Optional button under the answer that takes the student somewhere (internal path or full URL). */
  link?: { label: L; href: string }
  /** Leaf that can only be solved by the team: skip "Did this solve it?". */
  needsAgent?: boolean
  /** Ticket type to use if this ends up as a ticket. */
  ticketType?: 'GENERAL' | 'SUBJECT'
}

export const GENIE_NAME = 'Genie'
export const WHATSAPP_URL = 'https://wa.me/917254926179'

export const UI: Record<string, L> = {
  hello: { en: "Hi, I'm Genie 👋", hi: 'Hi, main Genie hoon 👋' },
  helloSub: { en: 'Need help? Ask me.', hi: 'Help chahiye? Mujhse poocho.' },
  greeting: {
    en: "Hi! I'm Genie, your support helper. What do you need help with?",
    hi: 'Hi! Main Genie hoon, aapka support helper. Kis cheez mein help chahiye?',
  },
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
  mistakes: { en: 'Genie can make mistakes.', hi: 'Genie se galti ho sakti hai.' },
  close: { en: 'Close', hi: 'Band karo' },
  tooLong: { en: 'Please keep it under {n} characters.', hi: 'Please {n} characters se kam likho.' },
  slowDown: { en: 'Please wait a moment before sending again.', hi: 'Thoda ruko, phir bhejo.' },
}

const t = (en: string, hi: string): L => ({ en, hi })

const FLAT_TREE: GenieNode = {
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

// ── keep every screen to 5 options max: split big lists into sub-categories, end each with "Other" ──
function findNode(n: GenieNode, id: string): GenieNode | null {
  if (n.id === id && n.options) return n
  for (const o of n.options || []) { const f = findNode(o.next, id); if (f) return f }
  return null
}
const SUBGROUPS: Record<string, { id: string; label: L; ids: string[] }[]> = {
  video: [
    { id: 'video.g-videos', label: t('Videos', 'Videos'), ids: ['video.not-playing', 'video.download'] },
    { id: 'video.g-live', label: t('Live classes & recordings', 'Live classes aur recordings'), ids: ['video.join-live', 'video.live-issue', 'video.plus-live', 'video.recording'] },
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
;(function addOther(n: GenieNode) {
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

const pick = (ids: string[]) => (FLAT_TREE.options || []).filter(o => ids.includes(o.id))
const group = (id: string, label: L, ids: string[]) => ({
  id, label,
  next: { id, q: t('Which one is closest?', 'Inme se kaunsa sabse close hai?'), options: pick(ids) },
})

/** Top level shows three groups first; the detailed topics open inside them. */
export const GENIE_TREE: GenieNode = {
  id: 'root',
  q: UI.greeting,
  options: [
    group('g-academic', t('Academic', 'Academic'), ['video', 'study', 'doubt']),
    group('g-technical', t('Technical', 'Technical'), ['account', 'app', 'course']),
    group('g-other', t('Other', 'Other'), ['buy', 'pay', 'other']),
  ],
}

export const GENIE_MAX_MESSAGE = 1000
