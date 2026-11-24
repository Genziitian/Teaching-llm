// Shared docs data & types

export interface CourseRow {
  name: string;
  credits: number | string;
  code: string;
  prerequisites?: string;
  corequisites?: string;
  tag?: string; // e.g. 'CORE COURSE', 'OPTION 1', 'OPTION 2', 'MANDATORY COURSE'
}

export interface ContentBlock {
  type: 'text' | 'html' | 'heading' | 'stats' | 'table' | 'callout' | 'fee-table' | 'image' | 'list' | 'divider';
  value?: string;
  items?: string[];
  level?: number; // heading level
  variant?: 'info' | 'warning' | 'success' | 'important';
  stats?: { label: string; value: string; sub?: string }[];
  columns?: string[];
  rows?: (string | number)[][];
  courses?: CourseRow[];
  src?: string;
  alt?: string;
}

export interface DocItem {
  title: string;
  slug: string;
  badge?: string;
  content: ContentBlock[];
}

export interface DocSection {
  title: string;
  items: DocItem[];
}

export interface DocEntry {
  slug: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  sections: DocSection[];
}

// ─── IIT MADRAS BS DEGREE ─────────────────────────────────────

const iitMadrasBSDegree: DocEntry = {
  slug: 'iit-madras-bs-degree',
  title: 'IIT Madras BS Degree',
  description: 'Complete academic reference for the IIT Madras BS Degree in Data Science and Applications — programme structure, curriculum, fees, exams & more.',
  category: 'Degree',
  icon: 'graduation-cap',
  sections: [
    {
      title: 'Programme Overview',
      items: [
        {
          title: 'Overall Structure',
          slug: 'overall-structure',
          badge: 'Important',
          content: [
            { type: 'text', value: 'There are six levels in the IIT Madras Degree program. To get the BS Degree in Data Science and Applications from IIT Madras, a learner has to successfully complete the first four levels.' },
            { type: 'text', value: 'There is also the flexibility to exit at any level. Depending on the courses completed and credits earned, the learner can receive:' },
            { type: 'list', items: [
              'Foundation Certificate from IITM CODE (Centre for Outreach and Digital Education)',
              'Diploma(s) from IIT Madras',
              'BSc Degree in Programming and Data Science from IIT Madras',
              'BS Degree in Data Science and Applications from IIT Madras',
              'PGD in Artificial Intelligence & Machine Learning from IIT Madras',
              'M.Tech in Artificial Intelligence & Machine Learning from IIT Madras',
            ]},
            { type: 'callout', variant: 'info', value: 'Those who are interested in pursuing an exclusive Diploma Program in Programming or Data Science can also check out the Diploma Program website.' },
          ],
        },
        {
          title: 'Courses & Credits',
          slug: 'courses-credits',
          content: [
            { type: 'heading', value: 'Courses and Credits in Each Level', level: 3 },
            { type: 'stats', stats: [
              { label: 'Foundation Level', value: '32 credits', sub: '8 courses' },
              { label: 'Diploma (Programming)', value: '27 credits', sub: '6 courses + 2 projects' },
              { label: 'Diploma (Data Science)', value: '27 credits', sub: '6 courses + 2 projects' },
              { label: 'BSc Degree Level', value: '28 credits', sub: '' },
              { label: 'BS Degree Level', value: '28 credits', sub: '' },
              { label: 'PG Diploma Level', value: '20 credits', sub: '3 core + 2 electives' },
              { label: 'MTech Level', value: '20 credits', sub: 'MTech Project' },
            ]},
            { type: 'heading', value: 'Total Credits for Each Qualification', level: 3 },
            { type: 'table', columns: ['Qualification', 'Total Credits'], rows: [
              ['BSc Degree', '114 credits'],
              ['BS Degree', '142 credits'],
              ['PG Diploma in AI & ML', '162 credits (BS + PG Diploma)'],
              ['MTech in AI & ML', '182 credits (BS + PG Diploma + MTech)'],
            ]},
          ],
        },
        {
          title: 'Completion Time',
          slug: 'completion-time',
          content: [
            { type: 'text', value: 'The time period is based on learner\'s preferred pace and performance in assessments. Expected learner engagement: approximately 10 hrs/course/week.' },
            { type: 'callout', variant: 'info', value: 'Maximum completion time: up to 8 years from starting Foundation Level.' },
            { type: 'table', columns: ['Level', 'Duration'], rows: [
              ['Foundation Level', '1–3 years'],
              ['Diploma Level', '1–2 years each'],
              ['BSc/BS Degree Level', '1–2 years each'],
              ['PG Diploma', '1–2 years'],
              ['MTech', 'Up to 8 years from Foundation start'],
            ]},
          ],
        },
        {
          title: 'Term Structure',
          slug: 'term-structure',
          content: [
            { type: 'text', value: 'Every year is divided into three terms of four months each — January Term, May Term and September Term.' },
            { type: 'text', value: 'Each term of four months has 12 weeks of coursework (video lectures and assignments), 2 in-person invigilated Quizzes and End Term Exams. Depending on the course, assessments may include programming exams, mini projects, vivas, take home assignments, etc.' },
            { type: 'stats', stats: [
              { label: 'Terms per Year', value: '3', sub: 'Jan · May · Sept' },
              { label: 'Coursework', value: '12 weeks', sub: 'per term' },
              { label: 'Course Duration', value: '12 weeks', sub: '2–3 hrs video/week' },
              { label: 'Max Courses/Term', value: '4', sub: 'based on CCC' },
            ]},
          ],
        },
      ],
    },
    {
      title: 'Assessments & Exams',
      items: [
        {
          title: 'Assessment Types',
          slug: 'assessment-types',
          content: [
            { type: 'text', value: 'There are 3 types of assessments for each course:' },
            { type: 'list', items: [
              'Weekly Assignments — online',
              'Monthly in-person Quizzes',
              'In-person End Term Exam',
            ]},
            { type: 'text', value: 'In addition, assessments may include programming exams, mini projects, vivas, take home assignments, etc.' },
          ],
        },
        {
          title: 'Course Registration',
          slug: 'course-registration',
          content: [
            { type: 'text', value: 'In each term, a learner may register for up to 4 courses depending on their CCC (Credit Clearing Capability).' },
            { type: 'text', value: 'A learner\'s CCC in the Foundation Level is calculated based on their performance in the Qualifier Exam or the previous term\'s End Term Exams. The CCC in the Diploma Level and thereafter is 4.' },
            { type: 'heading', value: 'Level Progression Requirements', level: 3 },
            { type: 'list', items: [
              'Foundation Level: All 8 courses must be successfully completed before enrolling in any Diploma Level course.',
              'Diploma Level: All courses and projects must be successfully completed before enrolling in any Degree Level course.',
              'BS Degree Level: All courses must be successfully completed before enrolling in PG Diploma Level.',
              'PG Diploma Level: All courses must be successfully completed before enrolling in MTech Level.',
            ]},
          ],
        },
        {
          title: 'Exam Cities',
          slug: 'exam-cities',
          content: [
            { type: 'text', value: 'The Invigilated Quizzes and End Term exams are conducted in a number of cities spread across India.' },
            { type: 'heading', value: 'Students in India', level: 3 },
            { type: 'text', value: 'All students residing in India or physically present in India on the day of an in-centre exam must write exams at one of the exam centres in India.' },
            { type: 'heading', value: 'Learners Outside India', level: 3 },
            { type: 'text', value: 'In-person exams are also conducted in Bahrain, Kuwait, Oman and UAE. Learners based out of other countries will be allowed to take remote proctored exams.' },
            { type: 'callout', variant: 'warning', value: 'If overseas students are planning to be in India on exam day, it is the student\'s responsibility to notify ahead of time. Violation of norms will be considered malpractice.' },
            { type: 'callout', variant: 'info', value: 'Additional Exam Fee applies for all learners opting to write exams outside India. Contact ge@study.iitm.ac.in for assistance.' },
          ],
        },
      ],
    },
    {
      title: 'Fee Structure',
      items: [
        {
          title: 'Programme Fees',
          slug: 'programme-fees',
          badge: 'Updated',
          content: [
            { type: 'text', value: 'Each term, pay only for the courses you register for in that specific term.' },
            { type: 'callout', variant: 'important', value: 'The fee structure has been revised for students joining at Foundation level from January 2026 Term onwards.' },
            { type: 'table', columns: ['Goal', 'Total Credits', 'Total Fees (INR)'], rows: [
              ['Foundation Only', '32', '₹48,000'],
              ['Foundation + One Diploma', '59', '₹1,29,000'],
              ['Foundation + Two Diplomas', '86', '₹2,10,000'],
              ['BSc Degree', '114', '₹2,86,000 – ₹3,10,000'],
              ['BS Degree', '142', '₹3,86,000 – ₹4,50,000'],
              ['PG Diploma in AI & ML', '162 (BS + PGD)', '₹4,86,000 – ₹5,90,000'],
              ['MTech in AI & ML', '182 (BS + PGD + MTech)', '₹6,86,000 – ₹7,90,000'],
            ]},
            { type: 'callout', variant: 'success', value: 'The IITM BS program strives to secure scholarships from CSR and Alumni donations for students from socially and economically disadvantaged backgrounds to cover full program fees.' },
          ],
        },
        {
          title: 'Fee Support & Waivers',
          slug: 'fee-support',
          content: [
            { type: 'text', value: 'IIT Madras covers part of the fees for students from socially and economically disadvantaged backgrounds. The fraction depends on the learner\'s category and family income.' },
            { type: 'heading', value: 'Fee Support Matrix', level: 3 },
            { type: 'table', columns: ['Category', 'Income > 5 LPA', 'Income 1–5 LPA', 'Income ≤ 1 LPA'], rows: [
              ['General', 'NIL', '50% (EWS + Income proof)', '75% (EWS + Income proof)'],
              ['OBC', 'NIL', '50% (OBC-NCL + Income)', '75% (OBC-NCL + Income)'],
              ['SC / ST', '50% (SC/ST cert)', '50% (SC/ST cert)', '75% (SC/ST + Income)'],
              ['PwD', '50% (PwD cert)', '50% (PwD cert)', '75% (PwD + EWS/OBC-NCL + Income)'],
              ['SC/ST + PwD', '75%', '75%', '75%'],
            ]},
            { type: 'callout', variant: 'warning', value: 'Fee waiver is not applicable for students outside India.' },
            { type: 'heading', value: 'Important Notes', level: 3 },
            { type: 'list', items: [
              'Family income includes income of the candidate, parents, spouse, and siblings/children below 18.',
              'Family income certificate is not required while applying but will be required to avail fee support when joining.',
              'At Diploma and Degree levels, a nominal fee may be charged for additional document verification.',
              'If a learner does not pass a course, they must repeat it with full re-payment of course fee.',
              'If a learner completed all course requirements but missed the end term exam, they can repeat just the end term exam (₹1,000 for Foundation; ₹2,000 for Diploma/Degree level).',
            ]},
          ],
        },
      ],
    },
    {
      title: 'Foundation Level',
      items: [
        {
          title: 'Foundation Overview',
          slug: 'foundation-overview',
          content: [
            { type: 'text', value: 'The Foundation Level comprises courses in Mathematics, Statistics, Basics of Programming and Python, and English. These courses ensure the learner is well prepared for Diploma Level courses.' },
            { type: 'stats', stats: [
              { label: 'Courses', value: '8', sub: '' },
              { label: 'Credits', value: '32', sub: '' },
              { label: 'Duration', value: '1–3 years', sub: '' },
              { label: 'Effort', value: '10 hrs', sub: 'per course/week' },
            ]},
            { type: 'heading', value: 'Requirements', level: 3 },
            { type: 'text', value: 'The learner should apply for and clear the Qualifier Process.' },
            { type: 'heading', value: 'Options on Completion', level: 3 },
            { type: 'list', items: [
              'Exit: Foundation Certificate from Centre for Outreach and Digital Education (CODE), IIT Madras.',
              'Proceed: Join the Diploma Level.',
            ]},
          ],
        },
        {
          title: 'Foundation Courses',
          slug: 'foundation-courses',
          badge: 'Important',
          content: [
            { type: 'heading', value: 'Foundation Level Course Table', level: 3 },
            { type: 'table', columns: ['Course Name', 'Credits', 'Code', 'Prerequisites', 'Corequisites'], rows: [
              ['Mathematics for Data Science I', 4, 'BSMA1001', 'None', 'None'],
              ['Statistics for Data Science I', 4, 'BSMA1002', 'None', 'None'],
              ['Computational Thinking', 4, 'BSCS1001', 'None', 'None'],
              ['English I', 4, 'BSHS1001', 'None', 'None'],
              ['Mathematics for Data Science II', 4, 'BSMA1003', 'BSMA1001', 'None'],
              ['Statistics for Data Science II', 4, 'BSMA1004', 'BSMA1002, BSMA1001', 'BSMA1003'],
              ['Programming in Python', 4, 'BSCS1002', 'BSCS1001', 'None'],
              ['English II', 4, 'BSHS1002', 'BSHS1001', 'None'],
            ]},
          ],
        },
      ],
    },
    {
      title: 'Diploma Level',
      items: [
        {
          title: 'Diploma Overview',
          slug: 'diploma-overview',
          content: [
            { type: 'text', value: 'There are two sections in the Diploma Level: Diploma in Programming and Diploma in Data Science. Each comprises 5 core courses, 2 projects and 1 skill enhancement course.' },
            { type: 'stats', stats: [
              { label: 'Total Courses', value: '12 + 4 projects', sub: '' },
              { label: 'Credits', value: '54', sub: '' },
              { label: 'Duration', value: '1–3 years', sub: '' },
              { label: 'Effort', value: '15 hrs', sub: 'per course/week' },
            ]},
            { type: 'heading', value: 'Requirements', level: 3 },
            { type: 'text', value: 'The learner should have cleared all 8 Foundation Level courses.' },
            { type: 'heading', value: 'Exit Options', level: 3 },
            { type: 'list', items: [
              'Complete both Diplomas → proceed to BSc Degree Level',
              'Exit with Diploma in Programming from IIT Madras',
              'Exit with Diploma in Data Science from IIT Madras',
              'Exit with both Diplomas from IIT Madras',
            ]},
          ],
        },
        {
          title: 'Diploma in Programming',
          slug: 'diploma-programming',
          content: [
            { type: 'text', value: 'The Diploma in Programming lays a sturdy foundation in databases and programming concepts with data structures and algorithms. The learner builds a web application by the end of the diploma.' },
            { type: 'stats', stats: [
              { label: 'Courses', value: '6 + 2 projects', sub: '' },
              { label: 'Credits', value: '27', sub: '' },
              { label: 'Duration', value: '1–2 years', sub: '' },
              { label: 'Effort', value: '15 hrs/course/week', sub: '' },
            ]},
            { type: 'table', columns: ['Course Name', 'Credits', 'Code', 'Prerequisites', 'Corequisites'], rows: [
              ['Database Management Systems', 4, 'BSCS2001', 'None', 'None'],
              ['PDSA using Python', 4, 'BSCS2002', 'None', 'None'],
              ['Modern Application Development I', 4, 'BSCS2003', 'None', 'BSCS2001'],
              ['MAD I – Project', 2, 'BSCS2003P', 'None', 'BSCS2003'],
              ['Programming Concepts using Java', 4, 'BSCS2005', 'None', 'None'],
              ['Modern Application Development II', 4, 'BSCS2006', 'BSCS2003', 'None'],
              ['MAD II – Project', 2, 'BSCS2006P', 'BSCS2003P', 'BSCS2006'],
              ['System Commands', 3, 'BSSE2001', 'None', 'None'],
            ]},
          ],
        },
        {
          title: 'Diploma in Data Science',
          slug: 'diploma-data-science',
          content: [
            { type: 'text', value: 'The Diploma in Data Science exposes the learner to gathering, analysing, and interpreting data. Business Data courses lay the context, while Machine Learning courses equip the learner for impactful conclusions.' },
            { type: 'stats', stats: [
              { label: 'Courses', value: '6 + 2 projects', sub: '' },
              { label: 'Credits', value: '27', sub: '' },
              { label: 'Duration', value: '1–2 years', sub: '' },
              { label: 'Effort', value: '15 hrs/course/week', sub: '' },
            ]},
            { type: 'callout', variant: 'info', value: 'Two pathway options: Complete 5 mandatory courses (21 credits) + 1 Project, then choose Option 1 (Business Analytics) or Option 2 (Deep Learning & AI) for the remaining 6 credits. Effective from September 2025 Term onwards.' },
            { type: 'table', columns: ['Course Name', 'Credits', 'Code', 'Prerequisites', 'Corequisites'], rows: [
              ['Machine Learning Foundations', 4, 'BSCS2004', 'None', 'None'],
              ['Business Data Management', 4, 'BSMS2001', 'None', 'None'],
              ['Machine Learning Techniques', 4, 'BSCS2007', 'None', 'BSCS2004'],
              ['Machine Learning Practice', 4, 'BSCS2008', 'BSCS2004, BSCS2007', 'None'],
              ['ML Practice – Project', 2, 'BSCS2008P', 'None', 'BSCS2008'],
              ['Tools in Data Science', 3, 'BSSE2002', 'None', 'BSCS2008'],
              ['BDM – Project (Option 1)', 2, 'BSMS2001P', 'None', 'BSMS2001'],
              ['Business Analytics (Option 1)', 4, 'BSMS2002', 'BSMS2001', 'None'],
              ['Intro to Deep Learning & GenAI (Option 2)', 4, 'BSDA2001', 'None', 'BSCS2008'],
              ['DL & GenAI – Project (Option 2)', 2, 'BSDA2001P', 'BSCS2007', 'BSCS2008, BSDA2001'],
            ]},
          ],
        },
      ],
    },
    {
      title: 'Degree Level',
      items: [
        {
          title: 'BSc Degree Level',
          slug: 'bsc-degree-level',
          content: [
            { type: 'heading', value: 'BSc in Programming and Data Science', level: 3 },
            { type: 'stats', stats: [
              { label: 'Credits', value: '28', sub: 'Total: 114 credits' },
              { label: 'Duration', value: '1–3 years', sub: '' },
              { label: 'Effort', value: '15 hrs', sub: 'per course/week' },
            ]},
            { type: 'heading', value: 'Requirements', level: 3 },
            { type: 'text', value: 'The learner should have cleared all 8 courses in Foundation Level and all 12 courses + 4 projects in Diploma Level.' },
            { type: 'heading', value: 'Options on Completion', level: 3 },
            { type: 'list', items: [
              'Proceed to the BS Degree Level.',
              'Exit with a BSc Degree in Programming & Data Science from IIT Madras.',
            ]},
          ],
        },
        {
          title: 'BS Degree Level',
          slug: 'bs-degree-level',
          content: [
            { type: 'heading', value: 'BS in Data Science and Applications', level: 3 },
            { type: 'stats', stats: [
              { label: 'Credits', value: '28', sub: 'Total: 142 credits' },
              { label: 'Duration', value: '1–3 years', sub: '' },
              { label: 'Effort', value: '15 hrs', sub: 'per course/week' },
            ]},
            { type: 'heading', value: 'Requirements', level: 3 },
            { type: 'text', value: 'The learner should have earned 114 credits and completed the BSc Degree Level.' },
            { type: 'heading', value: 'Options on Completion', level: 3 },
            { type: 'list', items: [
              'Exit with a BS Degree in Data Science and Applications from IIT Madras.',
              'Proceed to PG Diploma Level (minimum CGPA of 8.0 required).',
            ]},
          ],
        },
        {
          title: 'Core Courses',
          slug: 'degree-core-courses',
          badge: 'Important',
          content: [
            { type: 'text', value: 'There are two pairs of core courses in the degree level. It is mandatory for the learner to complete all four core courses.' },
            { type: 'table', columns: ['Core Pair I', 'Core Pair II'], rows: [
              ['Software Engineering', 'AI: Search Methods for Problem Solving'],
              ['Software Testing', 'Deep Learning'],
            ]},
          ],
        },
        {
          title: 'Elective Courses',
          slug: 'degree-electives',
          content: [
            { type: 'text', value: 'A maximum of 8 credits can be transferred from NPTEL at BSc/BS level, and up to 12 credits apprenticeship transfer at BS level. List may change each term depending on availability.' },
            { type: 'table', columns: ['#', 'Course Name', 'Code', 'Credits'], rows: [
              [1, 'Software Engineering (CORE)', 'BSCS3001', 4],
              [2, 'Software Testing (CORE)', 'BSCS3002', 4],
              [3, 'AI: Search Methods (CORE)', 'BSCS3003', 4],
              [4, 'Deep Learning (CORE)', 'BSCS3004', 4],
              [5, 'Strategies for Professional Growth (MANDATORY)', 'BSGN3001', 4],
              [6, 'Algorithmic Thinking in Bioinformatics', 'BSBT4001', 4],
              [7, 'Big Data and Biological Networks', 'BSBT4002', 4],
              [8, 'Data Visualization Design', 'BSCS4001', 4],
              [9, 'Special Topics in ML (Reinforcement Learning)', 'BSDA5007', 4],
              [10, 'Speech Technology', 'BSEE4001', 4],
              [11, 'Design Thinking for Data-Driven App Dev', 'BSMS4002', 4],
              [12, 'Industry 4.0', 'BSMS4001', 4],
              [13, 'Market Research', 'BSMS3002', 4],
              [14, 'Privacy & Security in Online Social Media', 'BSCS4003', 4],
              [15, 'Introduction to Big Data', 'BSDA5001', 4],
              [16, 'Financial Forensics', 'BSMS4003', 4],
              [17, 'Linear Statistical Models', 'BSMA3012', 4],
              [18, 'Advanced Algorithms', 'BSCS4021', 4],
              [19, 'Statistical Computing', 'BSMA3014', 4],
              [20, 'Computer Systems Design', 'BSCS3031', 4],
              [21, 'Programming in C', 'BSCS3005', 4],
              [22, 'Mathematical Thinking', 'BSMA2001', 4],
              [23, 'Large Language Models', 'BSDA5004', 4],
              [24, 'Intro to NLP (i-NLP)', 'BSDA5005', 4],
              [25, 'Deep Learning for Computer Vision', 'BSDA5006', 4],
              [26, 'Managerial Economics', 'BSMS3033', 4],
              [27, 'Game Theory and Strategy', 'BSMS4023', 4],
              [28, 'Corporate Finance', 'BSMS3034', 4],
              [29, 'Deep Learning Practice', 'BSDA5013', 4],
              [30, 'Operating Systems', 'BSCS4022', 4],
              [31, 'Mathematical Foundations of GenAI', 'BSDA5002', 4],
              [32, 'Algorithms for Data Science (ADS)', 'BSDA5003', 4],
              [33, 'MLOps', 'BSDA5014', 4],
              [34, 'Data Science and AI Lab', 'BSDA4001', 4],
              [35, 'App Dev Lab', 'BSCS4010', 4],
              [36, 'Computer Networks', 'BSCS4024', 4],
              [37, 'Theory of Computation', 'BSCS3021', 4],
            ]},
          ],
        },
      ],
    },
    {
      title: 'PG & MTech Level',
      items: [
        {
          title: 'PG Diploma in AI & ML',
          slug: 'pg-diploma',
          badge: 'New',
          content: [
            { type: 'stats', stats: [
              { label: 'Credits', value: '20', sub: '3 core + 2 electives' },
              { label: 'Duration', value: '1–2 years', sub: '' },
              { label: 'Effort', value: '15 hrs', sub: 'per course/week' },
            ]},
            { type: 'heading', value: 'Requirements', level: 3 },
            { type: 'text', value: 'Students must have completed all core course requirements at the Degree level and meet the CGPA requirements at the time of applying for the upgrade.' },
            { type: 'heading', value: 'Core Courses', level: 3 },
            { type: 'table', columns: ['Course Name', 'Code', 'Credits'], rows: [
              ['ML Ops', 'BSDA5014', 4],
              ['Generative AI', 'BSDA5002', 4],
              ['Algorithms for Data Science', 'BSDA5003', 4],
            ]},
            { type: 'heading', value: 'Elective Courses (Choose 2)', level: 3 },
            { type: 'table', columns: ['#', 'Course Name', 'Code', 'Credits'], rows: [
              [1, 'Large Language Models', 'BSDA5004', 4],
              [2, 'Intro to NLP (i-NLP)', 'BSDA5005', 4],
              [3, 'Deep Learning for Computer Vision', 'BSDA5006', 4],
              [4, 'Reinforcement Learning', 'BSDA5007', 4],
              [5, 'Responsible AI', 'BSDA6001', 4],
              [6, 'Statistical Learning Theory', 'BSDA6002', 4],
              [7, 'Deployability Aspects of AI', 'BSDA6003', 4],
              [8, 'Sequential Decision Making', 'BSDA6004', 4],
              [9, 'Information Theory and Learning', 'BSDA6005', 4],
              [10, 'Speech Technology', 'BSEE5001', 4],
              [11, 'Research Project', 'BSDA6006', 4],
            ]},
          ],
        },
        {
          title: 'MTech in AI & ML',
          slug: 'mtech',
          content: [
            { type: 'stats', stats: [
              { label: 'Credits', value: '20', sub: 'MTech Project' },
              { label: 'Duration', value: 'Flexible', sub: '~5 years' },
              { label: 'Deadline', value: '8 years', sub: 'from Foundation start' },
            ]},
            { type: 'heading', value: 'Requirements', level: 3 },
            { type: 'text', value: 'Must have completed PG Diploma Level (20 credits). Students can start the project after completing the PG Diploma. Projects can be done in a company or research lab.' },
            { type: 'heading', value: 'Exit', level: 3 },
            { type: 'text', value: 'Students who complete the mandatory MTech Project in AI & ML earn a BS + MTech degree from IIT Madras. The project is executed and evaluated in the same way as Web MTech programs with mandatory project work in broad areas of Machine Learning and AI.' },
            { type: 'table', columns: ['Course Name', 'Code', 'Credits'], rows: [
              ['MTech Project', 'BSDA6901', 20],
            ]},
          ],
        },
      ],
    },
  ],
};

