import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { newId, generatePriceHistory } from '../utils/helpers';

const router = Router();

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
        _count: {
          select: { trades: true }
        }
      },
    });

    if (!market) {
      market = await prisma.market.findFirst({
        where: { resolutionDetail: `kalshi:${req.params.id}` },
        include: {
          pricePoints: { orderBy: { ts: 'asc' }, take: 300 },
          trades: { orderBy: { createdAt: 'desc' }, take: 20 },
          oracleResolution: true,
          _count: {
            select: { trades: true }
          }
        },
      });
    }

    // Lazy Mirroring: If not found, check if it's a Kalshi ticker and create it
    if (!market && req.params.id.includes('-')) {
      try {
        const r = await fetch(`https://api.elections.kalshi.com/trade-api/v2/markets/${req.params.id}`, {
          headers: { 'Accept': 'application/json' }
        });
        if (r.ok) {
          const d = await r.json() as { market: any };
          if (d.market) {
            const m = d.market;
            const newMarketId = newId();
            market = await prisma.market.create({
              data: {
                id: newMarketId,
                question: m.title,
                category: m.category || 'Other',
                description: m.subtitle || '',
                endsAt: new Date(m.close_time),
                yesPrice: m.yes_prob,
                noPrice: 1 - m.yes_prob,
                volume: (m.volume_24h || 0) / 100,
                liquidity: (m.liquidity || 1000) / 100,
                isLive: true,
                resolutionDetail: `kalshi:${m.ticker}`,
                creator: JSON.stringify({ wallet: 'system', handle: 'Heliora Bridge' }),
              },
              include: {
                pricePoints: true,
                trades: true,
                oracleResolution: true,
                _count: { select: { trades: true } }
              }
            }) as any;
          }
        }
      } catch (err) {
        console.error('[LazyMirror]', err);
      }
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
          _count: { select: { trades: true } }
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
      totalTrades: (market as any)._count?.trades || 0,
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

// Get top holders for a market
router.get('/:id/holders', async (req: Request, res: Response): Promise<void> => {
  try {
    let marketId = req.params.id;
    let market = await prisma.market.findUnique({ where: { id: marketId } });
    if (!market) {
      market = await prisma.market.findFirst({ where: { resolutionDetail: `kalshi:${marketId}` } });
      if (market) marketId = market.id;
    }

    if (!market) {
      res.status(404).json({ error: 'Market not found' });
      return;
    }

    const positions = await prisma.position.findMany({
      where: {
        marketId,
        OR: [
          { yesShares: { gt: 0 } },
          { noShares: { gt: 0 } }
        ]
      },
      include: {
        user: true
      },
      orderBy: {
        yesShares: 'desc'
      },
      take: 20
    });

    const agents = await prisma.agent.findMany({
      select: { wallet: true }
    });
    const agentWallets = new Set(agents.map(a => a.wallet));

    const holders = positions.map(p => ({
      id: p.id,
      wallet: p.user.wallet,
      handle: p.user.handle,
      isAgent: agentWallets.has(p.user.wallet),
      yesShares: p.yesShares,
      noShares: p.noShares,
      totalShares: p.yesShares + p.noShares,
      avgPrice: (p.avgYesCost + p.avgNoCost) / 2,
    })).sort((a, b) => b.totalShares - a.totalShares);

    res.json({ holders });
    return;
  } catch (error) {
    console.error('[HoldersAPI]', error);
    res.status(500).json({ error: 'Failed to fetch holders' });
    return;
  }
});

// --- Comments ---

// Get comments for a market
router.get('/:id/comments', async (req: Request, res: Response): Promise<void> => {
  try {
    let marketId = req.params.id;
    const wallet = req.headers['x-wallet'] as string;

    let market = await prisma.market.findUnique({ where: { id: marketId } });
    if (!market) market = await prisma.market.findFirst({ where: { resolutionDetail: `kalshi:${marketId}` } });
    if (market) marketId = market.id;

    const comments = await prisma.comment.findMany({
      where: { marketId },
      include: {
        _count: {
          select: { likes: true }
        },
        likes: wallet ? {
          where: { wallet }
        } : false,
        bookmarks: wallet ? {
          where: { wallet }
        } : false,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const parsed = comments.map(c => ({
      ...c,
      isLiked: c.likes?.length > 0,
      isBookmarked: c.bookmarks?.length > 0,
      likesCount: c.likesCount, // Or use c._count.likes if we want live count
    }));

    res.json({ comments: parsed });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

// Post a comment
router.post('/:id/comments', async (req: Request, res: Response): Promise<void> => {
  try {
    const { text, wallet, isAgent, gifUrl } = req.body;
    if (!text && !gifUrl) {
      res.status(400).json({ error: 'Comment text or GIF is required' });
      return;
    }

    let marketId = req.params.id;
    let market = await prisma.market.findUnique({ where: { id: marketId } });
    if (!market) market = await prisma.market.findFirst({ where: { resolutionDetail: `kalshi:${marketId}` } });
    if (!market) {
      res.status(404).json({ error: 'Market not found' });
      return;
    }
    marketId = market.id;

    const comment = await prisma.comment.create({
      data: {
        id: newId(),
        marketId,
        text: text || '',
        gifUrl,
        wallet: wallet || (req.headers['x-wallet'] as string) || 'anon',
        isAgent: isAgent || false,
      },
    });

    // Broadcast in real-time
    const { broadcastSocialEvent } = require('./ws');
    broadcastSocialEvent(marketId, {
      type: 'comment',
      comment: {
        ...comment,
        isLiked: false,
        isBookmarked: false,
        likesCount: 0
      }
    });

    res.status(201).json({ comment });
  } catch (error) {
    res.status(500).json({ error: 'Failed to post comment' });
  }
});

export default router;

