/**
 * AI Grading Service
 * Supports OpenRouter API for cloud-based grading
 * Supports local models via API (for GTX 5050 - e.g., Ollama, LM Studio)
 */

// Provider types
export type AIProvider = 'openrouter' | 'local';

// Provider configuration
export interface AIProviderConfig {
  name: AIProvider;
  apiKey: string;
  model: string;
  baseURL?: string;
  fallbackModels?: string[];
}

// OpenRouter free models (tried in order)
export const OPENROUTER_FREE_MODELS = [
  'liquid/lfm-2.5-1.2b-thinking:free',
  'xiaomi/mimo-v2-flash:free',
  'arcee-ai/trinity-mini:free',
  'allenai/molmo-2-8b:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'tngtech/tng-r1t-chimera:free',
];

// OpenRouter paid models (optional, better quality)
export const OPENROUTER_PAID_MODELS = [
  'anthropic/claude-3.5-sonnet',
  'openai/gpt-4o-mini',
  'google/gemini-2.0-flash-exp',
];

// Local model options (for Ollama, LM Studio, etc.)
export const LOCAL_MODELS = [
  'google/gemma-3-4b',
  'llama3.2:3b',
  'llama3.2:1b',
  'phi3.5:3.8b',
  'qwen2.5:3b',
  'gemma2:2b',
  'tinyllama:1.1b',
];

// Provider model configurations
export const PROVIDER_MODELS: Record<AIProvider, { default: string; options: string[] }> = {
  openrouter: {
    default: OPENROUTER_FREE_MODELS[0],
    options: [...OPENROUTER_FREE_MODELS, ...OPENROUTER_PAID_MODELS],
  },
  local: {
    default: 'google/gemma-3-4b',
    options: LOCAL_MODELS,
  },
};

/**
 * Get provider configuration from environment variables or database config
 */
function getProviderConfig(
  provider: AIProvider,
  dbConfig?: Record<string, string>
): AIProviderConfig | null {
  const apiKeyEnvVars: Record<AIProvider, string> = {
    openrouter: 'OPENROUTER_API_KEY',
    local: 'LOCAL_API_KEY', // Optional for local
  };

  const modelConfigKeys: Record<AIProvider, string> = {
    openrouter: 'openrouter_model',
    local: 'local_model',
  };

  const apiKeyConfigKeys: Record<AIProvider, string> = {
    openrouter: 'openrouter_api_key',
    local: 'local_api_key',
  };

  // Try to get API key from database config first, then environment variables
  let apiKey = dbConfig?.[apiKeyConfigKeys[provider]] || process.env[apiKeyEnvVars[provider]];

  // Local provider doesn't strictly require an API key
  if (provider === 'local' && !apiKey) {
    apiKey = ''; // Empty string for local
  }

  if (!apiKey && provider !== 'local') {
    return null;
  }

  // Get model from database config or environment variable or default
  const modelEnvVar = provider === 'local' ? 'LOCAL_MODEL' : 'OPENROUTER_MODEL';
  const model = dbConfig?.[modelConfigKeys[provider]] || process.env[modelEnvVar] || PROVIDER_MODELS[provider].default;

  const baseURLs: Partial<Record<AIProvider, string>> = {
    openrouter: 'https://openrouter.ai/api/v1',
    local: process.env.LOCAL_API_URL || 'http://localhost:11434/v1', // Default to Ollama
  };

  return {
    name: provider,
    apiKey: apiKey || '',
    model,
    baseURL: baseURLs[provider],
    fallbackModels: provider === 'openrouter' ? OPENROUTER_FREE_MODELS : undefined,
  };
}

/**
 * Get all available providers (those with API keys configured)
 */
export function getAvailableProviders(dbConfig?: Record<string, string>): AIProvider[] {
  const providers: AIProvider[] = [];

  // Check OpenRouter
  if (getProviderConfig('openrouter', dbConfig)) {
    providers.push('openrouter');
  }

  // Local is always available (runs on user's machine)
  providers.push('local');

  return providers;
}

/**
 * Get the default provider or preferred provider
 */
