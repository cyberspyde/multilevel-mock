/**
 * Test script for all AI providers
 * Run with: npx tsx scripts/test-all-ai-providers.ts
 *
 * This script tests all configured AI providers and reports their status.
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { testAllProviders, generateContent, getAvailableProviders, type AIProvider } from '../services/ai-provider';

const ANSI = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: string = ANSI.reset) {
  console.log(`${color}${message}${ANSI.reset}`);
}

function separator() {
  log('━'.repeat(60), ANSI.cyan);
}

async function testProvider(provider: AIProvider) {
  const startTime = Date.now();

  try {
    const result = await generateContent(
      `You are a test assistant. Reply with exactly: "Provider ${provider} is working!"`,
      provider
    );

    const duration = Date.now() - startTime;
    log(`✅ ${provider.toUpperCase()}`, ANSI.green);
    log(`   Model: ${result.model}`);
    log(`   Response: ${result.content.slice(0, 100)}${result.content.length > 100 ? '...' : ''}`);
    log(`   Time: ${duration}ms`);
    log('');

    return { success: true, provider, duration, model: result.model };
  } catch (error: any) {
    const duration = Date.now() - startTime;
    log(`❌ ${provider.toUpperCase()}`, ANSI.red);
    log(`   Error: ${error.message?.slice(0, 100)}${error.message?.length > 100 ? '...' : error.message}`);
    log(`   Time: ${duration}ms`);
    log('');

    return { success: false, provider, duration, error: error.message };
  }
}

async function main() {
  log('\n' + '═'.repeat(60), ANSI.cyan);
  log('  AI Provider Test Suite'.padStart(40), ANSI.bright + ANSI.cyan);
  log('═'.repeat(60) + '\n', ANSI.cyan);

  // Check available providers
  const available = getAvailableProviders();

  if (available.length === 0) {
    log('❌ No AI providers configured!', ANSI.red);
    log('');
    log('Please add API keys to your .env.local file:', ANSI.yellow);
    log('  - GROK_API_KEY (recommended)', ANSI.yellow);
    log('  - GEMINI_API_KEY', ANSI.yellow);
    log('  - OPENAI_API_KEY', ANSI.yellow);
    log('  - ANTHROPIC_API_KEY', ANSI.yellow);
    log('');
    process.exit(1);
  }

  log(`Found ${available.length} configured provider(s): ${available.join(', ')}`, ANSI.bright);
  log('');

  // Run quick connectivity test
  separator();
  log('Quick Connectivity Test', ANSI.bright);
  separator();
  log('');

  const quickResults = await testAllProviders();

  for (const [provider, result] of Object.entries(quickResults)) {
    if (result.success) {
      log(`✅ ${provider.toUpperCase()}: Connected`, ANSI.green);
    } else {
      log(`❌ ${provider.toUpperCase()}: ${result.error || 'Not configured'}`, ANSI.red);
    }
  }

  log('');

  // Run detailed test on available providers
  separator();
  log('Detailed Test (generating content)', ANSI.bright);
  separator();
  log('');

  const results: any[] = [];

  for (const provider of available) {
    results.push(await testProvider(provider));
  }

  // Summary
  separator();
  log('Summary', ANSI.bright);
  separator();
  log('');

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  log(`Total tests: ${results.length}`, ANSI.bright);
  log(`Successful: ${successful.length}`, ANSI.green);
  log(`Failed: ${failed.length}`, failed.length > 0 ? ANSI.red : ANSI.green);
  log('');

  if (successful.length > 0) {
    log('Working providers:', ANSI.green);
    successful.forEach(r => {
      log(`  • ${r.provider.toUpperCase()} (${r.model}) - ${r.duration}ms`, ANSI.green);
    });
    log('');
  }

  if (failed.length > 0) {
    log('Failed providers:', ANSI.red);
    failed.forEach(r => {
      log(`  • ${r.provider.toUpperCase()} - ${r.error}`, ANSI.red);
    });
    log('');
  }

  // Speed comparison
  if (successful.length > 1) {
    separator();
    log('Speed Comparison', ANSI.bright);
    separator();
    log('');

    const sorted = [...successful].sort((a, b) => a.duration - b.duration);
    sorted.forEach((r, i) => {
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
      log(`${medal} ${r.provider.toUpperCase()}: ${r.duration}ms`, ANSI.bright);
    });
    log('');
  }

  // Recommendations
  separator();
  log('Recommendations', ANSI.bright);
  separator();
  log('');

  if (successful.length > 0) {
    const fastest = successful.sort((a, b) => a.duration - b.duration)[0];
    log(`✅ For best performance, use: ${fastest.provider.toUpperCase()}`, ANSI.green);
    log(`   Set in .env.local: AI_PROVIDER_PREFERRED="${fastest.provider}"`, ANSI.cyan);
    log('');
  }

  if (available.includes('grok') && !successful.find(r => r.provider === 'grok')) {
    log('💡 Grok (xAI) has a free tier with generous limits:', ANSI.yellow);
    log('   Get your API key at: https://console.x.ai/', ANSI.cyan);
    log('');
  }

  if (available.includes('gemini') && !successful.find(r => r.provider === 'gemini')) {
    log('💡 Gemini has a free tier but may have quota limits:', ANSI.yellow);
    log('   Check your quota at: https://ai.google.dev/', ANSI.cyan);
    log('');
  }

  log('═'.repeat(60) + '\n', ANSI.cyan);
}

main().catch(error => {
  log('Fatal error:', ANSI.red);
  console.error(error);
  process.exit(1);
});
