import React, { useState, useEffect } from 'react';
import { TestScenario, StudentSession } from './types';
import { AppProvider, useApp } from './contexts/AppContext';
import AdminPanel from './components/AdminPanel';
import TestPlayer from './components/TestPlayer';
import Button from './components/Button';

type View = 'LANDING' | 'ADMIN' | 'REGISTER' | 'TEST' | 'SUMMARY';

// Inner component that uses the context
const AppContent: React.FC = () => {
  const [currentView, setCurrentView] = useState<View>('LANDING');
  const {
    tests,
    selectedTest,
    studentName,
    currentSession,
    loadTests,
    setSelectedTest,
    setStudentName,
    setCurrentSession,
    startTest,
    saveSession,
    resetState,
  } = useApp();

  useEffect(() => {
    // Reload tests when view changes (e.g. after admin adds test)
    loadTests();
  }, [currentView, loadTests]);

  const handleStartTest = async () => {
    if (!selectedTest || !studentName) return;

    const session = await startTest(studentName, selectedTest.id);
    if (session) {
      setCurrentView('TEST');
    }
  };

  const handleTestComplete = async (completedSession: StudentSession) => {
    await saveSession(completedSession);
    setCurrentView('SUMMARY');
  };

  const reset = () => {
    resetState();
    setCurrentView('LANDING');
  };

  const renderView = () => {
    switch (currentView) {
      case 'ADMIN':
        return (
          <div className="animate-fade-in">
             <div className="mb-6 flex items-center gap-4">
                <Button variant="secondary" onClick={() => setCurrentView('LANDING')}>&larr; Back Home</Button>
             </div>
             <AdminPanel />
          </div>
        );

      case 'REGISTER':
        return (
          <div className="max-w-md mx-auto mt-10 animate-fade-in">
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Candidate Registration</h2>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                  <input 
                    type="text" 
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Jane Doe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Select Test Scenario</label>
                  <select 
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                    onChange={(e) => setSelectedTest(tests.find(t => t.id === e.target.value) || null)}
                    value={selectedTest?.id || ''}
                  >
                    <option value="" disabled>Choose a test...</option>
                    {tests.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                </div>
                
                <div className="pt-4">
                  <Button 
                    className="w-full text-lg" 
                    onClick={handleStartTest}
                    disabled={!studentName || !selectedTest}
                  >
                    Begin Examination
                  </Button>
                </div>
              </div>
            </div>
            <div className="mt-6 text-center">
              <button onClick={() => setCurrentView('LANDING')} className="text-gray-500 hover:text-gray-800 text-sm">Cancel</button>
            </div>
          </div>
        );

      case 'TEST':
        return selectedTest && currentSession ? (
          <TestPlayer 
            test={selectedTest} 
            session={currentSession} 
            onComplete={handleTestComplete}
          />
        ) : <div>Error loading test</div>;

      case 'SUMMARY':
        return currentSession ? (
           <div className="max-w-3xl mx-auto animate-fade-in space-y-8">
             <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-100">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">Test Results</h2>
                    <p className="text-gray-500 mt-1">Candidate: {currentSession.studentName}</p>
                  </div>
                  <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full font-bold text-sm">
                    COMPLETED
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                    <h3 className="flex items-center gap-2 text-blue-900 font-bold text-lg mb-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                      AI Examiner Feedback
                    </h3>
                    <p className="text-blue-800 leading-relaxed whitespace-pre-wrap">
                      {currentSession.aiSummary || "Generating summary..."}
                    </p>
                  </div>

                  <div>
                    <h3 className="font-bold text-gray-900 mb-4">Transcript Analysis</h3>
                    <div className="space-y-4">
                      {currentSession.answers.map((ans, idx) => (
                        <div key={idx} className="bg-gray-50 p-4 rounded-lg">
                          <p className="text-xs text-gray-500 uppercase font-bold mb-1">Question {idx + 1}</p>
                          <p className="text-gray-800 italic">"{ans.transcription}"</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-100 flex justify-center">
                   <Button onClick={reset}>Return to Home</Button>
                </div>
             </div>
           </div>
        ) : null;

      case 'LANDING':
      default:
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-fade-in">
            <div className="space-y-4 max-w-2xl">
              <h1 className="text-5xl font-extrabold text-gray-900 tracking-tight">
                Bestcenter Speaking
              </h1>
              <p className="text-xl text-gray-500">
                The next generation of autonomous English speaking evaluation.
                Powered by AI.
              </p>
            </div>
            
            <div className="flex gap-4">
              <Button 
                onClick={() => setCurrentView('REGISTER')}
                className="px-8 py-4 text-lg shadow-lg hover:shadow-xl hover:-translate-y-1"
              >
                I'm a Student
              </Button>
              <Button 
                variant="secondary"
                onClick={() => setCurrentView('ADMIN')}
                className="px-8 py-4 text-lg"
              >
                Admin Portal
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => setCurrentView('LANDING')}
          >
             <span className="font-bold text-xl text-gray-900">Bestcenter Speaking</span>
          </div>
          {currentSession && currentView === 'TEST' && (
             <div className="text-sm font-medium text-gray-500">
               Session in progress: <span className="text-gray-900">{studentName}</span>
             </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderView()}
      </main>
    </div>
  );
};

// Main App component with context provider
const App: React.FC = () => {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
};

export default App;