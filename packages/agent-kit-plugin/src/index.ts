import { Connection, Keypair } from '@solana/web3.js';
import { HelioraClient } from './HelioraClient';
import * as actions from './actions';

export * from './HelioraClient';
export * from './actions';

/**
 * Official Heliora Plugin for Solana Agent Kit
 */
export class HelioraPlugin {
  private client: HelioraClient;

  constructor(connection: Connection, keypair: Keypair) {
    this.client = new HelioraClient(connection, keypair);
  }

  // Expose actions as bound methods for easy tool calling
  async findMarkets(filters?: actions.FindMarketsOptions) {
    return actions.findMarkets(this.client, filters);
  }

  async getMarket(marketId: number) {
    return actions.getMarket(this.client, marketId);
  }

  async placeBet(marketId: number, side: number, amount: number) {
    return actions.placeBet(this.client, marketId, side, amount);
  }

  async getPositions(wallet: string) {
    return actions.getPositions(this.client, wallet);
  }

  async claimWinnings(marketId: number) {
    return actions.claimWinnings(this.client, marketId);
  }

  async createMarket(params: actions.CreateMarketParams) {
    return actions.createMarket(this.client, params);
  }

  async getMarketHistory(marketId: string, apiBaseUrl?: string) {
    return actions.getMarketHistory(this.client, marketId, apiBaseUrl);
  }

  /**
   * Returns a list of tools for LangChain/OpenAI integration
   */
  getTools() {
    return [
      {
        name: 'heliora_find_markets',
        description: 'Find open prediction markets on Heliora with odds and metadata.',
        execute: this.findMarkets.bind(this),
      },
      {
        name: 'heliora_place_bet',
        description: 'Place a bet on a Heliora prediction market outcome.',
        execute: this.placeBet.bind(this),
      },
      {
        name: 'heliora_create_market',
        description: 'Deploy a new prediction market on Solana with custom truth conditions.',
        execute: this.createMarket.bind(this),
      },
      // ... other tools
    ];
  }
}
