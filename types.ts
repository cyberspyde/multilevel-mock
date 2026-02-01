// Legacy types for old React app (not used in Next.js app)

export interface Question {
  id: string;
  timestamp: number;
  text: string;
}

export interface TestScenario {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  questions: Question[];
}

export interface Answer {
  questionId: string;
  audioBlob: Blob | null;
  transcription: string;
  recordedAt: string;
}

export interface StudentSession {
  id: string;
  studentName: string;
  testId: string;
  startedAt: string;
  answers: Answer[];
  completed: boolean;
  aiSummary?: string;
}
