/**
 * Kalshi Market Data Service
 * Fetches real-time market data from Kalshi's public API and syncs
 * it into the local SQLite database so all agents can trade on live markets.
 */

import { prisma } from '../prisma';
import { newId, generatePriceHistory } from './helpers';

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2';
const POLYMARKET_BASE = 'https://gamma-api.polymarket.com';

// Public Kalshi API — no auth needed for market list
export async function fetchKalshiMarkets(limit = 100): Promise<any[]> {
  try {
    const res = await fetch(`${KALSHI_BASE}/markets?limit=${limit}&status=open`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`Kalshi API error: ${res.status}`);
    const data = await res.json() as { markets?: any[] };
    return data.markets ?? [];
  } catch (e) {
    return [];
  }
}

export const fetchExternalMarkets = fetchKalshiMarkets;

export async function fetchPolymarketMarkets(limit = 100): Promise<any[]> {
  try {
    const res = await fetch(`${POLYMARKET_BASE}/markets?limit=${limit}&active=true&closed=false`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`Polymarket API error: ${res.status}`);
    return await res.json() as any[];
  } catch (e) {
    console.error('[MarketDataService] Polymarket fetch failed:', e);
    return [];
  }
}

function mapExternalCategory(category: string, title: string = ''): string {
  const c = (category || '').toLowerCase() + ' ' + (title || '').toLowerCase();
  if (c.includes('crypto') || c.includes('bitcoin') || c.includes('eth') || c.includes('solana') || c.includes('token')) return 'Crypto';
  if (c.includes('politic') || c.includes('election') || c.includes('president') || c.includes('senate') || c.includes('modi') || c.includes('house') || c.includes('vote') || c.includes('democrat') || c.includes('republican') || c.includes('independence') || c.includes('government')) return 'Politics';
  if (c.includes('sport') || c.includes('nfl') || c.includes('nba') || c.includes('soccer') || c.includes('cricket') || c.includes('ipl') || c.includes('t20') || c.includes('ncaa')) return 'Sports';
  if (c.includes('ai') || c.includes('tech') || c.includes('openai') || c.includes('nvidia') || c.includes('llm') || c.includes('anthropic') || c.includes('apple') || c.includes('google') || c.includes('sora')) return 'AI';
  if (c.includes('economy') || c.includes('fed') || c.includes('rate') || c.includes('inflation') || c.includes('defi') || c.includes('yield') || c.includes('usdt') || c.includes('usdc') || c.includes('staking') || c.includes('gdp') || c.includes('jobs')) return 'DeFi'; 
  if (c.includes('weather') || c.includes('temp') || c.includes('storm') || c.includes('hurricane') || c.includes('climate')) return 'Weather';
  if (c.includes('meme') || c.includes('doge') || c.includes('pepe') || c.includes('shib')) return 'Memes';
  if (c.includes('nft') || c.includes('bored ape') || c.includes('punk') || c.includes('floor')) return 'NFTs';
  if (c.includes('culture') || c.includes('movie') || c.includes('oscar') || c.includes('grammy') || c.includes('social') || c.includes('twitter') || c.includes('x.com') || c.includes('celebrity')) return 'Social';
  return 'Politics'; 
}

function getCategoryImage(category: string): string {
  const images: Record<string, string> = {
    'Crypto': 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&q=80&w=800',
    'Politics': 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&q=80&w=800',
    'Sports': 'https://images.unsplash.com/photo-1531415074968-036ba1b575da?auto=format&fit=crop&q=80&w=800',
    'AI': 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800',
    'DeFi': 'https://images.unsplash.com/photo-1639762681057-408e52192e55?auto=format&fit=crop&q=80&w=800',
    'Memes': 'https://images.unsplash.com/photo-1620712943543-bcc4628c71d5?auto=format&fit=crop&q=80&w=800',
    'NFTs': 'https://images.unsplash.com/photo-1620712943543-bcc4628c71d5?auto=format&fit=crop&q=80&w=800',
    'Social': 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&q=80&w=800',
  };
  return images[category] || images['Crypto'];
}

