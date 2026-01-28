/**
 * Gemini Service Stub
 * This file provides type-safe stubs for the legacy Vite-based components.
 * The actual functionality has been migrated to the ai-provider service.
 */

export async function generateFeedback(prompt: string): Promise<string> {
  console.warn('generateFeedback is deprecated - use ai-provider service instead');
  return '';
}
