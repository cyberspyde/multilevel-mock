/**
 * Summarizer Service Stub
 * This file provides type-safe stubs for the legacy Vite-based components.
 */

export async function summarizeText(text: string): Promise<string> {
  console.warn('summarizeText is deprecated');
  return text;
}

export async function analyzeTextComplexity(text: string): Promise<{ score: number; level: string }> {
  console.warn('analyzeTextComplexity is deprecated');
  return { score: 0, level: 'unknown' };
}
