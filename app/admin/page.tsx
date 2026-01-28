'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import EditExamModal from '@/components/EditExamModal';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import PrintableGradeReport from '@/components/PrintableGradeReport';

type AdminTab = 'dashboard' | 'exams' | 'sessions' | 'grading' | 'ai' | 'settings';

export default function AdminPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // Check admin authorization
    const authorized = localStorage.getItem('adminAuthorized');
    if (authorized !== 'true') {
      router.push('/admin/login');
    } else {
      setIsAuthorized(true);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('adminAuthorized');
    router.push('/admin/login');
  };

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <span className="font-bold text-xl text-gray-900">
                Admin Panel
              </span>
              <span className="text-sm text-gray-500">|</span>
              <span className="text-sm text-gray-500">Bestcenter Multilevel Mock</span>
            </div>
            <button
              onClick={handleLogout}
              className="text-gray-500 hover:text-gray-800 text-sm flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'dashboard'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('exams')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'exams'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Exams
            </button>
            <button
              onClick={() => setActiveTab('sessions')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'sessions'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Sessions
            </button>
            <button
              onClick={() => setActiveTab('grading')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'grading'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Grading
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'ai'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              AI Configuration
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${activeTab === 'settings'
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
            >
              Settings
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && <DashboardTab />}
        {activeTab === 'exams' && <ExamsTab />}
        {activeTab === 'sessions' && <SessionsTab />}
        {activeTab === 'grading' && <GradingTab />}
        {activeTab === 'ai' && <AITab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
}

function DashboardTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [examsRes, sessionsRes] = await Promise.all([
        fetch('/api/admin/exams'),
        fetch('/api/admin/sessions'),
      ]);

      const exams = await examsRes.json();
      const sessions = await sessionsRes.json();

      const completedSessions = sessions.filter((s: any) => s.completedAt);
      const activeSessions = sessions.filter((s: any) => !s.completedAt);
      const aiGraded = sessions.filter((s: any) => s.isAiGraded);
      const manuallyGraded = sessions.filter((s: any) => s.isManuallyGraded);
      const needsGrading = completedSessions.filter((s: any) => !s.isManuallyGraded);

      const speakingExams = exams.filter((e: any) => e.type === 'SPEAKING');
      const writingExams = exams.filter((e: any) => e.type === 'WRITING');

      setStats({
        totalExams: exams.length,
        activeExams: exams.filter((e: any) => e.isActive).length,
        speakingExams: speakingExams.length,
        writingExams: writingExams.length,
        totalSessions: sessions.length,
        completedSessions: completedSessions.length,
        activeSessions: activeSessions.length,
        aiGraded: aiGraded.length,
        manuallyGraded: manuallyGraded.length,
        needsGrading: needsGrading.length,
        recentSessions: sessions.slice(0, 5),
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
        <p className="text-gray-500">Key statistics and recent activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Exams</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalExams}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.activeExams} active</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Sessions</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.totalSessions}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.completedSessions} completed</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">AI Graded</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.aiGraded}</p>
              <p className="text-xs text-gray-500 mt-1">{stats.manuallyGraded} manual</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Needs Grading</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.needsGrading}</p>
              <p className="text-xs text-gray-500 mt-1">Awaiting review</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Sessions</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {stats.recentSessions.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No sessions yet</div>
          ) : (
            stats.recentSessions.map((session: any) => (
              <div key={session.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{session.studentName}</p>
                    <p className="text-sm text-gray-500">{session.exam.title}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-500">
                      {new Date(session.startedAt).toLocaleDateString()}
                    </span>
                    {session.completedAt ? (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">
                        Completed
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                        In Progress
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function ExamsTab() {
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SPEAKING' | 'WRITING'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  // Delete confirmation dialog state
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; examId: string | null; title: string }>({ open: false, examId: null, title: '' });
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchExams();
  }, []);

  const fetchExams = async () => {
    try {
      const res = await fetch('/api/admin/exams');
      const data = await res.json();
      setExams(data);
    } catch (err) {
      console.error('Failed to fetch exams:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExam = async (examId: string) => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/exams/${examId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        alert('Failed to delete exam');
        return;
      }

      fetchExams();
    } catch (err) {
      console.error('Error:', err);
      alert('Something went wrong');
    } finally {
      setIsDeleting(false);
      setDeleteConfirm({ open: false, examId: null, title: '' });
    }
  };

  const openDeleteConfirm = (exam: any) => {
    setDeleteConfirm({ open: true, examId: exam.id, title: exam.title });
  };

  const handleToggleStatus = async (examId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/exams/${examId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !currentStatus }),
      });

      if (!res.ok) {
        alert('Failed to update exam status');
        return;
      }

      fetchExams();
    } catch (err) {
      console.error('Error:', err);
      alert('Something went wrong');
    }
  };

  const handleDuplicateExam = async (exam: any) => {
    if (!confirm(`Duplicate "${exam.title}"?`)) return;

    try {
      const res = await fetch('/api/admin/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `${exam.title} (Copy)`,
          description: exam.description,
          type: exam.type,
          unlockCode: `${exam.unlockCode}-COPY`,
        }),
      });

      if (!res.ok) {
        alert('Failed to duplicate exam');
        return;
      }

      fetchExams();
    } catch (err) {
      console.error('Error:', err);
      alert('Something went wrong');
    }
  };

  const handleExportExams = () => {
    const csv = [
      ['Title', 'Type', 'Code', 'Status', 'Questions', 'Sessions'].join(','),
      ...filteredExams.map(exam => [
        `"${exam.title}"`,
        exam.type,
        exam.unlockCode,
        exam.isActive ? 'Active' : 'Inactive',
        exam._count?.questions || 0,
        exam._count?.sessions || 0,
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `exams-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filteredExams = exams.filter(exam => {
    const matchesSearch = exam.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exam.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exam.unlockCode.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'ALL' || exam.type === typeFilter;
    const matchesStatus = statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && exam.isActive) ||
      (statusFilter === 'INACTIVE' && !exam.isActive);
    return matchesSearch && matchesType && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Manage Exams</h2>
          <p className="text-gray-500">Create and manage mock exams</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportExams}
            className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-gray-900 hover:bg-black text-white font-medium rounded-lg transition-colors"
          >
            Create Exam
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="Search exams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
            />
          </div>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
          >
            <option value="ALL">All Types</option>
            <option value="SPEAKING">Speaking</option>
            <option value="WRITING">Writing</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
      </div>

      {filteredExams.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No exams found</h3>
          <p className="text-gray-500 mb-4">
            {searchQuery || typeFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'Try adjusting your filters'
              : 'Get started by creating your first exam'}
          </p>
          {!searchQuery && typeFilter === 'ALL' && statusFilter === 'ALL' && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-gray-900 hover:bg-black text-white font-medium rounded-lg"
            >
              Create First Exam
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stats
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredExams.map((exam) => (
                <tr key={exam.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-900">{exam.title}</div>
                    <div className="text-sm text-gray-500">{exam.description}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${exam.type === 'SPEAKING'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-purple-100 text-purple-800'
                      }`}>
                      {exam.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-gray-600">
                    {exam.unlockCode}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-600">
                      {exam._count?.questions || 0} questions
                    </div>
                    <div className="text-xs text-gray-500">
                      {exam._count?.sessions || 0} sessions
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleStatus(exam.id, exam.isActive)}
                      className={`px-2 py-1 text-xs font-medium rounded ${exam.isActive
                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                    >
                      {exam.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleDuplicateExam(exam)}
                        className="text-gray-500 hover:text-gray-800"
                        title="Duplicate"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setEditingExamId(exam.id)}
                        className="text-gray-500 hover:text-gray-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openDeleteConfirm(exam)}
                        className="text-red-500 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <CreateExamModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchExams();
          }}
        />
      )}

      {editingExamId && (
        <EditExamModal
          examId={editingExamId}
          onClose={() => setEditingExamId(null)}
          onSuccess={() => {
            setEditingExamId(null);
            fetchExams();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.open}
        title="Delete Exam"
        message={`Are you sure you want to delete "${deleteConfirm.title}"? This action cannot be undone and will delete all associated questions and sessions.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={() => deleteConfirm.examId && handleDeleteExam(deleteConfirm.examId)}
        onCancel={() => setDeleteConfirm({ open: false, examId: null, title: '' })}
      />
    </div>
  );
}

function CreateExamModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'SPEAKING',
    unlockCode: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to create exam');
        setLoading(false);
        return;
      }

      onSuccess();
    } catch (err) {
      console.error('Error:', err);
      setError('Something went wrong');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">Create New Exam</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Exam Title
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
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
              value={formData.unlockCode}
              onChange={(e) => setFormData({ ...formData, unlockCode: e.target.value.toUpperCase() })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none font-mono"
              placeholder="SPEAK-001"
              required
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm">{error}</p>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-gray-900 hover:bg-black text-white font-medium rounded-lg disabled:bg-gray-300"
            >
              {loading ? 'Creating...' : 'Create Exam'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SessionsTab() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'IN_PROGRESS'>('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/admin/sessions');
      const data = await res.json();
      setSessions(data);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions?id=${sessionId}`);
      const data = await res.json();
      setSelectedSession(data);
      setShowDetailModal(true);
    } catch (err) {
      console.error('Failed to fetch session details:', err);
      alert('Failed to load session details');
    }
  };

  const handleExportSessions = () => {
    const csv = [
      ['Student', 'Exam', 'Started', 'Completed', 'Status', 'AI Graded', 'Manual Graded'].join(','),
      ...filteredSessions.map(session => [
        `"${session.studentName}"`,
        `"${session.exam.title}"`,
        new Date(session.startedAt).toISOString(),
        session.completedAt ? new Date(session.completedAt).toISOString() : '',
        session.completedAt ? 'Completed' : 'In Progress',
        session.isAiGraded ? 'Yes' : 'No',
        session.isManuallyGraded ? 'Yes' : 'No',
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sessions-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const filterByDate = (session: any) => {
    if (dateFilter === 'ALL') return true;

    const sessionDate = new Date(session.startedAt);
    const now = new Date();

    if (dateFilter === 'TODAY') {
      return sessionDate.toDateString() === now.toDateString();
    } else if (dateFilter === 'WEEK') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return sessionDate >= weekAgo;
    } else if (dateFilter === 'MONTH') {
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return sessionDate >= monthAgo;
    }
    return true;
  };

  const filteredSessions = sessions.filter(session => {
    const matchesSearch = session.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.exam.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' ||
      (statusFilter === 'COMPLETED' && session.completedAt) ||
      (statusFilter === 'IN_PROGRESS' && !session.completedAt);
    const matchesDate = filterByDate(session);
    return matchesSearch && matchesStatus && matchesDate;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Exam Sessions</h2>
          <p className="text-gray-500">View and manage student exam sessions</p>
        </div>
        <button
          onClick={handleExportSessions}
          className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
          >
            <option value="ALL">All Status</option>
            <option value="COMPLETED">Completed</option>
            <option value="IN_PROGRESS">In Progress</option>
          </select>
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value as any)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
          >
            <option value="ALL">All Time</option>
            <option value="TODAY">Today</option>
            <option value="WEEK">Last 7 Days</option>
            <option value="MONTH">Last 30 Days</option>
          </select>
        </div>
      </div>

      {filteredSessions.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No sessions found</h3>
          <p className="text-gray-500">
            {searchQuery || statusFilter !== 'ALL' || dateFilter !== 'ALL'
              ? 'Try adjusting your filters'
              : 'No exam sessions have been created yet'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Student
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Exam
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Started
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Graded
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredSessions.map((session) => (
                <tr
                  key={session.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => handleViewSession(session.id)}
                >
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {session.studentName}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {session.exam.title}
                  </td>
                  <td className="px-6 py-4 text-gray-600 text-sm">
                    {new Date(session.startedAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    {session.completedAt ? (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">
                        Completed
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                        In Progress
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {session.isAiGraded && (
                        <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800">
                          AI
                        </span>
                      )}
                      {session.isManuallyGraded && (
                        <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">
                          Manual
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleViewSession(session.id);
                      }}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showDetailModal && selectedSession && (
        <SessionDetailModal
          session={selectedSession}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedSession(null);
          }}
          onRefresh={() => {
            fetchSessions();
            handleViewSession(selectedSession.id);
          }}
        />
      )}
    </div>
  );
}

function GradingTab() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState<'ALL' | 'UNGRADED' | 'AI_ONLY' | 'MANUALLY_GRADED'>('UNGRADED');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());


  const [batchGrading, setBatchGrading] = useState<{
    isActive: boolean;
    total: number;
    current: number;
    success: number;
    failed: number;
  }>({ isActive: false, total: 0, current: 0, success: 0, failed: 0 });
  const [batchResults, setBatchResults] = useState<{ open: boolean, results: any[] }>({ open: false, results: [] });
  // Print state
  const [printData, setPrintData] = useState<any[] | null>(null);
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    try {
      const res = await fetch('/api/admin/sessions');
      const data = await res.json();
      // Filter only completed sessions
      const completed = data.filter((s: any) => s.completedAt);
      setSessions(completed);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewSession = async (sessionId: string) => {
    try {
      const res = await fetch(`/api/sessions?id=${sessionId}`);
      const data = await res.json();
      setSelectedSession(data);
      setShowDetailModal(true);
    } catch (err) {
      console.error('Failed to fetch session details:', err);
      alert('Failed to load session details');
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredSessions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSessions.map(s => s.id)));
    }
  };

  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleBatchGrade = async () => {
  if (selectedIds.size === 0) return;
  if (!confirm(`Are you sure you want to visually AI grade ${selectedIds.size} sessions? This may take a few minutes.`)) return;

  const idsToGrade = Array.from(selectedIds);
  setBatchGrading({
    isActive: true,
    total: idsToGrade.length,
    current: 0,
    success: 0,
    failed: 0
  });

  const results = [];

  for (let i = 0; i < idsToGrade.length; i++) {
    const id = idsToGrade[i];
    setBatchGrading(prev => ({ ...prev, current: i + 1 }));

    try {
      const res = await fetch('/api/ai/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: id })
      });

      if (res.ok) {
        results.push({ id, status: 'success' });
        setBatchGrading(prev => ({ ...prev, success: prev.success + 1 }));
      } else {
        const err = await res.json();
        results.push({ id, status: 'error', message: err.error });
        setBatchGrading(prev => ({ ...prev, failed: prev.failed + 1 }));
      }
    } catch (e) {
      results.push({ id, status: 'error', message: 'Network error' });
      setBatchGrading(prev => ({ ...prev, failed: prev.failed + 1 }));
    }
  }

  setBatchGrading(prev => ({ ...prev, isActive: false }));
  setBatchResults(results.length > 0 ? { open: true, results } : { open: false, results: [] });
  fetchSessions();
  setSelectedIds(new Set());
};

const handlePrint = async (idsToPrint: string[] = []) => {
  const ids = idsToPrint.length > 0 ? idsToPrint : Array.from(selectedIds);
  if (ids.length === 0) return;

  setIsPreparingPrint(true);
  try {
    // Fetch full details for each session to get feedback and answers
    const fullSessions = await Promise.all(
      ids.map(async (id) => {
        const res = await fetch(`/api/sessions?id=${id}`);
        if (!res.ok) throw new Error(`Failed to load session ${id}`);
        return res.json();
      })
    );
    setPrintData(fullSessions);
  } catch (err) {
    console.error('Error preparing print:', err);
    alert('Failed to prepare reports for printing');
  } finally {
    setIsPreparingPrint(false);
  }
};

const handleExportGrades = () => {
  const csv = [
    ['Student', 'Exam', 'Completed', 'AI Score', 'Manual Score', 'Feedback'].join(','),
    ...filteredSessions.map(session => [
      `"${session.studentName}"`,
      `"${session.exam.title}"`,
      new Date(session.completedAt).toISOString(),
      session.isAiGraded ? 'Yes' : 'No',
      session.isManuallyGraded ? 'Yes' : 'No',
      '""',
    ].join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `grades-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
};

const filteredSessions = sessions.filter(session => {
  const matchesSearch = session.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    session.exam.title.toLowerCase().includes(searchQuery.toLowerCase());

  let matchesGrade = true;
  if (gradeFilter === 'UNGRADED') {
    matchesGrade = !session.isManuallyGraded && !session.isAiGraded;
  } else if (gradeFilter === 'AI_ONLY') {
    matchesGrade = session.isAiGraded && !session.isManuallyGraded;
  } else if (gradeFilter === 'MANUALLY_GRADED') {
    matchesGrade = session.isManuallyGraded;
  }

  return matchesSearch && matchesGrade;
});

if (loading) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
    </div>
  );
}