export async function clearAllMarkets(): Promise<void> {
  console.log('[MarketDataService] Clearing all existing markets...');
  await prisma.pricePoint.deleteMany({});
  await prisma.trade.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.market.deleteMany({});
}

export async function syncKalshiMarkets(): Promise<number> {
  console.log('[MarketDataService] Syncing live Kalshi markets...');
  const raw = await fetchKalshiMarkets(200);
  if (raw.length === 0) return 0;

  let synced = 0;
  for (const m of raw) {
    try {
      const ticker: string = m.ticker ?? m.market_id ?? '';
      let question: string = m.title ?? m.question ?? ticker;
      const subtitle: string = m.subtitle ?? m.yes_sub_title ?? '';
      const closeTime: string = m.close_time ?? m.expiration_time ?? m.latest_expiration_time ?? '';
      
      const yesAsk = parseFloat(String(m.yes_ask ?? m.yes_ask_dollars ?? '0.50'));
      const yesBid = parseFloat(String(m.yes_bid ?? m.yes_bid_dollars ?? '0.50'));
      const yesPrice = Math.max(0.01, Math.min(0.99, (yesAsk + yesBid) / 2));
      
      const volumeStr = String(m.volume_24h_fp ?? m.volume_fp ?? m.volume_24h ?? '0');
      const volume: number = parseFloat(volumeStr);
      const openInterest: number = parseFloat(String(m.open_interest_fp ?? m.open_interest ?? '0'));
      const status: string = m.status ?? 'open';

      if (!ticker || !question || !closeTime || isNaN(yesPrice)) continue;
      if (status !== 'open' && status !== 'active') continue;

      const endsAt = new Date(closeTime);
      if (isNaN(endsAt.getTime()) || endsAt < new Date()) continue;

      const category = mapExternalCategory(m.category ?? m.event_category ?? '');

      // FILTER: Aggressively block parlay-style junk and micro-stats
      const qLower = question.toLowerCase();
      const isJunk = question.includes(',') || 
                     question.includes(':') || 
                     qLower.startsWith('yes ') ||
                     qLower.startsWith('no ') ||
                     qLower.includes('player prop') || 
                     qLower.includes('pointers') || 
                     qLower.includes('rebounds') || 
                     qLower.includes('assists') || 
                     qLower.includes('yards') || 
                     qLower.includes('touchdown') ||
                     qLower.includes('over ') || 
                     qLower.includes('under ') ||
                     qLower.includes('scored by') ||
                     qLower.includes('wins by') ||
                     qLower.includes('strikeouts') ||
                     qLower.includes('home run') ||
                     (volume < 100 && openInterest < 50); // Higher threshold for quality
      
      if (isJunk) continue;

      const exists = await prisma.market.findFirst({ where: { resolutionDetail: `kalshi:${ticker}` } });
      if (exists) continue;

      const marketId = newId();
      await prisma.market.create({
        data: {
          id: marketId,
          question: question.slice(0, 250),
          description: subtitle || `Live prediction market from Kalshi. Ticker: ${ticker}`,
          category,
          resolution: 'AIOracle',
          resolutionDetail: `kalshi:${ticker}`,
          endsAt,
          yesPrice,
          noPrice: Math.max(0.01, 1 - yesPrice),
          liquidity: openInterest > 0 ? openInterest / 100 : 1000,
          volume: volume,
          participants: Math.floor(volume / 10) + Math.floor(Math.random() * 50),
          isLive: true,
          creator: JSON.stringify({ wallet: 'kalshi_bridge.sol', handle: 'Kalshi' }),
          imageUrl: getCategoryImage(category),
        },
      });

      const history = generatePriceHistory(yesPrice, 48);
      const now = Date.now();
      const interval = (7 * 24 * 60 * 60 * 1000) / history.length; 

      await prisma.pricePoint.createMany({
        data: history.map((p, i) => ({
          id: newId(),
          marketId,
          yesPrice: p,
          noPrice: Math.max(0.01, 1 - p),
          ts: new Date(now - (history.length - 1 - i) * interval),
        })),
      });
      synced++;
    } catch (e) {
      console.error('[MarketDataService] Kalshi sync item error:', e);
    }
  }
  return synced;
}

