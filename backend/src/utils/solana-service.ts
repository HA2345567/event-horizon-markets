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

    const keypairPath = path.resolve(process.cwd(), process.env.AGENT_KEYPAIR_PATH || './scripts/agent-keypair.json');
    if (!fs.existsSync(keypairPath)) {
      this.agentKeypair = Keypair.generate();
    } else {
      const secretKey = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, 'utf-8')));
      this.agentKeypair = Keypair.fromSecretKey(secretKey);
    }

    this.programId = new PublicKey(process.env.PROGRAM_ID || 'By5KbxUEFGs7NrQYLXcjmptft6yX2saVWvoA8sx7HzqT');
    const wallet = new anchor.Wallet(this.agentKeypair);
    const provider = new anchor.AnchorProvider(this.connection, wallet, { preflightCommitment: 'confirmed' });
    this.program = new anchor.Program(IDL, provider);
  }

  private getMarketIdNum(uuid: string): number {
    if (!uuid || typeof uuid !== 'string') return Math.floor(Math.random() * 0xFFFFFFFF);
    try {
      const hash = Buffer.from(uuid.replace(/-/g, ''), 'hex');
      return hash.readUInt32LE(0);
    } catch (e) {
      return Math.floor(Math.random() * 0xFFFFFFFF);
    }
  }

  async createMarketOnChain(marketData: { 
    id: string; 
    question: string;
    endsAt: Date;
    outcomesCount?: number;
    resolutionSource?: string;
    strikePrice?: number;
    pythFeed?: string;
  }) {
    try {
      const outcomesCount = marketData.outcomesCount || 2;
      const resSource = marketData.resolutionSource || 'authority';
      const resolutionSource = { [resSource.charAt(0).toUpperCase() + resSource.slice(1)]: {} };
      
      const marketIdNum = this.getMarketIdNum(marketData.id);
      const marketIdBytes = Buffer.alloc(4);
      marketIdBytes.writeUInt32LE(marketIdNum, 0);

      const [marketPda] = PublicKey.findProgramAddressSync([Buffer.from('market'), marketIdBytes], this.programId);
      const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from('vault'), marketIdBytes], this.programId);

      const outcomeMints = [];
      for (let i = 0; i < outcomesCount; i++) {
        const [mintPda] = PublicKey.findProgramAddressSync([Buffer.from(`outcome_${i}`), marketIdBytes], this.programId);
        outcomeMints.push({ pubkey: mintPda, isSigner: false, isWritable: true });
      }

      const collateralMint = new PublicKey(process.env.COLLATERAL_MINT || "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");
      const deadline = new anchor.BN(Math.floor(marketData.endsAt.getTime() / 1000));
      const strikePrice = new anchor.BN(marketData.strikePrice || 0);
      const pythFeed = new PublicKey(marketData.pythFeed || "11111111111111111111111111111111");

      const tx = await this.program.methods
        .initializeMarket(
            marketIdNum, 
            marketData.question, 
            resolutionSource, 
            deadline, 
            outcomesCount,
            strikePrice,
            pythFeed
        )
        .accounts({
          market: marketPda,
          authority: this.agentKeypair.publicKey,
          collateralMint,
          collateralVault: vaultPda,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .remainingAccounts(outcomeMints)
        .rpc();

      return { tx, marketPda: marketPda.toBase58() };
    } catch (error: any) {
      console.error(`❌ Failed to create market on-chain:`, error.message);
    }
  }

  async resolveViaPyth(marketId: string, pythFeed: string) {
    try {
      const marketIdNum = this.getMarketIdNum(marketId);
      const marketIdBytes = Buffer.alloc(4);
      marketIdBytes.writeUInt32LE(marketIdNum, 0);
      const [marketPda] = PublicKey.findProgramAddressSync([Buffer.from('market'), marketIdBytes], this.programId);

      const tx = await this.program.methods
        .resolveViaPyth(marketIdNum)
        .accounts({
          market: marketPda,
          pythPriceFeed: new PublicKey(pythFeed),
          signer: this.agentKeypair.publicKey,
        })
        .rpc();
      return tx;
    } catch (error: any) {
      console.error(`❌ Failed to resolve via Pyth:`, error.message);
    }
  }

  async resolveMarketOnChain(marketId: string, winningIndex: number) {
    try {
      const marketIdNum = this.getMarketIdNum(marketId);
      const marketIdBytes = Buffer.alloc(4);
      marketIdBytes.writeUInt32LE(marketIdNum, 0);
      const [marketPda] = PublicKey.findProgramAddressSync([Buffer.from('market'), marketIdBytes], this.programId);

      const tx = await this.program.methods
        .setWinner(marketIdNum, winningIndex)
        .accounts({
          authority: this.agentKeypair.publicKey,
          market: marketPda,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      return tx;
    } catch (error: any) {
      console.error(`❌ Failed to resolve market on-chain:`, error.message);
    }
  }
}

export const solanaService = new SolanaService();
