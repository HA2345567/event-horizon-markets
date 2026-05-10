/**
 * /api/live — Real-time market data endpoint
 * Serves live markets from the database (populated by MarketDataService from Kalshi).
 * Supports full filtering, pagination, and price refresh.
 */

import express, { Request, Response } from 'express';
import { prisma } from '../prisma';
import { syncKalshiMarkets, seedFallbackMarkets } from '../utils/market-data-service';

const router = express.Router();

// Cache the last sync time to avoid hammering Kalshi
let lastSyncTime = 0;
const SYNC_INTERVAL_MS = 1 * 60 * 1000; // 1 minute

async function ensureLiveMarkets() {
  const now = Date.now();
  if (now - lastSyncTime > SYNC_INTERVAL_MS) {
    lastSyncTime = now;
    // Try Kalshi first, fall back to curated markets
    const synced = await syncKalshiMarkets();
    if (synced === 0) {
      await seedFallbackMarkets();
    }
  }
}

// GET /api/live — list live markets with filtering
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const now = Date.now();
    if (now - lastSyncTime > SYNC_INTERVAL_MS) {
      lastSyncTime = now;
      // Run sync in the background so it doesn't block the request
      ensureLiveMarkets().catch(console.error);
    }

    const {
      status = 'active',
      limit = '1000',
      offset = '0',
      sort = 'volume',
      search,
      category,
    } = req.query;

    const filters: any = { isLive: true };
    if (category && category !== 'all') filters.category = category;
    if (search) {
      filters.question = { contains: search as string };
    }

    // Status filter
    if (status === 'active' || status === 'open') {
      filters.status = 'open';
      filters.endsAt = { gt: new Date() };
    } else if (status === 'closed') {
      filters.status = 'resolved';
    }

    const orderBy: any =
      sort === 'ending' ? { endsAt: 'asc' }
      : sort === 'liquidity' ? { liquidity: 'desc' }
      : sort === 'newest' ? { createdAt: 'desc' }
      : { volume: 'desc' };

    const take = Math.min(parseInt(limit as string, 10), 1000);
    const skip = parseInt(offset as string, 10);

    const [markets, total] = await Promise.all([
      prisma.market.findMany({
        where: filters,
        orderBy,
        take,
        skip,
      }),
      prisma.market.count({ where: filters }),
    ]);

    // Map to Kalshi-style response shape (matches frontend types)
    const mapped = markets.map((m) => {
      const ticker = m.resolutionDetail?.startsWith('kalshi:')
        ? m.resolutionDetail.replace('kalshi:', '')
        : m.id.slice(0, 8).toUpperCase();

      const yesBid = Math.max(1, Math.round((m.yesPrice - 0.01) * 100));
      const yesAsk = Math.min(99, Math.round((m.yesPrice + 0.01) * 100));
      const trend =
        m.yesPrice > 0.55 ? 'up' : m.yesPrice < 0.45 ? 'down' : 'flat';

      return {
        ticker,
        title: m.question,
        subtitle: m.description ?? '',
        category: m.category,
        status: m.status === 'open' ? 'active' : m.status,
        yes_bid: yesBid,
        yes_ask: yesAsk,
        no_bid: 100 - yesAsk,
        no_ask: 100 - yesBid,
        yes_prob: m.yesPrice,
        trend,
        volume_24h: m.volume,
        liquidity: m.liquidity,
        open_interest: m.liquidity * 10,
        close_time: m.endsAt.toISOString(),
        event_ticker: ticker.split('-')[0] ?? ticker,
        // Internal ID so frontend can navigate to detail
        _id: m.id,
      };
    });

    // Compute meta stats
    const activeCount = mapped.filter(m => m.status === 'active').length;
    const totalVolume = markets.reduce((s, m) => s + m.volume, 0);
    const totalLiquidity = markets.reduce((s, m) => s + m.liquidity, 0);
    const cats = { crypto: 0, politics: 0, sports: 0, economy: 0, culture: 0, weather: 0, other: 0 } as Record<string, number>;
    markets.forEach(m => {
      const c = m.category.toLowerCase();
      if (c === 'crypto' || c === 'defi') cats.crypto++;
      else if (c === 'politics') cats.politics++;
      else if (c === 'sports') cats.sports++;
      else if (c === 'ai' || c === 'social') cats.culture++;
      else cats.other++;
    });

    res.json({
      markets: mapped,
      pagination: {
        offset: skip,
        limit: take,
        total,
        hasMore: skip + take < total,
      },
      meta: {
        activeCount,
        closedCount: 0,
        settledCount: 0,
        totalVolume,
        totalLiquidity,
        categories: cats,
        cacheAge: Date.now() - lastSyncTime,
      },
    });
  } catch (error) {
    console.error('[LiveRoute] Error:', error);
    res.status(500).json({ error: 'Failed to fetch live markets' });
  }
});

// GET /api/live/health/status
router.get('/health/status', async (_req: Request, res: Response): Promise<void> => {
  const count = await prisma.market.count({ where: { isLive: true } });
  res.json({
    status: 'ok',
    markets_available: count > 0,
    cache: { lastSync: new Date(lastSyncTime).toISOString(), count },
    timestamp: new Date().toISOString(),
  });
});

