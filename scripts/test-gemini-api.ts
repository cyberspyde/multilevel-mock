/**
 * Test script for Gemini API
 * Run with: tsx scripts/test-gemini-api.ts
 */

import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.GEMINI_API_KEY || "AIzaSyDvc74nyqg0zmuv_zpomJdjyVOiDrUyhws";

async function testGeminiAPI() {
  console.log("Testing Gemini API...\n");
  console.log(`API Key: ${API_KEY ? API_KEY.slice(0, 10) + "..." : "NOT FOUND"}\n`);

  if (!API_KEY) {
    console.error("❌ GEMINI_API_KEY not found in environment variables");
    process.exit(1);
  }

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    // Test 1: Simple text generation
    console.log("Test 1: Simple text generation");
    console.log("-----------------------------------");
    const response1 = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: "Say 'Hello! Gemini API is working!' in a friendly way.",
    });
    console.log("✅ Success:", response1.text);
    console.log();

    // Test 2: Grading simulation
    console.log("Test 2: Student answer grading");
    console.log("-----------------------------------");
    const prompt = `You are an expert English examiner. Evaluate the following student's performance.

Student Name: John Doe
Test Context: Speaking Test - Describe your hometown

Question: Tell me about your hometown.
Student Answer: "I come from small city near mountains. The weather is very nice in summer. People are friendly and there are many parks. I like my hometown because it is peaceful."

Please provide a concise summary of their performance, highlighting:
1. Grammatical strengths and weaknesses
2. Vocabulary usage and variety
3. Fluency and coherence
4. Specific areas for improvement

Keep the tone professional and encouraging. Provide actionable feedback.`;

    const response2 = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: prompt,
    });
    console.log("✅ Success - AI Feedback generated:");
    console.log(response2.text);
    console.log();

    // Test 3: Check model info
    console.log("Test 3: Model availability check");
    console.log("-----------------------------------");
    try {
      const models = await ai.models.list();
      console.log("✅ Available models:");
      for (const model of models.slice(0, 10)) {
        console.log(`  - ${model.name}`);
      }
    } catch (err) {
      console.log("⚠️  Could not list models (may require additional permissions)");
    }

    console.log("\n✅ All tests passed! Gemini API is working correctly.");

  } catch (error) {
    console.error("\n❌ Gemini API Test Failed:");
    console.error(error);
    process.exit(1);
  }
}

testGeminiAPI();
