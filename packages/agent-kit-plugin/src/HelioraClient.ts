import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import { IDL } from './idl';

export class HelioraClient {
  public connection: Connection;
  public program: Program<any>; // Use any to bypass strict IDL checks for now
  public wallet: anchor.Wallet;

  constructor(connection: Connection, keypair: Keypair) {
    this.connection = connection;
    this.wallet = new anchor.Wallet(keypair);
    const provider = new anchor.AnchorProvider(this.connection, this.wallet, {
      preflightCommitment: 'confirmed',
    });
    this.program = new Program(IDL, provider);
  }

  async withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await fn();
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }
    throw new Error('Unreachable');
  }
}