// ─── IIT MADRAS HANDBOOK (placeholder — will be updated later) ──

const iitMadrasHandbook: DocEntry = {
  slug: 'iit-madras-handbook',
  title: 'IIT Madras BS Handbook',
  description: 'Student handbook covering admissions, policies, rules, and FAQs for the IIT Madras BS programme.',
  category: 'Degree',
  icon: 'book-text',
  sections: [
    {
      title: 'Getting Started',
      items: [
        { title: 'Overview', slug: 'overview', content: [{ type: 'text', value: 'Welcome to the IIT Madras BS Handbook. Content will be updated soon with full admissions, policies, and student guidelines.' }] },
        { title: 'Admission Process', slug: 'admission-process', content: [{ type: 'text', value: 'Details about the admission process will be added here.' }] },
        { title: 'Eligibility Criteria', slug: 'eligibility-criteria', content: [{ type: 'text', value: 'Eligibility requirements for the IIT Madras BS programme.' }] },
      ],
    },
    {
      title: 'Policies',
      items: [
        { title: 'Academic Integrity', slug: 'academic-integrity', content: [{ type: 'text', value: 'Academic integrity policy details.' }] },
        { title: 'Attendance Policy', slug: 'attendance-policy', content: [{ type: 'text', value: 'Attendance and participation requirements.' }] },
        { title: 'Grievance Redressal', slug: 'grievance-redressal', content: [{ type: 'text', value: 'How to raise and resolve academic grievances.' }] },
      ],
    },
    {
      title: 'FAQs',
      items: [
        { title: 'General FAQs', slug: 'general-faqs', content: [{ type: 'text', value: 'Frequently asked questions about the programme.' }] },
        { title: 'Exam FAQs', slug: 'exam-faqs', content: [{ type: 'text', value: 'Common questions about exams and assessments.' }] },
      ],
    },
  ],
};

