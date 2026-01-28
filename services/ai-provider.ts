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