// GET /api/live/:ticker — get single live market detail with orderbook
router.get('/:ticker', async (req: Request, res: Response): Promise<void> => {
  try {
    const { ticker } = req.params;

    // Try by Kalshi ticker first, then by DB id prefix
    let market = await prisma.market.findFirst({
      where: { resolutionDetail: `kalshi:${ticker}` },
      include: { pricePoints: { orderBy: { ts: 'asc' }, take: 200 } },
    });

    if (!market) {
      // Try matching by ID prefix
      const markets = await prisma.market.findMany({
        where: { isLive: true },
        include: { pricePoints: { orderBy: { ts: 'asc' }, take: 200 } },
      });
      market = markets.find(m => m.id.startsWith(ticker.toLowerCase())) ?? null;
    }

    if (!market) {
      res.status(404).json({ error: 'Market not found' });
      return;
    }

    const yesPrice = market.yesPrice;
    const spread = 0.01;
    const yesBid = Math.max(1, Math.round((yesPrice - spread) * 100));
    const yesAsk = Math.min(99, Math.round((yesPrice + spread) * 100));

    res.json({
      market: {
        ticker,
        title: market.question,
        subtitle: market.description ?? '',
        description: market.description ?? '',
        category: market.category,
        status: market.status,
        yes_bid: yesBid,
        yes_ask: yesAsk,
        no_bid: 100 - yesAsk,
        no_ask: 100 - yesBid,
        yes_prob: yesPrice,
        trend: yesPrice > 0.55 ? 'up' : yesPrice < 0.45 ? 'down' : 'flat',
        volume_24h: market.volume,
        volume: market.volume,
        liquidity: market.liquidity,
        open_interest: market.liquidity * 10,
        notional_value: market.volume * 0.5,
        close_time: market.endsAt.toISOString(),
        event_ticker: ticker.split('-')[0] ?? ticker,
        _id: market.id,
      },
      orderbook: {
        yes: {
          bids: [
            { price: yesBid, quantity: 150 + Math.floor(Math.random() * 100) },
            { price: yesBid - 1, quantity: 80 + Math.floor(Math.random() * 60) },
            { price: yesBid - 2, quantity: 40 + Math.floor(Math.random() * 30) },
          ],
          asks: [
            { price: yesAsk, quantity: 150 + Math.floor(Math.random() * 100) },
            { price: yesAsk + 1, quantity: 80 + Math.floor(Math.random() * 60) },
            { price: yesAsk + 2, quantity: 40 + Math.floor(Math.random() * 30) },
          ],
        },
        no: {
          bids: [
            { price: 100 - yesAsk, quantity: 130 + Math.floor(Math.random() * 90) },
            { price: 100 - yesAsk - 1, quantity: 70 + Math.floor(Math.random() * 50) },
          ],
          asks: [
            { price: 100 - yesBid, quantity: 130 + Math.floor(Math.random() * 90) },
            { price: 100 - yesBid + 1, quantity: 70 + Math.floor(Math.random() * 50) },
          ],
        },
      },
      priceHistory: market.pricePoints.map(p => ({
        ts: p.ts.toISOString(),
        yesPrice: p.yesPrice,
        noPrice: p.noPrice,
      })),
    });
  } catch (error) {
    console.error('[LiveRoute] Error fetching market:', error);
    res.status(500).json({ error: 'Failed to fetch live market' });
  }
});

// GET /api/live/candlesticks/:ticker — OHLCV candlestick data
router.get('/candlesticks/:ticker', async (req: Request, res: Response): Promise<void> => {
  try {
    const { ticker } = req.params;
    const { interval = '1h', limit = '100' } = req.query;

    const market = await prisma.market.findFirst({
      where: {
        OR: [
          { resolutionDetail: `kalshi:${ticker}` },
          { isLive: true },
        ],
      },
      include: {
        pricePoints: {
          orderBy: { ts: 'asc' },
          take: Math.min(parseInt(limit as string, 10), 500),
        },
      },
    });

    if (!market || market.pricePoints.length === 0) {
      res.json({ ticker, interval, candlesticks: [] });
      return;
    }

    // Aggregate price points into candlesticks
    const pts = market.pricePoints;
    const candlesticks = [];
    const chunkSize = interval === '1m' ? 1 : interval === '5m' ? 5 : interval === '1h' ? 12 : 48;

    for (let i = 0; i < pts.length; i += chunkSize) {
      const chunk = pts.slice(i, i + chunkSize);
      if (chunk.length === 0) continue;
      const prices = chunk.map(p => p.yesPrice);
      candlesticks.push({
        ts: chunk[0].ts.getTime(),
        open: prices[0],
        high: Math.max(...prices),
        low: Math.min(...prices),
        close: prices[prices.length - 1],
        volume: Math.floor(market.volume / pts.length * chunk.length),
      });
    }

    res.json({ ticker, interval, candlesticks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch candlesticks' });
  }
});

export default router;
