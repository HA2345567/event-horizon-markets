import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { IDL } from './idl';

dotenv.config();

export class SolanaService {
  private connection: Connection;
  private agentKeypair: Keypair;
  private program: anchor.Program;
  private programId: PublicKey;

  constructor() {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    this.connection = new Connection(rpcUrl, 'confirmed');

    // Load agent keypair or fallback
    const keypairPath = path.resolve(process.cwd(), process.env.AGENT_KEYPAIR_PATH || './scripts/agent-keypair.json');
    if (!fs.existsSync(keypairPath)) {
      console.warn(`[SolanaService] Agent keypair not found at ${keypairPath}. Using ephemeral keypair for dev.`);
      this.agentKeypair = Keypair.generate();
    } else {
      const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, 'utf-8')));
      this.agentKeypair = Keypair.fromSecretKey(secretKey);
    }

    this.programId = new PublicKey(process.env.PROGRAM_ID || 'By5KbxUEFGs7NrQYLXcjmptft6yX2saVWvoA8sx7HzqT');

    // Initialize Anchor Provider
    const wallet = new anchor.Wallet(this.agentKeypair);
    const provider = new anchor.AnchorProvider(this.connection, wallet, {
      preflightCommitment: 'confirmed',
    });

    this.program = new anchor.Program(IDL, provider);
  }

  async getAgentBalance() {
    const balance = await this.connection.getBalance(this.agentKeypair.publicKey);
    return balance / anchor.web3.LAMPORTS_PER_SOL;
  }

  async verifyTransaction(txSig: string): Promise<boolean> {
    try {
      const tx = await this.connection.getTransaction(txSig, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0,
      });
      if (!tx) throw new Error('Transaction not found');
      if (tx.meta?.err) throw new Error('Transaction failed on-chain');
      return true;
    } catch (error) {
      console.error(`[SolanaService] Verification failed for ${txSig}:`, error);
      return false;
    }
  }

  async mintMockUsdc(targetWallet: string, amount: number) {
    // In a real devnet environment with spl-token, this would use mintTo
    // For now, we will simulate it, or assume the agent wallet transfers it
    // Actually using spl-token transfer:
    try {
      const { getOrCreateAssociatedTokenAccount, transfer } = await import('@solana/spl-token');
      const targetPubkey = new PublicKey(targetWallet);
      const collateralMint = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");

      const agentAta = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.agentKeypair,
        collateralMint,
        this.agentKeypair.publicKey
      );

      const userAta = await getOrCreateAssociatedTokenAccount(
        this.connection,
        this.agentKeypair,
        collateralMint,
        targetPubkey
      );

      const txSig = await transfer(
        this.connection,
        this.agentKeypair,
        agentAta.address,
        userAta.address,
        this.agentKeypair,
        amount * 1_000_000 // 6 decimals
      );

      console.log(`✅ Airdropped ${amount} USDC to ${targetWallet}. TX: ${txSig}`);
      return txSig;
    } catch (err: any) {
      console.error('❌ Failed to airdrop mock USDC:', err.message);
      // Fallback for dev mode without real tokens: just return success
      return `simulated_tx_${Date.now()}`;
    }
  }

  private getMarketIdNum(uuid: string): number {
    // Deterministically generate a u32 from the market UUID
    const hash = Buffer.from(uuid.replace(/-/g, ''), 'hex');
    return hash.readUInt32LE(0);
  }

  async createMarketOnChain(marketData: { id: string; endsAt: Date }) {
    try {
      console.log(`[SolanaService] Creating market on-chain: ${marketData.id}`);

      const marketIdNum = this.getMarketIdNum(marketData.id);
      const marketIdBytes = Buffer.alloc(4);
      marketIdBytes.writeUInt32LE(marketIdNum, 0);

      const [marketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('market'), marketIdBytes],
        this.programId
      );
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), marketIdBytes],
        this.programId
      );
      const [outcomeAMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('outcome_a'), marketIdBytes],
        this.programId
      );
      const [outcomeBMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('outcome_b'), marketIdBytes],
        this.programId
      );

      // Devnet USDC placeholder (or any token)
      const collateralMint = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");

      const deadline = new anchor.BN(Math.floor(marketData.endsAt.getTime() / 1000));

      const tx = await this.program.methods
        .initializeMarket(marketIdNum, deadline)
        .accounts({
          market: marketPda,
          authority: this.agentKeypair.publicKey,
          collateralMint: collateralMint,
          collateralVault: vaultPda,
          outcomeAMint: outcomeAMintPda,
          outcomeBMint: outcomeBMintPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .rpc();

      console.log(`✅ Market created on-chain. TX: ${tx}`);
      return { tx, marketPda: marketPda.toBase58() };
    } catch (error: any) {
      console.error(`❌ Failed to create market on-chain:`, error.message);
      // Don't throw to prevent crashing the agent runner if solana devnet is down
    }
  }

  async resolveMarketOnChain(marketId: string, outcome: 'YES' | 'NO' | 'INVALID') {
    try {
      console.log(`[SolanaService] Resolving market on-chain: ${marketId} -> ${outcome}`);
      const marketIdNum = this.getMarketIdNum(marketId);
      const marketIdBytes = Buffer.alloc(4);
      marketIdBytes.writeUInt32LE(marketIdNum, 0);

      const [marketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('market'), marketIdBytes],
        this.programId
      );
      const [outcomeAMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('outcome_a'), marketIdBytes],
        this.programId
      );
      const [outcomeBMintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('outcome_b'), marketIdBytes],
        this.programId
      );

      // OutcomeA = YES, OutcomeB = NO, Neither = INVALID
      let winnerEnum: any = { outcomeA: {} }; // For Anchor enum
      if (outcome === 'YES') winnerEnum = { outcomeA: {} };
      else if (outcome === 'NO') winnerEnum = { outcomeB: {} };
      else winnerEnum = { neither: {} };

      const tx = await this.program.methods
        .setWinningSide(marketIdNum, winnerEnum)
        .accounts({
          authority: this.agentKeypair.publicKey,
          market: marketPda,
          outcomeAMint: outcomeAMintPda,
          outcomeBMint: outcomeBMintPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();

      console.log(`✅ Market resolved on-chain. TX: ${tx}`);
      return tx;
    } catch (error: any) {
      console.error(`❌ Failed to resolve market on-chain:`, error.message);
    }
  }
}

export const solanaService = new SolanaService();
