/**
 * Gemini AI Client with rate limiting and exponential backoff.
 * Paid keys still have RPM (requests-per-minute) caps.
 * We queue requests and retry with backoff to stay within limits.
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

// Queue for rate limiting
let _lastCallTime = 0;
const MIN_CALL_INTERVAL_MS = 2000; // max 30 RPM to be safe

async function throttle(): Promise<void> {
  const now = Date.now();
  const wait = MIN_CALL_INTERVAL_MS - (now - _lastCallTime);
  if (wait > 0) await new Promise(r => setTimeout(r, wait));
  _lastCallTime = Date.now();
}

export interface GeminiResponse {
  text: string;
  json: <T>() => T | null;
}

export async function callGemini(prompt: string, retries = 5): Promise<GeminiResponse> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured');

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle();

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 512,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (res.status === 429) {
        // Rate limited — exponential backoff: 2s, 4s, 8s
        const backoff = Math.pow(2, attempt + 1) * 1000;
        console.warn(`[Gemini] Rate limited (429), retrying in ${backoff / 1000}s... (attempt ${attempt + 1}/${retries})`);
        await new Promise(r => setTimeout(r, backoff));
        continue;
      }

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini API error ${res.status}: ${err.slice(0, 200)}`);
      }

      const data = await res.json() as any;
      const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

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
    } catch (e) {
      if (attempt === retries) {
        console.error('[Gemini] All retries exhausted. Returning fallback empty response.');
        return { text: '', json: () => null };
      }
      const backoff = Math.pow(2, attempt + 1) * 1000;
      console.warn(`[Gemini] Error, retrying in ${backoff / 1000}s:`, (e as Error).message);
      await new Promise(r => setTimeout(r, backoff));
    }
  }

  return { text: '', json: () => null };
}

export function geminiAvailable(): boolean {
  return Boolean(GEMINI_API_KEY);
}
