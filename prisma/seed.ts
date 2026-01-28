import { PrismaClient, ExamType, QuestionFormat } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin code (default: Admin123)
  const adminCode = await prisma.adminCode.upsert({
    where: { code: 'Admin123' },
    update: {},
    create: {
      code: 'Admin123',
      isActive: true,
    },
  });
  console.log('✅ Admin code created:', adminCode.code);

  // Create some AI codes
  const aiCode1 = await prisma.aICode.upsert({
    where: { code: 'AI-GRADER-2024' },
    update: {},
    create: {
      code: 'AI-GRADER-2024',
      isActive: true,
      maxUses: 100,
    },
  });

  const aiCode2 = await prisma.aICode.upsert({
    where: { code: 'AI-SUMMARY-FREE' },
    update: {},
    create: {
      code: 'AI-SUMMARY-FREE',
      isActive: true,
      maxUses: null, // unlimited
    },
  });
  console.log('✅ AI codes created:', [aiCode1.code, aiCode2.code]);

  // Create admin config for AI settings
  const aiModelConfig = await prisma.adminConfig.upsert({
    where: { key: 'ai_model' },
    update: {},
    create: {
      key: 'ai_model',
      value: 'gemini-2.0-flash-exp',
      description: 'AI model used for grading and summaries',
    },
  });

  const aiApiKey = await prisma.adminConfig.upsert({
    where: { key: 'ai_api_key' },
    update: {},
    create: {
      key: 'ai_api_key',
      value: '', // Empty by default, admin should set this
      description: 'API key for AI service (Gemini, OpenAI, etc.)',
    },
  });
  console.log('✅ Admin config created');

  // Create sample Speaking exam
  const speakingExam = await prisma.exam.upsert({
    where: { id: 'exam-speaking-1' },
    update: {},
    create: {
      id: 'exam-speaking-1',
      title: 'IELTS Speaking Practice Test',
      description: 'Practice your speaking skills with this comprehensive IELTS-style speaking test',
      type: ExamType.SPEAKING,
      unlockCode: 'SPEAK-001',
      isActive: true,
    },
  });

  // Add speaking questions with different formats
  await prisma.speakingQuestion.upsert({
    where: { id: 'q-speaking-1' },
    update: {},
    create: {
      id: 'q-speaking-1',
      examId: speakingExam.id,
      order: 1,
      format: QuestionFormat.TEXT_ONLY,
      text: 'Please introduce yourself and tell me about your hobbies and interests.',
      instructions: 'You will have 1-2 minutes to speak.',
    },
  });

  await prisma.speakingQuestion.upsert({
    where: { id: 'q-speaking-2' },
    update: {},
    create: {
      id: 'q-speaking-2',
      examId: speakingExam.id,
      order: 2,
      format: QuestionFormat.PICTURE_TEXT,
      text: 'Describe the picture you see and explain how it makes you feel.',
      mediaUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
      instructions: 'Take 1 minute to prepare, then speak for 2-3 minutes.',
    },
  });

  await prisma.speakingQuestion.upsert({
    where: { id: 'q-speaking-3' },
    update: {},
    create: {
      id: 'q-speaking-3',
      examId: speakingExam.id,
      order: 3,
      format: QuestionFormat.VIDEO,
      text: 'Based on the video clip you just watched, what do you think will happen next?',
      mediaUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      timestamp: 30,
      instructions: 'The video will pause at the specified time. You will have 2 minutes to answer.',
    },
  });

  await prisma.speakingQuestion.upsert({
    where: { id: 'q-speaking-4' },
    update: {},
    create: {
      id: 'q-speaking-4',
      examId: speakingExam.id,
      order: 4,
      format: QuestionFormat.AUDIO_ONLY,
      text: 'Listen to the audio clip and answer the question you hear.',
      mediaUrl: 'https://www2.cs.uic.edu/~i101/SoundFiles/BabyElephantWalk60.wav',
      instructions: 'You will hear the audio once, then have 2 minutes to respond.',
    },
  });
  console.log('✅ Speaking exam created with questions');

  // Create sample Writing exam
  const writingExam = await prisma.exam.upsert({
    where: { id: 'exam-writing-1' },
    update: {},
    create: {
      id: 'exam-writing-1',
      title: 'IELTS Academic Writing Task',
      description: 'Practice your academic writing skills with this IELTS-style writing test',
      type: ExamType.WRITING,
      unlockCode: 'WRITE-001',
      isActive: true,
    },
  });

  await prisma.writingPrompt.upsert({
    where: { id: 'prompt-writing-1' },
    update: {},
    create: {
      id: 'prompt-writing-1',
      examId: writingExam.id,
      order: 1,
      title: 'Task 1: Report Writing',
      prompt: 'The chart below shows the percentage of households in owned and rented accommodation in England and Wales between 1918 and 2011. Summarize the information by selecting and reporting the main features, and make comparisons where relevant.',
      wordLimit: 150,
      timeLimit: 20,
      instructions: 'Write at least 150 words. Allow approximately 20 minutes for this task.',
    },
  });

  await prisma.writingPrompt.upsert({
    where: { id: 'prompt-writing-2' },
    update: {},
    create: {
      id: 'prompt-writing-2',
      examId: writingExam.id,
      order: 2,
      title: 'Task 2: Essay Writing',
      prompt: 'Some people think that the best way to reduce crime is to give longer prison sentences. Others, however, believe there are better alternative ways of reducing crime. Discuss both views and give your opinion.',
      wordLimit: 250,
      timeLimit: 40,
      instructions: 'Write at least 250 words. Allow approximately 40 minutes for this task.',
    },
  });
  console.log('✅ Writing exam created with prompts');

  console.log('🎉 Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
