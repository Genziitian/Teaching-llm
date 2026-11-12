'use client';
import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronUp, AlertCircle, Sparkles, Clock, Layout } from 'lucide-react';

const REATTEMPT_SYLLABUS = [
  {
    subject: "Mathematics for Data Science I",
    topics: ["Set Theory", "Coordinate Geometry", "Quadratic Functions", "Polynomials"]
  },
  {
    subject: "Statistics for Data Science I",
    topics: ["Types of Data", "Descriptive Statistics", "Central Tendency", "Dispersion", "Correlation"]
  },
  {
    subject: "Computational Thinking",
    topics: ["Variables", "Iteration", "Conditions", "Functions", "Nested Logic"]
  },
  {
    subject: "English I",
    topics: ["Sounds", "Parts of Speech", "Sentences", "Speaking Skills"]
  }
];

const FOUNDATION_SYLLABUS = [
  {
    subject: "Mathematics for Data Science I",
    groups: [
      { name: "Week 1–4: Basics", topics: ["Set Theory", "Coordinate Geometry", "Quadratic Functions", "Polynomials"] },
      { name: "Week 5–8: Core Concepts", topics: ["Functions", "Logarithms", "Limits", "Derivatives", "Integrals"] },
      { name: "Week 9–12: Advanced Topics", topics: ["Graph Theory", "Algorithms"] }
    ]
  },
  {
    subject: "Statistics for Data Science I",
    groups: [
      { name: "Week 1–4: Descriptive Statistics", topics: ["Types of Data", "Descriptive Statistics", "Central Tendency", "Dispersion", "Correlation"] },
      { name: "Week 5–8: Probability", topics: ["Counting", "Probability", "Random Variables"] },
      { name: "Week 9–12: Distributions", topics: ["Distributions"] }
    ]
  },
  {
    subject: "Mathematics for Data Science II",
    groups: [
      { name: "Week 1–6: Linear Algebra", topics: ["Linear Algebra", "Vector Spaces", "Matrices", "Transformations", "Orthogonality"] },
      { name: "Week 7–12: Multivariable Calculus", topics: ["Multivariable Calculus", "Gradients", "Hessian"] }
    ]
  },
  {
    subject: "Statistics for Data Science II",
    groups: [
      { name: "Week 1–4: Foundations", topics: ["Multiple Random Variables", "Expectation", "Covariance", "Continuous Distributions"] },
      { name: "Week 5-12: Advanced Methods", topics: ["Estimation", "Bayesian Methods", "Hypothesis Testing"] }
    ]
  },
  {
    subject: "Computational Thinking",
    groups: [
      { name: "Week 1–4: Fundamentals", topics: ["Variables", "Iterations", "Data Structures"] },
      { name: "Week 5–8: Logic Building", topics: ["Graphs", "Recursion", "OOP"] },
      { name: "Week 9–12: Advanced Concepts", topics: ["Concurrency", "Decision Trees"] }
    ]
  },
  {
    subject: "Programming in Python",
    groups: [
      { name: "Week 1–4: Fundamentals", topics: ["Algorithms", "Conditionals", "Loops"] },
      { name: "Week 5–8: Logic Building", topics: ["Collections", "File Handling", "Modules"] },
      { name: "Week 9–12: Advanced Concepts", topics: ["NumPy & Pandas basics"] }
    ]
  },
  {
    subject: "English I & II",
    groups: [
      { name: "English I: Grammar & Skills", topics: ["Grammar", "Speaking", "Writing", "Reading", "Listening"] },
      { name: "English II: Professionalism", topics: ["Professional Communication"] }
    ]
  }
];

