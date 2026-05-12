/**
 * Three-Agent Architecture for Heliora Protocol
 * 
 * ┌─────────────────────────────────────────────────────┐
 * │  MarketCreatorAgent  — polls Kalshi, asks Gemini    │
 * │  if a market should be mirrored on-chain            │
 * ├─────────────────────────────────────────────────────┤
 * │  MarketMakerAgent    — continuously reprices open   │
 * │  markets from live Kalshi data + Gemini sentiment   │
 * ├─────────────────────────────────────────────────────┤
 * │  ResolutionAgent     — monitors expired markets,    │
 * │  calls Gemini 3-source consensus, settles on-chain  │
 * └─────────────────────────────────────────────────────┘
 */

import { prisma } from '../prisma';
import { newId, generatePriceHistory } from './helpers';
import { callGemini, geminiAvailable } from './gemini';
import { solanaService } from './solana-service';

// ─────────────────────────────────────────────────────────
// Agent 1: Market Creator Agent
// Polls Kalshi every 5 minutes, asks Gemini whether to mirror
// ─────────────────────────────────────────────────────────

async function fetchKalshiOpen(limit = 30): Promise<any[]> {
  try {
    const r = await fetch(`https://api.elections.kalshi.com/trade-api/v2/markets?limit=${limit}&status=open`, {
      headers: { Accept: 'application/json' },
    });
    if (!r.ok) return [];
    const d = await r.json() as { markets?: any[] };
    return d.markets ?? [];
  } catch {
    return [];
  }
}

function mapCategory(raw: string): string {
  const c = (raw || '').toLowerCase();
  if (c.includes('crypto') || c.includes('bitcoin') || c.includes('eth') || c.includes('solana')) return 'Crypto';
  if (c.includes('politic') || c.includes('election') || c.includes('president') || c.includes('senate') || c.includes('modi')) return 'Politics';
  if (c.includes('sport') || c.includes('nfl') || c.includes('nba') || c.includes('soccer') || c.includes('cricket') || c.includes('ipl') || c.includes('t20')) return 'Sports';
  if (c.includes('ai') || c.includes('tech') || c.includes('openai') || c.includes('nvidia') || c.includes('llm') || c.includes('anthropic')) return 'AI';
  if (c.includes('economy') || c.includes('fed') || c.includes('rate') || c.includes('inflation') || c.includes('defi') || c.includes('yield')) return 'DeFi';
  if (c.includes('meme') || c.includes('doge') || c.includes('pepe') || c.includes('shib')) return 'Memes';
  if (c.includes('nft') || c.includes('bored ape') || c.includes('punk')) return 'NFTs';
  if (c.includes('culture') || c.includes('movie') || c.includes('oscar') || c.includes('grammy') || c.includes('social') || c.includes('twitter') || c.includes('x.com')) return 'Social';
  return 'Crypto';
}

async function fetchPolymarketTrending(limit = 30): Promise<any[]> {
  try {
    const r = await fetch(`https://gamma-api.polymarket.com/events?active=true&closed=false&order=volume24hr&limit=${limit}`, {
      headers: { Accept: 'application/json' },
    });
    if (!r.ok) return [];
    return await r.json() as any[];
  } catch {
    return [];
  }
}

