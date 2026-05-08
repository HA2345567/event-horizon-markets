import { PublicKey, SystemProgram } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { HelioraClient } from '../HelioraClient';

/**
 * Places a bet on a market using the AMM swap logic.
 * Signs and sends the Solana tx, returns the tx hash.
 */
export async function placeBet(
  client: HelioraClient,
  marketId: number,
  outcomeIndex: number,
  amount: number,
  collateralMintAddress: string = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr"
) {
  return await client.withRetry(async () => {
    const marketIdBytes = Buffer.alloc(4);
    marketIdBytes.writeUInt32LE(marketId, 0);

    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('market'), marketIdBytes],
      client.program.programId
    );

    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), marketIdBytes],
      client.program.programId
    );

    const collateralMint = new PublicKey(collateralMintAddress);
    const userCollateral = await getAssociatedTokenAddress(collateralMint, client.wallet.publicKey);

    // Get the market to know outcome count and mints
    const marketAccount: any = await (client.program.account as any).market.fetch(marketPda);
    const outcomesCount = marketAccount.outcomesCount;

    const remainingAccounts = [];
    for (let i = 0; i < outcomesCount; i++) {
      remainingAccounts.push({
        pubkey: marketAccount.outcomeMints[i],
        isSigner: false,
        isWritable: true,
      });
    }
    for (let i = 0; i < outcomesCount; i++) {
      remainingAccounts.push({
        pubkey: marketAccount.outcomeVaults[i],
        isSigner: false,
        isWritable: true,
      });
    }

    const outcomeMint = marketAccount.outcomeMints[outcomeIndex];
    const userOutcomeAta = await getAssociatedTokenAddress(outcomeMint, client.wallet.publicKey);

    // Pre-flight check: ensure the ATA exists (this logic would typically be in a builder that adds the init instruction if needed)
    // For agent-kit, we can execute the ATA creation if it doesn't exist, but we assume it here or append to instructions.

    const tx = await (client.program.methods as any)
      .swap(marketId, outcomeIndex, new anchor.BN(amount))
      .accounts({
        market: marketPda,
        user: client.wallet.publicKey,
        userCollateral,
        collateralVault: vaultPda,
        userOutcome: userOutcomeAta,
        outcomeVault: marketAccount.outcomeVaults[outcomeIndex],
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .remainingAccounts(remainingAccounts)
      .rpc();

    return { tx, outcomeMint: outcomeMint.toBase58() };
  });
}