const DIPLOMA_SYLLABUS = [
  {
    subject: "Database Management Systems",
    weeks: [
      { week: 1, topic: "Course Overview" },
      { week: 2, topic: "Relational Model and Basic SQL" },
      { week: 3, topic: "Intermediate and Advanced SQL" },
      { week: 4, topic: "Relational Query Languages and Database Design" },
      { week: 5, topic: "Data Warehousing and Data Mining" },
      { week: 6, topic: "Transactions and Concurrency Control" },
      { week: 7, topic: "Database Recovery Techniques" },
      { week: 8, topic: "Database Security and Integrity" },
      { week: 9, topic: "Distributed Databases" },
      { week: 10, topic: "Object-Oriented and Object-Relational Databases" },
      { week: 11, topic: "XML and Web Databases" },
      { week: 12, topic: "Summary and Advanced Topics" }
    ]
  },
  {
    subject: "Programming, Data Structures and Algorithms using Python",
    weeks: [
      { week: 1, topic: "Python Refresher" },
      { week: 2, topic: "Complexity, Notations, Sorting and Searching Algorithms" },
      { week: 3, topic: "Arrays, Lists, Stacks, Queues, Hashing" },
      { week: "4–5", topic: "Graph Algorithms" },
      { week: 6, topic: "Union-Find, Priority Queue, Heap, BST" },
      { week: 7, topic: "Balanced Search Tree, Greedy Algorithms" },
      { week: 8, topic: "Divide and Conquer" },
      { week: 9, topic: "Dynamic Programming" },
      { week: 10, topic: "String or Pattern Matching Algorithms" },
      { week: 11, topic: "Network Flows, Linear Programming" },
      { week: 12, topic: "Summary" }
    ]
  },
  {
    subject: "Modern Application Development I",
    weeks: [
      { week: 1, topic: "Basic terminologies of Web" },
      { week: 2, topic: "Webpages written in HTML and CSS" },
      { week: 3, topic: "Presentation layer - View" },
      { week: 4, topic: "Models - Introduction to databases" },
      { week: 5, topic: "Controllers - Business logic" },
      { week: 6, topic: "APIs and REST APIs" },
      { week: 7, topic: "Backend Systems" },
      { week: 8, topic: "Application Frontend" },
      { week: 9, topic: "Application Security" },
      { week: 10, topic: "Testing of Web Applications" },
      { week: 11, topic: "HTML Evolution and Beyond HTML" },
      { week: 12, topic: "Application Deployment" }
    ]
  },
  {
    subject: "Programming Concepts using Java",
    weeks: [
      { week: 1, topic: "OOP Class Hierarchy" },
      { week: 2, topic: "Inheritance and Overriding" },
      { week: 3, topic: "Polymorphism" },
      { week: 4, topic: "Abstract Classes" },
      { week: 5, topic: "Collections and Iterators" },
      { week: 6, topic: "Generics and Callbacks" },
      { week: "7–8", topic: "Cloning, I/O Serialization, Packages" },
      { week: 9, topic: "Exception Handling" },
      { week: "10–12", topic: "Concurrent Programming" }
    ]
  },
  {
    subject: "Modern Application Development II",
    weeks: [
      { week: 1, topic: "Basics of JavaScript" },
      { week: 2, topic: "Advanced JavaScript" },
      { week: 3, topic: "Introduction to Web Frontend" },
      { week: 4, topic: "Introduction to VueJS" },
      { week: 5, topic: "Vue with APIs" },
      { week: 6, topic: "Advanced VueJS" },
      { week: 7, topic: "Advanced State Management" },
      { week: 8, topic: "Authentication and Designing APIs" },
      { week: 9, topic: "Asynchronous Jobs" },
      { week: 10, topic: "Inter-Service Messaging and Webhooks" },
      { week: 11, topic: "Performance" },
      { week: 12, topic: "Project" }
    ]
  },
  {
    subject: "System Commands",
    weeks: [
      { week: 1, topic: "Intro to GNU/Linux and Command Line" },
      { week: 2, topic: "Package Management, File Permissions, Environment Variables" },
      { week: 3, topic: "Shell Variables and File Systems" },
      { week: 4, topic: "Redirection, Regex, Editors, Bash Scripts" },
      { week: 5, topic: "Filters (head, tail, cut, paste, sort, uniq)" },
      { week: 6, topic: "Advanced Regex (sed, awk)" },
      { week: 7, topic: "Process Management and Networking" },
      { week: 8, topic: "Bash Scripting" }
    ]
  },
  {
    subject: "Machine Learning Foundations",
    weeks: [
      { week: 1, topic: "Introduction to ML" },
      { week: 2, topic: "Calculus for ML" },
      { week: "3–5", topic: "Linear Algebra concepts (Least Squares, Eigenvalues, Symmetric Matrices)" },
      { week: 6, topic: "SVD and PCA" },
      { week: 7, topic: "Unconstrained Optimization" },
      { week: 8, topic: "Convex Optimization" },
      { week: 9, topic: "Constrained Optimization" },
      { week: 10, topic: "Probabilistic Models" },
      { week: 11, topic: "Exponential Family" },
      { week: 12, topic: "Parameter Estimation and EM" }
    ]
  },
  {
    subject: "Business Data Management",
    weeks: [
      { week: 1, topic: "Economics basics" },
      { week: 2, topic: "Demand/Supply and Cost" },
      { week: 3, topic: "Firm strategies" },
      { week: 4, topic: "Industry data and metrics" },
      { week: "5–6", topic: "E-commerce case study" },
      { week: "7–8", topic: "Manufacturing case study" },
      { week: 9, topic: "HR data" },
      { week: "10–11", topic: "FinTech and risk" },
      { week: 12, topic: "Project wrap-up" }
    ]
  },
  {
    subject: "Machine Learning Techniques",
    weeks: [
      { week: "1–2", topic: "Unsupervised Learning and PCA" },
      { week: 3, topic: "Clustering" },
      { week: 4, topic: "Estimation and GMM" },
      { week: "5–6", topic: "Regression" },
      { week: 7, topic: "Classification basics" },
      { week: 8, topic: "Naive Bayes" },
      { week: 9, topic: "Logistic Regression and Perceptron" },
      { week: 10, topic: "SVM" },
      { week: 11, topic: "Ensemble Methods" },
      { week: 12, topic: "Neural Networks" }
    ]
  },
  {
    subject: "Machine Learning Practice",
    weeks: [
      { week: 1, topic: "End-to-end ML project" },
      { week: 2, topic: "Graph Theory" },
      { week: "3–4", topic: "Regression models" },
      { week: 5, topic: "Logistic Regression" },
      { week: "6–7", topic: "Classification" },
      { week: 8, topic: "SVM" },
      { week: "9–10", topic: "Decision Trees and Ensembles" },
      { week: 11, topic: "Neural Networks" },
      { week: 12, topic: "Unsupervised Learning" }
    ]
  },
  {
    subject: "Tools in Data Science",
    weeks: [
      { week: 1, topic: "Dev Tools (Git)" },
      { week: 2, topic: "Jupyter and Environments" },
      { week: 3, topic: "Deployment tools" },
      { week: 4, topic: "LLMs and APIs" },
      { week: 5, topic: "Data sourcing" },
      { week: 6, topic: "Data cleaning" },
      { week: 7, topic: "EDA" },
      { week: 8, topic: "Visualization" },
      { week: 9, topic: "Advanced visualization" },
      { week: 10, topic: "Project structure" },
      { week: 11, topic: "Case study" },
      { week: 12, topic: "Final presentation" }
    ]
  },
  {
    subject: "Business Analytics",
    weeks: [
      { week: 1, topic: "Dashboarding" },
      { week: 2, topic: "Data summarization" },
      { week: 3, topic: "Preference analysis" },
      { week: 4, topic: "Regression basics" },
      { week: 5, topic: "Regression diagnostics" },
      { week: 6, topic: "Logistic Regression" },
      { week: 7, topic: "ANOVA" },
      { week: "8–9", topic: "Time series" },
      { week: 10, topic: "Decision Trees" },
      { week: 11, topic: "Clustering" },
      { week: 12, topic: "Capstone" }
    ]
  },
  {
    subject: "Deep Learning and Generative AI",
    weeks: [
      { week: 1, topic: "ANN theory" },
      { week: 2, topic: "ANN practice" },
      { week: 3, topic: "CNN theory" },
      { week: 4, topic: "CNN practice" },
      { week: 5, topic: "RNN/LSTM theory" },
      { week: 6, topic: "Sequential data practice" },
      { week: "7–8", topic: "Generative models (GANs, VAEs, Diffusion)" },
      { week: 9, topic: "Image generation" },
      { week: 10, topic: "Transformers and LLM basics" },
      { week: 11, topic: "BERT and fine-tuning" },
      { week: 12, topic: "Prompting and LLM practice" }
    ]
  }
];