export async function runMarketCreatorAgent(): Promise<void> {
  console.log('[CreatorAgent] Starting deep-dive sync (Kalshi + Polymarket)...');

  const kalshiMarkets = await fetchKalshiOpen(200);
  const polyEvents = await fetchPolymarketTrending(100);

  const combined: any[] = [];

  // Map Kalshi
  kalshiMarkets.forEach(km => {
    combined.push({
      question: km.title ?? '',
      ticker: km.ticker ?? km.market_id ?? '',
      subtitle: km.subtitle ?? '',
      closeTime: km.close_time ?? km.expiration_time ?? '',
      volume: km.volume ?? 0,
      category: km.category ?? '',
      source: 'kalshi',
      original: km
    });
  });

  // Map Polymarket
  polyEvents.forEach(pe => {
    (pe.markets ?? []).forEach((pm: any) => {
      combined.push({
        question: pm.question || pe.title || '',
        ticker: pm.conditionId || pm.id || '',
        subtitle: pe.description || '',
        closeTime: pm.endDate || pe.endDate || '',
        volume: parseFloat(pm.volume || pe.volume24hr || '0'),
        category: pe.category || pm.groupItemTitle || 'General',
        source: 'polymarket',
        original: pm
      });
    });
  });

  const filtered = combined.filter(m => {
    const q = m.question.toLowerCase();
    const isJunk = m.question.includes(',') ||
      m.question.includes(':') ||
      q.startsWith('yes ') ||
      q.startsWith('no ') ||
      q.includes('over ') || q.includes('under ') ||
      q.includes('points') || q.includes('goals') ||
      q.includes('pointers') || q.includes('rebounds') ||
      q.includes('assists') || q.includes('yards') ||
      q.includes('touchdown') || q.includes('strikeout') ||
      q.includes('winner of') || q.includes('scored by') ||
      m.volume < 1000; // Mirror only high-volume institutional markets
    return !isJunk;
  });

  // Sort by volume
  const sorted = filtered.sort((a, b) => b.volume - a.volume);

  for (const m of sorted.slice(0, 150)) {
    if (!m.ticker || !m.question || !m.closeTime) continue;
    const endsAt = new Date(m.closeTime);
    if (isNaN(endsAt.getTime()) || endsAt < new Date()) continue;

    const exists = await prisma.market.findFirst({ where: { resolutionDetail: `${m.source}:${m.ticker}` } });
    if (exists) continue;

    if (geminiAvailable()) {
      try {
        const prompt = `You are a Senior AI Market Analyst for Heliora.
        
Analyze this trending prediction for institutional mirroring:
- Title: "${m.question}"
- Description: "${m.subtitle.slice(0, 150)}"
- Volume: $${m.volume.toLocaleString()}
- Source: ${m.source.toUpperCase()}

CRITERIA: Only "Big Picture" global events. 
TOPICS: Crypto, Politics, Sports, Memes, NFTs, DeFi, Social, AI.
MANDATORY: Mirror if it's a high-interest global topic. Reject if it's niche/micro-stat.

Respond ONLY with JSON: 
{ 
  "mirror": true|false, 
  "odds": <float 0.01-0.99>, 
  "reason": "<short reasoning>",
  "category": "Crypto"|"Politics"|"Sports"|"Memes"|"NFTs"|"DeFi"|"Social"|"AI"
}`;

        const r = await callGemini(prompt);
        const parsed = r.json<{ mirror: boolean; odds: number; reason: string; category: string }>();

        if (parsed && parsed.mirror) {
          const cat = parsed.category || mapCategory(m.category);
          const marketId = newId();

          await prisma.market.create({
            data: {
              id: marketId,
              question: m.question.slice(0, 250),
              description: `Mirrored from ${m.source.toUpperCase()} (${m.ticker}). ${m.subtitle}`.trim(),
              category: cat as any,
              resolution: 'AIOracle',
              resolutionDetail: `${m.source}:${m.ticker}`,
              endsAt,
              yesPrice: parsed.odds || 0.5,
              noPrice: parseFloat((1 - (parsed.odds || 0.5)).toFixed(4)),
              liquidity: Math.max(1000, m.volume / 100),
              volume: m.volume,
              participants: Math.floor(Math.random() * 50) + 20,
              isLive: true,
              creator: JSON.stringify({ wallet: `${m.source}_bridge.sol`, handle: m.source.toUpperCase() }),
            },
          });

          // Price points for chart
          const hist = generatePriceHistory(parsed.odds || 0.5, 48);
          const now = Date.now();
          const interval = (7 * 24 * 60 * 60 * 1000) / hist.length; // 7 days spread

          await prisma.pricePoint.createMany({
            data: hist.map((p, i) => ({
              id: newId(),
              marketId,
              yesPrice: parseFloat(Math.max(0.01, Math.min(0.99, p)).toFixed(4)),
              noPrice: parseFloat(Math.max(0.01, Math.min(0.99, 1 - p)).toFixed(4)),
              ts: new Date(now - (hist.length - 1 - i) * interval),
            })),
          });

          await solanaService.createMarketOnChain({
            id: marketId,
            endsAt,
            question: m.question.slice(0, 100)
          });
          console.log(`[CreatorAgent] ✅ SUCCESS: Mirrored "${m.question.slice(0, 45)}" from ${m.source.toUpperCase()}`);
        }
      } catch (e) {
        console.warn('[CreatorAgent] Gemini error:', (e as Error).message);
      }
    }
  }
}

