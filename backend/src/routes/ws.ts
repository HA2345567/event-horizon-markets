import { WebSocket, WebSocketServer } from 'ws';
import { prisma } from '../index';
import { newId } from '../utils/helpers';

const MAX_CONNECTIONS_PER_MARKET = 50;
const PRICE_PERSIST_EVERY_N_TICKS = 4; // ~6s instead of 1.5s
const TICK_SLEEP_SEC = 1500; // milliseconds

const activeConnections: Map<string, WebSocket[]> = new Map();
const priceTrackers: Map<string, number> = new Map();

export function initializeWebSocket(wss: WebSocketServer) {
  wss.on('connection', async (ws: WebSocket, req) => {
    const url = req.url || '';
    const marketIdMatch = url.match(/\/ws\/([^/?]+)/);

    if (!marketIdMatch) {
      ws.close(1008, 'Market ID required');
      return;
    }

    const marketId = marketIdMatch[1];
    let market = await prisma.market.findUnique({
      where: { id: marketId },
    });

    if (!market) {
      market = await prisma.market.findFirst({
        where: { resolutionDetail: `kalshi:${marketId}` },
      });
    }

    // Fallback: Try matching by short UUID prefix
    if (!market) {
      market = await prisma.market.findFirst({
        where: { id: { startsWith: marketId.toLowerCase() } },
      });
    }

    if (!market) {
      ws.close(1008, 'Market not found');
      return;
    }

    const realId = market.id;
    const isLive = market.isLive;
    const tickInterval = isLive ? 400 : TICK_SLEEP_SEC;

    // Check connection cap
    const conns = activeConnections.get(realId) || [];
    if (conns.length >= MAX_CONNECTIONS_PER_MARKET) {
      ws.close(1013, 'Connection cap exceeded');
      return;
    }

    conns.push(ws);
    activeConnections.set(realId, conns);

    console.log(`✓ WebSocket connected for market ${realId} (Live: ${isLive}, Interval: ${tickInterval}ms)`);

    let currentPrice = market.yesPrice;
    let tick = 0;

    const priceUpdateInterval = setInterval(async () => {
      try {
        // Generate realistic price movement
        // Live markets have higher volatility
        const driftScale = isLive ? 0.025 : 0.012;
        const drift = (Math.random() - 0.5) * driftScale;
        currentPrice = Math.max(0.02, Math.min(0.98, currentPrice + drift));
        const rounded = parseFloat(currentPrice.toFixed(4));

        tick++;

        // Update market document - Use non-blocking update for latency
        prisma.market.update({
          where: { id: realId },
          data: {
            yesPrice: rounded,
            noPrice: parseFloat((1 - rounded).toFixed(4)),
          },
        }).catch(err => {
          if (err.code === 'P2025') {
            clearInterval(priceUpdateInterval);
          }
        });

        // Persist price points less frequently for live markets to save DB I/O
        const persistFrequency = isLive ? 10 : PRICE_PERSIST_EVERY_N_TICKS;
        if (tick % persistFrequency === 0) {
          prisma.pricePoint.create({
            data: {
              id: newId(),
              marketId: realId,
              yesPrice: rounded,
              noPrice: parseFloat((1 - rounded).toFixed(4)),
            },
          }).catch(() => {});
        }

        // Generate orderbook snapshot
        const buyYes = [];
        const sellYes = [];
        const levels = isLive ? 8 : 15; // Fewer levels for live to reduce payload size
        for (let i = 1; i <= levels; i++) {
          buyYes.push({
            price: parseFloat(Math.max(0.01, rounded - (i * 0.004)).toFixed(4)),
            size: Math.round(150 + Math.random() * 900)
          });
          sellYes.push({
            price: parseFloat(Math.min(0.99, rounded + (i * 0.004)).toFixed(4)),
            size: Math.round(150 + Math.random() * 900)
          });
        }
        
        // Broadcast immediately
        const message = JSON.stringify({
          type: 'price',
          yesPrice: rounded,
          noPrice: parseFloat((1 - rounded).toFixed(4)),
          orderbook: { buyYes, sellYes },
          ts: Date.now(),
        });

        const targets = activeConnections.get(realId);
        if (targets) {
          for (const client of targets) {
            if (client.readyState === WebSocket.OPEN) {
              client.send(message);
            }
          }
        }
      } catch (error) {
        console.error(`WebSocket error for market ${realId}:`, error);
      }
    }, tickInterval);

    ws.on('close', () => {
      clearInterval(priceUpdateInterval);
      const conns = activeConnections.get(realId) || [];
      const index = conns.indexOf(ws);
      if (index > -1) {
        conns.splice(index, 1);
      }
      if (conns.length === 0) {
        activeConnections.delete(realId);
        priceTrackers.delete(realId);
      }
      console.log(`✗ WebSocket disconnected for market ${realId}`);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error: ${error}`);
      clearInterval(priceUpdateInterval);
    });
  });
}

export { activeConnections };
