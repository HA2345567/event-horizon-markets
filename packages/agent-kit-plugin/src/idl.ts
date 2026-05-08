export const IDL: any = {
  version: "0.5.0",
  name: "heliora_prediction_market",
  address: "By5KbxUEFGs7NrQYLXcjmptft6yX2saVWvoA8sx7HzqT",
  metadata: {
    address: "By5KbxUEFGs7NrQYLXcjmptft6yX2saVWvoA8sx7HzqT"
  },
  instructions: [
    {
      name: "initializeGlobalConfig",
      accounts: [
        { name: "config", isMut: true, isSigner: false },
        { name: "authority", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [],
    },
    {
      name: "initializeMarket",
      accounts: [
        { name: "market", isMut: true, isSigner: false },
        { name: "authority", isMut: true, isSigner: true },
        { name: "collateralMint", isMut: false, isSigner: false },
        { name: "collateralVault", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
        { name: "rent", isMut: false, isSigner: false },
      ],
      args: [
        { name: "marketId", type: "u32" },
        { name: "question", type: "string" },
        { name: "resolutionCriteria", type: "string" },
        { name: "resolutionSource", type: { defined: { name: "ResolutionSource" } } },
        { name: "settlementDeadline", type: "i64" },
        { name: "outcomesCount", type: "u8" },
        { name: "strikePrice", type: "i64" },
        { name: "pythFeed", type: "publicKey" },
      ],
    },
    {
      name: "submitOracleVote",
      accounts: [
        { name: "market", isMut: true, isSigner: false },
        { name: "oracleVote", isMut: true, isSigner: false },
        { name: "oracle", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "marketId", type: "u32" },
        { name: "outcomeIndex", type: "u8" },
        { name: "confidence", type: "u8" },
      ],
    },
    {
      name: "resolveViaPyth",
      accounts: [
        { name: "market", isMut: true, isSigner: false },
        { name: "pythPriceFeed", isMut: false, isSigner: false },
        { name: "signer", isMut: true, isSigner: true },
      ],
      args: [
        { name: "marketId", type: "u32" },
      ],
    },
    {
      name: "initializePool",
      accounts: [
        { name: "market", isMut: true, isSigner: false },
        { name: "authority", isMut: true, isSigner: true },
        { name: "lpMint", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false },
        { name: "rent", isMut: false, isSigner: false },
      ],
      args: [
        { name: "marketId", type: "u32" }
      ],
    },
    {
      name: "addLiquidity",
      accounts: [
        { name: "market", isMut: true, isSigner: false },
        { name: "user", isMut: true, isSigner: true },
        { name: "userCollateral", isMut: true, isSigner: false },
        { name: "collateralVault", isMut: true, isSigner: false },
        { name: "lpMint", isMut: true, isSigner: false },
        { name: "userLp", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "marketId", type: "u32" },
        { name: "amount", type: "u64" },
      ],
    },
    {
      name: "swap",
      accounts: [
        { name: "market", isMut: true, isSigner: false },
        { name: "user", isMut: true, isSigner: true },
        { name: "userCollateral", isMut: true, isSigner: false },
        { name: "collateralVault", isMut: true, isSigner: false },
        { name: "userOutcome", isMut: true, isSigner: false },
        { name: "outcomeVault", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "marketId", type: "u32" },
        { name: "outcomeIndex", type: "u8" },
        { name: "amountIn", type: "u64" },
      ],
    },
    {
      name: "splitTokens",
      accounts: [
        { name: "market", isMut: true, isSigner: false },
        { name: "user", isMut: true, isSigner: true },
        { name: "userCollateral", isMut: true, isSigner: false },
        { name: "collateralVault", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "marketId", type: "u32" },
        { name: "amount", type: "u64" },
      ],
    },
    {
      name: "setWinner",
      accounts: [
        { name: "authority", isMut: true, isSigner: true },
        { name: "market", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "marketId", type: "u32" },
        { name: "winningIndex", type: "u8" },
      ],
    },
    {
      name: "claimRewards",
      accounts: [
        { name: "user", isMut: true, isSigner: true },
        { name: "market", isMut: true, isSigner: false },
        { name: "userCollateral", isMut: true, isSigner: false },
        { name: "collateralVault", isMut: true, isSigner: false },
        { name: "winningOutcomeMint", isMut: false, isSigner: false },
        { name: "userWinningOutcomeAta", isMut: true, isSigner: false },
        { name: "tokenProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "marketId", type: "u32" }
      ],
    }
  ],
  accounts: [
    {
      name: "Market",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "publicKey" },
          { name: "marketId", type: "u32" },
          { name: "createdAt", type: "i64" },
          { name: "settlementDeadline", type: "i64" },
          { name: "question", type: "string" },
          { name: "resolutionCriteria", type: "string" },
          { name: "resolutionSource", type: { defined: { name: "ResolutionSource" } } },
          { name: "collateralMint", type: "publicKey" },
          { name: "collateralVault", type: "publicKey" },
          { name: "outcomesCount", type: "u8" },
          { name: "outcomeMints", type: { array: ["publicKey", 8] } },
          { name: "isSettled", type: "bool" },
          { name: "winningOutcomeIndex", type: { option: "u8" } },
          { name: "totalCollateralLocked", type: "u64" },
          { name: "poolInitialized", type: "bool" },
          { name: "lpMint", type: "publicKey" },
          { name: "outcomeVaults", type: { array: ["publicKey", 8] } },
          { name: "resolutionVotesCount", type: "u8" },
          { name: "consensusThreshold", type: "u8" },
          { name: "totalConsensusConfidence", type: "u32" },
          { name: "strikePrice", type: "i64" },
          { name: "pythFeed", type: "publicKey" },
          { name: "bump", type: "u8" }
        ]
      }
    },
    {
      name: "OracleVote",
      type: {
        kind: "struct",
        fields: [
          { name: "market", type: "publicKey" },
          { name: "oracle", type: "publicKey" },
          { name: "outcomeIndex", type: "u8" },
          { name: "confidence", type: "u8" },
          { name: "timestamp", type: "i64" },
          { name: "bump", type: "u8" }
        ]
      }
    },
    {
      name: "GlobalConfig",
      type: {
        kind: "struct",
        fields: [
          { name: "authority", type: "publicKey" },
          { name: "treasury", type: "publicKey" },
          { name: "protocolFeeBps", type: "u16" },
          { name: "creatorFeeBps", type: "u16" },
          { name: "lpFeeBps", type: "u16" },
          { name: "bump", type: "u8" }
        ]
      }
    }
  ],
  types: [
    {
      name: "ResolutionSource",
      type: {
        kind: "enum",
        variants: [
          { name: "Authority" },
          { name: "Pyth" },
          { name: "Switchboard" },
          { name: "AI" },
          { name: "DAO" }
        ]
      }
    }
  ]
};