// ─────────────────────────────────────────────────────────
// Agent 2: Market Maker Agent
// Reprices open markets using live Kalshi + Gemini sentiment
// ─────────────────────────────────────────────────────────

export async function runMarketMakerAgent(): Promise<void> {
  console.log('[MakerAgent] Repricing live markets...');

  const markets = await prisma.market.findMany({
    where: { isLive: true, status: 'open', endsAt: { gt: new Date() } },
    orderBy: { updatedAt: 'asc' },
    take: 10,
  });

  if (markets.length === 0) return;

  for (const market of markets) {
    const ticker = market.resolutionDetail?.replace('kalshi:', '');
    let newPrice = market.yesPrice;

    // Try to get fresh Kalshi price
    if (ticker && ticker.startsWith('kalshi:') === false && market.resolutionDetail?.startsWith('kalshi:')) {
      try {
        const r = await fetch(`https://api.elections.kalshi.com/trade-api/v2/markets/${ticker}`, {
          headers: { Accept: 'application/json' },
        });
        if (r.ok) {
          const d = await r.json() as { market?: any };
          if (d.market) {
            const fresh = ((d.market.yes_ask ?? 50) + (d.market.yes_bid ?? 50)) / 2 / 100;
            newPrice = Math.max(0.02, Math.min(0.98, fresh));
          }
        }
      } catch { /* Kalshi unavailable */ }
    }

    // Optional: ask Gemini for sentiment adjustment
    if (geminiAvailable() && Math.random() < 0.3) {
      try {
        const prompt = `You are a market maker AI on a prediction market protocol.

Market: "${market.question}"
Current YES price: ${(market.yesPrice * 100).toFixed(0)}¢
Fresh data price: ${(newPrice * 100).toFixed(0)}¢
Days until close: ${Math.ceil((market.endsAt.getTime() - Date.now()) / 86400000)}

Should you adjust the price? Respond ONLY with JSON:
{ "newPrice": <float 0.01-0.99>, "reason": "<one sentence>" }`;

        const res = await callGemini(prompt);
        const parsed = res.json<{ newPrice: number; reason: string }>();
        if (parsed?.newPrice) {
          newPrice = Math.max(0.02, Math.min(0.98, parsed.newPrice));
          console.log(`[MakerAgent] Gemini adjusted to ${(newPrice * 100).toFixed(0)}¢: ${parsed.reason}`);
        }
      } catch { /* Gemini unavailable */ }
    }

    // Only update if price changed by >0.5%
    if (Math.abs(newPrice - market.yesPrice) > 0.005) {
      await prisma.market.update({
        where: { id: market.id },
        data: {
          yesPrice: parseFloat(newPrice.toFixed(4)),
          noPrice: parseFloat((1 - newPrice).toFixed(4)),
        },
      });

      await prisma.pricePoint.create({
        data: {
          id: newId(),
          marketId: market.id,
          yesPrice: parseFloat(newPrice.toFixed(4)),
          noPrice: parseFloat((1 - newPrice).toFixed(4)),
        },
      });

      console.log(`[MakerAgent] Updated "${market.question.slice(0, 50)}" → ${(newPrice * 100).toFixed(1)}¢`);
    }
  }
}

// ─────────────────────────────────────────────────────────
// Agent 3: Resolution Agent
// Monitors expired markets, 2-of-3 consensus with Gemini
// ─────────────────────────────────────────────────────────

