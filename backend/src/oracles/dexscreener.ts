import axios from 'axios';

export interface DexScreenerToken {
  chainId: string;
  dexId: string;
  url: string;
  pairAddress: string;
  baseToken: {
    address: string;
    name: string;
    symbol: string;
  };
  priceUsd: string;
  fdv: number;
  marketCap: number;
  volume: {
    h24: number;
    h6: number;
    h1: number;
    m5: number;
  };
}

export class DexScreenerOracle {
  private static BASE_URL = 'https://api.dexscreener.com/latest/dex/tokens';

  /**
   * Fetches the current market cap of a token on Solana
   * @param tokenAddress The mint address of the token
   */
  static async getMarketCap(tokenAddress: string): Promise<number | null> {
    try {
      const response = await axios.get(`${this.BASE_URL}/${tokenAddress}`);
      const pairs: DexScreenerToken[] = response.data.pairs;
      
      if (!pairs || pairs.length === 0) return null;
      
      // Filter for Solana pairs and find the one with the highest liquidity/volume
      const solanaPairs = pairs.filter(p => p.chainId === 'solana');
      if (solanaPairs.length === 0) return null;
      
      // DexScreener FDV is often a better proxy for 'market cap' in early tokens
      const topPair = solanaPairs[0];
      return topPair.marketCap || topPair.fdv || 0;
    } catch (error) {
      console.error('[DexScreenerOracle] Error fetching market cap:', error);
      return null;
    }
  }

  /**
   * Checks if a token has reached a target market cap
   */
  static async checkMarketCapTarget(tokenAddress: string, targetCap: number): Promise<boolean> {
    const currentCap = await this.getMarketCap(tokenAddress);
    if (currentCap === null) return false;
    return currentCap >= targetCap;
  }
}
