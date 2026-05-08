use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};
use crate::state::*;

#[derive(Accounts)]
#[instruction(
    market_id: u32, 
    question: String, 
    resolution_criteria: String,
    resolution_source: ResolutionSource, 
    settlement_deadline: i64, 
    outcomes_count: u8,
    strike_price: i64,
    pyth_feed: Pubkey
)]
pub struct InitializeMarket<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Market::INIT_SPACE,
        seeds = [b"market", market_id.to_le_bytes().as_ref()],
        bump
    )]
    pub market: Account<'info, Market>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub collateral_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = authority,
        token::mint = collateral_mint,
        token::authority = market,
        seeds = [b"vault", market_id.to_le_bytes().as_ref()],
        bump
    )]
    pub collateral_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(name: String, agent_type: u8, performance_fee: u16)]
pub struct RegisterAgentTemplate<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + AgentTemplate::INIT_SPACE,
        seeds = [b"agent_template", name.as_bytes()],
        bump
    )]
    pub template: Account<'info, AgentTemplate>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeAgentAccount<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + AgentAccount::INIT_SPACE,
        seeds = [b"agent_account", owner.key().as_ref(), template.key().as_ref()],
        bump
    )]
    pub agent_account: Account<'info, AgentAccount>,
    
    pub template: Account<'info, AgentTemplate>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(market_id: u32, amount: u64)]
pub struct AgentSwap<'info> {
    #[account(mut)]
    pub agent_account: Account<'info, AgentAccount>,
    
    #[account(
        mut,
        seeds = [b"market", market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,
    
    pub agent_key: Signer<'info>, // Must match agent_account.agent_key
    
    #[account(mut)]
    pub collateral_vault: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub agent_collateral: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct InitializeGlobalConfig<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + GlobalConfig::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, GlobalConfig>,
    
    #[account(mut)]
    pub authority: Signer<'info>,

    pub heliora_mint: Account<'info, Mint>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(market_id: u32)]
pub struct InitializePool<'info> {
    #[account(
        mut,
        seeds = [b"market", market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,
    
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = market,
        seeds = [b"lp", market_id.to_le_bytes().as_ref()],
        bump
    )]
    pub lp_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(market_id: u32)]
pub struct AddLiquidity<'info> {
    #[account(
        mut,
        seeds = [b"market", market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,
    
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        constraint = user_collateral.mint == market.collateral_mint,
        constraint = user_collateral.owner == user.key()
    )]
    pub user_collateral: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = collateral_vault.key() == market.collateral_vault
    )]
    pub collateral_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = lp_mint.key() == market.lp_mint
    )]
    pub lp_mint: Account<'info, Mint>,

    #[account(
        mut,
        constraint = user_lp.mint == lp_mint.key(),
        constraint = user_lp.owner == user.key()
    )]
    pub user_lp: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(market_id: u32, outcome_index: u8)]
pub struct SubmitOracleVote<'info> {
    #[account(
        mut,
        seeds = [b"market", market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,
    
    #[account(
        init,
        payer = oracle,
        space = 8 + OracleVote::INIT_SPACE,
        seeds = [b"vote", market.key().as_ref(), oracle.key().as_ref()],
        bump
    )]
    pub oracle_vote: Account<'info, OracleVote>,
    
    #[account(mut)]
    pub oracle: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(amount: u64)]
pub struct StakeOracle<'info> {
    #[account(
        init_if_needed,
        payer = oracle,
        space = 8 + OracleRegistry::INIT_SPACE,
        seeds = [b"oracle_registry", oracle.key().as_ref()],
        bump
    )]
    pub registry: Account<'info, OracleRegistry>,
    
    #[account(mut)]
    pub oracle: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(market_id: u32)]
pub struct DisputeMarket<'info> {
    #[account(
        mut,
        seeds = [b"market", market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,
    
    #[account(
        init,
        payer = challenger,
        space = 8 + Dispute::INIT_SPACE,
        seeds = [b"dispute", market.key().as_ref(), challenger.key().as_ref()],
        bump
    )]
    pub dispute: Account<'info, Dispute>,
    
    #[account(mut)]
    pub challenger: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(market_id: u32)]
