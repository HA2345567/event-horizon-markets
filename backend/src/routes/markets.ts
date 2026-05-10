import express, { Request, Response } from 'express';
import { prisma } from '../prisma';
import { newId, generatePriceHistory } from '../utils/helpers';

const router = express.Router();

interface CreateMarketBody {
  question: string;
  description?: string;
  category: string;
  resolution?: string;
  resolutionDetail?: string;
  endsAt: string;
  liquiditySeed?: number;
  isLive?: boolean;
}

// List markets with filtering and sorting
router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      category,
      live,
      sort = 'volume',
      search,
      take = '60',
    } = req.query;

    const filters: any = {};
    if (category) filters.category = category;
    if (live !== undefined) filters.isLive = live === 'true';
    if (search) {
      filters.question = {
        contains: search as string,
      };
    }

    const orderBy: any =
      sort === 'ending'
        ? { endsAt: 'asc' }
        : sort === 'trending'
          ? { participants: 'desc' }
          : sort === 'newest'
            ? { createdAt: 'desc' }
            : { volume: 'desc' };

    const markets = await prisma.market.findMany({
      where: filters,
      orderBy,
      take: Math.min(parseInt(take as string), 100),
      include: {
        pricePoints: {
          take: 1,
          orderBy: { ts: 'desc' },
        },
      },
    });

    // Parse creator JSON string for each market
    const parsed = markets.map(m => ({
      ...m,
      creator: (() => { try { return JSON.parse(m.creator); } catch { return { wallet: m.creator }; } })(),
    }));

    res.json({ markets: parsed });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch markets' });
  }
});

// Create market
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as CreateMarketBody;
    const xWallet = (req.headers['x-wallet'] as string) || `demo_${newId().slice(0, 8)}.sol`;

    if (!body.question || !body.category || !body.endsAt) {
      res.status(400).json({
        error: 'question, category, and endsAt are required',
      });
      return;
    }

    const marketId = newId();
    const market = await prisma.market.create({
      data: {
        id: marketId,
        question: body.question,
        description: body.description || '',
        category: body.category,
        resolution: body.resolution,
        resolutionDetail: body.resolutionDetail || '',
        endsAt: new Date(body.endsAt),
        liquidity: body.liquiditySeed || 500,
        yesPrice: 0.5,
        noPrice: 0.5,
        isLive: body.isLive || false,
        creator: JSON.stringify({ wallet: xWallet, handle: null }),
      },
    });

    // Generate price history
    const priceHistory = generatePriceHistory(0.5, 48);
    const pricePoints = priceHistory.map((price) => ({
      id: newId(),
      marketId,
      yesPrice: price,
      noPrice: 1 - price,
    }));

    await prisma.pricePoint.createMany({
      data: pricePoints,
    });

    res.status(201).json({ market });
    return;
  } catch (error) {
    res.status(500).json({ error: 'Failed to create market' });
    return;
  }
});

// Get market by ID with price history and trades
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    let market = await prisma.market.findUnique({
      where: { id: req.params.id },
      include: {
        pricePoints: {
          orderBy: { ts: 'asc' },
          take: 300,
        },
        trades: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        oracleResolution: true,
      },
    });

    if (!market) {
      market = await prisma.market.findFirst({
        where: { resolutionDetail: `kalshi:${req.params.id}` },
        include: {
          pricePoints: {
            orderBy: { ts: 'asc' },
            take: 300,
          },
          trades: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
          oracleResolution: true,
        },
      });
    }

    // Fallback: Try matching by short UUID prefix (e.g. BAD52E93)
    if (!market) {
      const markets = await prisma.market.findMany({
        where: { id: { startsWith: req.params.id.toLowerCase() } },
        include: {
          pricePoints: {
            orderBy: { ts: 'asc' },
            take: 300,
          },
          trades: {
            orderBy: { createdAt: 'desc' },
            take: 20,
          },
          oracleResolution: true,
        },
      });
      if (markets.length > 0) market = markets[0];
    }

    if (!market) {
      res.status(404).json({ error: 'Market not found' });
      return;
    }

    const parsed = {
      ...market,
      creator: (() => { try { return JSON.parse(market.creator); } catch { return { wallet: market.creator }; } })(),
    };

    res.json({
      market: parsed,
      recentTrades: market.trades,
    });
    return;
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch market' });
    return;
  }
});

// Get orderbook (simulated snapshot)
router.get('/:id/orderbook', async (req: Request, res: Response): Promise<void> => {
  try {
    const market = await prisma.market.findUnique({
      where: { id: req.params.id },
    });

    if (!market) {
      res.status(404).json({ error: 'Market not found' });
      return;
    }

    // Generate realistic orderbook snapshot
    const spread = 0.01;
    const yesPrice = market.yesPrice;
    const orderbook = {
      mid: yesPrice,
      buyYes: [
        { price: yesPrice - spread, size: 100 + Math.random() * 50 },
        { price: yesPrice - spread * 2, size: 50 + Math.random() * 30 },
        { price: yesPrice - spread * 3, size: 25 + Math.random() * 20 },
      ],
      sellYes: [
        { price: yesPrice + spread, size: 100 + Math.random() * 50 },
        { price: yesPrice + spread * 2, size: 50 + Math.random() * 30 },
        { price: yesPrice + spread * 3, size: 25 + Math.random() * 20 },
      ],
    };

    res.json(orderbook);
    return;
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orderbook' });
    return;
  }
});

// --- Comments ---

// Get comments for a market
router.get('/:id/comments', async (req: Request, res: Response): Promise<void> => {
  try {
    const comments = await prisma.comment.findMany({
      where: { marketId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({ comments });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Post a comment
router.post('/:id/comments', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, wallet, isAgent } = req.body;
    if (!text) {
      res.status(400).json({ error: 'Comment text is required' });
      return;
    }

    const comment = await prisma.comment.create({
      data: {
        id: newId(),
        marketId: req.params.id,
        text,
        wallet: wallet || (req.headers['x-wallet'] as string) || 'anon',
        isAgent: isAgent || false,
      },
    });

    res.status(201).json({ comment });
  } catch (error) {
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

export default router;

