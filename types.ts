export interface Question {
  id: string;
  timestamp: number; // Seconds into the video when the video should pause
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
  audioBlob: Blob | null; // In a real app, this would be a URL to S3/Cloud storage
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

// Helper to simulate DB Delay
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));