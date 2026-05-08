import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { HelioraClient } from '../HelioraClient';

/**
 * Fetches all open positions for a given wallet.
 * Returns the token balance for each outcome mint associated with Heliora markets.
 */
export async function getPositions(client: HelioraClient, walletAddress: string) {
  return await client.withRetry(async () => {
    const owner = new PublicKey(walletAddress);
    
    // In a real implementation, we'd fetch all markets first to know which mints to check
    // or use a specialized indexer. For this plugin, we'll fetch active markets first.
    const markets = await (client.program.account as any).market.all();
    const positions = [];

    for (const m of markets) {
      const account: any = m.account;
      for (let i = 0; i < account.outcomesCount; i++) {
        const mint = account.outcomeMints[i];
        const ata = await getAssociatedTokenAddress(mint, owner);
        
        try {
          const balance = await client.connection.getTokenAccountBalance(ata);
          if (balance.value.uiAmount && balance.value.uiAmount > 0) {
            positions.push({
              marketId: account.marketId,
              question: account.question,
              outcomeIndex: i,
              balance: balance.value.uiAmount,
              mint: mint.toBase58(),
            });
          }
        } catch (e) {
          // Token account likely doesn't exist, which is fine
        }
      }
    }

    return positions;
  });
}
