import express, { Request, Response } from 'express';
import { prisma } from '../prisma';
import { newId } from '../utils/helpers';

const router = express.Router();

interface SubscribeBody {
  capital: number;
}

// Get all agents with subscription count
router.get('/', async (_req: Request, res: Response): Promise<void> => {
  try {
    const agents = await prisma.agent.findMany({
      include: {
        subscriptions: {
          select: { id: true },
        },
      },
    });

    const agentsWithCounts = agents.map((agent) => ({
      ...agent,
      _count: {
        subscriptions: agent.subscriptions.length + agent.subscriptionCount,
      },
      subscriptions: undefined,
    }));

    res.json({ agents: agentsWithCounts });
    return;
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch agents' });
    return;
  }
});

// Get agent by ID with performance metrics
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: req.params.id },
      include: {
        subscriptions: {
          select: { id: true },
        },
        trades: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            market: true,
          },
        },
      },
    });

    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    // Calculate performance metrics (mock for now, or based on trades)
    const totalTrades = agent.trades.length;
    const winningTrades = agent.trades.filter(t => (t.side === 'YES' && t.market.outcome === 'YES') || (t.side === 'NO' && t.market.outcome === 'NO')).length;
    
    const performance = {
      realizedPnl: agent.pnl30d * 0.8, // illustrative
      unrealizedPnl: agent.pnl30d * 0.2,
      totalPnl: agent.pnl30d,
      winRate: agent.winRate,
      winningTrades,
      losingTrades: totalTrades - winningTrades,
      totalTrades: agent.marketsTraded,
      maxDrawdown: agent.maxDrawdown,
      sharpe: agent.sharpe,
    };

    res.json({
      agent: {
        ...agent,
        _count: {
          subscriptions: agent.subscriptions.length + agent.subscriptionCount,
          oracleVotesCount: Math.floor(agent.marketsTraded / 5), // illustrative
        },
        subscriptions: undefined,
        trades: undefined,
      },
      performance,
      recentTrades: agent.trades.map(t => ({
        id: t.id,
        market: {
          id: t.market.id,
          question: t.market.question,
          category: t.market.category,
          outcome: t.market.outcome,
          status: t.market.status,
        },
        side: t.side,
        shares: t.shares,
        price: t.price,
        cost: t.cost,
        createdAt: t.createdAt,
        status: t.market.status === 'resolved' 
          ? ((t.side === t.market.outcome) ? 'won' : 'lost')
          : 'pending',
      })),
    });
    return;
  } catch (error) {
    console.error('Error fetching agent detail:', error);
    res.status(500).json({ error: 'Failed to fetch agent' });
    return;
  }
});

// Subscribe to agent
router.post('/:agentId/subscribe', async (req: Request, res: Response): Promise<void> => {
  try {
    const { agentId } = req.params;
    const body = req.body as SubscribeBody;
    const xWallet = (req.headers['x-wallet'] as string) || `demo_${newId().slice(0, 8)}.sol`;

    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      res.status(404).json({ error: 'Agent not found' });
      return;
    }

    if (!body.capital || body.capital <= 0) {
      res.status(400).json({ error: 'capital must be greater than 0' });
      return;
    }

    const subscription = await prisma.subscription.create({
      data: {
        id: newId(),
        agentId,
        userId: xWallet,
        capital: body.capital,
      },
    });

    await prisma.agent.update({
      where: { id: agentId },
      data: { subscriptionCount: { increment: 1 } },
    });

    res.status(201).json({
      subscription: {
        id: subscription.id,
        agentId: subscription.agentId,
        userId: subscription.userId,
        capital: subscription.capital,
        createdAt: subscription.createdAt,
      },
    });
    return;
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Already subscribed to this agent' });
      return;
    }
    res.status(500).json({ error: 'Failed to subscribe to agent' });
    return;
  }
});

export default router;
