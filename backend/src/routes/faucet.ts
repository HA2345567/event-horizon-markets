import { Router, Request, Response } from 'express';
import { solanaService } from '../utils/solana-service';

const router = Router();

router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { wallet, amount } = req.body;
    if (!wallet) {
      res.status(400).json({ error: 'Wallet address required' });
      return;
    }
    const requestedAmount = amount || 1000;
    
    // In production, add rate limiting or CAPTCHA here
    const txSig = await solanaService.mintMockUsdc(wallet, requestedAmount);
    
    res.json({ success: true, txSig, amount: requestedAmount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
