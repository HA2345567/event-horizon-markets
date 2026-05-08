import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';
import { HelioraClient } from '../HelioraClient';

/**
 * Claims winnings for a resolved market.
 */
export async function claimWinnings(client: HelioraClient, marketId: number) {
  return await client.withRetry(async () => {
    const marketIdBytes = Buffer.alloc(4);
    marketIdBytes.writeUInt32LE(marketId, 0);

    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('market'), marketIdBytes],
      client.program.programId
    );

    const marketAccount: any = await (client.program.account as any).market.fetch(marketPda);
    if (!marketAccount.isSettled) {
      throw new Error('Market is not yet settled');
    }

    const winningIndex = marketAccount.winningOutcomeIndex;
    const winningMint = marketAccount.outcomeMints[winningIndex];
    const userWinningAta = await getAssociatedTokenAddress(winningMint, client.wallet.publicKey);
    
    const collateralMint = marketAccount.collateralMint;
    const userCollateralAta = await getAssociatedTokenAddress(collateralMint, client.wallet.publicKey);
    
    const [vaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), marketIdBytes],
      client.program.programId
    );

    const tx = await (client.program.methods as any)
      .claimRewards(marketId)
      .accounts({
        user: client.wallet.publicKey,
        market: marketPda,
        userCollateral: userCollateralAta,
        collateralVault: vaultPda,
        winningOutcomeMint: winningMint,
        userWinningOutcomeAta: userWinningAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();

    return { tx };
  });
}
