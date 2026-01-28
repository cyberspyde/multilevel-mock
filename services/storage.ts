/**
 * Storage Service Stub
 * This file provides type-safe stubs for the legacy Vite-based components.
 * The actual functionality has been migrated to Prisma + Next.js API routes.
 */

import { TestScenario, StudentSession } from '../types';

export async function saveTest(test: TestScenario): Promise<void> {
  console.warn('saveTest is deprecated - use API routes instead');
}

export async function getTests(): Promise<TestScenario[]> {
  console.warn('getTests is deprecated - use API routes instead');
  return [];
}

export async function createSession(studentName: string, testId: string): Promise<StudentSession | null> {
  console.warn('createSession is deprecated - use API routes instead');
  return null;
}

export async function getSession(sessionId: string): Promise<StudentSession | null> {
  console.warn('getSession is deprecated - use API routes instead');
  return null;
}

export async function updateSession(session: StudentSession): Promise<void> {
  console.warn('updateSession is deprecated - use API routes instead');
}