// ─── PROGRAMMING LANGUAGE DOCS ────────────────────────────────

const pythonGuide: DocEntry = {
  slug: 'python-programming-guide',
  title: 'Python Programming Guide',
  description: 'From basics to advanced — a structured guide to mastering Python for your coursework.',
  category: 'Programming Languages',
  icon: 'code',
  sections: [
    {
      title: 'Basics',
      items: [
        { title: 'Introduction', slug: 'introduction', content: [{ type: 'text', value: 'Python is a versatile, high-level programming language widely used in data science, web development, and automation. This guide covers everything you need for your IIT Madras coursework.' }] },
        { title: 'Variables & Data Types', slug: 'variables-data-types', content: [{ type: 'text', value: 'Learn about Python variables, numbers, strings, lists, tuples, dictionaries, and sets.' }] },
        { title: 'Control Flow', slug: 'control-flow', content: [{ type: 'text', value: 'if/elif/else statements, for loops, while loops, break, continue, and pass.' }] },
        { title: 'Functions', slug: 'functions', content: [{ type: 'text', value: 'Defining functions, arguments, return values, lambda functions, and scope.' }] },
      ],
    },
    {
      title: 'Intermediate',
      items: [
        { title: 'OOP Concepts', slug: 'oop-concepts', content: [{ type: 'text', value: 'Classes, objects, inheritance, polymorphism, encapsulation, and abstraction in Python.' }] },
        { title: 'File Handling', slug: 'file-handling', content: [{ type: 'text', value: 'Reading and writing files, CSV handling, JSON parsing, and context managers.' }] },
        { title: 'Error Handling', slug: 'error-handling', content: [{ type: 'text', value: 'try/except/finally blocks, custom exceptions, and debugging techniques.' }] },
      ],
    },
    {
      title: 'Advanced',
      items: [
        { title: 'Decorators & Generators', slug: 'decorators-generators', badge: 'New', content: [{ type: 'text', value: 'Advanced Python patterns including decorators, generators, iterators, and context managers.' }] },
        { title: 'Libraries & Frameworks', slug: 'libraries-frameworks', content: [{ type: 'text', value: 'NumPy, Pandas, Matplotlib, Flask, Django, and other essential libraries.' }] },
      ],
    },
  ],
};