const QUIZ_1_MAPPING: Record<string, string> = {
  "Machine Learning Practice": "No quiz",
  "Tools in Data Science": "No quiz",
};

const QUIZ_2_MAPPING: Record<string, string> = {
  "Computational Thinking": "Week 1–8",
  "Mathematics for Data Science I": "Week 5–8",
  "Programming in Python": "No quiz",
};

const QuizBadge = ({ label, value, type }: { label: string, value: string, type: 'quiz1' | 'quiz2' }) => (
  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border-2 ${
    type === 'quiz1' 
      ? 'bg-blue-50 border-blue-100 text-blue-700' 
      : 'bg-indigo-50 border-indigo-100 text-indigo-700'
  }`}>
    <span className="text-[10px] font-black uppercase tracking-wider opacity-60">{label}</span>
    <span className="text-xs font-bold">{value}</span>
  </div>
);

export default function Syllabus() {
  const [course, setCourse] = useState('');
  const [level, setLevel] = useState('');
  const [openSubject, setOpenSubject] = useState<string | null>(null);

  const toggleSubject = (subject: string) => {
    setOpenSubject(openSubject === subject ? null : subject);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-12 md:py-20 min-h-[70vh]">
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-6xl font-black text-[#0b1120] mb-4 tracking-tight flex items-center justify-center gap-3">
          <BookOpen className="w-10 h-10 md:w-12 md:h-12 text-blue-600" />
          Syllabus
        </h1>
        <p className="text-lg md:text-xl text-gray-500 font-medium max-w-2xl mx-auto">
          Deep dive into the curriculum. Stay structured, stay ahead.
        </p>
      </div>

      <div className="bg-white rounded-[2rem] border-4 border-[#0b1120] shadow-[12px_12px_0px_#0b1120] p-6 md:p-10 mb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-black text-[#0b1120] uppercase tracking-wider">
              <Layout className="w-4 h-4" />
              Program
            </label>
            <div className="relative group">
              <select
                value={course}
                onChange={(e) => {
                  setCourse(e.target.value);
                  setLevel('');
                  setOpenSubject(null);
                }}
                className="w-full appearance-none bg-gray-50 border-3 border-gray-200 rounded-2xl px-5 py-4 font-bold text-[#0b1120] outline-none group-hover:border-[#0b1120] focus:border-[#0b1120] focus:ring-8 focus:ring-blue-50 transition-all cursor-pointer"
              >
                <option value="" disabled>Choose Course</option>
                <option value="Data Science">Data Science</option>
                <option value="Electronics">Electronics</option>
              </select>
              <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-[#0b1120]">
                <ChevronDown className="w-6 h-6" />
              </div>
            </div>
          </div>

          {course === 'Data Science' && (
            <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-500">
              <label className="flex items-center gap-2 text-sm font-black text-[#0b1120] uppercase tracking-wider">
                <Clock className="w-4 h-4" />
                Level
              </label>
              <div className="relative group">
                <select
                  value={level}
                  onChange={(e) => {
                    setLevel(e.target.value);
                    setOpenSubject(null);
                  }}
                  className="w-full appearance-none bg-gray-50 border-3 border-gray-200 rounded-2xl px-5 py-4 font-bold text-[#0b1120] outline-none group-hover:border-[#0b1120] focus:border-[#0b1120] focus:ring-8 focus:ring-blue-50 transition-all cursor-pointer"
                >
                  <option value="" disabled>Choose Level</option>
                  <option value="Reattempt">Reattempt</option>
                  <option value="Foundation">Foundation</option>
                  <option value="Diploma">Diploma</option>
                  <option value="Degree">Degree</option>
                </select>
                <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-[#0b1120]">
                  <ChevronDown className="w-6 h-6" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="transition-all duration-500">
        {!course && (
          <div className="flex flex-col items-center justify-center p-20 text-center bg-gray-50/50 rounded-[2.5rem] border-4 border-dashed border-gray-200">
            <AlertCircle className="w-16 h-16 text-gray-300 mb-6" />
            <h3 className="text-2xl font-black text-[#0b1120] mb-3">Begin Exploring</h3>
            <p className="text-gray-500 font-bold max-w-sm">
              Select your course and level above to see the path ahead.
            </p>
          </div>
        )}

        {course === 'Electronics' && (
          <div className="flex flex-col items-center justify-center p-20 text-center bg-blue-50/40 rounded-[2.5rem] border-4 border-dashed border-blue-200">
            <Sparkles className="w-16 h-16 text-blue-400 mb-6" />
            <h3 className="text-2xl font-black text-[#0b1120] mb-3">Wait for it!</h3>
            <p className="text-blue-600 font-bold max-w-md mx-auto">
              Our Electronics syllabus is being crafted by industry experts and will be available very soon.
            </p>
          </div>
        )}

        {course === 'Data Science' && level && (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="flex items-center justify-between mb-10 border-b-4 border-gray-100 pb-6">
              <div>
                <h2 className="text-3xl font-black text-[#0b1120] mb-1">{level} Curriculum</h2>
                <p className="text-gray-500 font-bold">Data Science Program</p>
              </div>
              <div className="hidden sm:block">
                <span className="bg-blue-600 text-white px-5 py-2 rounded-full font-black text-sm uppercase tracking-widest shadow-lg">
                  {level === 'Reattempt' ? 'Revision Focused' : 'Comprehensive'}
                </span>
              </div>
            </div>

            <div className="space-y-6">
              {(level === 'Foundation' ? FOUNDATION_SYLLABUS : (level === 'Reattempt' ? REATTEMPT_SYLLABUS : (level === 'Diploma' ? DIPLOMA_SYLLABUS : []))).map((item: any, idx) => (
                <div 
                  key={idx} 
                  className={`bg-white rounded-3xl border-4 transition-all duration-300 overflow-hidden ${
                    openSubject === item.subject 
                      ? 'border-[#0b1120] shadow-[8px_8px_0px_#0b1120]' 
                      : 'border-gray-100 hover:border-gray-300 transform hover:-translate-y-1'
                  }`}
                >
                  <button
                    onClick={() => toggleSubject(item.subject)}
                    className="w-full px-8 py-6 md:py-8 flex flex-col md:flex-row md:items-center justify-between text-left focus:outline-none gap-4"
                  >
                    <div className="space-y-3">
                      <span className="font-black text-xl md:text-2xl text-[#0b1120] block">{item.subject}</span>
                      <div className="flex flex-wrap gap-2">
                        {/* Quiz 1 Coverage (Primary) */}
                        <QuizBadge 
                          label="Quiz 1" 
                          value={QUIZ_1_MAPPING[item.subject] || "Week 1–4"} 
                          type="quiz1" 
                        />
                        
                        {/* Quiz 2 Coverage */}
                        {QUIZ_2_MAPPING[item.subject] && (
                          <QuizBadge 
                            label="Quiz 2" 
                            value={QUIZ_2_MAPPING[item.subject]} 
                            type="quiz2" 
                          />
                        )}
                      </div>
                    </div>
                    <div className={`transition-transform duration-300 ${openSubject === item.subject ? 'rotate-180 text-blue-600' : 'text-gray-400'}`}>
                      <ChevronDown className="w-7 h-7" />
                    </div>
                  </button>
                  
                  <div 
                    className={`overflow-hidden transition-all duration-500 ease-in-out ${
                      openSubject === item.subject ? 'max-h-[1500px] opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="px-8 pb-8">
                      <div className="h-1 bg-gray-100 w-full mb-8 rounded-full" />
                      
                      {level === 'Foundation' ? (
                        <div className="space-y-8">
                          {item.groups.map((group: any, gIdx: number) => (
                            <div key={gIdx} className="relative pl-6 border-l-4 border-blue-100">
                              <div className="absolute -left-[10px] top-0 w-4 h-4 rounded-full bg-blue-600 border-4 border-white shadow-sm" />
                              <h4 className="text-sm font-black uppercase text-blue-600 tracking-widest mb-4">
                                {group.name}
                              </h4>
                              <ul className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-10">
                                {group.topics.map((topic: string, tIdx: number) => (
                                  <li key={tIdx} className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-[#0b1120]/20" />
                                    <span className="text-gray-700 font-bold">{topic}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      ) : level === 'Diploma' ? (
                        <div className="space-y-6">
                          <div className="grid grid-cols-1 gap-4">
                            {item.weeks.map((w: any, wIdx: number) => (
                              <div key={wIdx} className="flex items-start gap-5 p-4 rounded-2xl bg-gray-50/50 border-2 border-transparent hover:border-blue-100 hover:bg-blue-50/30 transition-all duration-200">
                                <div className="flex-shrink-0 w-20 flex flex-col items-center justify-center p-2 rounded-xl bg-white border-2 border-gray-100 shadow-sm">
                                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-tighter">Week</span>
                                  <span className="text-lg font-black text-blue-600 leading-tight">{w.week}</span>
                                </div>
                                <div className="pt-1">
                                  <p className="text-[#0b1120] font-bold leading-relaxed">{w.topic}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <h4 className="text-sm font-black uppercase text-gray-400 tracking-widest mb-6">Revision Topics</h4>
                          <ul className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-10">
                            {item.topics.map((topic: string, tIdx: number) => (
                              <li key={tIdx} className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                <span className="text-gray-700 font-bold">{topic}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {level !== 'Foundation' && level !== 'Reattempt' && (
                <div className="flex flex-col items-center justify-center p-20 text-center bg-gray-50/50 rounded-[2.5rem] border-4 border-dashed border-gray-200">
                  <Layout className="w-16 h-16 text-gray-300 mb-6" />
                  <h3 className="text-2xl font-black text-[#0b1120] mb-3">Updating {level}</h3>
                  <p className="text-gray-500 font-bold max-w-sm">
                    We are currently populating the detailed syllabus for the {level} level. Stay tuned!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
