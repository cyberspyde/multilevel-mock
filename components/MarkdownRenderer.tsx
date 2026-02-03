'use client';

import React from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * Simple Markdown renderer for AI responses
 * Supports: bold, italic, bullet points, numbered lists, headers, and line breaks
 */
export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  if (!content) return null;

  const parseMarkdown = (text: string): React.ReactNode[] => {
    const lines = text.split('\n');
    const result: React.ReactNode[] = [];
    let listItems: React.ReactNode[] = [];
    let listType: 'ul' | 'ol' | null = null;
    let key = 0;

    const flushList = () => {
      if (listItems.length > 0) {
        if (listType === 'ul') {
          result.push(
            <ul key={`list-${key++}`} className="list-disc list-inside space-y-1 my-2 ml-2">
              {listItems}
            </ul>
          );
        } else if (listType === 'ol') {
          result.push(
            <ol key={`list-${key++}`} className="list-decimal list-inside space-y-1 my-2 ml-2">
              {listItems}
            </ol>
          );
        }
        listItems = [];
        listType = null;
      }
    };

    const formatInlineText = (line: string): React.ReactNode => {
      // Process inline formatting: **bold**, *italic*, `code`
      const parts: React.ReactNode[] = [];
      let remaining = line;
      let partKey = 0;

      while (remaining.length > 0) {
        // Bold: **text** or __text__
        const boldMatch = remaining.match(/^(.*?)(\*\*|__)(.+?)(\*\*|__)/);
        if (boldMatch) {
          if (boldMatch[1]) {
            parts.push(<span key={partKey++}>{formatInlineText(boldMatch[1])}</span>);
          }
          parts.push(<strong key={partKey++} className="font-semibold">{boldMatch[3]}</strong>);
          remaining = remaining.slice(boldMatch[0].length);
          continue;
        }

        // Italic: *text* or _text_
        const italicMatch = remaining.match(/^(.*?)(\*|_)([^*_]+)(\*|_)/);
        if (italicMatch && !remaining.startsWith('**')) {
          if (italicMatch[1]) {
            parts.push(<span key={partKey++}>{italicMatch[1]}</span>);
          }
          parts.push(<em key={partKey++} className="italic">{italicMatch[3]}</em>);
          remaining = remaining.slice(italicMatch[0].length);
          continue;
        }

        // Code: `code`
        const codeMatch = remaining.match(/^(.*?)`([^`]+)`/);
        if (codeMatch) {
          if (codeMatch[1]) {
            parts.push(<span key={partKey++}>{codeMatch[1]}</span>);
          }
          parts.push(
            <code key={partKey++} className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">
              {codeMatch[2]}
            </code>
          );
          remaining = remaining.slice(codeMatch[0].length);
          continue;
        }

        // No more formatting, add the rest
        parts.push(<span key={partKey++}>{remaining}</span>);
        break;
      }

      return parts.length === 1 ? parts[0] : <>{parts}</>;
    };

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Empty line
      if (!trimmedLine) {
        flushList();
        result.push(<div key={`br-${key++}`} className="h-2" />);
        continue;
      }

      // Headers
      const headerMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        flushList();
        const level = headerMatch[1].length;
        const headerText = formatInlineText(headerMatch[2]);
        const headerClasses: Record<number, string> = {
          1: 'text-xl font-bold mt-4 mb-2',
          2: 'text-lg font-bold mt-3 mb-2',
          3: 'text-base font-semibold mt-2 mb-1',
          4: 'text-sm font-semibold mt-2 mb-1',
          5: 'text-sm font-medium mt-1 mb-1',
          6: 'text-xs font-medium mt-1 mb-1',
        };
        result.push(
          <div key={`h-${key++}`} className={headerClasses[level] || headerClasses[3]}>
            {headerText}
          </div>
        );
        continue;
      }

      // Bullet points: - item, * item, • item
      const bulletMatch = trimmedLine.match(/^[-*•]\s+(.+)$/);
      if (bulletMatch) {
        if (listType !== 'ul') {
          flushList();
          listType = 'ul';
        }
        listItems.push(<li key={`li-${key++}`}>{formatInlineText(bulletMatch[1])}</li>);
        continue;
      }

      // Numbered list: 1. item, 1) item
      const numberedMatch = trimmedLine.match(/^\d+[.)]\s+(.+)$/);
      if (numberedMatch) {
        if (listType !== 'ol') {
          flushList();
          listType = 'ol';
        }
        listItems.push(<li key={`li-${key++}`}>{formatInlineText(numberedMatch[1])}</li>);
        continue;
      }

      // Regular paragraph
      flushList();
      result.push(
        <p key={`p-${key++}`} className="my-1">
          {formatInlineText(trimmedLine)}
        </p>
      );
    }

    flushList();
    return result;
  };

  return (
    <div className={`prose prose-sm max-w-none ${className}`}>
      {parseMarkdown(content)}
    </div>
  );
}

/**
 * Convert AI grade to downloadable PDF
 */
export async function downloadGradeAsPdf(
  studentName: string,
  examTitle: string,
  examType: string,
  completedAt: string,
  grade: {
    score?: number;
    summary?: string;
    feedback?: string;
    metadata?: { provider?: string; model?: string };
  }
) {
  // Create printable HTML content
  const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Grade Report - ${studentName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
      line-height: 1.6; 
      color: #333;
      padding: 40px;
      max-width: 800px;
      margin: 0 auto;
    }
    .header { 
      border-bottom: 3px solid #2563eb; 
      padding-bottom: 20px; 
      margin-bottom: 30px;
    }
    .logo { font-size: 24px; font-weight: bold; color: #2563eb; }
    .title { font-size: 28px; font-weight: bold; margin-top: 10px; color: #111; }
    .meta { color: #666; margin-top: 10px; }
    .meta-item { display: inline-block; margin-right: 20px; }
    .score-box {
      background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
      color: white;
      padding: 20px 30px;
      border-radius: 12px;
      text-align: center;
      margin: 20px 0;
    }
    .score-value { font-size: 48px; font-weight: bold; }
    .score-label { font-size: 14px; opacity: 0.9; }
    .section { margin: 25px 0; }
    .section-title { 
      font-size: 18px; 
      font-weight: 600; 
      color: #2563eb; 
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 8px;
      margin-bottom: 12px;
    }
    .content { white-space: pre-wrap; }
    .content ul, .content ol { margin-left: 20px; margin-top: 8px; margin-bottom: 8px; }
    .content li { margin-bottom: 4px; }
    .content strong { font-weight: 600; }
    .footer { 
      margin-top: 40px; 
      padding-top: 20px; 
      border-top: 1px solid #e5e7eb; 
      color: #666; 
      font-size: 12px;
      text-align: center;
    }
    @media print {
      body { padding: 20px; }
      .score-box { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">Bestcenter Multilevel Mock</div>
    <div class="title">AI Grade Report</div>
    <div class="meta">
      <span class="meta-item"><strong>Student:</strong> ${studentName}</span>
      <span class="meta-item"><strong>Exam:</strong> ${examTitle}</span>
      <span class="meta-item"><strong>Type:</strong> ${examType}</span>
    </div>
    <div class="meta">
      <span class="meta-item"><strong>Completed:</strong> ${new Date(completedAt).toLocaleString()}</span>
      ${grade.metadata?.provider ? `<span class="meta-item"><strong>Graded by:</strong> ${grade.metadata.provider}</span>` : ''}
    </div>
  </div>

  ${grade.score !== undefined ? `
  <div class="score-box">
    <div class="score-value">${grade.score}/100</div>
    <div class="score-label">Overall Score</div>
  </div>
  ` : ''}

  <div class="section">
    <div class="section-title">Summary</div>
    <div class="content">${formatTextForPdf(grade.summary || 'No summary available.')}</div>
  </div>

  <div class="section">
    <div class="section-title">Detailed Feedback</div>
    <div class="content">${formatTextForPdf(grade.feedback || 'No feedback available.')}</div>
  </div>

  <div class="footer">
    Generated on ${new Date().toLocaleString()} • Bestcenter Multilevel Mock Exam Platform
  </div>
</body>
</html>
  `;

  // Create blob and download
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  // Open in new window for printing/saving as PDF
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
  
  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/**
 * Format markdown text for PDF (convert to HTML)
 */
function formatTextForPdf(text: string): string {
  if (!text) return '';
  
  return text
    // Escape HTML
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/_([^_]+)_/g, '<em>$1</em>')
    // Bullet points
    .replace(/^[-*•]\s+(.+)$/gm, '<li>$1</li>')
    // Numbered lists
    .replace(/^\d+[.)]\s+(.+)$/gm, '<li>$1</li>')
    // Headers
    .replace(/^###\s+(.+)$/gm, '<h4 style="font-weight:600;margin-top:12px;">$1</h4>')
    .replace(/^##\s+(.+)$/gm, '<h3 style="font-weight:600;margin-top:16px;">$1</h3>')
    .replace(/^#\s+(.+)$/gm, '<h2 style="font-weight:700;margin-top:20px;">$1</h2>')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li>[\s\S]*?<\/li>)(\n<li>)/g, '$1$2')
    .replace(/(<li>.*<\/li>)/g, '<ul style="margin-left:20px;">$1</ul>')
    // Fix nested uls
    .replace(/<\/ul>\n<ul[^>]*>/g, '')
    // Line breaks
    .replace(/\n/g, '<br>');
}
