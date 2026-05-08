import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { HelioraClient } from '../HelioraClient';

/**
 * Fetches full market details, liquidity, and resolution rules.
 * @param client The HelioraClient instance
 * @param marketId The u32 market ID
 */
export async function getMarket(client: HelioraClient, marketId: number) {
  return await client.withRetry(async () => {
    const marketIdBytes = Buffer.alloc(4);
    marketIdBytes.writeUInt32LE(marketId, 0);

    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('market'), marketIdBytes],
      client.program.programId
    );

    const account: any = await (client.program.account as any).market.fetch(marketPda);

    return {
      publicKey: marketPda.toBase58(),
      marketId: account.marketId,
      question: account.question,
      resolutionCriteria: account.resolutionCriteria,
      isSettled: account.isSettled,
      winningOutcomeIndex: account.winningOutcomeIndex,
      outcomesCount: account.outcomesCount,
      totalCollateralLocked: account.totalCollateralLocked.toString(),
      settlementDeadline: new Date(account.settlementDeadline.toNumber() * 1000).toISOString(),
      createdAt: new Date(account.createdAt.toNumber() * 1000).toISOString(),
      poolInitialized: account.poolInitialized,
      resolutionSource: Object.keys(account.resolutionSource)[0],
      strikePrice: account.strikePrice?.toString(),
      pythFeed: account.pythFeed?.toBase58(),
    };
  });
}
