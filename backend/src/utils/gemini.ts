import { GoogleGenAI } from '@google/genai';
import 'dotenv/config';

// Config handled by import

const API_KEY = process.env.GEMINI_API_KEY || '';
const MODEL_NAME = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

const client = new GoogleGenAI({
  vertexai: true,
  apiKey: API_KEY,
});

export async function generateContent(prompt: string): Promise<string> {
  try {
    const result = await client.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    return result.text || '';
  } catch (error) {
    console.error('[Gemini] Error generating content:', error);
    throw error;
  }
}

export async function generateJSON<T>(prompt: string): Promise<T> {
  try {
    const result = await client.models.generateContent({
      model: MODEL_NAME,
      contents: [{ role: 'user', parts: [{ text: `${prompt}\n\nReturn ONLY a valid JSON object.` }] }],
      config: {
        responseMimeType: 'application/json',
      }
    });

    const text = result.text || '{}';
    return JSON.parse(text) as T;
  } catch (error) {
    console.error('[Gemini] Error generating JSON:', error);
    throw error;
  }
}

// Compatibility layer for legacy code expecting .json() method
export async function callGemini(prompt: string) {
  const textContent = await generateContent(prompt);
  return {
    text: textContent, // String property for .trim()
    textMethod: () => textContent, // Just in case
    json: <T>() => {
      try {
        // Find the first { and last } to extract JSON from potential conversational text
        const start = textContent.indexOf('{');
        const end = textContent.lastIndexOf('}');
        if (start === -1 || end === -1) throw new Error('No JSON found in response');
        
        const rawJson = textContent.substring(start, end + 1);
        return JSON.parse(rawJson) as T;
      } catch (e) {
        console.error('[Gemini] Failed to parse JSON from text:', textContent);
        return null;
      }
    }
  };
}


export const geminiAvailable = () => !!API_KEY;
