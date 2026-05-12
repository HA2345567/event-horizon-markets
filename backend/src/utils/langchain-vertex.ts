import { ChatVertexAI } from "@langchain/google-vertexai";
import 'dotenv/config';

// Config handled by import

/**
 * LangChain ChatVertexAI instance
 * Using explicit location to avoid 404 errors with new models.
 */
export const model = new ChatVertexAI({
  model: "gemini-1.5-flash", // Fallback to 1.5 to verify connection first
  location: "us-central1",
  authOptions: {
    apiKey: process.env.GEMINI_API_KEY,
  },
  // Express Mode specific configuration
  apiVersion: "v1",
  maxOutputTokens: 2048,
  temperature: 0.7,
});

/**
 * Structured Output Parser Helper
 */
export async function generateStructuredResponse<T>(prompt: string, schema: any): Promise<T> {
  const structuredModel = model.withStructuredOutput(schema);
  const response = await structuredModel.invoke(prompt);
  return response as T;
}