const javaGuide: DocEntry = {
  slug: 'java-programming-guide',
  title: 'Java Programming Guide',
  description: 'Comprehensive Java reference — OOP, data structures, and application development.',
  category: 'Programming Languages',
  icon: 'coffee',
  sections: [
    {
      title: 'Fundamentals',
      items: [
        { title: 'Introduction to Java', slug: 'java-intro', content: [{ type: 'text', value: 'Java is a class-based, object-oriented programming language. Learn about JDK, JRE, JVM, and your first Java program.' }] },
        { title: 'Data Types & Operators', slug: 'java-data-types', content: [{ type: 'text', value: 'Primitive types, reference types, operators, and type casting in Java.' }] },
        { title: 'Control Structures', slug: 'java-control', content: [{ type: 'text', value: 'Conditional statements, loops, switch-case, and branching in Java.' }] },
      ],
    },
    {
      title: 'Object-Oriented Programming',
      items: [
        { title: 'Classes & Objects', slug: 'java-classes', content: [{ type: 'text', value: 'Defining classes, constructors, methods, access modifiers, and the this keyword.' }] },
        { title: 'Inheritance & Polymorphism', slug: 'java-inheritance', content: [{ type: 'text', value: 'Extending classes, method overriding, abstract classes, and interfaces.' }] },
        { title: 'Collections Framework', slug: 'java-collections', badge: 'Important', content: [{ type: 'text', value: 'ArrayList, LinkedList, HashMap, HashSet, TreeMap, and iterators.' }] },
      ],
    },
  ],
};

