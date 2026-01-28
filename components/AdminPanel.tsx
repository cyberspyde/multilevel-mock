import React, { useState, useRef, useEffect } from 'react';
import { TestScenario, Question } from '../types';
import { saveTest, getTests } from '../services/storage';
import Button from './Button';
import SearchBar from './SearchBar';

const AdminPanel: React.FC = () => {
  const [tests, setTests] = useState<TestScenario[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Form State
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [videoUrl, setVideoUrl] = useState('https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
  const [questions, setQuestions] = useState<Question[]>([]);
  
  // Player state for setting timestamps
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    loadTests();
  }, []);

  const loadTests = async () => {
    const loaded = await getTests();
    setTests(loaded);
  };

  const handleAddQuestion = () => {
    const timestamp = videoRef.current ? videoRef.current.currentTime : 0;
    const newQ: Question = {
      id: `q-${Date.now()}`,
      timestamp: timestamp,
      text: ''
    };
    setQuestions([...questions, newQ]);
  };

  const updateQuestionText = (id: string, text: string) => {
    setQuestions(questions.map(q => q.id === id ? { ...q, text } : q));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const handleSave = async () => {
    if (!title) return alert('Title is required');
    
    const newTest: TestScenario = {
      id: `test-${Date.now()}`,
      title,
      description: desc,
      videoUrl,
      questions: questions.sort((a, b) => a.timestamp - b.timestamp)
    };

    await saveTest(newTest);
    setIsEditing(false);
    resetForm();
    loadTests();
  };

  const resetForm = () => {
    setTitle('');
    setDesc('');
    setQuestions([]);
    setVideoUrl('https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
  };

  // Filter tests based on search query
  const filteredTests = tests.filter(test => {
    const query = searchQuery.toLowerCase();
    return (
      test.title.toLowerCase().includes(query) ||
      test.description.toLowerCase().includes(query) ||
      test.questions.length.toString().includes(query)
    );
  });

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
          <p className="text-gray-500">Manage video scenarios and speaking prompts</p>
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)}>
            + Create New Test
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Scenario Title</label>
                <input 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g., Business Meeting Simulation"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  rows={3}
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="Brief instructions for the student..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Video URL (MP4)</label>
                <input 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  value={videoUrl}
                  onChange={e => setVideoUrl(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4">
               <label className="block text-sm font-medium text-gray-700">Video Preview & Timestamp Selector</label>
               <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                 <video 
                    ref={videoRef}
                    src={videoUrl}
                    className="w-full h-full object-contain"
                    controls
                    onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime || 0)}
                 />
               </div>
               <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <span className="font-mono text-blue-600 font-medium">{currentTime.toFixed(1)}s</span>
                  <Button variant="secondary" onClick={handleAddQuestion} className="py-1 px-3 text-sm">
                    Add Question at Current Time
                  </Button>
               </div>
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Questions</h3>
            {questions.length === 0 ? (
              <p className="text-gray-400 italic">No questions added yet. Play the video and click "Add Question" to set pause points.</p>
            ) : (
              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <div key={q.id} className="flex gap-4 items-start bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <div className="pt-2">
                       <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded">
                         {q.timestamp.toFixed(1)}s
                       </span>
                    </div>
                    <div className="flex-1">
                      <input 
                        className="w-full bg-white px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
                        value={q.text}
                        onChange={e => updateQuestionText(q.id, e.target.value)}
                        placeholder={`Question #${idx + 1} text...`}
                      />
                    </div>
                    <button 
                      onClick={() => removeQuestion(q.id)}
                      className="text-red-500 hover:text-red-700 p-2"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Scenario</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="max-w-md">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search tests by title, description, or question count..."
              resultCount={tests.length}
            />
          </div>
          {filteredTests.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-500">
                {searchQuery ? 'No tests match your search.' : 'No tests available.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTests.map(test => (
                <div key={test.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex flex-col hover:shadow-md transition-shadow">
                  <h3 className="font-bold text-gray-900 text-lg mb-2">{test.title}</h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">{test.description}</p>
                  <div className="mt-auto pt-4 border-t border-gray-100 flex justify-between items-center text-sm text-gray-500">
                    <span>{test.questions.length} Questions</span>
                    <span className="bg-gray-100 px-2 py-1 rounded">Video Test</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPanel;