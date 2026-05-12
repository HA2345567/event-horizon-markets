import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { newId } from '../utils/helpers';

const router = Router();

// Helper to ensure user exists
async function ensureUser(wallet: string) {
  let user = await prisma.user.findUnique({
    where: { wallet }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        id: newId(),
        wallet: wallet,
        handle: `user_${wallet.slice(0, 4)}...${wallet.slice(-4)}`
      }
    });
  }
  return user;
}

// ─── Watchlist ─────────────────────────────────────────────────────────────

// Toggle watchlist status
router.post('/watchlist/toggle', async (req: Request, res: Response): Promise<void> => {
  try {
    const { marketId } = req.body;
    const wallet = req.headers['x-wallet'] as string;

    if (!wallet) {
      res.status(401).json({ error: 'Wallet not connected' });
      return;
    }

    const user = await ensureUser(wallet);

    const existing = await prisma.watchlist.findUnique({
      where: {
        userId_marketId: {
          userId: user.id,
          marketId
        }
      }
    });

    if (existing) {
      await prisma.watchlist.delete({
        where: { id: existing.id }
      });
      res.json({ status: 'removed', marketId });
    } else {
      await prisma.watchlist.create({
        data: {
          id: newId(),
          userId: user.id,
          marketId
        }
      });
      res.json({ status: 'added', marketId });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to toggle watchlist' });
  }
});

// Get user's watchlist
router.get('/watchlist', async (req: Request, res: Response): Promise<void> => {
  try {
    const wallet = req.headers['x-wallet'] as string;
    if (!wallet) {
      res.json({ markets: [] });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { wallet },
      include: {
        watchlist: {
          include: { market: true }
        }
      }
    });

    res.json({ markets: user?.watchlist.map(w => w.market) || [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch watchlist' });
  }
});

// ─── Alerts ────────────────────────────────────────────────────────────────

// Set an alert
router.post('/alerts', async (req: Request, res: Response): Promise<void> => {
  try {
    const { marketId, type, threshold } = req.body;
    const wallet = req.headers['x-wallet'] as string;

    if (!wallet) {
      res.status(401).json({ error: 'Wallet not connected' });
      return;
    }

    const user = await ensureUser(wallet);

    const alert = await prisma.alert.create({
      data: {
        id: newId(),
        userId: user.id,
        marketId,
        type, // price_above, price_below, resolved
        threshold: threshold ? parseFloat(threshold) : null
      }
    });

    res.status(201).json({ alert });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create alert' });
  }
});

// Get user's alerts
router.get('/alerts', async (req: Request, res: Response): Promise<void> => {
  try {
    const wallet = req.headers['x-wallet'] as string;
    if (!wallet) {
      res.json({ alerts: [] });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { wallet },
      include: { alerts: { include: { market: true } } }
    });

    res.json({ alerts: user?.alerts || [] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

// Delete alert
router.delete('/alerts/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    await prisma.alert.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

export default router;
