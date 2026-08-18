import type {
  User,
  Resume,
  JobDescription,
  Interview,
  Question,
  Answer,
  InterviewResult,
  InterviewSetup,
  DashboardStats,
} from '@/types';

export const mockUser: User = {
  id: 'u-1',
  name: 'Aarav Sharma',
  email: 'aarav@example.com',
  role: 'candidate',
  createdAt: '2024-09-15T10:00:00Z',
};

export const mockResume: Resume = {
  id: 'r-1',
  userId: 'u-1',
  fileName: 'Aarav_Sharma_Resume.pdf',
  content:
    'Full-stack developer with 3 years of experience in React, Node.js, TypeScript and Python. Built scalable e-commerce and ed-tech platforms.',
  skills: ['React', 'TypeScript', 'Node.js', 'Python', 'Tailwind CSS', 'MongoDB', 'Git'],
  experience: [
    {
      company: 'TechNova Solutions',
      role: 'Frontend Engineer',
      duration: 'Jan 2022 - Present',
      description:
        'Developed customer-facing dashboards using React and TypeScript, improving page load by 30%.',
    },
    {
      company: 'CodeCrate',
      role: 'Junior Web Developer',
      duration: 'Jun 2021 - Dec 2021',
      description: 'Built landing pages and email templates for marketing campaigns.',
    },
  ],
  education: [
    {
      institution: 'Mumbai University',
      degree: 'B.Tech in Computer Engineering',
      year: '2018 - 2022',
    },
  ],
  strengths: ['Strong React fundamentals', 'Clean component design', 'Version control best practices'],
  improvements: ['System design depth', 'Testing coverage', 'DevOps basics'],
  uploadedAt: '2024-10-01T08:30:00Z',
};

export const mockResumeAnalysis = {
  ...mockResume,
  missingKeywords: ['AWS', 'Docker', 'CI/CD'],
  atsScore: 78,
};

export const mockJobDescription: JobDescription = {
  id: 'jd-1',
  userId: 'u-1',
  title: 'Software Engineer - Frontend',
  company: 'InnovateTech',
  description:
    'We are looking for a frontend engineer with strong React and TypeScript skills to build accessible, high-performance web applications.',
  requiredSkills: ['React', 'TypeScript', 'HTML', 'CSS', 'Git'],
  preferredSkills: ['Tailwind CSS', 'Jest', 'GraphQL'],
  experienceLevel: 'Mid-level',
  keyResponsibilities: [
    'Build reusable UI components',
    'Optimize application performance',
    'Collaborate with designers and backend engineers',
    'Write unit and integration tests',
  ],
  createdAt: '2024-10-05T14:20:00Z',
};

export const mockJDAnalysis = {
  ...mockJobDescription,
  matchScore: 82,
  matchedSkills: ['React', 'TypeScript', 'HTML', 'CSS', 'Git'],
  missingSkills: ['GraphQL', 'Jest'],
};

export const mockQuestions: Question[] = [
  {
    id: 'q-1',
    text: 'Explain the difference between state and props in React.',
    category: 'technical',
    difficulty: 'easy',
    expectedAnswer:
      'Props are read-only data passed from parent to child, while state is mutable data managed within a component.',
  },
  {
    id: 'q-2',
    text: 'How would you optimize a slow React application?',
    category: 'technical',
    difficulty: 'medium',
    expectedAnswer:
      'Use React.memo, useMemo, useCallback, virtualize long lists, code-split, and reduce re-renders.',
  },
  {
    id: 'q-3',
    text: 'Describe a time you had to resolve a conflict in a team.',
    category: 'behavioral',
    difficulty: 'medium',
    expectedAnswer:
      'STAR format: situation, task, action, result. Emphasize communication and empathy.',
  },
  {
    id: 'q-4',
    text: 'What is closure in JavaScript? Give an example.',
    category: 'technical',
    difficulty: 'medium',
    expectedAnswer:
      'A closure is a function that remembers variables from its enclosing scope even after the outer function has finished executing.',
  },
  {
    id: 'q-5',
    text: 'Why do you want to work at this company?',
    category: 'behavioral',
    difficulty: 'easy',
    expectedAnswer: 'Mention alignment with company mission, growth opportunities, and values.',
  },
];

export const mockAnswers: Answer[] = [
  {
    questionId: 'q-1',
    text: 'Props are passed down and read-only; state is local and can be updated with setState.',
    skipped: false,
    timeTaken: 60,
    submittedAt: '2024-10-10T09:05:00Z',
  },
  {
    questionId: 'q-2',
    text: 'I would use React.memo and useMemo to prevent unnecessary re-renders.',
    skipped: false,
    timeTaken: 90,
    submittedAt: '2024-10-10T09:08:00Z',
  },
];

export const mockResult: InterviewResult = {
  score: 76,
  totalQuestions: 5,
  answered: 4,
  skipped: 1,
  feedback:
    'Good understanding of React basics. Behavioral questions need more structure. Keep practicing the STAR method.',
  strengths: ['Clear technical explanations', 'Good React knowledge'],
  weaknesses: ['Vague behavioral examples', 'Time management on follow-ups'],
  suggestions: ['Practice STAR responses', 'Add metrics to behavioral answers'],
  questionResults: [
    {
      questionId: 'q-1',
      question: 'Explain the difference between state and props in React.',
      answer: 'Props are passed down and read-only; state is local and can be updated with setState.',
      score: 85,
      feedback: 'Concise and accurate.',
    },
    {
      questionId: 'q-2',
      question: 'How would you optimize a slow React application?',
      answer: 'I would use React.memo and useMemo to prevent unnecessary re-renders.',
      score: 70,
      feedback: 'Good start, but missing code splitting and virtualization.',
    },
    {
      questionId: 'q-3',
      question: 'Describe a time you had to resolve a conflict in a team.',
      answer: '',
      score: 0,
      feedback: 'Skipped.',
    },
  ],
};

export const mockInterviewSetup: InterviewSetup = {
  resumeId: mockResume.id,
  jobDescriptionId: mockJobDescription.id,
  difficulty: 'medium',
  questionCount: 5,
  type: 'mixed',
  duration: 30,
};

export const mockInterview: Interview = {
  id: 'i-1',
  userId: 'u-1',
  setup: mockInterviewSetup,
  title: 'Frontend Mock Interview - InnovateTech',
  status: 'completed',
  startedAt: '2024-10-10T09:00:00Z',
  completedAt: '2024-10-10T09:35:00Z',
  questions: mockQuestions,
  answers: mockAnswers,
  result: mockResult,
};

export const mockPreviousInterviews: Interview[] = [
  mockInterview,
  {
    id: 'i-2',
    userId: 'u-1',
    setup: { ...mockInterviewSetup, difficulty: 'easy' },
    title: 'React Fundamentals Check',
    status: 'completed',
    startedAt: '2024-10-02T10:00:00Z',
    completedAt: '2024-10-02T10:20:00Z',
    questions: mockQuestions.slice(0, 3),
    answers: [mockAnswers[0]],
    result: { ...mockResult, score: 62 },
  },
];

export const mockDashboardStats: DashboardStats = {
  totalInterviews: 2,
  completedInterviews: 2,
  averageScore: 69,
  improvementRate: 14,
};
