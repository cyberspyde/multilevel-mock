'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type QuestionFormat = 'AUDIO_ONLY' | 'PICTURE_TEXT' | 'VIDEO' | 'TEXT_ONLY';

interface SpeakingQuestion {
  id?: string;
  order: number;
  format: QuestionFormat;
  text: string;
  mediaUrl?: string;
  timestamp?: number;
  instructions?: string;
  readingTimeLimit?: number;
  answeringTimeLimit?: number;
  mediaFile?: File;
}

interface WritingPrompt {
  id?: string;
  order: number;
  partId?: string;
  taskNumber?: string;
  title: string;
  prompt: string;
  wordLimit?: number;
  timeLimit?: number;
  instructions?: string;
}

interface WritingPart {
  id?: string;
  order: number;
  title: string;
  description?: string;
  timeLimit?: number;
  prompts: WritingPrompt[];
}

interface Exam {
  id: string;
  title: string;
  description: string;
  type: 'SPEAKING' | 'WRITING';
  unlockCode: string;
  isActive: boolean;
  questions?: SpeakingQuestion[];
  writingPrompts?: WritingPrompt[];
  writingParts?: WritingPart[];
}

interface EditExamModalProps {
  examId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditExamModal({ examId, onClose, onSuccess }: EditExamModalProps) {
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'details' | 'content'>('details');
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const uploadRetryCountRef = useRef<number>(0);

  const fetchExam = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/exams/${examId}`);
      const data = await res.json();
      // Ensure writingParts is initialized
      if (data.type === 'WRITING' && !data.writingParts) {
        data.writingParts = [];
      }
      setExam(data);
    } catch (err) {
      console.error('Failed to fetch exam:', err);
      setError('Failed to load exam');
    } finally {
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    fetchExam();
  }, [fetchExam]);

  // Debug: Log when uploadingIndex changes
  useEffect(() => {
    console.log('[EditExamModal] uploadingIndex changed to:', uploadingIndex);
  }, [uploadingIndex]);

  // Debug: Log when exam.questions changes
  useEffect(() => {
    if (exam?.questions?.length) {
      exam.questions.forEach((q, i) => {
        if (q.format === 'VIDEO' || q.format === 'AUDIO_ONLY' || q.format === 'PICTURE_TEXT') {
          console.log(`[EditExamModal] Question ${i} (${q.format}):`, {
            mediaUrl: q.mediaUrl,
            hasMediaFile: !!q.mediaFile,
          });
        }
      });
    }
  }, [exam?.questions]);

  const handleUpdateExam = async () => {
    if (!exam) return;
    setSaving(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/exams/${examId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: exam.title,
          description: exam.description,
          type: exam.type,
          unlockCode: exam.unlockCode,
          isActive: exam.isActive,
          questions: exam.questions,
          writingPrompts: exam.writingPrompts,
          writingParts: exam.writingParts,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to update exam');
        setSaving(false);
        return;
      }

      onSuccess();
    } catch (err) {
      console.error('Error:', err);
      setError('Something went wrong');
      setSaving(false);
    }
  };

  const handleDeleteExam = async () => {
    if (!confirm('Are you sure you want to delete this exam? This action cannot be undone.')) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/exams/${examId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        setError('Failed to delete exam');
        setSaving(false);
        return;
      }

      onSuccess();
    } catch (err) {
      console.error('Error:', err);
      setError('Something went wrong');
      setSaving(false);
    }
  };

  const addQuestion = () => {
    if (!exam) return;
    const newQuestion: SpeakingQuestion = {
      order: (exam.questions?.length || 0) + 1,
      format: 'TEXT_ONLY',
      text: '',
    };
    setExam({
      ...exam,
      questions: [...(exam.questions || []), newQuestion],
    });
  };

  const updateQuestion = (index: number, field: keyof SpeakingQuestion, value: any) => {
    console.log(`[updateQuestion] Called: index=${index}, field=${field}, value=${value}`);
    console.log(`[updateQuestion] exam exists:`, !!exam, 'questions exist:', !!exam?.questions);
    if (!exam || !exam.questions) {
      console.error(`[updateQuestion] Early return - exam:`, exam, 'questions:', exam?.questions);
      return;
    }
    const updatedQuestions = [...exam.questions];
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
    console.log(`[updateQuestion] Setting exam with question ${index} ${field} =`, value);
    setExam({ ...exam, questions: updatedQuestions });
    console.log(`[updateQuestion] setExam called`);
  };

  // Update multiple fields on a question in a single state update (to avoid race conditions)
  const updateQuestionMultiple = (index: number, updates: Partial<SpeakingQuestion>) => {
    if (!exam || !exam.questions) return;
    const updatedQuestions = [...exam.questions];
    updatedQuestions[index] = { ...updatedQuestions[index], ...updates };
    setExam({ ...exam, questions: updatedQuestions });
  };

  const removeQuestion = (index: number) => {
    if (!exam || !exam.questions) return;
    const updatedQuestions = exam.questions.filter((_, i) => i !== index);
    // Reorder questions
    updatedQuestions.forEach((q, i) => q.order = i + 1);
    setExam({ ...exam, questions: updatedQuestions });
  };

  const moveQuestion = (fromIndex: number, toIndex: number) => {
    if (!exam || !exam.questions) return;
    const questions = [...exam.questions];
    const [moved] = questions.splice(fromIndex, 1);
    questions.splice(toIndex, 0, moved);
    // Update order numbers
    questions.forEach((q, i) => q.order = i + 1);
    setExam({ ...exam, questions });
  };

  const duplicateQuestion = (index: number) => {
    if (!exam || !exam.questions) return;
    const question = exam.questions[index];
    const newQuestion: SpeakingQuestion = {
      ...question,
      id: undefined,
      order: exam.questions.length + 1,
    };
    setExam({
      ...exam,
      questions: [...exam.questions, newQuestion],
    });
  };

  const handleFileUpload = (index: number, file: File) => {
    if (!file) return;

    // Abort any existing upload
    if (xhrRef.current) {
      xhrRef.current.abort();
    }

    setUploadingIndex(index);
    setUploadProgress(0);
    setError('');
    uploadRetryCountRef.current = 0;

    const doUpload = (retryCount: number = 0) => {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && xhrRef.current === xhr) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      // Handle completion
      xhr.addEventListener('load', () => {
        // Only process if this is still the current XHR
        if (xhrRef.current !== xhr) return;

        console.log('[Upload] Response status:', xhr.status);
        console.log('[Upload] Response text:', xhr.responseText);

        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            console.log('[Upload] Parsed response:', response);
            console.log('[Upload] Setting mediaUrl to:', response.url);
            // Update both fields in a single state update to avoid race condition
            updateQuestionMultiple(index, {
              mediaUrl: response.url,
              mediaFile: undefined,
            });
            setUploadingIndex(null);
            setUploadProgress(0);
            xhrRef.current = null;

            // Debug: Check state after updates
            setTimeout(() => {
              console.log('[Upload] Delayed check - Question should have mediaUrl now');
            }, 100);
          } catch (parseErr) {
            console.error('Failed to parse upload response:', parseErr);
            // Retry if response was invalid
            if (retryCount < 3) {
              setTimeout(() => doUpload(retryCount + 1), 1000 * (retryCount + 1));
            } else {
              setError('Server returned an invalid response');
              setUploadingIndex(null);
              setUploadProgress(0);
              xhrRef.current = null;
            }
          }
        } else {
          let errorMsg = 'Upload failed';
          try {
            const error = JSON.parse(xhr.responseText);
            errorMsg = error.error || errorMsg;
          } catch {
            errorMsg = `Server error (${xhr.status})`;
          }
          // Retry on failure if less than 3 attempts
          if (retryCount < 3) {
            console.log(`Upload failed, retrying... (${retryCount + 1}/3)`);
            setTimeout(() => doUpload(retryCount + 1), 1000 * (retryCount + 1));
          } else {
            setError(errorMsg);
            setUploadingIndex(null);
            setUploadProgress(0);
            xhrRef.current = null;
          }
        }
      });

      // Handle error
      xhr.addEventListener('error', () => {
        if (xhrRef.current !== xhr) return;

        // Retry on network error if less than 3 attempts
        if (retryCount < 3) {
          console.log(`Network error, retrying... (${retryCount + 1}/3)`);
          setTimeout(() => doUpload(retryCount + 1), 1000 * (retryCount + 1));
        } else {
          setError('Failed to upload file. Please check your connection.');
          setUploadingIndex(null);
          setUploadProgress(0);
          xhrRef.current = null;
        }
      });

      // Handle timeout
      xhr.addEventListener('timeout', () => {
        if (xhrRef.current !== xhr) return;

        // Retry on timeout if less than 3 attempts
        if (retryCount < 3) {
          console.log(`Upload timeout, retrying... (${retryCount + 1}/3)`);
          setTimeout(() => doUpload(retryCount + 1), 1000 * (retryCount + 1));
        } else {
          setError('Upload timed out. Try a smaller file or check your connection.');
          setUploadingIndex(null);
          setUploadProgress(0);
          xhrRef.current = null;
        }
      });

      // Handle abort
      xhr.addEventListener('abort', () => {
        if (xhrRef.current === xhr) {
          setUploadingIndex(null);
          setUploadProgress(0);
          xhrRef.current = null;
        }
      });

      // Open and send request with extended timeout
      xhr.open('POST', '/api/upload');
      xhr.timeout = 120000; // 2 minute timeout for large files
      xhr.send(formData);
    };

    doUpload(0);
  };

  // Cleanup XHR on unmount
  useEffect(() => {
    return () => {
      if (xhrRef.current) {
        xhrRef.current.abort();
      }
    };
  }, []);

  const handleFileSelect = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Store file reference temporarily
      if (!exam || !exam.questions) return;
      const updatedQuestions = [...exam.questions];
      updatedQuestions[index] = { ...updatedQuestions[index], mediaFile: file };
      setExam({ ...exam, questions: updatedQuestions });

      // Auto-upload the file
      handleFileUpload(index, file);
    }
  };

  const clearMediaUrl = (index: number) => {
    // Abort upload if this index is currently uploading
    if (uploadingIndex === index && xhrRef.current) {
      xhrRef.current.abort();
    }
    updateQuestionMultiple(index, {
      mediaUrl: '',
      mediaFile: undefined,
    });
  };

  // ===== WRITING PARTS MANAGEMENT =====
  const addWritingPart = () => {
    if (!exam) return;
    const partNumber = (exam.writingParts?.length || 0) + 1;
    const newPart: WritingPart = {
      order: partNumber,
      title: `Part ${partNumber}`,
      prompts: [],
    };
    setExam({
      ...exam,
      writingParts: [...(exam.writingParts || []), newPart],
    });
  };

  const updateWritingPart = (partIndex: number, field: keyof WritingPart, value: any) => {
    if (!exam || !exam.writingParts) return;
    const updatedParts = [...exam.writingParts];
    updatedParts[partIndex] = { ...updatedParts[partIndex], [field]: value };
    setExam({ ...exam, writingParts: updatedParts });
  };

  const removeWritingPart = (partIndex: number) => {
    if (!exam || !exam.writingParts) return;
    const updatedParts = exam.writingParts.filter((_, i) => i !== partIndex);
    // Reorder parts and update task numbers
    updatedParts.forEach((p, i) => {
      p.order = i + 1;
      p.prompts.forEach((task, ti) => {
        task.taskNumber = `${i + 1}.${ti + 1}`;
      });
    });
    setExam({ ...exam, writingParts: updatedParts });
  };

  const moveWritingPart = (fromIndex: number, toIndex: number) => {
    if (!exam || !exam.writingParts) return;
    const parts = [...exam.writingParts];
    const [moved] = parts.splice(fromIndex, 1);
    parts.splice(toIndex, 0, moved);
    // Update order numbers and task numbers
    parts.forEach((p, i) => {
      p.order = i + 1;
      p.prompts.forEach((task, ti) => {
        task.taskNumber = `${i + 1}.${ti + 1}`;
      });
    });
    setExam({ ...exam, writingParts: parts });
  };

  const addTaskToPart = (partIndex: number) => {
    if (!exam || !exam.writingParts) return;
    const updatedParts = [...exam.writingParts];
    const part = updatedParts[partIndex];
    const taskNumber = `${part.order}.${part.prompts.length + 1}`;
    const newTask: WritingPrompt = {
      order: part.prompts.length + 1,
      taskNumber,
      title: `Task ${taskNumber}`,
      prompt: '',
    };
    part.prompts = [...part.prompts, newTask];
    setExam({ ...exam, writingParts: updatedParts });
  };

  const updateTaskInPart = (partIndex: number, taskIndex: number, field: keyof WritingPrompt, value: any) => {
    if (!exam || !exam.writingParts) return;
    const updatedParts = [...exam.writingParts];
    const updatedTasks = [...updatedParts[partIndex].prompts];
    updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], [field]: value };
    updatedParts[partIndex].prompts = updatedTasks;
    setExam({ ...exam, writingParts: updatedParts });
  };

  const removeTaskFromPart = (partIndex: number, taskIndex: number) => {
    if (!exam || !exam.writingParts) return;
    const updatedParts = [...exam.writingParts];
    const part = updatedParts[partIndex];
    part.prompts = part.prompts.filter((_, i) => i !== taskIndex);
    // Reorder tasks and update task numbers
    part.prompts.forEach((task, i) => {
      task.order = i + 1;
      task.taskNumber = `${part.order}.${i + 1}`;
    });
    setExam({ ...exam, writingParts: updatedParts });
  };

  const moveTaskInPart = (partIndex: number, fromTaskIndex: number, toTaskIndex: number) => {
    if (!exam || !exam.writingParts) return;
    const updatedParts = [...exam.writingParts];
    const part = updatedParts[partIndex];
    const tasks = [...part.prompts];
    const [moved] = tasks.splice(fromTaskIndex, 1);
    tasks.splice(toTaskIndex, 0, moved);
    // Update order numbers
    tasks.forEach((task, i) => {
      task.order = i + 1;
      task.taskNumber = `${part.order}.${i + 1}`;
    });
    part.prompts = tasks;
    setExam({ ...exam, writingParts: updatedParts });
  };

  const updateWritingPrompt = (index: number, field: keyof WritingPrompt, value: any) => {
    if (!exam || !exam.writingPrompts) return;
    const updatedPrompts = [...exam.writingPrompts];
    updatedPrompts[index] = { ...updatedPrompts[index], [field]: value };
    setExam({ ...exam, writingPrompts: updatedPrompts });
  };

  const removeWritingPrompt = (index: number) => {
    if (!exam || !exam.writingPrompts) return;
    const updatedPrompts = exam.writingPrompts.filter((_, i) => i !== index);
    // Reorder prompts
    updatedPrompts.forEach((p, i) => p.order = i + 1);
    setExam({ ...exam, writingPrompts: updatedPrompts });
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
          <p className="text-red-600">Failed to load exam</p>
          <button onClick={onClose} className="mt-4 px-4 py-2 bg-gray-900 text-white rounded-lg">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Edit Exam</h3>
            <p className="text-xs text-gray-500">{exam.questions?.length || 0} questions</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 shrink-0">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'details'
                  ? 'border-b-2 border-gray-900 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab('content')}
              className={`px-4 py-2 text-sm font-medium ${
                activeTab === 'content'
                  ? 'border-b-2 border-gray-900 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {exam.type === 'SPEAKING' ? 'Questions' : 'Writing Prompts'}
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {activeTab === 'details' && (
            <div className="max-w-xl mx-auto space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Exam Title
                </label>
                <input
                  type="text"
                  value={exam.title}
                  onChange={(e) => setExam({ ...exam, title: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={exam.description}
                  onChange={(e) => setExam({ ...exam, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none resize-none"
                  rows={3}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Exam Type
                </label>
                <select
                  value={exam.type}
                  onChange={(e) => setExam({ ...exam, type: e.target.value as 'SPEAKING' | 'WRITING' })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
                >
                  <option value="SPEAKING">Speaking Mock</option>
                  <option value="WRITING">Writing Mock</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unlock Code
                </label>
                <input
                  type="text"
                  value={exam.unlockCode}
                  onChange={(e) => setExam({ ...exam, unlockCode: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none font-mono"
                  required
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={exam.isActive}
                  onChange={(e) => setExam({ ...exam, isActive: e.target.checked })}
                  className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  Exam is active
                </label>
              </div>
            </div>
          )}

          {activeTab === 'content' && exam.type === 'SPEAKING' && (
            <div className="space-y-3">
              {/* Add Question Button */}
              <button
                onClick={addQuestion}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-gray-400 hover:text-gray-600 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Question
              </button>

              {exam.questions?.map((question, index) => (
                <QuestionCard
                  key={question.id || index}
                  question={question}
                  index={index}
                  _totalQuestions={exam.questions?.length || 0}
                  uploadingIndex={uploadingIndex}
                  uploadProgress={uploadProgress}
                  onUpdate={updateQuestion}
                  onRemove={() => removeQuestion(index)}
                  onMoveUp={index > 0 ? () => moveQuestion(index, index - 1) : undefined}
                  onMoveDown={index < (exam.questions?.length || 0) - 1 ? () => moveQuestion(index, index + 1) : undefined}
                  onDuplicate={() => duplicateQuestion(index)}
                  onFileSelect={handleFileSelect}
                  onClearMedia={clearMediaUrl}
                />
              )) || <p className="text-center text-gray-400 py-8">No questions yet. Add a question to get started.</p>}
            </div>
          )}

          {activeTab === 'content' && exam.type === 'WRITING' && (
            <div className="space-y-4">
              {/* Add Part Button */}
              <button
                onClick={addWritingPart}
                className="w-full py-3 border-2 border-dashed border-purple-300 rounded-xl text-purple-500 hover:border-purple-400 hover:text-purple-600 flex items-center justify-center gap-2 bg-purple-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Add Part (e.g., Part 1, Part 2)
              </button>

              {/* Writing Parts */}
              {exam.writingParts?.map((part, partIndex) => (
                <div key={part.id || `part-${partIndex}`} className="border-2 border-purple-200 rounded-xl overflow-hidden bg-white">
                  {/* Part Header */}
                  <div className="bg-purple-50 px-4 py-3 flex items-center justify-between border-b border-purple-200">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-purple-900 text-lg">Part {part.order}</span>
                      <input
                        type="text"
                        value={part.title}
                        onChange={(e) => updateWritingPart(partIndex, 'title', e.target.value)}
                        className="px-2 py-1 text-sm border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none bg-white"
                        placeholder="Part title..."
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      {partIndex > 0 && (
                        <button
                          onClick={() => moveWritingPart(partIndex, partIndex - 1)}
                          className="p-1 text-purple-400 hover:text-purple-600 hover:bg-purple-100 rounded"
                          title="Move up"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                      )}
                      {partIndex < (exam.writingParts?.length || 0) - 1 && (
                        <button
                          onClick={() => moveWritingPart(partIndex, partIndex + 1)}
                          className="p-1 text-purple-400 hover:text-purple-600 hover:bg-purple-100 rounded"
                          title="Move down"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}
                      <button
                        onClick={() => removeWritingPart(partIndex)}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Remove part"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Part Description */}
                  <div className="px-4 py-3 border-b border-purple-100">
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Part Description (Optional)
                    </label>
                    <textarea
                      value={part.description || ''}
                      onChange={(e) => updateWritingPart(partIndex, 'description', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none"
                      rows={2}
                      placeholder="Description or instructions for this part..."
                    />
                    <div className="mt-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Part Time Limit (Optional - Minutes)
                      </label>
                      <input
                        type="number"
                        value={part.timeLimit || ''}
                        onChange={(e) => updateWritingPart(partIndex, 'timeLimit', parseInt(e.target.value) || undefined)}
                        className="w-32 px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                        placeholder="No limit"
                      />
                    </div>
                  </div>

                  {/* Tasks in Part */}
                  <div className="p-4 space-y-3">
                    {/* Add Task Button */}
                    <button
                      onClick={() => addTaskToPart(partIndex)}
                      className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600 flex items-center justify-center gap-2 text-sm"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add Task to Part {part.order}
                    </button>

                    {/* Task Cards */}
                    {part.prompts.map((task, taskIndex) => (
                      <div key={task.id || `task-${partIndex}-${taskIndex}`} className="border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-gray-800">
                            Task {task.taskNumber || `${part.order}.${taskIndex + 1}`}
                          </span>
                          <div className="flex items-center gap-1">
                            {taskIndex > 0 && (
                              <button
                                onClick={() => moveTaskInPart(partIndex, taskIndex, taskIndex - 1)}
                                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
                                title="Move up"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                </svg>
                              </button>
                            )}
                            {taskIndex < part.prompts.length - 1 && (
                              <button
                                onClick={() => moveTaskInPart(partIndex, taskIndex, taskIndex + 1)}
                                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
                                title="Move down"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                              </button>
                            )}
                            <button
                              onClick={() => removeTaskFromPart(partIndex, taskIndex)}
                              className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="Remove task"
                            >
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Task Title
                          </label>
                          <input
                            type="text"
                            value={task.title}
                            onChange={(e) => updateTaskInPart(partIndex, taskIndex, 'title', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none bg-white"
                            placeholder="Task title..."
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Task Prompt/Instructions
                          </label>
                          <textarea
                            value={task.prompt}
                            onChange={(e) => updateTaskInPart(partIndex, taskIndex, 'prompt', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none resize-none bg-white"
                            rows={3}
                            placeholder="Write the task prompt here..."
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Min Word Count
                            </label>
                            <input
                              type="number"
                              value={task.wordLimit || ''}
                              onChange={(e) => updateTaskInPart(partIndex, taskIndex, 'wordLimit', parseInt(e.target.value) || undefined)}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none bg-white"
                              placeholder="No limit"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">
                              Time Limit (Minutes)
                            </label>
                            <input
                              type="number"
                              value={task.timeLimit || ''}
                              onChange={(e) => updateTaskInPart(partIndex, taskIndex, 'timeLimit', parseInt(e.target.value) || undefined)}
                              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none bg-white"
                              placeholder="No limit"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Additional Instructions (Optional)
                          </label>
                          <textarea
                            value={task.instructions || ''}
                            onChange={(e) => updateTaskInPart(partIndex, taskIndex, 'instructions', e.target.value)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none resize-none bg-white"
                            rows={2}
                            placeholder="Additional guidelines..."
                          />
                        </div>
                      </div>
                    ))}

                    {part.prompts.length === 0 && (
                      <p className="text-center text-gray-400 py-4 text-sm">No tasks yet. Add a task to this part.</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Legacy standalone prompts (backward compatibility) */}
              {exam.writingPrompts && exam.writingPrompts.length > 0 && (
                <div className="mt-6 border-t border-gray-200 pt-6">
                  <h4 className="text-sm font-medium text-gray-500 mb-3">Legacy Standalone Prompts</h4>
                  {exam.writingPrompts.map((prompt, index) => (
                    <div key={prompt.id || index} className="border border-gray-200 rounded-xl p-4 space-y-3 mb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Prompt {prompt.order}</span>
                        <button
                          onClick={() => removeWritingPrompt(index)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Title
                        </label>
                        <input
                          type="text"
                          value={prompt.title}
                          onChange={(e) => updateWritingPrompt(index, 'title', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Prompt/Instructions
                        </label>
                        <textarea
                          value={prompt.prompt}
                          onChange={(e) => updateWritingPrompt(index, 'prompt', e.target.value)}
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none resize-none"
                          rows={3}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Word Limit
                          </label>
                          <input
                            type="number"
                            value={prompt.wordLimit || ''}
                            onChange={(e) => updateWritingPrompt(index, 'wordLimit', parseInt(e.target.value) || undefined)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
                            placeholder="No limit"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">
                            Time Limit (Minutes)
                          </label>
                          <input
                            type="number"
                            value={prompt.timeLimit || ''}
                            onChange={(e) => updateWritingPrompt(index, 'timeLimit', parseInt(e.target.value) || undefined)}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
                            placeholder="No limit"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(!exam.writingParts || exam.writingParts.length === 0) && (!exam.writingPrompts || exam.writingPrompts.length === 0) && (
                <p className="text-center text-gray-400 py-8">No parts yet. Add a part to organize your writing tasks.</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex items-center justify-between shrink-0">
          <button
            onClick={handleDeleteExam}
            disabled={saving}
            className="px-4 py-2 text-red-600 hover:text-red-700 font-medium disabled:text-gray-400"
          >
            Delete Exam
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateExam}
              disabled={saving}
              className="px-4 py-2 bg-gray-900 hover:bg-black text-white font-medium rounded-lg disabled:bg-gray-300"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Question Card Component
interface QuestionCardProps {
  question: SpeakingQuestion;
  index: number;
  _totalQuestions: number;
  uploadingIndex: number | null;
  uploadProgress: number;
  onUpdate: (index: number, field: keyof SpeakingQuestion, value: any) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDuplicate: () => void;
  onFileSelect: (index: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearMedia: (index: number) => void;
}

function QuestionCard({
  question,
  index,
  _totalQuestions,
  uploadingIndex,
  uploadProgress,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onFileSelect,
  onClearMedia,
}: QuestionCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const isUploading = uploadingIndex === index;

  // Debug: Log when question prop changes
  useEffect(() => {
    if (question.format === 'VIDEO' || question.format === 'AUDIO_ONLY' || question.format === 'PICTURE_TEXT') {
      console.log(`[QuestionCard ${index}] Rendered:`, {
        format: question.format,
        mediaUrl: question.mediaUrl,
        isUploading,
      });
    }
  }, [question.mediaUrl, question.format, isUploading, index]);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Card Header - Always Visible */}
      <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg
              className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <span className="font-semibold text-gray-900">Q{index + 1}</span>
          <span className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-600">
            {question.format.replace('_', ' ')}
          </span>
          {question.mediaUrl && (
            <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-700 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              Media
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {onMoveUp && (
            <button
              onClick={onMoveUp}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
              title="Move up"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
            </button>
          )}
          {onMoveDown && (
            <button
              onClick={onMoveDown}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
              title="Move down"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
          <button
            onClick={onDuplicate}
            className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
            title="Duplicate"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={onRemove}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
            title="Remove"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Format Selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Format
            </label>
            <select
              value={question.format}
              onChange={(e) => onUpdate(index, 'format', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none bg-white"
            >
              <option value="TEXT_ONLY">Text Only</option>
              <option value="AUDIO_ONLY">Audio Only</option>
              <option value="PICTURE_TEXT">Picture + Text</option>
              <option value="VIDEO">Video</option>
            </select>
          </div>

          {/* Question Text */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Question Text
            </label>
            <textarea
              value={question.text}
              onChange={(e) => onUpdate(index, 'text', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none resize-none"
              rows={2}
              placeholder="Enter the question..."
              required
            />
          </div>

          {/* Media Upload Section */}
          {(question.format === 'AUDIO_ONLY' || question.format === 'PICTURE_TEXT' || question.format === 'VIDEO') && (
            <div className="space-y-3 p-4 bg-gray-50 rounded-lg">
              <label className="block text-sm font-medium text-gray-700">
                {question.format === 'AUDIO_ONLY' ? 'Audio' : question.format === 'PICTURE_TEXT' ? 'Image' : 'Video'} File
              </label>

              <div className="flex gap-2">
                <label className="flex-1">
                  <input
                    type="file"
                    accept={
                      question.format === 'AUDIO_ONLY'
                        ? 'audio/*,.mp3,.wav,.ogg,.webm,.m4a,.aac'
                        : question.format === 'PICTURE_TEXT'
                        ? 'image/*,.jpg,.jpeg,.png,.gif,.webp'
                        : 'video/*,.mp4,.webm,.mov,.avi,.mkv'
                    }
                    onChange={(e) => onFileSelect(index, e)}
                    className="hidden"
                    disabled={isUploading}
                  />
                  <div className={`px-4 py-3 text-sm border-2 border-dashed rounded-lg text-center transition-all ${
                    isUploading
                      ? 'border-blue-400 bg-blue-50 cursor-wait'
                      : 'border-gray-300 cursor-pointer hover:bg-white hover:border-gray-400'
                  }`}>
                    {isUploading ? (
                      <span className="text-blue-600 flex items-center justify-center gap-2">
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Uploading... {uploadProgress}%
                      </span>
                    ) : (
                      <span className="text-gray-600">Click to upload or drag & drop</span>
                    )}
                  </div>
                </label>

                {isUploading && (
                  <button
                    type="button"
                    onClick={() => {
                      onClearMedia(index);
                    }}
                    className="px-3 py-2 text-sm text-red-600 hover:bg-red-100 rounded-lg border border-red-200"
                  >
                    Cancel
                  </button>
                )}

                {question.mediaUrl && !isUploading && (
                  <button
                    type="button"
                    onClick={() => onClearMedia(index)}
                    className="px-3 py-2 text-sm text-red-600 hover:bg-red-100 rounded-lg border border-red-200"
                  >
                    Clear
                  </button>
                )}
              </div>

              {/* Manual URL Input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={question.mediaUrl || ''}
                  onChange={(e) => onUpdate(index, 'mediaUrl', e.target.value)}
                  className="w-full pl-10 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
                  placeholder="Or paste media URL..."
                />
              </div>

              {/* Media Preview */}
              {question.mediaUrl && (
                <div className="rounded-lg overflow-hidden border border-gray-200 bg-white">
                  {question.format === 'AUDIO_ONLY' && (
                    <audio controls className="w-full" src={question.mediaUrl} preload="metadata">
                      Your browser does not support audio.
                    </audio>
                  )}
                  {question.format === 'PICTURE_TEXT' && (
                    <img
                      src={question.mediaUrl}
                      alt="Preview"
                      className="w-full max-h-48 object-contain bg-gray-100"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  )}
                  {question.format === 'VIDEO' && (
                    <video
                      controls
                      className="w-full max-h-48"
                      src={question.mediaUrl}
                      preload="metadata"
                      playsInline
                    >
                      Your browser does not support video.
                    </video>
                  )}
                  {/* URL display */}
                  <div className="px-3 py-2 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 truncate">
                    {question.mediaUrl}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Video Timestamp (only for VIDEO format) */}
          {question.format === 'VIDEO' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Timestamp (seconds) - When to pause video
              </label>
              <input
                type="number"
                value={question.timestamp || ''}
                onChange={(e) => onUpdate(index, 'timestamp', parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
                placeholder="0"
              />
            </div>
          )}

          {/* Instructions */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Instructions (Optional)
            </label>
            <textarea
              value={question.instructions || ''}
              onChange={(e) => onUpdate(index, 'instructions', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none resize-none"
              rows={2}
              placeholder="Additional instructions for the student"
            />
          </div>

          {/* Time Limits */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Preparation Time (sec)
              </label>
              <input
                type="number"
                value={question.readingTimeLimit || ''}
                onChange={(e) => onUpdate(index, 'readingTimeLimit', parseInt(e.target.value) || undefined)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
                placeholder="Default"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Answering Time (sec)
              </label>
              <input
                type="number"
                value={question.answeringTimeLimit || ''}
                onChange={(e) => onUpdate(index, 'answeringTimeLimit', parseInt(e.target.value) || undefined)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
                placeholder="Default"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