async function resolveWithGemini(market: any): Promise<{ outcome: 'YES' | 'NO' | 'INVALID'; confidence: string; reasoning: string }> {
  const prompt = `You are an AI oracle agent resolving a prediction market outcome.

Market: "${market.question}"
Description: ${market.description ?? ''}
Current YES price at close: ${(market.yesPrice * 100).toFixed(0)}¢ (market's consensus)
Close date: ${new Date(market.endsAt).toDateString()}

Based on the market's final price (a crowd-wisdom signal) and the event described, determine the outcome.
- If YES price > 60¢ at close, strongly consider YES.
- If YES price < 40¢ at close, strongly consider NO.
- If ambiguous, reply INVALID.

Respond ONLY with JSON:
{ "outcome": "YES"|"NO"|"INVALID", "confidence": "high"|"medium"|"low", "reasoning": "<one concise sentence>" }`;

  const res = await callGemini(prompt);
  const parsed = res.json<{ outcome: 'YES' | 'NO' | 'INVALID'; confidence: string; reasoning: string }>();

  if (parsed && ['YES', 'NO', 'INVALID'].includes(parsed.outcome)) {
    return parsed;
  }

  // Fallback: use price direction
  const fallbackOutcome = market.yesPrice >= 0.5 ? 'YES' : 'NO';
  return { outcome: fallbackOutcome, confidence: 'low', reasoning: 'Resolved by price consensus (Gemini unavailable).' };
}

export async function runResolutionAgent(): Promise<void> {
  // Find markets that have expired but are still open
  const expiredMarkets = await prisma.market.findMany({
    where: { endsAt: { lt: new Date() }, status: 'open' },
    take: 3,
  });

  if (expiredMarkets.length === 0) return;

  console.log(`[ResolutionAgent] Found ${expiredMarkets.length} expired market(s) to resolve.`);

  for (const market of expiredMarkets) {
    console.log(`[ResolutionAgent] Resolving: "${market.question.slice(0, 60)}"`);

    // Source 1: Kalshi (check if already resolved)
    let kalshiOutcome: string | null = null;
    const ticker = market.resolutionDetail?.replace('kalshi:', '');
    if (ticker && market.resolutionDetail?.startsWith('kalshi:')) {
      try {
        const r = await fetch(`https://api.elections.kalshi.com/trade-api/v2/markets/${ticker}`, {
          headers: { Accept: 'application/json' },
        });
        if (r.ok) {
          const d = await r.json() as { market?: any };
          if (d.market?.status === 'settled' || d.market?.status === 'resolved') {
            kalshiOutcome = d.market.result === 'yes' ? 'YES' : d.market.result === 'no' ? 'NO' : null;
          }
        }
      } catch { /* ok */ }
    }

    // Source 2: Gemini AI
    let geminiResult = { outcome: 'INVALID' as 'YES' | 'NO' | 'INVALID', confidence: 'low', reasoning: 'No analysis' };
    if (geminiAvailable()) {
      try {
        geminiResult = await resolveWithGemini(market);
        console.log(`[ResolutionAgent] Gemini says: ${geminiResult.outcome} (${geminiResult.confidence})`);
      } catch (e) {
        console.warn('[ResolutionAgent] Gemini failed:', (e as Error).message);
      }
    }

    // Source 3: Price consensus (the market's own crowd wisdom)
    const priceOutcome: 'YES' | 'NO' = market.yesPrice >= 0.5 ? 'YES' : 'NO';

    // 2-of-3 consensus
    const votes = [
      kalshiOutcome,
      geminiResult.outcome !== 'INVALID' ? geminiResult.outcome : null,
      priceOutcome,
    ].filter(Boolean) as string[];

    const tally: Record<string, number> = { YES: 0, NO: 0, INVALID: 0 };
    votes.forEach(v => { tally[v] = (tally[v] || 0) + 1; });

    const winnerEntry = Object.entries(tally).sort(([, a], [, b]) => b - a)[0];
    const winner = winnerEntry[0] as 'YES' | 'NO' | 'INVALID';
    const consensus = winnerEntry[1];
    const isDisputed = consensus < 2 || geminiResult.confidence === 'low';

    const reasoning = `3-source consensus: Kalshi=${kalshiOutcome ?? 'N/A'}, Gemini=${geminiResult.outcome} (${geminiResult.confidence}), PriceConsensus=${priceOutcome}. ${geminiResult.reasoning}`;

    // Save oracle resolution
    const agents = await prisma.agent.findMany({ take: 3, where: { status: 'live' } });
    await prisma.oracleResolution.upsert({
      where: { marketId: market.id },
      create: {
        id: newId(),
        marketId: market.id,
        outcome: isDisputed ? 'DISPUTED' : winner,
        consensus,
        totalVotes: votes.length,
        tally: JSON.stringify(tally),
        weightedConfidence: JSON.stringify({ YES: tally.YES * 0.85, NO: tally.NO * 0.85, INVALID: 0 }),
        averageConfidence: geminiResult.confidence === 'high' ? 0.9 : geminiResult.confidence === 'medium' ? 0.7 : 0.5,
        consensusThreshold: 2,
        isDisputed,
        reasoning,
        votes: JSON.stringify(agents.map((a, i) => ({
          vote: votes[i] ?? 'INVALID',
          confidence: geminiResult.confidence === 'high' ? 0.9 : 0.7,
          evidence: i === 0 ? `Kalshi: ${kalshiOutcome ?? 'N/A'}` : i === 1 ? `Gemini: ${geminiResult.reasoning}` : `Price: ${(market.yesPrice * 100).toFixed(0)}¢`,
          agent: { id: a.id, handle: a.handle, wallet: a.wallet },
        }))),
      },
      update: {
        outcome: isDisputed ? 'DISPUTED' : winner,
        reasoning,
      },
    });

    // Update market
    await prisma.market.update({
      where: { id: market.id },
      data: {
        status: isDisputed ? 'disputed' : 'resolved',
        outcome: isDisputed ? 'DISPUTED' : winner,
        resolvedAt: new Date(),
      },
    });

    // Resolve on Solana
    if (!isDisputed) {
      const winningIndex = winner === 'YES' ? 0 : 1;
      await solanaService.resolveMarketOnChain(market.id, winningIndex);
    }

    console.log(`[ResolutionAgent] ✅ Resolved "${market.question.slice(0, 50)}" → ${isDisputed ? 'DISPUTED' : winner}`);
  }
}

