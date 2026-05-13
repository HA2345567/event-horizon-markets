export const IDL = {
  version: "0.7.0",
  name: "heliora_prediction_market",
  address: "By5KbxUEFGs7NrQYLXcjmptft6yX2saVWvoA8sx7HzqT",
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
        { name: "pythFeed", type: "pubkey" },
      ],
    },
    {
      name: "stakeOracle",
      accounts: [
        { name: "registry", isMut: true, isSigner: false },
        { name: "oracle", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "amount", type: "u64" },
      ],
    },
    {
      name: "disputeMarket",
      accounts: [
        { name: "market", isMut: true, isSigner: false },
        { name: "dispute", isMut: true, isSigner: false },
        { name: "challenger", isMut: true, isSigner: true },
        { name: "systemProgram", isMut: false, isSigner: false },
      ],
      args: [
        { name: "marketId", type: "u32" },
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
    { name: "Market", discriminator: [219, 190, 213, 55, 0, 227, 198, 154] },
    { name: "oracleRegistry", discriminator: [94, 153, 19, 250, 94, 0, 12, 172] },
    { name: "agentTemplate", discriminator: [144, 215, 86, 173, 92, 116, 55, 22] },
    { name: "agentAccount", discriminator: [241, 119, 69, 140, 233, 9, 112, 50] }
  ],
  types: [
    {
      name: "Market",
      type: {
        kind: "struct",
        fields: [

          { name: "authority", type: "pubkey" },
          { name: "marketId", type: "u32" },
          { name: "createdAt", type: "i64" },
          { name: "settlementDeadline", type: "i64" },
          { name: "question", type: "string" },
          { name: "resolutionCriteria", type: "string" },
          { name: "resolutionSource", type: { defined: { name: "ResolutionSource" } } },
          { name: "collateralMint", type: "pubkey" },
          { name: "collateralVault", type: "pubkey" },
          { name: "outcomesCount", type: "u8" },
          { name: "outcomeMints", type: { array: ["pubkey", 8] } },
          { name: "isSettled", type: "bool" },
          { name: "winningOutcomeIndex", type: { option: "u8" } },
          { name: "totalCollateralLocked", type: "u64" },
          { name: "poolInitialized", type: "bool" },
          { name: "lpMint", type: "pubkey" },
          { name: "outcomeVaults", type: { array: ["pubkey", 8] } },
          { name: "resolutionVotesCount", type: "u8" },
          { name: "consensusThreshold", type: "u8" },
          { name: "totalConsensusConfidence", type: "u32" },
          { name: "strikePrice", type: "i64" },
          { name: "pythFeed", type: "pubkey" },
          { name: "assignedOracles", type: { array: ["pubkey", 5] } },
          { name: "isDisputed", type: "bool" },
          { name: "disputeDeadline", type: "i64" },
          { name: "bump", type: "u8" }
        ]
      }
    },
    {
      name: "oracleRegistry",
      type: {
        kind: "struct",
        fields: [
          { name: "oracle", type: "pubkey" },
          { name: "stakedAmount", type: "u64" },
          { name: "accuracyRate", type: "u8" },
          { name: "totalResolved", type: "u32" },
          { name: "isActive", type: "bool" },
          { name: "bump", type: "u8" }
        ]
      }
    },
    {
      name: "agentTemplate",
      type: {
        kind: "struct",
        fields: [
          { name: "creator", type: "pubkey" },
          { name: "name", type: "string" },
          { name: "agentType", type: "u8" },
          { name: "performanceFeeBps", type: "u16" },
          { name: "totalStaked", type: "u64" },
          { name: "totalPnl", type: "i64" },
          { name: "sharpeRatio", type: "i32" },
          { name: "maxDrawdownBps", type: "u16" },
          { name: "accuracyRate", type: "u8" },
          { name: "bump", type: "u8" }
        ]
      }
    },
    {
      name: "agentAccount",
      type: {
        kind: "struct",
        fields: [
          { name: "owner", type: "pubkey" },
          { name: "agentTemplate", type: "pubkey" },
          { name: "agentKey", type: "pubkey" },
          { name: "collateralVault", type: "pubkey" },
          { name: "maxBetAmount", type: "u64" },
          { name: "dailyLossLimit", type: "u64" },
          { name: "currentDailyLoss", type: "u64" },
          { name: "lastTradeTimestamp", type: "i64" },
          { name: "isActive", type: "bool" },
          { name: "bump", type: "u8" }
        ]
      }
    },
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
} as const;
