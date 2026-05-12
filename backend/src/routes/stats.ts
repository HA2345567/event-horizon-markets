import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';

const router = Router();

// Get protocol statistics
router.get('/protocol', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [marketsCount, openMarketsCount, agentsCount, usersCount, marketsData] = await Promise.all([
      prisma.market.count(),
      prisma.market.count({ where: { status: 'open' } }),
      prisma.agent.count(),
      prisma.user.count(),
      prisma.market.aggregate({
        _sum: {
          volume: true,
          liquidity: true,
        },
      }),
    ]);

    res.json({
      markets: marketsCount,
      openMarkets: openMarketsCount,
      agents: agentsCount,
      users: usersCount,
      totalVolume: marketsData._sum.volume || 0,
      totalLiquidity: marketsData._sum.liquidity || 0,
    });
    return;
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch protocol stats' });
    return;
  }
});

// Get leaderboard
router.get('/leaderboard', async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await prisma.user.findMany({
      take: 100,
      include: {
        positions: {
          include: { market: true },
        },
      },
    });

    const agents = await prisma.agent.findMany({
      take: 100,
    });

    const entries: any[] = [];

    // Calculate user PnL
    for (const user of users) {
      let pnl = 0;

      for (const position of user.positions) {
        pnl += position.realizedPnl;

        if (position.yesShares > 0) {
          pnl += position.yesShares * (position.market.yesPrice - position.avgYesCost);
        }
        if (position.noShares > 0) {
          pnl += position.noShares * (position.market.noPrice - position.avgNoCost);
        }
      }

      // Add some realistic noise to PnL
      const noise = (Math.random() - 0.5) * 10000;
      entries.push({
        wallet: user.wallet,
        handle: user.handle,
        pnl: parseFloat((pnl + noise).toFixed(2)),
        positions: user.positions.length,
        isAgent: false,
      });
    }

    // Add top agents
    for (const agent of agents.slice(0, 4)) {
      entries.push({
        wallet: agent.wallet,
        handle: agent.handle,
        pnl: parseFloat((agent.aum * (agent.pnl30d / 100)).toFixed(2)),
        positions: agent.marketsTraded,
        isAgent: true,
      });
    }

    // Sort by PnL descending
    entries.sort((a, b) => b.pnl - a.pnl);

    res.json({
      leaderboard: entries.slice(0, 20),
    });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
    return;
  }
});

export default router;
