'use client';

import { useEffect } from 'react';

interface PrintableGradeReportProps {
    sessions: any[];
    onClose: () => void;
}

export default function PrintableGradeReport({ sessions, onClose }: PrintableGradeReportProps) {

    // Auto-trigger print when mounted
    useEffect(() => {
        const handlePrint = async () => {
            // Small delay to ensure styles are loaded and content is rendered
            await new Promise(resolve => setTimeout(resolve, 500));
            window.print();
        };
        handlePrint();

        // Listen for afterprint to potentially close, but usually better to let user manually close
        // just in case they want to print again
    }, []);

    return (
        <div className="fixed inset-0 bg-white z-[100] overflow-y-auto">
            {/* Non-printable header */}
            <div className="print:hidden sticky top-0 bg-gray-900 text-white px-6 py-4 flex justify-between items-center shadow-lg">
                <h2 className="text-lg font-bold">Print Preview ({sessions.length} reports)</h2>
                <div className="flex gap-4">
                    <button
                        onClick={() => window.print()}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
                    >
                        Print
                    </button>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg font-medium"
                    >
                        Close
                    </button>
                </div>
            </div>

            {/* Printable Content */}
            <div className="max-w-[210mm] mx-auto bg-white p-8 print:p-0">
                {sessions.map((session, index) => (
                    <div key={session.id} className="print:break-after-page mb-16 print:mb-0 relative min-h-[297mm]">
                        {/* Certificate/Report Header */}
                        <div className="border-b-2 border-gray-900 pb-6 mb-8">
                            <div className="flex justify-between items-end">
                                <div>
                                    <h1 className="text-3xl font-bold text-gray-900">BESTCENTER</h1>
                                    <p className="text-gray-500 uppercase tracking-widest text-sm mt-1">Multilevel Mock Exam Result</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-gray-600">Date: {new Date(session.completedAt).toLocaleDateString()}</p>
                                    <p className="text-gray-600">Session ID: {session.id.slice(0, 8)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Student Info */}
                        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 mb-8 print:bg-white print:border-gray-300">
                            <div className="grid grid-cols-2 gap-8">
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Student Name</p>
                                    <p className="text-xl font-bold text-gray-900">{session.studentName}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Exam Title</p>
                                    <p className="text-xl font-bold text-gray-900">{session.exam.title}</p>
                                </div>
                            </div>
                        </div>

                        {/* Score Section */}
                        <div className="mb-8">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">Assessment Summary</h3>

                            <div className="flex gap-4 mb-2">
                                <div className={`flex-1 p-4 rounded-lg border-2 ${session.isManuallyGraded ? 'border-green-500 bg-green-50 print:border-gray-300' : 'border-purple-500 bg-purple-50 print:border-gray-300'}`}>
                                    <p className="text-sm text-gray-600 mb-1">Grading Method</p>
                                    <p className="font-bold text-lg">
                                        {session.isManuallyGraded ? 'Instructor Evaluated' : 'AI Evaluated'}
                                    </p>
                                </div>
                            </div>

                            {/* AI Comparison if applicable */}
                            {session.isManuallyGraded && session.isAiGraded && (
                                <p className="text-xs text-gray-500 mt-2">
                                    * This session was evaluated by both AI and an Instructor.
                                </p>
                            )}

                            {/* WPM Display */}
                            {session.aiGrades && session.aiGrades[0]?.metadata?.wpm && (
                                <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-100 print:border-gray-200">
                                    <p className="text-sm text-blue-800 font-bold mb-1">Fluency Analysis</p>
                                    <p className="text-2xl font-bold text-blue-900">
                                        {session.aiGrades[0].metadata.wpm} <span className="text-sm font-normal text-blue-700">WPM</span>
                                    </p>
                                    <p className="text-xs text-blue-600 mt-1">Average Words Per Minute</p>
                                </div>
                            )}
                        </div>

                        {/* Feedback / Detailed Review */}
                        <div className="mb-8">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">Detailed Feedback</h3>

                            {/* Try to parse feedback if it's JSON-like or structured, otherwise display raw */}
                            <div className="prose max-w-none text-sm text-gray-800 whitespace-pre-wrap">
                                {session.feedback || "No feedback provided for this session."}
                            </div>
                        </div>

                        {/* Question Breakdown (Simplified) */}
                        <div className="mb-8">
                            <h3 className="text-lg font-bold text-gray-900 mb-4 border-b border-gray-200 pb-2">Response Breakdown</h3>
                            <div className="space-y-2">
                                {session.speakingAnswers?.length > 0 && (
                                    <p className="text-sm text-gray-600">
                                        <span className="font-medium">Type:</span> Speaking Exam &bull; {session.speakingAnswers.length} recorded responses
                                    </p>
                                )}
                                {session.writingAnswers?.length > 0 && (
                                    <p className="text-sm text-gray-600">
                                        <span className="font-medium">Type:</span> Writing Exam &bull; {session.writingAnswers.length} written responses ({session.writingAnswers.reduce((acc: number, curr: any) => acc + (curr.wordCount || 0), 0)} words total)
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-900 pt-4 text-center text-xs text-gray-500">
                            <p>Bestcenter Multilevel Mock Platform &bull; Assessment Report</p>
                        </div>
                    </div>
                ))}
            </div>

            <style jsx global>{`
        @media print {
          @page { margin: 10mm; }
          body { -webkit-print-color-adjust: exact; }
        }
      `}</style>
        </div>
    );
}