const cProgrammingGuide: DocEntry = {
  slug: 'c-programming-guide',
  title: 'C Programming Guide',
  description: 'Systems programming with C — pointers, memory management, and low-level operations.',
  category: 'Programming Languages',
  icon: 'zap',
  sections: [
    {
      title: 'Basics',
      items: [
        { title: 'Getting Started with C', slug: 'c-intro', content: [{ type: 'text', value: 'Introduction to C programming, compilers, and your first program.' }] },
        { title: 'Variables & Data Types', slug: 'c-data-types', content: [{ type: 'text', value: 'int, float, char, double, arrays, and strings in C.' }] },
        { title: 'Pointers & Memory', slug: 'c-pointers', badge: 'Important', content: [{ type: 'text', value: 'Pointer arithmetic, dynamic memory allocation (malloc/calloc/free), and memory management.' }] },
      ],
    },
    {
      title: 'Advanced',
      items: [
        { title: 'Structures & Unions', slug: 'c-structures', content: [{ type: 'text', value: 'User-defined data types, struct, union, and typedef.' }] },
        { title: 'File I/O', slug: 'c-file-io', content: [{ type: 'text', value: 'File operations, reading/writing files, and binary file handling in C.' }] },
      ],
    },
  ],
};

const mathReference: DocEntry = {
  slug: 'mathematics-reference',
  title: 'Mathematics Reference',
  description: 'Quick reference for key mathematical concepts used across IIT Madras courses.',
  category: 'Programming Languages',
  icon: 'compass',
  sections: [
    {
      title: 'Foundations',
      items: [
        { title: 'Sets & Logic', slug: 'sets-logic', content: [{ type: 'text', value: 'Set theory, propositional logic, predicates, and quantifiers.' }] },
        { title: 'Functions & Relations', slug: 'functions-relations', content: [{ type: 'text', value: 'Functions, domain, range, injective, surjective, bijective, and equivalence relations.' }] },
        { title: 'Number Theory Basics', slug: 'number-theory', content: [{ type: 'text', value: 'Divisibility, primes, GCD, LCM, modular arithmetic.' }] },
      ],
    },
    {
      title: 'Calculus',
      items: [
        { title: 'Limits & Continuity', slug: 'limits-continuity', content: [{ type: 'text', value: 'Limits, epsilon-delta definition, continuity, and intermediate value theorem.' }] },
        { title: 'Differentiation', slug: 'differentiation', content: [{ type: 'text', value: 'Derivatives, chain rule, product rule, quotient rule, and applications.' }] },
        { title: 'Integration', slug: 'integration', content: [{ type: 'text', value: 'Definite and indefinite integrals, integration techniques, and applications.' }] },
      ],
    },
    {
      title: 'Linear Algebra',
      items: [
        { title: 'Matrices', slug: 'matrices', content: [{ type: 'text', value: 'Matrix operations, determinants, inverse, and rank.' }] },
        { title: 'Eigenvalues', slug: 'eigenvalues', badge: 'Important', content: [{ type: 'text', value: 'Eigenvalues, eigenvectors, diagonalization, and spectral decomposition.' }] },
        { title: 'Vector Spaces', slug: 'vector-spaces', content: [{ type: 'text', value: 'Vector spaces, basis, dimension, linear independence, and span.' }] },
      ],
    },
  ],
};

// ─── EXPORT ALL ───────────────────────────────────────────────

export const docsData: DocEntry[] = [
  iitMadrasBSDegree,
  iitMadrasHandbook,
  pythonGuide,
  javaGuide,
  cProgrammingGuide,
  mathReference,
];