export function getDefaultProvider(
  preferred?: AIProvider,
  dbConfig?: Record<string, string>
): AIProvider | null {
  const available = getAvailableProviders(dbConfig);
  if (available.length === 0) return null;

  // Check environment variable for preferred provider
  const envPreferred = process.env.AI_PROVIDER_PREFERRED as AIProvider;
  const providerToTry = preferred || envPreferred;

  if (providerToTry && available.includes(providerToTry)) {
    return providerToTry;
  }

  return available[0];
}

/**
 * Generate content using OpenRouter with model fallback
 */
async function generateWithOpenRouter(prompt: string, config: AIProviderConfig): Promise<string> {
  const modelsToTry = config.fallbackModels || [config.model];

  for (const model of modelsToTry) {
    try {
      console.log(`[OpenRouter] Trying model: ${model}`);

      const response = await fetch(`${config.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
          'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:9586',
          'X-Title': 'BestCenter Mock Exam',
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.warn(`[OpenRouter] Model ${model} failed: ${response.status} - ${error}`);
        continue;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (content) {
        console.log(`[OpenRouter] ✅ Model ${model} succeeded`);
        return content;
      }

      console.warn(`[OpenRouter] Model ${model} returned no content`);
      continue;
    } catch (error: any) {
      console.warn(`[OpenRouter] Model ${model} error:`, error.message);
      continue;
    }
  }

  throw new Error(`[OpenRouter] All models failed. Tried: ${modelsToTry.join(', ')}`);
}

/**
 * Generate content using Local API (Ollama, LM Studio, etc.)
 * Compatible with OpenAI API format
 */
async function generateWithLocal(prompt: string, config: AIProviderConfig): Promise<string> {
  try {
    console.log(`[Local AI] Using model: ${config.model} at ${config.baseURL}`);

    const response = await fetch(`${config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Local API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (content) {
      console.log(`[Local AI] ✅ Response received`);
      return content;
    }

    throw new Error('Local API returned no content');
  } catch (error: any) {
    console.error('[Local AI] Error:', error);
    throw new Error(`Local AI failed: ${error.message}. Make sure your local API server is running at ${config.baseURL}`);
  }
}

/**
 * Generate content using specified provider
 */
export async function generateContent(
  prompt: string,
  provider?: AIProvider,
  dbConfig?: Record<string, string>
): Promise<{ content: string; provider: AIProvider; model: string }> {
  const selectedProvider = provider || getDefaultProvider(undefined, dbConfig);

  if (!selectedProvider) {
    throw new Error('No AI provider available. Please configure OpenRouter API key or ensure local AI server is running.');
  }

  const config = getProviderConfig(selectedProvider, dbConfig);
  if (!config) {
    throw new Error(`Provider ${selectedProvider} is not configured.`);
  }

  try {
    let content: string;

    switch (selectedProvider) {
      case 'openrouter':
        content = await generateWithOpenRouter(prompt, config);
        break;
      case 'local':
        content = await generateWithLocal(prompt, config);
        break;
      default:
        throw new Error(`Unsupported provider: ${selectedProvider}`);
    }

    return {
      content,
      provider: selectedProvider,
      model: config.model,
    };
  } catch (error) {
    console.error(`Error generating content with ${selectedProvider}:`, error);
    throw error;
  }
}

/**
 * Generate content with automatic fallback to other providers
 */
export async function generateContentWithFallback(
  prompt: string,
  preferredProvider?: AIProvider,
  dbConfig?: Record<string, string>
): Promise<{ content: string; provider: AIProvider; model: string }> {
  const available = getAvailableProviders(dbConfig);

  if (available.length === 0) {
    throw new Error('No AI providers available. Configure OpenRouter API key or ensure local AI server is running.');
  }

  // Try preferred provider first
  if (preferredProvider && available.includes(preferredProvider)) {
    try {
      return await generateContent(prompt, preferredProvider, dbConfig);
    } catch (error) {
      console.warn(`[AI] Preferred provider ${preferredProvider} failed, trying fallback...`);
    }
  }

  // Try all other providers
  for (const provider of available) {
    if (provider === preferredProvider) continue;

    try {
      return await generateContent(prompt, provider, dbConfig);
    } catch (error) {
      console.warn(`[AI] Provider ${provider} failed, trying next...`);
      continue;
    }
  }

  throw new Error('All AI providers failed. Check your API keys, quotas, or local server connection.');
}

/**
 * Test a provider's connection
 */
export async function testProvider(
  provider: AIProvider
): Promise<{ success: boolean; error?: string }> {
  try {
    await generateContent('Respond with "OK" if you can read this.', provider);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Test all available providers
 */
export async function testAllProviders(): Promise<
  Record<AIProvider, { success: boolean; error?: string }>
> {
  const results: Record<string, { success: boolean; error?: string }> = {};

  for (const provider of Object.keys(PROVIDER_MODELS) as AIProvider[]) {
    results[provider] = await testProvider(provider);
  }

  return results as Record<AIProvider, { success: boolean; error?: string }>;
}

// ============================================
// CHUNKED GRADING SUPPORT FOR SMALL CONTEXT WINDOWS
// ============================================

/**
 * Estimate token count (rough approximation: ~4 chars per token for English)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Configuration for chunked grading
 */
export interface ChunkedGradingConfig {
  maxContextTokens: number; // Max tokens for the model (e.g., 4096, 8192)
  reservedTokens: number;   // Tokens reserved for system prompt and output
  provider: AIProvider;
  dbConfig?: Record<string, string>;
}

/**
 * Result from grading a chunk
 */
export interface ChunkGradeResult {
  chunkIndex: number;
  questionIndices: number[];
  summary: string;
  feedback: string;
  rawResponse: string;
}

/**
 * Aggregated result from chunked grading
 */
export interface AggregatedGradeResult {
  summary: string;
  feedback: string;
  chunksUsed: number;
  provider: AIProvider;
  model: string;
}

/**
 * Split answers into chunks that fit within context limits
 */
export function chunkAnswers<T extends { text: string }>(
  answers: T[],
  systemPromptTokens: number,
  maxContextTokens: number,
  reservedOutputTokens: number = 1500
): T[][] {
  const availableTokens = maxContextTokens - systemPromptTokens - reservedOutputTokens;
  const chunks: T[][] = [];
  let currentChunk: T[] = [];
  let currentTokens = 0;

  for (const answer of answers) {
    const answerTokens = estimateTokens(answer.text);
    
    // If single answer is too large, it still goes in its own chunk
    if (answerTokens > availableTokens) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentTokens = 0;
      }
      chunks.push([answer]);
      continue;
    }

    // Check if adding this answer would exceed limit
    if (currentTokens + answerTokens > availableTokens) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }
      currentChunk = [answer];
      currentTokens = answerTokens;
    } else {
      currentChunk.push(answer);
      currentTokens += answerTokens;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Build a mini grading prompt for a chunk of answers
 */
export function buildChunkGradingPrompt(
  studentName: string,
  examTitle: string,
  examType: 'SPEAKING' | 'WRITING',
  chunkIndex: number,
  totalChunks: number,
  answers: Array<{ questionIndex: number; question: string; answer: string; wordCount?: number; duration?: number }>
): string {
  const isSpeaking = examType === 'SPEAKING';
  
  let prompt = `You are grading PART ${chunkIndex + 1} of ${totalChunks} for student "${studentName}" in the ${examType.toLowerCase()} exam "${examTitle}".

${isSpeaking ? 'SPEAKING' : 'WRITING'} RESPONSES (Part ${chunkIndex + 1}/${totalChunks}):

`;

  for (const ans of answers) {
    prompt += `Question ${ans.questionIndex + 1}: ${ans.question}\n`;
    prompt += `Response: "${ans.answer}"\n`;
    if (ans.wordCount) prompt += `Word Count: ${ans.wordCount} words\n`;
    if (ans.duration) prompt += `Duration: ${ans.duration} seconds\n`;
    prompt += '\n';
  }

  prompt += `
EVALUATE these ${answers.length} response(s) using these criteria:
${isSpeaking ? `
1. Task Achievement & Relevance (Did they answer the question?)
2. Fluency & Coherence (Natural speech flow?)
3. Pronunciation & Intelligibility (Clear enough to understand?)
4. Vocabulary & Expression (Good word choices?)
5. Grammar (Acceptable accuracy?)
` : `
1. Task Achievement & Relevance (Did they address the prompt?)
2. Content Quality & Development (Well-developed ideas?)
3. Coherence & Organization (Logical structure?)
4. Language Use & Vocabulary (Good word choices?)
5. Grammar & Accuracy (Acceptable accuracy?)
`}

REQUIRED OUTPUT FORMAT:
CHUNK_SUMMARY:
[2-3 sentences summarizing performance on these ${answers.length} question(s)]

CHUNK_FEEDBACK:
[Specific strengths and weaknesses for each question in this chunk]
`;

  return prompt;
}

/**
 * Build a final aggregation prompt to combine chunk results
 */
export function buildAggregationPrompt(
  studentName: string,
  examTitle: string,
  examType: 'SPEAKING' | 'WRITING',
  chunkResults: ChunkGradeResult[]
): string {
  let prompt = `You are combining grading results for student "${studentName}" from the ${examType.toLowerCase()} exam "${examTitle}".

The exam was graded in ${chunkResults.length} parts due to length. Here are the results from each part:

`;

  for (const chunk of chunkResults) {
    prompt += `=== PART ${chunk.chunkIndex + 1} (Questions ${chunk.questionIndices.map(i => i + 1).join(', ')}) ===
Summary: ${chunk.summary}
Feedback: ${chunk.feedback}

`;
  }

  prompt += `
Now provide a UNIFIED final evaluation that combines all parts:

OVERALL_PERFORMANCE:
[2-3 sentences summarizing the student's OVERALL performance across ALL questions]

STRENGTHS:
- [List 2-4 key strengths observed across all responses]

AREAS_FOR_IMPROVEMENT:
- [List 2-5 key areas for improvement across all responses]

ACTIONABLE_RECOMMENDATIONS:
- [3-5 specific, actionable steps to improve]

Be concise but comprehensive. Consider patterns across all responses.`;

  return prompt;
}

/**
 * Parse chunk grading response
 */
export function parseChunkResponse(response: string): { summary: string; feedback: string } {
  const summaryMatch = response.match(/CHUNK_SUMMARY:\s*([\s\S]*?)(?=\nCHUNK_FEEDBACK:|$)/i);
  const feedbackMatch = response.match(/CHUNK_FEEDBACK:\s*([\s\S]*?)$/i);

  return {
    summary: summaryMatch?.[1]?.trim() || 'Unable to parse chunk summary.',
    feedback: feedbackMatch?.[1]?.trim() || 'Unable to parse chunk feedback.',
  };
}

/**
 * Grade content in chunks when context is too large
 */
export async function gradeInChunks(
  studentName: string,
  examTitle: string,
  examType: 'SPEAKING' | 'WRITING',
  answers: Array<{ question: string; answer: string; wordCount?: number; duration?: number }>,
  config: ChunkedGradingConfig
): Promise<AggregatedGradeResult> {
  // Prepare answers with text for chunking
  const answersWithText = answers.map((a, i) => ({
    ...a,
    questionIndex: i,
    text: `Q: ${a.question}\nA: ${a.answer}`,
  }));

  // Estimate system prompt size (base prompt is ~500 tokens)
  const systemPromptTokens = 500;
  
  // Check if we need chunking
  const totalTokens = answersWithText.reduce((sum, a) => sum + estimateTokens(a.text), 0);
  const availableTokens = config.maxContextTokens - config.reservedTokens;

  console.log(`[Chunked Grading] Total content: ~${totalTokens} tokens, Available: ~${availableTokens} tokens`);

  // If it fits, no chunking needed
  if (totalTokens + systemPromptTokens < availableTokens) {
    console.log('[Chunked Grading] Content fits in single request, no chunking needed');
    throw new Error('CHUNKING_NOT_NEEDED');
  }

  // Chunk the answers
  const chunks = chunkAnswers(answersWithText, systemPromptTokens, config.maxContextTokens, config.reservedTokens);
  console.log(`[Chunked Grading] Split into ${chunks.length} chunks`);

  // Grade each chunk
  const chunkResults: ChunkGradeResult[] = [];
  let usedModel = '';

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const prompt = buildChunkGradingPrompt(
      studentName,
      examTitle,
      examType,
      i,
      chunks.length,
      chunk.map(a => ({
        questionIndex: a.questionIndex,
        question: a.question,
        answer: a.answer,
        wordCount: a.wordCount,
        duration: a.duration,
      }))
    );

    console.log(`[Chunked Grading] Grading chunk ${i + 1}/${chunks.length} (${chunk.length} questions)`);

    try {
      const result = await generateContentWithFallback(prompt, config.provider, config.dbConfig);
      usedModel = result.model;
      
      const parsed = parseChunkResponse(result.content);
      chunkResults.push({
        chunkIndex: i,
        questionIndices: chunk.map(a => a.questionIndex),
        summary: parsed.summary,
        feedback: parsed.feedback,
        rawResponse: result.content,
      });
    } catch (error) {
      console.error(`[Chunked Grading] Chunk ${i + 1} failed:`, error);
      chunkResults.push({
        chunkIndex: i,
        questionIndices: chunk.map(a => a.questionIndex),
        summary: `Failed to grade questions ${chunk.map(a => a.questionIndex + 1).join(', ')}.`,
        feedback: 'Grading service encountered an error for this section.',
        rawResponse: '',
      });
    }

    // Small delay between chunks to avoid rate limiting
    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  // Aggregate results
  console.log('[Chunked Grading] Aggregating chunk results...');
  
  const aggregationPrompt = buildAggregationPrompt(studentName, examTitle, examType, chunkResults);
  
  try {
    const aggregationResult = await generateContentWithFallback(aggregationPrompt, config.provider, config.dbConfig);
    usedModel = aggregationResult.model;

    // Parse aggregated response
    const overallMatch = aggregationResult.content.match(/OVERALL_PERFORMANCE:\s*([\s\S]*?)(?=\nSTRENGTHS:|$)/i);
    const strengthsMatch = aggregationResult.content.match(/STRENGTHS:\s*([\s\S]*?)(?=\nAREAS_FOR_IMPROVEMENT:|$)/i);
    const areasMatch = aggregationResult.content.match(/AREAS_FOR_IMPROVEMENT:\s*([\s\S]*?)(?=\nACTIONABLE_RECOMMENDATIONS:|$)/i);
    const recommendationsMatch = aggregationResult.content.match(/ACTIONABLE_RECOMMENDATIONS:\s*([\s\S]*?)$/i);

    const summary = overallMatch?.[1]?.trim() || chunkResults.map(c => c.summary).join(' ');
    
    let feedback = '';
    if (strengthsMatch) feedback += `Strengths:\n${strengthsMatch[1].trim()}\n\n`;
    if (areasMatch) feedback += `Areas for Improvement:\n${areasMatch[1].trim()}\n\n`;
    if (recommendationsMatch) feedback += `Recommendations:\n${recommendationsMatch[1].trim()}`;
    
    if (!feedback) {
      feedback = chunkResults.map((c, i) => `Part ${i + 1}:\n${c.feedback}`).join('\n\n');
    }

    return {
      summary,
      feedback: feedback.trim(),
      chunksUsed: chunks.length,
      provider: config.provider,
      model: usedModel,
    };
  } catch (error) {
    console.error('[Chunked Grading] Aggregation failed:', error);
    
    // Return concatenated results as fallback
    return {
      summary: chunkResults.map(c => c.summary).join(' '),
      feedback: chunkResults.map((c, i) => `Part ${i + 1}:\n${c.feedback}`).join('\n\n'),
      chunksUsed: chunks.length,
      provider: config.provider,
      model: usedModel || 'unknown',
    };
  }
}
