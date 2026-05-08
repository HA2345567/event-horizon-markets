import { HelioraClient } from '../HelioraClient';

export interface FindMarketsOptions {
  activeOnly?: boolean;
  limit?: number;
}

/**
 * Discovers open markets directly from the blockchain.
 * Returns structured metadata, including plain English resolution criteria.
 */
export async function findMarkets(client: HelioraClient, options?: FindMarketsOptions) {
  return await client.withRetry(async () => {
    let markets = await (client.program.account as any).market.all();

    if (options?.activeOnly) {
      const now = Math.floor(Date.now() / 1000);
      markets = markets.filter(
        (m: any) => !m.account.isSettled && m.account.settlementDeadline.toNumber() > now
      );
    }

    // Sort by created_at descending (newest first)
    markets.sort((a: any, b: any) => b.account.createdAt.toNumber() - a.account.createdAt.toNumber());

    if (options?.limit) {
      markets = markets.slice(0, options.limit);
    }

    return markets.map((m: any) => ({
      publicKey: m.publicKey.toBase58(),
      marketId: m.account.marketId,
      question: m.account.question,
      resolutionCriteria: m.account.resolutionCriteria,
      isSettled: m.account.isSettled,
      outcomesCount: m.account.outcomesCount,
      totalCollateralLocked: m.account.totalCollateralLocked.toString(),
      settlementDeadline: new Date(m.account.settlementDeadline.toNumber() * 1000).toISOString(),
    }));
  });
}