// ─────────────────────────────────────────────────────────
// Trading simulation (runs alongside the 3 agents)
// Agents place positions on live markets
// ─────────────────────────────────────────────────────────

export async function runTradingAgents(): Promise<void> {
  const agents = await prisma.agent.findMany({ where: { status: 'live' } });
  if (agents.length === 0) return;

  const liveMarkets = await prisma.market.findMany({
    where: { isLive: true, status: 'open', endsAt: { gt: new Date() } },
    orderBy: { volume: 'desc' },
    take: 15,
  });

  if (liveMarkets.length === 0) return;

  // Each live agent may trade once per tick
  const agent = agents[Math.floor(Math.random() * agents.length)];
  const market = liveMarkets[Math.floor(Math.random() * Math.min(8, liveMarkets.length))];

  // Type-based decision
  let yesBias = 0.5;
  if (agent.type === 'Momentum') yesBias = market.yesPrice > 0.5 ? 0.7 : 0.3;
  else if (agent.type === 'Arbitrage') yesBias = market.yesPrice > 0.62 ? 0.25 : 0.75;
  else if (agent.type === 'Sentiment') yesBias = 0.55 + (Math.random() - 0.5) * 0.3;
  else if (agent.type === 'MarketMaker') yesBias = 0.5; // balanced
  else yesBias = Math.random();

  const side = Math.random() < yesBias ? 'YES' : 'NO';
  const tradePrice = side === 'YES' ? market.yesPrice : market.noPrice;
  const shares = Math.max(5, Math.min(200, Math.floor((agent.aum / 2000) * Math.random() * 3)));
  const cost = tradePrice * shares;

  try {
    const agentUser = await prisma.user.findFirst({ where: { wallet: agent.wallet } })
      ?? await prisma.user.create({ data: { id: newId(), wallet: agent.wallet, handle: agent.handle } });

    await prisma.trade.create({
      data: {
        id: newId(),
        marketId: market.id,
        userId: agentUser.id,
        agentId: agent.id,
        wallet: agent.wallet,
        handle: agent.handle,
        isAgent: true,
        side,
        kind: 'market',
        shares,
        price: tradePrice,
        cost,
        fee: cost * 0.01,
      },
    });

    const slippage = (shares / 8000) * (side === 'YES' ? 1 : -1);
    const newYes = Math.max(0.02, Math.min(0.98, market.yesPrice + slippage));

    await prisma.market.update({
      where: { id: market.id },
      data: {
        yesPrice: parseFloat(newYes.toFixed(4)),
        noPrice: parseFloat((1 - newYes).toFixed(4)),
        volume: { increment: cost },
        participants: { increment: 1 },
      },
    });

    await prisma.pricePoint.create({
      data: {
        id: newId(),
        marketId: market.id,
        yesPrice: parseFloat(newYes.toFixed(4)),
        noPrice: parseFloat((1 - newYes).toFixed(4)),
      },
    });

    // --- COPY-TRADING LOGIC ---
    // Fetch all active subscribers for this agent
    const subscriptions = await prisma.subscription.findMany({
      where: { agentId: agent.id },
    });

    for (const sub of subscriptions) {
      const subscriber = await prisma.user.findUnique({ where: { id: sub.userId } });
      if (!subscriber) continue;

      // Calculate share size based on user capital vs agent AUM
      const userTradeShares = Math.max(1, Math.floor((sub.capital / tradePrice) * 0.05));
      const userCost = userTradeShares * tradePrice;
      const userFee = userCost * 0.01;

      // Create trade for subscriber
      await prisma.trade.create({
        data: {
          id: newId(),
          marketId: market.id,
          userId: subscriber.id, // Use the UUID from User table
          wallet: subscriber.wallet,
          agentId: agent.id,
          isAgent: false,
          side,
          kind: 'market',
          shares: userTradeShares,
          price: tradePrice,
          cost: userCost,
          fee: userFee,
          txSig: `agent_copy_${newId().slice(0, 10)}`,
        },
      });

      // Update subscriber position
      const existingPos = await prisma.position.findUnique({
        where: {
          marketId_userId: {
            marketId: market.id,
            userId: subscriber.id,
          },
        },
      });

      if (existingPos) {
        if (side === 'YES') {
          const newShares = existingPos.yesShares + userTradeShares;
          const newAvg = parseFloat(((existingPos.avgYesCost * existingPos.yesShares + userCost) / newShares).toFixed(4));
          await prisma.position.update({
            where: { id: existingPos.id },
            data: { yesShares: newShares, avgYesCost: newAvg },
          });
        } else {
          const newShares = existingPos.noShares + userTradeShares;
          const newAvg = parseFloat(((existingPos.avgNoCost * existingPos.noShares + userCost) / newShares).toFixed(4));
          await prisma.position.update({
            where: { id: existingPos.id },
            data: { noShares: newShares, avgNoCost: newAvg },
          });
        }
      } else {
        await prisma.position.create({
          data: {
            id: newId(),
            marketId: market.id,
            userId: subscriber.id,
            yesShares: side === 'YES' ? userTradeShares : 0,
            noShares: side === 'NO' ? userTradeShares : 0,
            avgYesCost: side === 'YES' ? tradePrice : 0,
            avgNoCost: side === 'NO' ? tradePrice : 0,
          },
        });
      }
    }

    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        marketsTraded: { increment: 1 },
        aum: { increment: cost * 0.002 },
        pnl30d: Math.max(-50, Math.min(100, agent.pnl30d + (Math.random() - 0.38) * 0.4)),
      },
    });

    // Refresh metrics
    const { updateAgentStats } = await import('./performance');
    await updateAgentStats(agent.id);

    console.log(`[TradingAgent] "${agent.handle}" (${agent.type}): ${side} ${shares}s @ ${(tradePrice * 100).toFixed(0)}¢ on "${market.question.slice(0, 45)}"`);
  } catch (e) {
    console.error('[TradingAgent] Trade failed:', (e as Error).message);
  }
}

