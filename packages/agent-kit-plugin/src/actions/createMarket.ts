import { PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { HelioraClient } from '../HelioraClient';

export interface CreateMarketParams {
  marketId: number;
  question: string;
  resolutionCriteria: string;
  resolutionSource: 'authority' | 'pyth' | 'switchboard' | 'ai' | 'dao';
  settlementDeadline: number; // Unix timestamp
  outcomesCount: number;
  strikePrice?: number;
  pythFeed?: string;
  collateralMintAddress?: string;
}

/**
 * Deploys a new prediction market on-chain.
 */
export async function createMarket(client: HelioraClient, params: CreateMarketParams) {
  return await client.withRetry(async () => {
    const marketIdBytes = Buffer.alloc(4);
    marketIdBytes.writeUInt32LE(params.marketId, 0);

    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('market'), marketIdBytes],
      client.program.programId
    );

    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), marketIdBytes],
      client.program.programId
    );

    const collateralMint = new PublicKey(params.collateralMintAddress || "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");
    
    // Derived outcome mints for agents (using same logic as backend)
    const outcomeMints = [];
    for (let i = 0; i < params.outcomesCount; i++) {
      const [mintPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(`outcome_${i}`), marketIdBytes],
        client.program.programId
      );
      outcomeMints.push({
        pubkey: mintPda,
        isSigner: false,
        isWritable: true,
      });
    }

    const resSource = { [params.resolutionSource]: {} };
    const strikePrice = new anchor.BN(params.strikePrice || 0);
    const pythFeed = new PublicKey(params.pythFeed || "11111111111111111111111111111111");

    const tx = await (client.program.methods as any)
      .initializeMarket(
        params.marketId,
        params.question,
        params.resolutionCriteria,
        resSource,
        new anchor.BN(params.settlementDeadline),
        params.outcomesCount,
        strikePrice,
        pythFeed
      )
      .accounts({
        market: marketPda,
        authority: client.wallet.publicKey,
        collateralMint,
        collateralVault: vaultPda,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .remainingAccounts(outcomeMints)
      .rpc();

    return { tx, marketPda: marketPda.toBase58() };
  });
}
