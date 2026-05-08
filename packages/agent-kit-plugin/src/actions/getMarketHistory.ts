import { HelioraClient } from '../HelioraClient';

/**
 * Fetches historical odds and volume for a market.
 * Note: On-chain Solana state only stores current balance. 
 * This action attempts to fetch from the Heliora indexing API if provided.
 */
export async function getMarketHistory(client: HelioraClient, marketId: string, apiBaseUrl?: string) {
  if (!apiBaseUrl) {
    console.warn('[HelioraPlugin] No apiBaseUrl provided for getMarketHistory. Returning current state.');
    return [];
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/markets/${marketId}/history`);
    if (!response.ok) return [];
    return await response.json();
  } catch (e) {
    console.error('[HelioraPlugin] Failed to fetch market history:', e);
    return [];
  }
}