pub struct ResolveViaPyth<'info> {
    #[account(
        mut,
        seeds = [b"market", market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,
    
    /// CHECK: Validated in the instruction via pyth-sdk-solana
    pub pyth_price_feed: UncheckedAccount<'info>,
    
    #[account(mut)]
    pub signer: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(market_id: u32, outcome_index: u8)]
pub struct Swap<'info> {
    #[account(
        mut,
        seeds = [b"market", market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,
    
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        constraint = user_collateral.mint == market.collateral_mint,
        constraint = user_collateral.owner == user.key()
    )]
    pub user_collateral: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = collateral_vault.key() == market.collateral_vault
    )]
    pub collateral_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = user_outcome.mint == market.outcome_mints[outcome_index as usize],
        constraint = user_outcome.owner == user.key()
    )]
    pub user_outcome: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = outcome_vault.key() == market.outcome_vaults[outcome_index as usize]
    )]
    pub outcome_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(market_id: u32)]
pub struct SplitToken<'info> {
    #[account(
        mut,
        seeds = [b"market", market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,
    
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        constraint = user_collateral.mint == market.collateral_mint,
        constraint = user_collateral.owner == user.key()
    )]
    pub user_collateral: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = collateral_vault.key() == market.collateral_vault
    )]
    pub collateral_vault: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(market_id: u32)]
pub struct MergeToken<'info> {
    #[account(
        mut,
        seeds = [b"market", market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,
    
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        constraint = user_collateral.mint == market.collateral_mint,
        constraint = user_collateral.owner == user.key()
    )]
    pub user_collateral: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = collateral_vault.key() == market.collateral_vault,
    )]
    pub collateral_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(market_id: u32)]
pub struct SetWinner<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"market", market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(market_id: u32)]
pub struct ClaimRewards<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        seeds = [b"market", market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        constraint = user_collateral.mint == market.collateral_mint,
        constraint = user_collateral.owner == user.key()
    )]
    pub user_collateral: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        constraint = collateral_vault.key() == market.collateral_vault
    )]
    pub collateral_vault: Account<'info, TokenAccount>,
     
    pub winning_outcome_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        constraint = user_winning_outcome_ata.mint == winning_outcome_mint.key(),
        constraint = user_winning_outcome_ata.owner == user.key()
    )]
    pub user_winning_outcome_ata: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct InitializeStakingPool<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + StakingPool::INIT_SPACE,
        seeds = [b"staking_pool", heliora_mint.key().as_ref()],
        bump
    )]
    pub pool: Account<'info, StakingPool>,

    pub heliora_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = authority,
        token::mint = heliora_mint,
        token::authority = pool,
        seeds = [b"staking_vault", heliora_mint.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct StakeTokens<'info> {
    #[account(mut)]
    pub pool: Account<'info, StakingPool>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + UserStake::INIT_SPACE,
        seeds = [b"user_stake", user.key().as_ref(), pool.key().as_ref()],
        bump
    )]
    pub user_stake: Account<'info, UserStake>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub pool_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(proposal_id: u32)]
pub struct CreateProposal<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + GovernanceProposal::INIT_SPACE,
        seeds = [b"proposal", proposal_id.to_le_bytes().as_ref()],
        bump
    )]
    pub proposal: Account<'info, GovernanceProposal>,

    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        constraint = user_stake.amount >= 1000_000_000, // Requires 1000 HELIORA staked to create proposal
        seeds = [b"user_stake", creator.key().as_ref(), pool.key().as_ref()],
        bump = user_stake.bump
    )]
    pub user_stake: Account<'info, UserStake>,

    pub pool: Account<'info, StakingPool>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub proposal: Account<'info, GovernanceProposal>,

    pub voter: Signer<'info>,

    #[account(
        seeds = [b"user_stake", voter.key().as_ref(), pool.key().as_ref()],
        bump = user_stake.bump
    )]
    pub user_stake: Account<'info, UserStake>,

    pub pool: Account<'info, StakingPool>,
}