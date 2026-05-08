import axios from 'axios';

export class MagicEdenOracle {
  private static BASE_URL = 'https://api-mainnet.magiceden.dev/v2';

  /**
   * Fetches the current floor price of an NFT collection in SOL
   * @param collectionSymbol The symbol of the collection on Magic Eden (e.g., 'mad_lads')
   */
  static async getFloorPrice(collectionSymbol: string): Promise<number | null> {
    try {
      // Note: In production, this requires an API key in the headers
      const response = await axios.get(`${this.BASE_URL}/collections/${collectionSymbol}/stats`);
      
      if (!response.data || typeof response.data.floorPrice === 'undefined') {
        return null;
      }
      
      // Magic Eden returns floorPrice in lamports (usually)
      return response.data.floorPrice / 1_000_000_000;
    } catch (error) {
      console.error('[MagicEdenOracle] Error fetching floor price:', error);
      return null;
    }
  }

  /**
   * Checks if a collection floor is above a target
   */
  static async checkFloorTarget(collectionSymbol: string, targetSol: number): Promise<boolean> {
    const currentFloor = await this.getFloorPrice(collectionSymbol);
    if (currentFloor === null) return false;
    return currentFloor >= targetSol;
  }
}
