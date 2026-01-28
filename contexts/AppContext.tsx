/**
 * Centralized Application State Management
 * Provides global state and actions for the Bestcenter Speaking app
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { TestScenario, StudentSession } from '../types';
import { getTests, createSession, getSession, updateSession } from '../services/storage';
import { preloadWhisper } from '../services/whisper';

interface AppContextType {
  // State
  tests: TestScenario[];
  selectedTest: TestScenario | null;
  studentName: string;
  currentSession: StudentSession | null;
  modelsReady: boolean;
  isLoading: boolean;

  // Actions
  setTests: (tests: TestScenario[]) => void;
  setSelectedTest: (test: TestScenario | null) => void;
  setStudentName: (name: string) => void;
  setCurrentSession: (session: StudentSession | null) => void;
  loadTests: () => Promise<void>;
  startTest: (studentName: string, testId: string) => Promise<StudentSession | null>;
  saveSession: (session: StudentSession) => Promise<void>;
  resetState: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [tests, setTests] = useState<TestScenario[]>([]);
  const [selectedTest, setSelectedTest] = useState<TestScenario | null>(null);
  const [studentName, setStudentName] = useState('');
  const [currentSession, setCurrentSession] = useState<StudentSession | null>(null);
  const [modelsReady, setModelsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize app and preload models
  useEffect(() => {
    const initializeApp = async () => {
      setIsLoading(true);
      try {
        // Load tests from storage
        await loadTests();

        // Preload AI models in background
        preloadWhisper()
          .then(() => {
            console.log('AI models preloaded successfully');
            setModelsReady(true);
          })
          .catch((error) => {
            console.warn('Failed to preload AI models:', error);
            setModelsReady(false);
          });
      } catch (error) {
        console.error('Failed to initialize app:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  const loadTests = useCallback(async () => {
    const loadedTests = await getTests();
    setTests(loadedTests);
  }, []);

  const startTest = useCallback(async (name: string, testId: string): Promise<StudentSession | null> => {
    try {
      const session = await createSession(name, testId);
      setCurrentSession(session);
      setStudentName(name);
      return session;
    } catch (error) {
      console.error('Failed to start test:', error);
      return null;
    }
  }, []);

  const saveSession = useCallback(async (session: StudentSession) => {
    try {
      await updateSession(session);
      setCurrentSession(session);
    } catch (error) {
      console.error('Failed to save session:', error);
      throw error;
    }
  }, []);

  const resetState = useCallback(() => {
    setSelectedTest(null);
    setStudentName('');
    setCurrentSession(null);
  }, []);

  const value: AppContextType = {
    // State
    tests,
    selectedTest,
    studentName,
    currentSession,
    modelsReady,
    isLoading,

    // Actions
    setTests,
    setSelectedTest,
    setStudentName,
    setCurrentSession,
    loadTests,
    startTest,
    saveSession,
    resetState,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};
