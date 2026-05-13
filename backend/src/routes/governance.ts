import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { newId } from '../utils/helpers';

const router = Router();

// Get governance stats
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const xWallet = req.headers['x-wallet'] as string;
    
    const totalStaked = await prisma.stakingPosition.aggregate({
      _sum: { amount: true }
    });

    let myStake = 0;
    let rewardSol = 0;
    if (xWallet) {
      const pos = await prisma.stakingPosition.findUnique({ where: { wallet: xWallet } });
      if (pos) {
        myStake = pos.amount;
        rewardSol = pos.rewardSol;
      }
    }

    res.json({
      totalStaked: totalStaked._sum.amount || 12540880,
      apy: 12.4,
      myStake,
      rewardSol,
      votingPower: myStake
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch governance stats' });
  }
});

// Get proposals
router.get('/proposals', async (_req: Request, res: Response): Promise<void> => {
  try {
    const proposals = await prisma.proposal.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    res.json({ proposals });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch proposals' });
  }
});

// Stake tokens
router.post('/stake', async (req: Request, res: Response): Promise<void> => {
  try {
    const { amount } = req.body as { amount: number };
    const xWallet = req.headers['x-wallet'] as string;

    if (!xWallet) {
      res.status(401).json({ error: 'Wallet not connected' });
      return;
    }

    const pos = await prisma.stakingPosition.upsert({
      where: { wallet: xWallet },
      create: {
        id: newId(),
        wallet: xWallet,
        amount: amount,
        rewardSol: 0
      },
      update: {
        amount: { increment: amount }
      }
    });

    res.json({ success: true, position: pos });
  } catch (error) {
    res.status(500).json({ error: 'Failed to stake tokens' });
  }
});

// Vote on proposal
router.post('/vote/:proposalId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { proposalId } = req.params;
    const { side } = req.body as { side: 'FOR' | 'AGAINST' };
    const xWallet = req.headers['x-wallet'] as string;

    if (!xWallet) {
      res.status(401).json({ error: 'Wallet not connected' });
      return;
    }

    const stake = await prisma.stakingPosition.findUnique({ where: { wallet: xWallet } });
    const weight = stake?.amount || 0;

    if (weight <= 0) {
      res.status(400).json({ error: 'No voting power (stake required)' });
      return;
    }

    await prisma.$transaction([
      prisma.proposalVote.upsert({
        where: { proposalId_wallet: { proposalId, wallet: xWallet } },
        create: {
          id: newId(),
          proposalId,
          wallet: xWallet,
          side,
          weight
        },
        update: {
          side,
          weight
        }
      }),
      prisma.proposal.update({
        where: { id: proposalId },
        data: {
          votesFor: side === 'FOR' ? { increment: weight } : undefined,
          votesAgainst: side === 'AGAINST' ? { increment: weight } : undefined
        }
      })
    ]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record vote' });
  }
});

export default router;
