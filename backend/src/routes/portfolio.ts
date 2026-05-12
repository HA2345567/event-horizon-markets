import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';

const router = Router();

// Get portfolio for a wallet (specified in X-Wallet header or query)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const xWallet = (req.headers['x-wallet'] as string) || (req.query.wallet as string);

    if (!xWallet) {
      res.status(400).json({ error: 'Wallet address required' });
      return;
    }

    // Find user by wallet
    const user = await prisma.user.findUnique({
      where: { wallet: xWallet },
      include: {
        positions: {
          include: {
            market: true,
          },
        },
        trades: {
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: {
            market: true,
          },
        },
        subscriptions: {
          include: {
            agent: true,
          },
        },
      },
    });

    if (!user) {
      // If user doesn't exist, return empty portfolio
      res.json({
        wallet: xWallet,
        totalBalance: 0,
        unrealizedPnl: 0,
        realizedPnl: 0,
        positions: [],
        recentTrades: [],
      });
      return;
    }

    // Calculate totals
    const unrealizedPnl = user.positions.reduce((sum, pos) => {
      const currentYesValue = pos.yesShares * pos.market.yesPrice;
      const currentNoValue = pos.noShares * pos.market.noPrice;
      const cost = (pos.yesShares * pos.avgYesCost) + (pos.noShares * pos.avgNoCost);
      return sum + (currentYesValue + currentNoValue - cost);
    }, 0);

    const realizedPnl = user.positions.reduce((sum, pos) => sum + pos.realizedPnl, 0);

    res.json({
      wallet: user.wallet,
      handle: user.handle,
      unrealizedPnl,
      realizedPnl,
      positions: user.positions.map(p => ({
        id: p.id,
        marketId: p.marketId,
        market: {
          question: p.market.question,
          category: p.market.category,
          status: p.market.status,
          yesPrice: p.market.yesPrice,
          noPrice: p.market.noPrice,
        },
        yesShares: p.yesShares,
        noShares: p.noShares,
        avgYesCost: p.avgYesCost,
        avgNoCost: p.avgNoCost,
        currentValue: (p.yesShares * p.market.yesPrice) + (p.noShares * p.market.noPrice),
      })),
      recentTrades: user.trades.map(t => ({
        id: t.id,
        marketId: t.marketId,
        question: t.market.question,
        side: t.side,
        shares: t.shares,
        price: t.price,
        cost: t.cost,
        isSell: t.isSell,
        createdAt: t.createdAt,
      })),
      subscriptions: (user.subscriptions || []).map(s => ({
        id: s.id,
        agentId: s.agentId,
        agentName: s.agent.name,
        agentHandle: s.agent.handle,
        agentType: s.agent.type,
        capital: s.capital,
        pnl: s.capital * (s.agent.pnl30d / 100) * 0.4, // illustrative ROI
        createdAt: s.createdAt,
      })),
    });
    return;
  } catch (error: any) {
    console.error('Error fetching portfolio:', error);
    res.status(500).json({ 
      error: 'Failed to fetch portfolio',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
    return;
  }
});

export default router;
