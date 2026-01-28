'use client';

import { useState, useEffect } from 'react';

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
  title: string;
  prompt: string;
  wordLimit?: number;
  timeLimit?: number;
  instructions?: string;
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

  useEffect(() => {
    fetchExam();
  }, [examId]);

  const fetchExam = async () => {
    try {
      const res = await fetch(`/api/admin/exams/${examId}`);
      const data = await res.json();
      setExam(data);
    } catch (err) {
      console.error('Failed to fetch exam:', err);
      setError('Failed to load exam');
    } finally {
      setLoading(false);
    }
  };

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
    if (!exam || !exam.questions) return;
    const updatedQuestions = [...exam.questions];
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
    setExam({ ...exam, questions: updatedQuestions });
  };

  const removeQuestion = (index: number) => {
    if (!exam || !exam.questions) return;
    const updatedQuestions = exam.questions.filter((_, i) => i !== index);
    // Reorder questions
    updatedQuestions.forEach((q, i) => q.order = i + 1);
    setExam({ ...exam, questions: updatedQuestions });
  };

  const handleFileUpload = async (index: number, file: File) => {
    if (!file) return;

    setUploadingIndex(index);
    setUploadProgress(0);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100));
        }
      });

      // Handle completion
      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          updateQuestion(index, 'mediaUrl', response.url);
          updateQuestion(index, 'mediaFile', undefined);
          setUploadingIndex(null);
          setUploadProgress(0);
        } else {
          const error = JSON.parse(xhr.responseText);
          setError(error.error || 'Failed to upload file');
          setUploadingIndex(null);
          setUploadProgress(0);
        }
      });

      // Handle error
      xhr.addEventListener('error', () => {
        setError('Failed to upload file');
        setUploadingIndex(null);
        setUploadProgress(0);
      });

      // Open and send request
      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    } catch (err) {
      console.error('Error uploading file:', err);
      setError('Failed to upload file');
      setUploadingIndex(null);
      setUploadProgress(0);
    }
  };

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
    updateQuestion(index, 'mediaUrl', '');
    updateQuestion(index, 'mediaFile', undefined);
  };

  const addWritingPrompt = () => {
    if (!exam) return;
    const newPrompt: WritingPrompt = {
      order: (exam.writingPrompts?.length || 0) + 1,
      title: '',
      prompt: '',
    };
    setExam({
      ...exam,
      writingPrompts: [...(exam.writingPrompts || []), newPrompt],
    });
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
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">Edit Exam</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('details')}
              className={`px-6 py-3 font-medium text-sm ${
                activeTab === 'details'
                  ? 'border-b-2 border-gray-900 text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Exam Details
            </button>
            <button
              onClick={() => setActiveTab('content')}
              className={`px-6 py-3 font-medium text-sm ${
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
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {error}
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-4">
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
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">Speaking Questions</h4>
                <button
                  onClick={addQuestion}
                  className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-black"
                >
                  Add Question
                </button>
              </div>

              {exam.questions?.map((question, index) => (
                <div key={question.id || index} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Question {question.order}</span>
                    <button
                      onClick={() => removeQuestion(index)}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Remove
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Format
                    </label>
                    <select
                      value={question.format}
                      onChange={(e) => updateQuestion(index, 'format', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
                    >
                      <option value="TEXT_ONLY">Text Only</option>
                      <option value="AUDIO_ONLY">Audio Only</option>
                      <option value="PICTURE_TEXT">Picture + Text</option>
                      <option value="VIDEO">Video</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Question Text
                    </label>
                    <textarea
                      value={question.text}
                      onChange={(e) => updateQuestion(index, 'text', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none resize-none"
                      rows={2}
                      required
                    />
                  </div>

                  {(question.format === 'AUDIO_ONLY' || question.format === 'PICTURE_TEXT' || question.format === 'VIDEO') && (
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-gray-600">
                        Media ({question.format === 'AUDIO_ONLY' ? 'Audio' : question.format === 'PICTURE_TEXT' ? 'Image' : 'Video'})
                      </label>

                      {/* File Upload Button */}
                      <div className="flex items-center gap-2">
                        <label className="flex-1">
                          <input
                            type="file"
                            accept={
                              question.format === 'AUDIO_ONLY'
                                ? 'audio/*'
                                : question.format === 'PICTURE_TEXT'
                                ? 'image/*'
                                : 'video/*'
                            }
                            onChange={(e) => handleFileSelect(index, e)}
                            className="hidden"
                            disabled={uploadingIndex === index}
                          />
                          <div className="px-3 py-2 text-sm border border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:bg-gray-50 transition-colors">
                            {uploadingIndex === index ? (
                              <span className="text-gray-500">Uploading... {uploadProgress}%</span>
                            ) : (
                              <span className="text-gray-600">Choose file from device</span>
                            )}
                          </div>
                        </label>

                        {question.mediaUrl && (
                          <button
                            type="button"
                            onClick={() => clearMediaUrl(index)}
                            className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200"
                          >
                            Clear
                          </button>
                        )}
                      </div>

                      {/* Or enter URL manually */}
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-gray-200"></div>
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-white px-2 text-xs text-gray-500">or paste URL</span>
                        </div>
                      </div>

                      <input
                        type="text"
                        value={question.mediaUrl || ''}
                        onChange={(e) => updateQuestion(index, 'mediaUrl', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
                        placeholder="https://..."
                      />

                      {/* Media Preview */}
                      {question.mediaUrl && !uploadingIndex && (
                        <div className="mt-2 rounded-lg overflow-hidden border border-gray-200 bg-gray-50">
                          {question.format === 'AUDIO_ONLY' && (
                            <audio controls className="w-full" src={question.mediaUrl}>
                              Your browser does not support the audio element.
                            </audio>
                          )}
                          {question.format === 'PICTURE_TEXT' && (
                            <img
                              src={question.mediaUrl}
                              alt="Preview"
                              className="w-full h-32 object-cover"
                              onError={(e) => {
                                e.currentTarget.src = '';
                                e.currentTarget.alt = 'Failed to load image';
                              }}
                            />
                          )}
                          {question.format === 'VIDEO' && (
                            <video controls className="w-full h-32" src={question.mediaUrl}>
                              Your browser does not support the video element.
                            </video>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {question.format === 'VIDEO' && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Timestamp (seconds) - When to pause video
                      </label>
                      <input
                        type="number"
                        value={question.timestamp || ''}
                        onChange={(e) => updateQuestion(index, 'timestamp', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
                        placeholder="0"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Instructions (Optional)
                    </label>
                    <textarea
                      value={question.instructions || ''}
                      onChange={(e) => updateQuestion(index, 'instructions', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none resize-none"
                      rows={2}
                      placeholder="Additional instructions for the student"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Reading Time Limit (seconds)
                      </label>
                      <input
                        type="number"
                        value={question.readingTimeLimit || ''}
                        onChange={(e) => updateQuestion(index, 'readingTimeLimit', parseInt(e.target.value) || undefined)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
                        placeholder="No limit"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Answering Time Limit (seconds)
                      </label>
                      <input
                        type="number"
                        value={question.answeringTimeLimit || ''}
                        onChange={(e) => updateQuestion(index, 'answeringTimeLimit', parseInt(e.target.value) || undefined)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
                        placeholder="No limit"
                      />
                    </div>
                  </div>
                </div>
              )) || <p className="text-gray-500 text-center py-4">No questions yet. Add a question to get started.</p>}
            </div>
          )}

          {activeTab === 'content' && exam.type === 'WRITING' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">Writing Prompts</h4>
                <button
                  onClick={addWritingPrompt}
                  className="px-3 py-1.5 text-sm bg-gray-900 text-white rounded-lg hover:bg-black"
                >
                  Add Prompt
                </button>
              </div>

              {exam.writingPrompts?.map((prompt, index) => (
                <div key={prompt.id || index} className="border border-gray-200 rounded-lg p-4 space-y-3">
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
                      required
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
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Word Limit (Optional)
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
                        Time Limit - Minutes (Optional)
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

                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Additional Instructions (Optional)
                    </label>
                    <textarea
                      value={prompt.instructions || ''}
                      onChange={(e) => updateWritingPrompt(index, 'instructions', e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none resize-none"
                      rows={2}
                      placeholder="Additional guidelines for the student"
                    />
                  </div>
                </div>
              )) || <p className="text-gray-500 text-center py-4">No prompts yet. Add a prompt to get started.</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex items-center justify-between">
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
