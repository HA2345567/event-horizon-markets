use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq, InitSpace)]
pub enum ResolutionSource {
    Authority,
    Pyth,
    Switchboard,
    AI,
    DAO,
}

#[account]
#[derive(InitSpace)]
pub struct GlobalConfig {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub heliora_mint: Pubkey,
    pub protocol_fee_bps: u16,
    pub creator_fee_bps: u16,
    pub lp_fee_bps: u16,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct StakingPool {
    pub mint: Pubkey,
    pub total_staked: u64,
    pub accumulated_fees_per_share: u128, // Scaled for precision
    pub total_fees_collected: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct UserStake {
    pub owner: Pubkey,
    pub amount: u64,
    pub reward_tally: u128,
    pub last_stake_timestamp: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct GovernanceProposal {
    pub creator: Pubkey,
    pub id: u32,
    #[max_len(64)]
    pub title: String,
    pub description_hash: [u8; 32],
    pub votes_for: u64,
    pub votes_against: u64,
    pub end_date: i64,
    pub executed: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct AgentTemplate {
    pub creator: Pubkey,
    #[max_len(32)]
    pub name: String,
    pub agent_type: u8, // 1: Sentiment, 2: Arbitrage, etc.
    pub performance_fee_bps: u16,
    pub total_staked: u64,
    pub total_pnl: i64,
    pub sharpe_ratio: i32,
    pub max_drawdown_bps: u16,
    pub accuracy_rate: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct AgentAccount {
    pub owner: Pubkey,
    pub agent_template: Pubkey,
    pub agent_key: Pubkey, // The TEE-hosted key allowed to trade
    pub collateral_vault: Pubkey,
    pub max_bet_amount: u64,
    pub daily_loss_limit: u64,
    pub current_daily_loss: u64,
    pub last_trade_timestamp: i64,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct OracleRegistry {
    pub oracle: Pubkey,
    pub staked_amount: u64,
    pub accuracy_rate: u8,
    pub total_resolved: u32,
    pub is_active: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct OracleVote {
    pub market: Pubkey,
    pub oracle: Pubkey,
    pub outcome_index: u8,
    pub confidence: u8,
    pub timestamp: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Dispute {
    pub market: Pubkey,
    pub challenger: Pubkey,
    pub staked_amount: u64,
    pub timestamp: i64,
    pub resolved: bool,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub authority: Pubkey,
    pub market_id: u32,
    pub created_at: i64,
    pub settlement_deadline: i64,
    #[max_len(128)]
    pub question: String,
    #[max_len(256)]
    pub resolution_criteria: String,
    pub resolution_source: ResolutionSource,
    pub collateral_mint: Pubkey,
    pub collateral_vault: Pubkey,
    pub outcomes_count: u8,
    pub outcome_mints: [Pubkey; 8], 
    pub is_settled: bool,
    pub winning_outcome_index: Option<u8>,
    pub total_collateral_locked: u64,
    pub pool_initialized: bool,
    pub lp_mint: Pubkey,
    pub outcome_vaults: [Pubkey; 8],
    pub resolution_votes_count: u8,
    pub consensus_threshold: u8,
    pub total_consensus_confidence: u32,
    pub strike_price: i64,
    pub pyth_feed: Pubkey,
    pub assigned_oracles: [Pubkey; 5],
    pub is_disputed: bool,
    pub dispute_deadline: i64,
    pub bump: u8,
}