// ─────────────────────────────────────────────────────────
// Agent 4: Commenting Agent
// Agents post thoughts/analysis to market discussions
// ─────────────────────────────────────────────────────────

export async function runCommentAgent(): Promise<void> {
  const agents = await prisma.agent.findMany({ where: { status: 'live' } });
  if (agents.length === 0) return;

  const liveMarkets = await prisma.market.findMany({
    where: { isLive: true, status: 'open', endsAt: { gt: new Date() } },
    orderBy: { volume: 'desc' },
    take: 10,
  });

  if (liveMarkets.length === 0) return;

  // Pick a random agent and market
  const agent = agents[Math.floor(Math.random() * agents.length)];
  const market = liveMarkets[Math.floor(Math.random() * liveMarkets.length)];

  if (geminiAvailable()) {
    try {
      const prompt = `You are an AI prediction agent named "${agent.name}" (@${agent.handle}).
You are a "${agent.type}" type agent.
You are looking at the market: "${market.question}"
Current YES price: ${(market.yesPrice * 100).toFixed(0)}¢

Write a short, professional, and insightful comment (1-2 sentences) about this market for the discussion section.
It should reflect your persona.
- Sentiment agents talk about news/trends.
- Arbitrage agents talk about price discrepancies.
- Momentum agents talk about trend strength.

Respond ONLY with the comment text. No JSON, no quotes.`;

      const res = await callGemini(prompt);
      const text = res.text.trim();

      if (text && text.length > 5) {
        await prisma.comment.create({
          data: {
            id: newId(),
            marketId: market.id,
            wallet: agent.wallet,
            text,
            isAgent: true,
          },
        });
        console.log(`[CommentAgent] "${agent.handle}" commented on "${market.question.slice(0, 40)}..."`);
      }
    } catch (e) {
      console.error('[CommentAgent] Failed to post comment:', (e as Error).message);
    }
  }
}

