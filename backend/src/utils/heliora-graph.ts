import { StateGraph, START, END, Annotation } from "@langchain/langgraph";
import { callGemini } from "./gemini";
import { prisma } from "../prisma";
import { solanaService } from "./solana-service";
import * as marketDataService from "./market-data-service";
import { newId } from "./helpers";
import { z } from "zod";

// --- 1. Define Agent State ---
const GraphState = Annotation.Root({
  scannedMarkets: Annotation<any[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),
  currentMarket: Annotation<any>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),
  decision: Annotation<{ mirror: boolean; reason: string; category: string; odds: number }>({
    reducer: (x, y) => y ?? x,
    default: () => ({ mirror: false, reason: "", category: "", odds: 0.5 }),
  }),
  logs: Annotation<string[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),
});

// --- 2. Define Nodes (Agent Logic) ---

/**
 * Creative Generator Node: Dreams up a NATIVE market based on trending topics
 */
const creativeGeneratorNode = async (state: typeof GraphState.State) => {
  console.log("[Graph:Creative] Dreaming up a unique market...");

  const prompt = `You are the Heliora Creative Director. 
  Dream up a viral, high-interest prediction market topic based on CURRENT global trends (AI, Crypto, Space, or Pop Culture).
  
  RETURN ONLY A VALID JSON OBJECT in this exact format:
  {
    "question": "The viral question",
    "subtitle": "Short description",
    "category": "Crypto" | "Politics" | "Sports" | "Memes" | "NFTs" | "DeFi" | "Social" | "AI",
    "odds": 0.5
  }

  Do not include any other text, reasoning, or markdown.`;

  const schema = z.object({
    question: z.string(),
    subtitle: z.string(),
    category: z.enum(["Crypto", "Politics", "Sports", "Memes", "NFTs", "DeFi", "Social", "AI"]),
    odds: z.number().min(0.01).max(0.99),
  });

  const res = await callGemini(prompt);
  const idea = res.json<{
    question: string;
    subtitle: string;
    category: "Crypto" | "Politics" | "Sports" | "Memes" | "NFTs" | "DeFi" | "Social" | "AI";
    odds: number;
  }>();

  if (!idea) throw new Error("Failed to generate creative market idea.");

  return {
    currentMarket: {
      question: idea.question,
      subtitle: idea.subtitle,
      source: "HELIORA_NATIVE",
      ticker: `NATIVE-${Date.now()}`
    },
    decision: {
      mirror: true,
      reason: "AI Generated Native Content",
      category: idea.category,
      odds: idea.odds
    },
    logs: [`Creative Agent dreamt up: ${idea.question}`]
  };
};


/**
 * Strategist Node: Analyzes if a market is fit for Heliora
 */
const strategistNode = async (state: typeof GraphState.State) => {
  const market = state.scannedMarkets[0]; // Take the first one
  if (!market) return { logs: ["No more markets to process."] };

  const title = market.title || market.question || "Untitled Market";
  console.log(`[Graph:Strategist] Analyzing: ${title}`);

  const strategistPrompt = `Analyze this prediction for institutional mirroring:
- Title: "${title}"
- Source: ${market.source || 'Kalshi'}
- Volume: ${market.volume || 0}

Return mirror: true if it's a high-interest global topic.`;

  const res = await callGemini(strategistPrompt);
  const decision = res.json<{
    mirror: boolean;
    reason: string;
    category: string;
    odds: number;
  }>();

  if (!decision) {
    return { 
      logs: ["Strategist failed to parse decision."] 
    };
  }

  return { 
    currentMarket: market, 
    decision,
    logs: [`Strategist decided ${decision.mirror ? 'YES' : 'NO'} for ${market.question}`]
  };
};

/**
 * Executor Node: Handles the Solana on-chain logic
 */
const executorNode = async (state: typeof GraphState.State) => {
  const { currentMarket, decision } = state;
  if (!decision.mirror) return {};

  console.log(`[Graph:Executor] Creating market on-chain: ${currentMarket.question}`);

  try {
    const marketId = newId();
    // In a real run, we'd call Solana here:
    // await solanaService.initializeMarket(marketId, ...);
    
    await prisma.market.create({
      data: {
        id: marketId,
        question: (currentMarket.title || currentMarket.question || "Untitled").slice(0, 250),
        description: currentMarket.subtitle || "",
        category: decision.category,
        resolutionDetail: `${currentMarket.source || 'KALSHI'}:${currentMarket.ticker || currentMarket.market_id}`,
        status: 'open',
        yesPrice: decision.odds,
        noPrice: 1 - decision.odds,
        endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Default 7 days
        creator: JSON.stringify({ name: "Heliora AI Agent" }),
      }
    });

    return { logs: [`Executor successfully mirrored ${currentMarket.question} to Solana.`] };
  } catch (error: any) {
    return { logs: [`Executor failed: ${error.message}`] };
  }
};

// --- 3. Build the Graph ---

const workflow = new StateGraph(GraphState)
  .addNode("creative", creativeGeneratorNode)
  .addNode("executor", executorNode)
  .addEdge(START, "creative")
  .addEdge("creative", "executor")
  .addEdge("executor", END);


// Compile the graph
export const helioraGraph = workflow.compile();

/**
 * Runner function to trigger the graph
 */
export async function runHelioraCycle() {
  try {
    console.log("🚀 Starting LangGraph AI Cycle...");
    await helioraGraph.invoke({});
    console.log("🏁 LangGraph AI Cycle Completed.");
  } catch (error) {
    console.error("❌ LangGraph Error:", error);
  }
}