export async function syncPolymarketMarkets(): Promise<number> {
  console.log('[MarketDataService] Syncing live Polymarket markets...');
  const raw = await fetchPolymarketMarkets(100);
  if (raw.length === 0) return 0;

  let synced = 0;
  for (const m of raw) {
    try {
      const id: string = m.id || m.clobTokenIds?.[0] || '';
      
      const event = m.events?.[0] || {};
      const question: string = m.question || event.title || event.question || '';
      const description: string = m.description || event.description || '';
      const endsAtRaw: string = m.endDate || m.end_date || event.endDate || '';
      
      let outcomePrices = m.outcomePrices || m.outcome_prices || [];
      if (typeof outcomePrices === 'string') {
        try { outcomePrices = JSON.parse(outcomePrices); } catch { outcomePrices = []; }
      }
      
      const yesPrice = parseFloat(String(outcomePrices[0] || m.lastTradePrice || '0.5'));
      const volume = parseFloat(String(m.volume || m.volume24hr || m.volumeNum || '0'));
      
      if (!id || !question || !endsAtRaw || isNaN(yesPrice)) continue;
      
      const endsAt = new Date(endsAtRaw);
      if (isNaN(endsAt.getTime()) || endsAt < new Date()) continue;

      const category = mapExternalCategory(m.group_name || m.category || event.category || '', question);

      const exists = await prisma.market.findFirst({ where: { resolutionDetail: `poly:${id}` } });
      if (exists) continue;

      const marketId = newId();
      await prisma.market.create({
        data: {
          id: marketId,
          question: question.slice(0, 250),
          description: (description || '').slice(0, 500) || `Live prediction market from Polymarket. ID: ${id}`,
          category,
          resolution: 'AIOracle',
          resolutionDetail: `poly:${id}`,
          endsAt,
          yesPrice,
          noPrice: Math.max(0.01, 1 - yesPrice),
          liquidity: volume > 0 ? volume * 0.05 : 1000,
          volume: volume,
          participants: Math.floor(volume / 50) + Math.floor(Math.random() * 100),
          isLive: true,
          creator: JSON.stringify({ wallet: 'poly_bridge.sol', handle: 'Polymarket' }),
          imageUrl: m.image || event.image || getCategoryImage(category),
        },
      });

      const history = generatePriceHistory(yesPrice, 48);
      const now = Date.now();
      const interval = (7 * 24 * 60 * 60 * 1000) / history.length;

      await prisma.pricePoint.createMany({
        data: history.map((p, i) => ({
          id: newId(),
          marketId,
          yesPrice: p,
          noPrice: Math.max(0.01, 1 - p),
          ts: new Date(now - (history.length - 1 - i) * interval),
        })),
      });
      synced++;
    } catch (e) {
      console.error('[MarketDataService] Polymarket sync item error:', e);
    }
  }
  return synced;
}

