import express, { Request, Response } from 'express';
import { prisma } from '../prisma';
import { newId } from '../utils/helpers';
import { callGemini, geminiAvailable } from '../utils/gemini';

const router = express.Router();

// Get recent resolutions
router.get('/recent', async (_req: Request, res: Response): Promise<void> => {
  try {
    const resolutionsRaw = await prisma.oracleResolution.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: { market: true },
    });

    const resolutions = resolutionsRaw.map(r => ({
      ...r,
      tally: r.tally ? JSON.parse(r.tally) : null,
      votes: r.votes ? JSON.parse(r.votes) : [],
      weightedConfidence: r.weightedConfidence ? JSON.parse(r.weightedConfidence) : null,
    }));

    res.json({ resolutions });
    return;
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch resolutions' });
    return;
  }
});

// Resolve a market using AI oracle consensus (Kalshi + Gemini + Price)
router.post('/resolve/:marketId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { marketId } = req.params;
    const { context = '' } = req.body as { context?: string };

    const market = await prisma.market.findUnique({ where: { id: marketId } });
    if (!market) {
      res.status(404).json({ error: 'Market not found' });
      return;
    }
    if (market.status === 'resolved') {
      res.status(400).json({ error: 'Market already resolved' });
      return;
    }

    const agents = await prisma.agent.findMany({ where: { status: 'live' }, take: 5 });

    // Source 1: Kalshi (check if resolved upstream)
    let kalshiOutcome: string | null = null;
    const ticker = market.resolutionDetail?.replace('kalshi:', '');
    if (ticker && market.resolutionDetail?.startsWith('kalshi:')) {
      try {
        const r = await fetch(`https://api.elections.kalshi.com/trade-api/v2/markets/${ticker}`, {
          headers: { Accept: 'application/json' },
        });
        if (r.ok) {
          const d = await r.json() as { market?: any };
          if (['settled', 'resolved'].includes(d.market?.status ?? '')) {
            kalshiOutcome = d.market.result === 'yes' ? 'YES' : d.market.result === 'no' ? 'NO' : null;
          }
        }
      } catch { /* Kalshi unreachable */ }
    }

    // Source 2: Gemini AI Oracle
    let geminiOutcome: 'YES' | 'NO' | 'INVALID' = 'INVALID';
    let geminiConfidence = 'low';
    let geminiReasoning = 'Gemini not configured';

    if (geminiAvailable()) {
      const prompt = `You are an AI oracle agent resolving a prediction market.

Market: "${market.question}"
${context ? `Additional context: ${context}` : ''}
YES price at close: ${(market.yesPrice * 100).toFixed(0)}¢ (crowd wisdom signal)
Close date: ${new Date(market.endsAt).toDateString()}
${kalshiOutcome ? `Kalshi official resolution: ${kalshiOutcome}` : ''}

Determine the correct outcome. YES price >60¢ = likely YES, <40¢ = likely NO.
If Kalshi resolved, defer to that. INVALID only if truly ambiguous.
Respond ONLY with JSON: { "outcome": "YES"|"NO"|"INVALID", "confidence": "high"|"medium"|"low", "reasoning": "<one sentence>" }`;

      try {
        const r = await callGemini(prompt);
        const parsed = r.json<{ outcome: 'YES' | 'NO' | 'INVALID'; confidence: string; reasoning: string }>();
        if (parsed && ['YES', 'NO', 'INVALID'].includes(parsed.outcome)) {
          geminiOutcome = parsed.outcome;
          geminiConfidence = parsed.confidence;
          geminiReasoning = parsed.reasoning;
        }
      } catch (e) {
        geminiReasoning = `Gemini error: ${(e as Error).message.slice(0, 80)}`;
      }
    }

    // Source 3: Price consensus (market's own crowd wisdom)
    const priceOutcome: 'YES' | 'NO' = market.yesPrice >= 0.5 ? 'YES' : 'NO';

    // 2-of-3 consensus
    const allVotes = [
      kalshiOutcome,
      geminiOutcome !== 'INVALID' ? geminiOutcome : null,
      priceOutcome,
    ].filter(Boolean) as string[];

    const tally: Record<string, number> = { YES: 0, NO: 0, INVALID: 0 };
    allVotes.forEach(v => { tally[v] = (tally[v] || 0) + 1; });
    const [[outcome, consensus]] = Object.entries(tally).sort(([, a], [, b]) => b - a);
    const isDisputed = consensus < 2 || geminiConfidence === 'low';
    const finalOutcome = isDisputed ? 'DISPUTED' : outcome;
    const avgConf = geminiConfidence === 'high' ? 0.9 : geminiConfidence === 'medium' ? 0.7 : 0.5;

    const reasoning = `3-source consensus — Kalshi: ${kalshiOutcome ?? 'N/A'} | Gemini (${geminiConfidence}): ${geminiOutcome} | Price signal: ${priceOutcome}. ${geminiReasoning}`;

    const voteRecords = agents.slice(0, 3).map((a, i) => ({
      id: newId(),
      vote: [kalshiOutcome ?? outcome, geminiOutcome, priceOutcome][i] ?? outcome,
      confidence: parseFloat((avgConf - i * 0.05).toFixed(2)),
      evidence: i === 0 ? `Kalshi: ${kalshiOutcome ?? 'not resolved'}` : i === 1 ? `Gemini AI: ${geminiReasoning}` : `Price consensus: ${(market.yesPrice * 100).toFixed(0)}¢`,
      agent: { id: a.id, handle: a.handle, wallet: a.wallet },
    }));

    const resolutionRaw = await prisma.oracleResolution.upsert({
      where: { marketId },
      create: {
        id: newId(),
        marketId,
        outcome: finalOutcome,
        consensus,
        totalVotes: allVotes.length,
        tally: JSON.stringify(tally),
        weightedConfidence: JSON.stringify({ YES: (tally.YES || 0) * avgConf, NO: (tally.NO || 0) * avgConf, INVALID: 0 }),
        averageConfidence: avgConf,
        consensusThreshold: 2,
        isDisputed,
        reasoning,
        votes: JSON.stringify(voteRecords),
      },
      update: { 
        outcome: finalOutcome, 
        reasoning, 
        isDisputed,
        consensus,
        totalVotes: allVotes.length,
        tally: JSON.stringify(tally),
        weightedConfidence: JSON.stringify({ YES: (tally.YES || 0) * avgConf, NO: (tally.NO || 0) * avgConf, INVALID: 0 }),
        averageConfidence: avgConf,
        votes: JSON.stringify(voteRecords),
      },
    });

    const resolution = {
      ...resolutionRaw,
      tally: resolutionRaw.tally ? JSON.parse(resolutionRaw.tally) : null,
      votes: resolutionRaw.votes ? JSON.parse(resolutionRaw.votes) : [],
      weightedConfidence: resolutionRaw.weightedConfidence ? JSON.parse(resolutionRaw.weightedConfidence) : null,
    };

    if (!isDisputed) {
      await prisma.market.update({
        where: { id: marketId },
        data: { status: 'resolved', outcome, resolvedAt: new Date() },
      });
    } else {
      await prisma.market.update({ where: { id: marketId }, data: { status: 'disputed' } });
    }

    res.json({ resolution: { ...resolution, market } });
    return;
  } catch (error) {
    console.error('[Oracle]', error);
    res.status(500).json({ error: 'Failed to resolve market' });
    return;
  }
});

// Challenge a resolution
router.post('/challenge/:marketId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { marketId } = req.params;
    const { reason = '' } = req.body as { reason?: string };
    const xWallet = (req.headers['x-wallet'] as string) || `demo_${newId().slice(0, 8)}.sol`;

    const resolution = await prisma.oracleResolution.findUnique({ where: { marketId } });
    if (!resolution) {
      res.status(404).json({ error: 'Resolution not found' });
      return;
    }

    if (resolution.isDisputed) {
      res.status(400).json({ error: 'Market already disputed' });
      return;
    }

    // Update resolution and market status
    await prisma.oracleResolution.update({
      where: { marketId },
      data: { isDisputed: true, reasoning: `${resolution.reasoning} | CHALLENGED by ${xWallet}: ${reason}` },
    });

    await prisma.market.update({
      where: { id: marketId },
      data: { status: 'disputed' },
    });

    res.json({ success: true, message: 'Challenge recorded' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record challenge' });
  }
});

export default router;