return (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Manual Grading</h2>
        <p className="text-gray-500">Review and manually grade student submissions</p>
      </div>
      <div className="flex gap-2">
        {selectedIds.size > 0 && (
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
          >
            Clear Selection ({selectedIds.size})
          </button>
        )}
        {selectedIds.size > 0 && (
          <>
            <button
              onClick={handleBatchGrade}
              disabled={batchGrading.isActive}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg flex items-center gap-2 disabled:bg-purple-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              Batch Grade AI
            </button>
            <button
              onClick={() => handlePrint()}
              disabled={isPreparingPrint}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center gap-2 disabled:bg-blue-300"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              {isPreparingPrint ? 'Preparing...' : 'Print Selected'}
            </button>
          </>
        )}
        <button
          onClick={handleExportGrades}
          className="px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export
        </button>
      </div>
    </div>

    {/* Search and Filters */}
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Search by student or exam..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
        />
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value as any)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
        >
          <option value="ALL">All Sessions</option>
          <option value="UNGRADED">Needs Grading</option>
          <option value="AI_ONLY">AI Graded Only</option>
          <option value="MANUALLY_GRADED">Manually Graded</option>
        </select>
      </div>
    </div>

    {filteredSessions.length === 0 ? (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Sessions Found</h3>
        <p className="text-gray-500">
          {searchQuery || gradeFilter !== 'ALL'
            ? 'Try adjusting your filters'
            : 'No completed sessions available for grading'}
        </p>
      </div>
    ) : (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedIds.size === filteredSessions.length && filteredSessions.length > 0}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300"
                />
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Student
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Exam
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Completed
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredSessions.map((session) => (
              <tr key={session.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(session.id)}
                    onChange={() => handleToggleSelect(session.id)}
                    className="rounded border-gray-300"
                  />
                </td>
                <td className="px-6 py-4 font-medium text-gray-900">
                  {session.studentName}
                </td>
                <td className="px-6 py-4 text-gray-600">
                  {session.exam.title}
                </td>
                <td className="px-6 py-4 text-gray-600 text-sm">
                  {new Date(session.completedAt).toLocaleString()}
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-col gap-1">
                    {session.isManuallyGraded ? (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">
                        Manual
                      </span>
                    ) : session.isAiGraded ? (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-purple-100 text-purple-800">
                        AI Only
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium rounded bg-yellow-100 text-yellow-800">
                        Ungraded
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => handleViewSession(session.id)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg"
                  >
                    {session.isManuallyGraded ? 'Review' : 'Grade Now'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}

    {showDetailModal && selectedSession && (
      <SessionDetailModal
        session={selectedSession}
        onClose={() => {
          setShowDetailModal(false);
          setSelectedSession(null);
        }}
        onRefresh={() => {
          fetchSessions();
          handleViewSession(selectedSession.id);
        }}
      />
    )}
  </div>
);
}

function AITab() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<'openrouter' | 'local'>('local');
  const [prompts, setPrompts] = useState<any[]>([]);
  const [editingPrompt, setEditingPrompt] = useState<any>(null);
  const [showPromptForm, setShowPromptForm] = useState(false);
  const [promptForm, setPromptForm] = useState({
    displayName: '',
    examType: 'SPEAKING',
    prompt: '',
  });

  useEffect(() => {
    fetchConfig();
    fetchPrompts();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/config');
      const data = await res.json();
      const configObj: Record<string, string> = {};
      data.forEach((c: any) => {
        configObj[c.key] = c.value;
      });
      setConfig(configObj);
      if (configObj.ai_provider) {
        setSelectedProvider(configObj.ai_provider as 'openrouter' | 'local');
      }
    } catch (err) {
      console.error('Failed to fetch config:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrompts = async () => {
    try {
      const res = await fetch('/api/admin/prompts');
      if (res.ok) {
        const data = await res.json();
        setPrompts(data);
      }
    } catch (err) {
      console.error('Failed to fetch prompts:', err);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      // Save AI provider selection
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'ai_provider',
          value: selectedProvider,
        }),
      });

      alert('AI configuration saved successfully!');
    } catch (err) {
      console.error('Failed to save config:', err);
      alert('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePrompt = async () => {
    if (!promptForm.displayName || !promptForm.prompt) {
      alert('Please fill in all fields');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/admin/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promptForm),
      });

      if (res.ok) {
        setShowPromptForm(false);
        setPromptForm({ displayName: '', examType: 'SPEAKING', prompt: '' });
        fetchPrompts();
        alert('Prompt saved successfully!');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to save prompt');
      }
    } catch (err) {
      console.error('Failed to save prompt:', err);
      alert('Failed to save prompt');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePrompt = async () => {
    if (!editingPrompt) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/prompts/${editingPrompt.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: editingPrompt.displayName,
          prompt: editingPrompt.prompt,
          isActive: editingPrompt.isActive,
        }),
      });

      if (res.ok) {
        setEditingPrompt(null);
        fetchPrompts();
        alert('Prompt updated successfully!');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update prompt');
      }
    } catch (err) {
      console.error('Failed to update prompt:', err);
      alert('Failed to update prompt');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePrompt = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/prompts/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });

      if (res.ok) {
        fetchPrompts();
      }
    } catch (err) {
      console.error('Failed to toggle prompt:', err);
    }
  };

  const handleDeletePrompt = async (id: string) => {
    if (!confirm('Are you sure you want to delete this prompt?')) return;

    try {
      const res = await fetch(`/api/admin/prompts/${id}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        fetchPrompts();
      }
    } catch (err) {
      console.error('Failed to delete prompt:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">AI Configuration</h2>
        <p className="text-gray-500">Configure AI provider, models, and custom grading prompts</p>
      </div>

      {/* Provider Selection */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">AI Provider Selection</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select AI Provider
              </label>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value as 'openrouter' | 'local')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
              >
                <option value="local">Local AI (Ollama/LM Studio) - GTX 5050</option>
                <option value="openrouter">OpenRouter (Cloud API)</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                {selectedProvider === 'local'
                  ? 'Use local AI running on your machine (free, fast)'
                  : 'Use OpenRouter for cloud-based AI (requires API key)'}
              </p>
            </div>

            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="w-full px-4 py-2 bg-gray-900 hover:bg-black text-white font-medium rounded-lg disabled:bg-gray-300"
            >
              {saving ? 'Saving...' : 'Save Provider Selection'}
            </button>
          </div>

          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">API Configuration</h4>
            {selectedProvider === 'openrouter' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    OpenRouter API Key
                  </label>
                  <input
                    type="password"
                    value={config.openrouter_api_key || ''}
                    onChange={(e) => setConfig({ ...config, openrouter_api_key: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
                    placeholder="Enter your OpenRouter API key"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Get your free API key at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">openrouter.ai</a>
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Model
                  </label>
                  <input
                    type="text"
                    value={config.openrouter_model || 'liquid/lfm-2.5-1.2b-thinking:free'}
                    onChange={(e) => setConfig({ ...config, openrouter_model: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
                  />
                </div>
              </>
            )}
            {selectedProvider === 'local' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Local API URL
                  </label>
                  <input
                    type="text"
                    value={config.local_api_url || process.env.LOCAL_API_URL || 'http://localhost:11434/v1'}
                    onChange={(e) => setConfig({ ...config, local_api_url: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none font-mono"
                    placeholder="http://localhost:11434/v1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Ollama: http://localhost:11434/v1 | LM Studio: http://localhost:1234/v1
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Default Model
                  </label>
                  <input
                    type="text"
                    value={config.local_model || 'google/gemma-3-4b'}
                    onChange={(e) => setConfig({ ...config, local_model: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
                    placeholder="google/gemma-3-4b"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Available models: google/gemma-3-4b, llama3.2:3b, llama3.2:1b, phi3.5:3.8b, qwen2.5:3b, gemma2:2b
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Test Connection
                  </label>
                  <button
                    onClick={handleTestLLM}
                    disabled={testingLLM}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg flex items-center justify-center gap-2"
                  >
                    {testingLLM ? (
                      <>
                        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Testing...
                      </>
                    ) : (
                      'Test LLM Connection'
                    )}
                  </button>
                  {llmTestResult && (
                    <div className={`mt-2 p-3 rounded-lg text-sm ${llmTestResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                      <p>{llmTestResult.message}</p>
                      {llmTestResult.duration && (
                        <p className="text-xs mt-1 opacity-75">Response time: {llmTestResult.duration}ms</p>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Custom Grading Prompts */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Custom Grading Prompts</h3>
            <p className="text-sm text-gray-500 mt-1">Define custom prompts for AI grading</p>
          </div>
          <button
            onClick={() => setShowPromptForm(true)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg"
          >
            + New Prompt
          </button>
        </div>

        {showPromptForm && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
            <h4 className="font-medium text-gray-900 mb-3">Create New Prompt</h4>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prompt Name
                </label>
                <input
                  type="text"
                  value={promptForm.displayName}
                  onChange={(e) => setPromptForm({ ...promptForm, displayName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  placeholder="e.g., Speaking Grading - Beginner"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Exam Type
                </label>
                <select
                  value={promptForm.examType}
                  onChange={(e) => setPromptForm({ ...promptForm, examType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                >
                  <option value="SPEAKING">Speaking Exam</option>
                  <option value="WRITING">Writing Exam</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Custom Prompt Template
                </label>
                <textarea
                  value={promptForm.prompt}
                  onChange={(e) => setPromptForm({ ...promptForm, prompt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none font-mono text-sm"
                  rows={6}
                  placeholder="Enter your custom grading prompt. Use {studentName}, {examTitle}, {answers} as placeholders."
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available placeholders: {'{'}studentName{'}'}, {'{'}examTitle{'}'}, {'{'}answers{'}'}, {'{'}examType{'}'}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSavePrompt}
                  disabled={saving}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white text-sm font-medium rounded-lg"
                >
                  {saving ? 'Saving...' : 'Save Prompt'}
                </button>
                <button
                  onClick={() => {
                    setShowPromptForm(false);
                    setPromptForm({ displayName: '', examType: 'SPEAKING', prompt: '' });
                  }}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-medium rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {prompts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No custom prompts yet. Create one to get started.</p>
            </div>
          ) : (
            prompts.map((prompt: any) => (
              <div
                key={prompt.id}
                className={`border rounded-lg p-4 ${prompt.isActive ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-60'
                  }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-gray-900">{prompt.displayName}</h4>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${prompt.examType === 'SPEAKING'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-purple-100 text-purple-800'
                        }`}>
                        {prompt.examType}
                      </span>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${prompt.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                        {prompt.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 font-mono bg-gray-50 p-2 rounded truncate">
                      {prompt.prompt.substring(0, 150)}...
                    </p>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => setEditingPrompt(prompt)}
                      className="text-gray-500 hover:text-gray-800 text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleTogglePrompt(prompt.id, !prompt.isActive)}
                      className={`text-sm ${prompt.isActive
                        ? 'text-yellow-600 hover:text-yellow-800'
                        : 'text-green-600 hover:text-green-800'
                        }`}
                    >
                      {prompt.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleDeletePrompt(prompt.id)}
                      className="text-red-500 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Edit Prompt Modal */}
      {editingPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Edit Prompt</h3>
              <button onClick={() => setEditingPrompt(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prompt Name
                </label>
                <input
                  type="text"
                  value={editingPrompt.displayName}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, displayName: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Exam Type
                </label>
                <div className="text-sm text-gray-600">
                  {editingPrompt.examType}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Prompt Template
                </label>
                <textarea
                  value={editingPrompt.prompt}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, prompt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none resize-none font-mono text-sm"
                  rows={10}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Available placeholders: {'{'}studentName{'}'}, {'{'}examTitle{'}'}, {'{'}answers{'}'}, {'{'}examType{'}'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={editingPrompt.isActive}
                  onChange={(e) => setEditingPrompt({ ...editingPrompt, isActive: e.target.checked })}
                  className="w-4 h-4 text-gray-900 border-gray-300 rounded focus:ring-gray-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">
                  Prompt is active
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setEditingPrompt(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdatePrompt}
                  disabled={saving}
                  className="flex-1 px-4 py-2 bg-gray-900 hover:bg-black text-white font-medium rounded-lg disabled:bg-gray-300"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsTab() {
  const [config, setConfig] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiCodes, setAiCodes] = useState<any[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [showCodeForm, setShowCodeForm] = useState(false);
  const [newCodeForm, setNewCodeForm] = useState({
    maxUses: '',
    expiresAt: '',
  });
  const [testingLLM, setTestingLLM] = useState(false);
  const [llmTestResult, setLlmTestResult] = useState<{ success: boolean; message: string; duration?: number } | null>(null);

  useEffect(() => {
    fetchConfig();
    fetchAICodes();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/config');
      const data = await res.json();
      const configObj: Record<string, string> = {};
      data.forEach((c: any) => {
        configObj[c.key] = c.value;
      });
      setConfig(configObj);
    } catch (err) {
      console.error('Failed to fetch config:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAICodes = async () => {
    try {
      const res = await fetch('/api/admin/codes');
      const data = await res.json();
      setAiCodes(data);
    } catch (err) {
      console.error('Failed to fetch AI codes:', err);
    } finally {
      setLoadingCodes(false);
    }
  };

  const handleCreateCode = async () => {
    try {
      const res = await fetch('/api/admin/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCodeForm),
      });

      if (!res.ok) {
        throw new Error('Failed to create code');
      }

      const newCode = await res.json();
      setAiCodes([newCode, ...aiCodes]);
      setShowCodeForm(false);
      setNewCodeForm({ maxUses: '', expiresAt: '' });
      alert(`AI Code created: ${newCode.code}`);
    } catch (err) {
      console.error('Failed to create code:', err);
      alert('Failed to create AI code');
    }
  };

  const handleToggleCode = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch('/api/admin/codes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive }),
      });

      if (!res.ok) {
        throw new Error('Failed to update code');
      }

      setAiCodes(aiCodes.map(code =>
        code.id === id ? { ...code, isActive } : code
      ));
    } catch (err) {
      console.error('Failed to update code:', err);
      alert('Failed to update AI code');
    }
  };

  const handleDeleteCode = async (id: string) => {
    if (!confirm('Are you sure you want to delete this AI code?')) {
      return;
    }

    try {
      const res = await fetch(`/api/admin/codes?id=${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        throw new Error('Failed to delete code');
      }

      setAiCodes(aiCodes.filter(code => code.id !== id));
    } catch (err) {
      console.error('Failed to delete code:', err);
      alert('Failed to delete AI code');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Code copied to clipboard!');
  };

  const handleSave = async (key: string, value: string) => {
    setSaving(true);
    try {
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      setConfig(prev => ({ ...prev, [key]: value }));
    } catch (err) {
      console.error('Failed to save config:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      // Convert config object to array format
      const configArray = Object.entries(config).map(([key, value]) => ({
        key,
        value,
      }));

      // Save all configs in a single batch request
      const res = await fetch('/api/admin/config/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configArray),
      });

      if (!res.ok) {
        throw new Error('Failed to save config');
      }

      alert('Configuration saved successfully!');
    } catch (err) {
      console.error('Failed to save config:', err);
      alert('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleTestLLM = async () => {
    setTestingLLM(true);
    setLlmTestResult(null);

    const apiUrl = config.local_api_url || process.env.LOCAL_API_URL || 'http://localhost:1234/v1';
    const model = config.local_model || 'google/gemma-3-4b';

    try {
      const res = await fetch('/api/admin/test-llm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiUrl, model }),
      });

      const data = await res.json();

      if (data.success) {
        setLlmTestResult({
          success: true,
          message: `Connected! Response: "${data.response}"`,
          duration: data.duration,
        });
      } else {
        setLlmTestResult({
          success: false,
          message: `Failed: ${data.error}`,
          duration: data.duration,
        });
      }
    } catch (err: any) {
      setLlmTestResult({
        success: false,
        message: `Error: ${err.message}`,
      });
    } finally {
      setTestingLLM(false);
    }
  };
        throw new Error('Failed to save settings');
      }

      alert('Settings saved successfully!');
    } catch (err) {
      console.error('Failed to save config:', err);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  const selectedProvider = config.ai_provider || 'local';

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Settings</h2>
        <p className="text-gray-500">Configure AI model and other settings</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">AI Configuration</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              AI Provider
            </label>
            <select
              value={selectedProvider}
              onChange={(e) => setConfig({ ...config, ai_provider: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
            >
              <option value="local">Local AI (Ollama/LM Studio) - Best for GTX 5050</option>
              <option value="openrouter">OpenRouter (Cloud API)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {selectedProvider === 'local'
                ? 'Use local AI running on your machine (e.g., Ollama, LM Studio)'
                : 'Use OpenRouter for cloud-based AI grading (requires API key)'}
            </p>
          </div>

          {selectedProvider === 'openrouter' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  OpenRouter API Key
                </label>
                <input
                  type="password"
                  value={config.openrouter_api_key || ''}
                  onChange={(e) => setConfig({ ...config, openrouter_api_key: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
                  placeholder="Enter your OpenRouter API key"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Get your free API key at <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">openrouter.ai</a>
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  OpenRouter Model
                </label>
                <select
                  value={config.openrouter_model || 'liquid/lfm-2.5-1.2b-thinking:free'}
                  onChange={(e) => setConfig({ ...config, openrouter_model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
                >
                  <option value="liquid/lfm-2.5-1.2b-thinking:free">liquid/lfm-2.5-1.2b-thinking:free</option>
                  <option value="xiaomi/mimo-v2-flash:free">xiaomi/mimo-v2-flash:free</option>
                  <option value="arcee-ai/trinity-mini:free">arcee-ai/trinity-mini:free</option>
                  <option value="allenai/molmo-2-8b:free">allenai/molmo-2-8b:free</option>
                  <option value="qwen/qwen3-next-80b-a3b-instruct:free">qwen/qwen3-next-80b-a3b-instruct:free</option>
                  <option value="tngtech/tng-r1t-chimera:free">tngtech/tng-r1t-chimera:free</option>
                  <option value="anthropic/claude-3.5-sonnet">anthropic/claude-3.5-sonnet (paid)</option>
                  <option value="openai/gpt-4o-mini">openai/gpt-4o-mini (paid)</option>
                  <option value="google/gemini-2.0-flash-exp">google/gemini-2.0-flash-exp (paid)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Free models available with OpenRouter</p>
              </div>
            </>
          )}

          {selectedProvider === 'local' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Local API URL
                </label>
                <input
                  type="text"
                  value={config.local_api_url || process.env.LOCAL_API_URL || 'http://localhost:11434/v1'}
                  onChange={(e) => setConfig({ ...config, local_api_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none font-mono"
                  placeholder="http://localhost:11434/v1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Default: http://localhost:11434/v1 (Ollama) | LM Studio: http://localhost:1234/v1
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Local Model
                </label>
                <select
                  value={config.local_model || 'google/gemma-3-4b'}
                  onChange={(e) => setConfig({ ...config, local_model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
                >
                  <option value="google/gemma-3-4b">google/gemma-3-4b (Recommended)</option>
                  <option value="llama3.2:3b">llama3.2:3b</option>
                  <option value="llama3.2:1b">llama3.2:1b (Fastest)</option>
                  <option value="phi3.5:3.8b">phi3.5:3.8b</option>
                  <option value="qwen2.5:3b">qwen2.5:3b</option>
                  <option value="gemma2:2b">gemma2:2b</option>
                  <option value="tinyllama:1.1b">tinyllama:1.1b</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Load the model in LM Studio
                </p>
              </div>
              <div>
                <button
                  onClick={handleTestLLM}
                  disabled={testingLLM}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg flex items-center justify-center gap-2"
                >
                  {testingLLM ? (
                    <>
                      <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Testing...
                    </>
                  ) : (
                    'Test LLM Connection'
                  )}
                </button>
                {llmTestResult && (
                  <div className={`mt-2 p-3 rounded-lg text-sm ${llmTestResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                    <p>{llmTestResult.message}</p>
                    {llmTestResult.duration && (
                      <p className="text-xs mt-1 opacity-75">Response time: {llmTestResult.duration}ms</p>
                    )}
                  </div>
                )}
              </div>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-900">
                  <strong>Setup instructions:</strong>
                  <br />1. Install LM Studio from <a href="https://lmstudio.ai" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-700">lmstudio.ai</a>
                  <br />2. Search and load <code>google/gemma-3-4b</code>
                  <br />3. Start the API server on port 1234
                  <br />4. <strong>Enable CORS</strong> in the server settings (check the "Apply CORS" or "Enable CORS" box)
                </p>
              </div>
            </>
          )}

          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="px-4 py-2 bg-gray-900 hover:bg-black text-white font-medium rounded-lg disabled:bg-gray-300"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Whisper Configuration Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Whisper Transcription</h3>
        <p className="text-sm text-gray-500 mb-4">
          Configure how speech-to-text transcription is processed for speaking exams.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transcription Mode
            </label>
            <select
              value={config.whisper_mode || 'client'}
              onChange={(e) => setConfig({ ...config, whisper_mode: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none"
            >
              <option value="client">Client-side (Browser)</option>
              <option value="server">Server-side (GTX 5050)</option>
            </select>
          </div>

          {config.whisper_mode === 'server' ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-900">
                <strong>Server-side Mode:</strong> Transcription runs on the server using the GTX 5050 GPU.
                <br />• Faster transcription for individual students
                <br />• Higher accuracy with larger models
                <br />• ⚠️ May cause issues with 100+ concurrent users
              </p>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-900">
                <strong>Client-side Mode:</strong> Transcription runs in each student&apos;s browser.
                <br />• Scales to unlimited concurrent users
                <br />• No server load for transcription
                <br />• ⚠️ Slower on low-end student devices
              </p>
            </div>
          )}

          <button
            onClick={() => handleSave('whisper_mode', config.whisper_mode || 'client')}
            disabled={saving}
            className="px-4 py-2 bg-gray-900 hover:bg-black text-white font-medium rounded-lg disabled:bg-gray-300"
          >
            {saving ? 'Saving...' : 'Save Whisper Settings'}
          </button>
        </div>
      </div>

      {/* AI Codes Management Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">AI Grading Codes</h3>
            <p className="text-sm text-gray-500 mt-1">Generate one-time or limited-use codes for students to enable AI grading</p>
          </div>
          <button
            onClick={() => setShowCodeForm(!showCodeForm)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg"
          >
            + Generate Code
          </button>
        </div>

        {/* Code Generation Form */}
        {showCodeForm && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-4">
            <h4 className="font-medium text-gray-900 mb-3">Generate New AI Code</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Uses (Optional)
                </label>
                <input
                  type="number"
                  min="1"
                  value={newCodeForm.maxUses}
                  onChange={(e) => setNewCodeForm({ ...newCodeForm, maxUses: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  placeholder="Unlimited if empty"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty for unlimited uses</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expires At (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={newCodeForm.expiresAt}
                  onChange={(e) => setNewCodeForm({ ...newCodeForm, expiresAt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                />
                <p className="text-xs text-gray-500 mt-1">Leave empty for no expiration</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCreateCode}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg"
              >
                Generate Code
              </button>
              <button
                onClick={() => {
                  setShowCodeForm(false);
                  setNewCodeForm({ maxUses: '', expiresAt: '' });
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-sm font-medium rounded-lg"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* AI Codes List */}
        {loadingCodes ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
          </div>
        ) : aiCodes.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <svg className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <p>No AI codes yet. Generate one to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {aiCodes.map((code) => (
              <div
                key={code.id}
                className={`border rounded-lg p-4 ${code.isActive ? 'border-gray-200 bg-white' : 'border-gray-200 bg-gray-50 opacity-60'
                  }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <code className="text-lg font-mono font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded">
                        {code.code}
                      </code>
                      <button
                        onClick={() => copyToClipboard(code.code)}
                        className="text-gray-500 hover:text-gray-700"
                        title="Copy to clipboard"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </button>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${code.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                        {code.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Uses:</span> {code.useCount}
                        {code.maxUses && ` / ${code.maxUses}`}
                        {!code.maxUses && ' (unlimited)'}
                      </div>
                      {code.expiresAt && (
                        <div>
                          <span className="font-medium">Expires:</span>{' '}
                          {new Date(code.expiresAt).toLocaleString()}
                        </div>
                      )}
                      <div>
                        <span className="font-medium">Created:</span>{' '}
                        {new Date(code.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleToggleCode(code.id, !code.isActive)}
                      className={`px-3 py-1 text-sm font-medium rounded ${code.isActive
                        ? 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800'
                        : 'bg-green-100 hover:bg-green-200 text-green-800'
                        }`}
                      title={code.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {code.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDeleteCode(code.id)}
                      className="px-3 py-1 text-sm font-medium rounded bg-red-100 hover:bg-red-200 text-red-800"
                      title="Delete"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function SessionDetailModal({ session, onClose, onRefresh }: { session: any; onClose: () => void; onRefresh: () => void }) {
  const [manualGrade, setManualGrade] = useState({
    score: 0,
    feedback: '',
    summary: '',
  });
  const [saving, setSaving] = useState(false);

  const handleManualGrade = async () => {
    if (!manualGrade.feedback || !manualGrade.summary) {
      alert('Please provide both feedback and summary');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/sessions/${session.id}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manualGrade),
      });

      if (!res.ok) {
        alert('Failed to save manual grade');
        return;
      }

      alert('Manual grade saved successfully!');
      onRefresh();
    } catch (err) {
      console.error('Error:', err);
      alert('Failed to save grade');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white p-6 border-b border-gray-200 flex items-center justify-between z-10">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Session Details</h3>
            <p className="text-sm text-gray-500 mt-1">{session.studentName} - {session.exam.title}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Session Info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-600">Started:</span>
              <span className="text-sm text-gray-900">{new Date(session.startedAt).toLocaleString()}</span>
            </div>
            {session.completedAt && (
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Completed:</span>
                <span className="text-sm text-gray-900">{new Date(session.completedAt).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-600">Status:</span>
              <span className={`text-sm px-2 py-1 rounded ${session.completedAt ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                {session.completedAt ? 'Completed' : 'In Progress'}
              </span>
            </div>
          </div>

          {/* Speaking Answers */}
          {session.speakingAnswers && session.speakingAnswers.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Speaking Answers</h4>
              <div className="space-y-4">
                {session.speakingAnswers.map((answer: any, idx: number) => (
                  <div key={answer.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h5 className="font-medium text-gray-900">Question {idx + 1}</h5>
                      <span className="text-xs text-gray-500">{new Date(answer.recordedAt).toLocaleString()}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{answer.question.text}</p>

                    {answer.audioUrl && (
                      <div className="mb-3">
                        <audio src={answer.audioUrl} controls className="w-full" />
                      </div>
                    )}

                    {answer.transcription ? (
                      <div className="bg-blue-50 rounded p-3">
                        <p className="text-xs font-medium text-blue-900 mb-1">Transcription:</p>
                        <p className="text-sm text-gray-800">{answer.transcription}</p>
                      </div>
                    ) : (
                      <div className="bg-yellow-50 rounded p-3 text-center">
                        <p className="text-xs text-yellow-800">No transcription available</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Writing Answers */}
          {session.writingAnswers && session.writingAnswers.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Writing Answers</h4>
              <div className="space-y-4">
                {session.writingAnswers.map((answer: any, idx: number) => (
                  <div key={answer.id} className="bg-white border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h5 className="font-medium text-gray-900">{answer.prompt.title}</h5>
                      <span className="text-xs text-gray-500">Words: {answer.wordCount || 0}</span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{answer.prompt.prompt}</p>
                    <div className="bg-gray-50 rounded p-3">
                      <p className="text-sm text-gray-800 whitespace-pre-wrap">{answer.content}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Grades */}
          {session.aiGrades && session.aiGrades.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">AI Grade</h4>
              {session.aiGrades.map((grade: any) => (
                <div key={grade.id} className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-lg font-bold text-purple-900">Score: {grade.score || 'N/A'}</span>
                    <span className="text-xs text-purple-700">{grade.metadata?.provider || 'AI'}</span>
                  </div>
                  <div className="mb-3">
                    <p className="text-xs font-medium text-purple-900 mb-1">Summary:</p>
                    <p className="text-sm text-gray-800">{grade.summary}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-purple-900 mb-1">Feedback:</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{grade.feedback}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Manual Grades */}
          {session.manualGrades && session.manualGrades.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Manual Grade</h4>
              {session.manualGrades.map((grade: any) => (
                <div key={grade.id} className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-lg font-bold text-green-900">Score: {grade.score || 'N/A'}</span>
                    <span className="text-xs text-green-700">Graded by: {grade.gradedBy}</span>
                  </div>
                  <div className="mb-3">
                    <p className="text-xs font-medium text-green-900 mb-1">Summary:</p>
                    <p className="text-sm text-gray-800">{grade.summary}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-green-900 mb-1">Feedback:</p>
                    <p className="text-sm text-gray-800 whitespace-pre-wrap">{grade.feedback}</p>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Graded on: {new Date(grade.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Manual Grading Section */}
          {session.completedAt && (
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Manual Grading</h4>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Score (0-100)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={manualGrade.score}
                    onChange={(e) => setManualGrade({ ...manualGrade, score: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Summary
                  </label>
                  <input
                    type="text"
                    value={manualGrade.summary}
                    onChange={(e) => setManualGrade({ ...manualGrade, summary: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                    placeholder="Brief summary of performance"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Detailed Feedback
                  </label>
                  <textarea
                    value={manualGrade.feedback}
                    onChange={(e) => setManualGrade({ ...manualGrade, feedback: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none resize-none"
                    rows={6}
                    placeholder="Provide detailed feedback on the student's performance..."
                  />
                </div>

                <button
                  onClick={handleManualGrade}
                  disabled={saving}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-medium rounded-lg"
                >
                  {saving ? 'Saving...' : 'Save Manual Grade'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