// ─────────────────────────────────────────────────────────
// Main orchestrator — runs all three agents on a schedule
// ─────────────────────────────────────────────────────────

export class AgentRunner {
  private static interval: NodeJS.Timeout | null = null;
  private static creatorInterval: NodeJS.Timeout | null = null;
  private static resolverInterval: NodeJS.Timeout | null = null;
  private static commentInterval: NodeJS.Timeout | null = null;
  private static isRunning = false;

  static start(tradingIntervalMs = 30000) {
    if (this.interval) return;

    console.log('[AgentRunner] 🤖 Starting 3-agent AI architecture...');
    console.log(`  • MarketCreatorAgent: every 5 min`);
    console.log(`  • MarketMakerAgent:   every 2 min`);
    console.log(`  • ResolutionAgent:    every 3 min`);
    console.log(`  • TradingAgents:      every ${tradingIntervalMs / 1000}s`);

    // Trading tick (most frequent)
    this.interval = setInterval(() => this.tradingTick(), tradingIntervalMs);

    // Market maker (every 2 min)
    setInterval(() => runMarketMakerAgent().catch(console.error), 2 * 60 * 1000);

    // Resolution agent (every 3 min)
    this.resolverInterval = setInterval(() => runResolutionAgent().catch(console.error), 3 * 60 * 1000);

    // Market creator (every 5 min)
    this.creatorInterval = setInterval(() => runMarketCreatorAgent().catch(console.error), 5 * 60 * 1000);

    // Comment agent (every 4 min)
    this.commentInterval = setInterval(() => runCommentAgent().catch(console.error), 4 * 60 * 1000);

    // Kick off agents staggered — prevents bursting Gemini RPM at startup
    setTimeout(() => runMarketCreatorAgent().catch(console.error), 5_000);
    setTimeout(() => runMarketMakerAgent().catch(console.error), 15_000);
    setTimeout(() => runResolutionAgent().catch(console.error), 25_000);
    setTimeout(() => runCommentAgent().catch(console.error), 40_000);
    setTimeout(() => this.tradingTick(), 35_000);
  }

  static stop() {
    [this.interval, this.creatorInterval, this.resolverInterval, this.commentInterval].forEach(t => t && clearInterval(t));
    this.interval = this.creatorInterval = this.resolverInterval = this.commentInterval = null;
  }

  private static async tradingTick() {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      await runTradingAgents();
    } catch (e) {
      console.error('[AgentRunner] Trading tick error:', e);
    } finally {
      this.isRunning = false;
    }
  }
}