export const FALLBACK_MARKETS = [
  {
    question: '2028 Democratic presidential nominee',
    description: 'Resolves to the official nominee of the Democratic Party for the 2028 US Presidential Election.',
    category: 'Politics',
    yesPrice: 0.26,
    volume: 104618102,
    participants: 45,
    daysFromNow: 800,
    imageUrl: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&q=80&w=800',
  },
  {
    question: '2028 Republican presidential nominee',
    description: 'Resolves to the official nominee of the Republican Party for the 2028 US Presidential Election.',
    category: 'Politics',
    yesPrice: 0.36,
    volume: 85200400,
    participants: 38,
    daysFromNow: 800,
    imageUrl: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&q=80&w=800',
  },
  {
    question: 'Los Angeles Mayor winner?',
    description: 'Resolves to the winner of the upcoming Los Angeles mayoral election.',
    category: 'Politics',
    yesPrice: 0.50,
    volume: 6064543,
    participants: 10,
    daysFromNow: 24,
    imageUrl: 'https://images.unsplash.com/photo-1505542403711-370ad531a78d?auto=format&fit=crop&q=80&w=800',
  },
  {
    question: '2028 U.S. Presidential Election winner?',
    description: 'Resolves to the winner of the 2028 United States Presidential Election.',
    category: 'Politics',
    yesPrice: 0.20,
    volume: 150000000,
    participants: 120,
    daysFromNow: 900,
    imageUrl: 'https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?auto=format&fit=crop&q=80&w=800',
  },
  {
    question: 'Will Bitcoin reach $150,000 in 2026?',
    description: 'Resolves YES if BTC/USD spot price reaches $150k on any major exchange.',
    category: 'Crypto',
    yesPrice: 0.68,
    volume: 12500000,
    participants: 45000,
    daysFromNow: 180,
    imageUrl: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?auto=format&fit=crop&q=80&w=800',
  },
  {
    question: 'Will Pepe (PEPE) flip Shiba Inu (SHIB) in market cap?',
    description: 'Resolves YES if PEPE market capitalization exceeds SHIB market capitalization.',
    category: 'Memes',
    yesPrice: 0.35,
    volume: 4500000,
    participants: 12000,
    daysFromNow: 120,
    imageUrl: 'https://images.unsplash.com/photo-1620712943543-bcc4628c71d5?auto=format&fit=crop&q=80&w=800',
  },
  {
    question: 'Will OpenAI release an ASI (Superintelligence) model before 2027?',
    description: 'Resolves YES if OpenAI makes a public announcement regarding an ASI model release.',
    category: 'AI',
    yesPrice: 0.28,
    volume: 9500000,
    participants: 35000,
    daysFromNow: 220,
    imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&q=80&w=800',
  },
  {
    question: 'Will X (Twitter) launch a crypto wallet in 2026?',
    description: 'Resolves YES if X officially launches a built-in cryptocurrency wallet.',
    category: 'Social',
    yesPrice: 0.55,
    volume: 5200000,
    participants: 18000,
    daysFromNow: 150,
    imageUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?auto=format&fit=crop&q=80&w=800',
  },
];

export async function seedFallbackMarkets(): Promise<void> {
  console.log('[MarketDataService] Seeding fallback real-time markets...');
  for (const m of FALLBACK_MARKETS) {
    const existing = await prisma.market.findFirst({ where: { question: m.question } });
    if (existing) continue;

    const marketId = newId();
    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + m.daysFromNow);

    await prisma.market.create({
      data: {
        id: marketId,
        question: m.question,
        description: m.description,
        category: m.category,
        resolution: 'AIOracle',
        resolutionDetail: `heliora:${marketId.slice(0, 8)}`,
        endsAt,
        yesPrice: m.yesPrice,
        noPrice: parseFloat((1 - m.yesPrice).toFixed(2)),
        liquidity: m.volume * 0.1,
        volume: m.volume,
        participants: m.participants,
        isLive: true,
        creator: JSON.stringify({ wallet: 'heliora_system.sol', handle: 'Heliora' }),
        imageUrl: m.imageUrl,
      },
    });

    // Seed price history with a realistic trend toward current price
    const history = generatePriceHistory(0.5, 100);
    // Nudge last price toward actual yesPrice
    const adjustedHistory = history.map((p, i) => {
      const blend = i / history.length;
      return p * (1 - blend) + m.yesPrice * blend;
    });

    await prisma.pricePoint.createMany({
      data: adjustedHistory.map((p, i) => {
        const now = Date.now();
        const interval = (30 * 24 * 60 * 60 * 1000) / adjustedHistory.length; // 30 days spread for fallback
        return {
          id: newId(),
          marketId,
          yesPrice: parseFloat(Math.max(0.01, Math.min(0.99, p)).toFixed(4)),
          noPrice: parseFloat(Math.max(0.01, Math.min(0.99, 1 - p)).toFixed(4)),
          ts: new Date(now - (adjustedHistory.length - 1 - i) * interval),
        };
      }),
    });
  }
  console.log(`[MarketDataService] Seeded ${FALLBACK_MARKETS.length} fallback markets.`);
}
