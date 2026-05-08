use anchor_lang::prelude::*;

#[error_code]
pub enum PredictionMarketError {
    #[msg("Invalid settlement deadline")]
    InvalidSettlementDeadline,
    #[msg("Market already settled")]
    MarketAlreadySettled,
    #[msg("Market has expired")]
    MarketExpired,
    #[msg("Invalid amount")]
    InvalidAmount,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Invalid winning outcome")]
    InvalidWinningOutcome,
    #[msg("Market is not settled yet")]
    MarketNotSettled,
    #[msg("Winning outcome is not set yet")]
    WinningOutcomeNotSet,
    #[msg("Too many outcomes. Max 8.")]
    TooManyOutcomes,
    #[msg("Not enough outcomes. Min 2.")]
    NotEnoughOutcomes,
    #[msg("Invalid resolution source")]
    InvalidResolutionSource,
    #[msg("Unauthorized resolution attempt")]
    UnauthorizedResolution,
    #[msg("Outcome index out of bounds")]
    OutcomeIndexOutOfBounds,
    #[msg("Unauthorized agent attempt")]
    UnauthorizedAgent,
    #[msg("Agent is inactive")]
    AgentInactive,
    #[msg("Bet limit exceeded for agent")]
    BetLimitExceeded,
    #[msg("Daily loss limit exceeded for agent")]
    DailyLossLimitExceeded,
    #[msg("Proposal has already expired")]
    ProposalExpired,
    #[msg("Dispute window has closed")]
    DisputeWindowClosed,
}