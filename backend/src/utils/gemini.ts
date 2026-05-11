/**
 * Vertex AI Client for Google Cloud
 * This implementation uses your Google Cloud Promotional Credits.
 * It automatically authenticates via Cloud Run's Service Account.
 */

import { VertexAI, GenerativeModel } from '@google-cloud/vertexai';

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'oneclaw-486705';
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-1.5-flash-001';

// Initialize Vertex AI
const vertexAI = new VertexAI({ project: PROJECT_ID, location: LOCATION });

export interface GeminiResponse {
  text: string;
  json: <T>() => T | null;
}

export async function callGemini(prompt: string, retries = 3): Promise<GeminiResponse> {
  const generativeModel = vertexAI.getGenerativeModel({
    model: MODEL_NAME,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    },
  });

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const request = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      };

      const streamingResp = await generativeModel.generateContent(request);
      const response = await streamingResp.response;
      
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';

      return {
        text,
        json: <T>() => {
          try {
            const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            return JSON.parse(clean) as T;
          } catch {
            return null;
          }
        },
      };
    } catch (e: any) {
      if (attempt === retries) {
        console.error('[VertexAI] All retries exhausted:', e.message);
        return { text: '', json: () => null };
      }
      const backoff = Math.pow(2, attempt + 1) * 1000;
      console.warn(`[VertexAI] Error, retrying in ${backoff / 1000}s:`, e.message);
      await new Promise(r => setTimeout(r, backoff));
    }
  }

  return { text: '', json: () => null };
}

export function geminiAvailable(): boolean {
  // On Google Cloud, we assume Vertex AI is available via the Service Account
  return true;
}
