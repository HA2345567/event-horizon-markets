use anchor_lang::prelude::*;
use crate::state::*;
use crate::instructions::*;
use crate::error::*;
use pyth_sdk_solana::load_price_feed_from_account_info;

declare_id!("By5KbxUEFGs7NrQYLXcjmptft6yX2saVWvoA8sx7HzqT");

#[program]
pub mod heliora_prediction_market {
    use super::*;

    pub fn initialize_global_config(ctx: Context<InitializeGlobalConfig>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = ctx.accounts.authority.key();
        config.treasury = ctx.accounts.authority.key();
        config.heliora_mint = ctx.accounts.heliora_mint.key();
        config.protocol_fee_bps = 20;
        config.creator_fee_bps = 30;
        config.lp_fee_bps = 50;
        config.bump = ctx.bumps.config;
        Ok(())
    }

    pub fn initialize_staking_pool(ctx: Context<InitializeStakingPool>) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        pool.mint = ctx.accounts.heliora_mint.key();
        pool.total_staked = 0;
        pool.accumulated_fees_per_share = 0;
        pool.bump = ctx.bumps.pool;
        Ok(())
    }

    pub fn stake_tokens(ctx: Context<StakeTokens>, amount: u64) -> Result<()> {
        let pool = &mut ctx.accounts.pool;
        let user_stake = &mut ctx.accounts.user_stake;
        let now = Clock::get()?.unix_timestamp;

        // Transfer HELIORA to pool vault
        let cpi_accounts = anchor_spl::token::Transfer {
            from: ctx.accounts.user_token_account.to_account_info(),
            to: ctx.accounts.pool_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        anchor_spl::token::transfer(CpiContext::new(cpi_program, cpi_accounts), amount)?;

        user_stake.owner = ctx.accounts.user.key();
        user_stake.amount += amount;
        user_stake.last_stake_timestamp = now;
        user_stake.bump = ctx.bumps.user_stake;

        pool.total_staked += amount;

        Ok(())
    }

    pub fn create_proposal(
        ctx: Context<CreateProposal>,
        proposal_id: u32,
        title: String,
        description_hash: [u8; 32],
        duration: i64,
    ) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let now = Clock::get()?.unix_timestamp;

        proposal.creator = ctx.accounts.creator.key();
        proposal.id = proposal_id;
        proposal.title = title;
        proposal.description_hash = description_hash;
        proposal.votes_for = 0;
        proposal.votes_against = 0;
        proposal.end_date = now + duration;
        proposal.executed = false;
        proposal.bump = ctx.bumps.proposal;

        Ok(())
    }

    pub fn cast_vote(ctx: Context<CastVote>, side: bool) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let user_stake = &ctx.accounts.user_stake;
        let now = Clock::get()?.unix_timestamp;

        require!(now < proposal.end_date, PredictionMarketError::ProposalExpired);
        
        let weight = user_stake.amount;
        if side {
            proposal.votes_for += weight;
        } else {
            proposal.votes_against += weight;
        }

        Ok(())
    }

    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        market_id: u32,
        question: String,
        resolution_criteria: String,
        resolution_source: ResolutionSource,
        settlement_deadline: i64,
        outcomes_count: u8,
        strike_price: i64,
        pyth_feed: Pubkey,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let now = Clock::get()?.unix_timestamp;
        
        require!(settlement_deadline > now, PredictionMarketError::InvalidSettlementDeadline);
        require!(outcomes_count >= 2, PredictionMarketError::NotEnoughOutcomes);
        
        market.authority = ctx.accounts.authority.key();
        market.market_id = market_id;
        market.created_at = now;
        market.question = question;
        market.resolution_criteria = resolution_criteria;
        market.resolution_source = resolution_source;
        market.settlement_deadline = settlement_deadline;
        market.collateral_mint = ctx.accounts.collateral_mint.key();
        market.collateral_vault = ctx.accounts.collateral_vault.key();
        market.outcomes_count = outcomes_count;
        market.consensus_threshold = 3;
        market.strike_price = strike_price;
        market.pyth_feed = pyth_feed;
        market.bump = ctx.bumps.market;

        for (i, account) in ctx.remaining_accounts.iter().enumerate() {
            market.outcome_mints[i] = account.key();
        }

        Ok(())
    }

    // Agent Marketplace Instructions
    pub fn register_agent_template(
        ctx: Context<RegisterAgentTemplate>,
        name: String,
        agent_type: u8,
        performance_fee: u16,
    ) -> Result<()> {
        let template = &mut ctx.accounts.template;
        template.creator = ctx.accounts.creator.key();
        template.name = name;
        template.agent_type = agent_type;
        template.performance_fee_bps = performance_fee;
        template.bump = ctx.bumps.template;
        Ok(())
    }

    pub fn initialize_agent_account(
        ctx: Context<InitializeAgentAccount>,
        agent_key: Pubkey,
        max_bet: u64,
        loss_limit: u64,
    ) -> Result<()> {
        let agent = &mut ctx.accounts.agent_account;
        agent.owner = ctx.accounts.owner.key();
        agent.agent_template = ctx.accounts.template.key();
        agent.agent_key = agent_key;
        agent.max_bet_amount = max_bet;
        agent.daily_loss_limit = loss_limit;
        agent.is_active = true;
        agent.bump = ctx.bumps.agent_account;
        Ok(())
    }

    pub fn agent_swap(
        ctx: Context<AgentSwap>,
        market_id: u32,
        outcome_index: u8,
        amount_in: u64,
    ) -> Result<()> {
        let agent = &mut ctx.accounts.agent_account;
        let now = Clock::get()?.unix_timestamp;

        // 1. Authorization
        require!(ctx.accounts.agent_key.key() == agent.agent_key, PredictionMarketError::UnauthorizedAgent);
        require!(agent.is_active, PredictionMarketError::AgentInactive);

        // 2. Risk Limits
        require!(amount_in <= agent.max_bet_amount, PredictionMarketError::BetLimitExceeded);
        
        // Reset daily loss if day has passed
        if now - agent.last_trade_timestamp > 86400 {
            agent.current_daily_loss = 0;
        }
        require!(agent.current_daily_loss + amount_in <= agent.daily_loss_limit, PredictionMarketError::DailyLossLimitExceeded);

        // 3. Execution (Logic would follow standard swap but using AgentAccount's vault)
        agent.last_trade_timestamp = now;
        // ... swap implementation ...

        Ok(())
    }

    // Existing Oracle/Market Logic
    pub fn stake_oracle(ctx: Context<StakeOracle>, amount: u64) -> Result<()> {
        let registry = &mut ctx.accounts.registry;
        registry.oracle = ctx.accounts.oracle.key();
        registry.staked_amount += amount;
        registry.is_active = true;
        registry.bump = ctx.bumps.registry;
        Ok(())
    }

    pub fn dispute_market(ctx: Context<DisputeMarket>, market_id: u32) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let now = Clock::get()?.unix_timestamp;
        require!(market.is_settled, PredictionMarketError::MarketNotSettled);
        require!(now < market.dispute_deadline, PredictionMarketError::DisputeWindowClosed);
        market.is_disputed = true;
        Ok(())
    }

    pub fn submit_oracle_vote(
        ctx: Context<SubmitOracleVote>,
        market_id: u32,
        outcome_index: u8,
        confidence: u8,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        let now = Clock::get()?.unix_timestamp;
        let oracle_key = ctx.accounts.oracle.key();
        
        if market.assigned_oracles.iter().all(|&k| k == Pubkey::default()) && market.resolution_votes_count < 5 {
             market.assigned_oracles[market.resolution_votes_count as usize] = oracle_key;
        }
        
        market.resolution_votes_count += 1;
        if market.resolution_votes_count >= 3 {
            market.is_settled = true;
            market.winning_outcome_index = Some(outcome_index);
            market.dispute_deadline = now + 172800;
        }
        Ok(())
    }

    pub fn resolve_via_pyth(ctx: Context<ResolveViaPyth>, market_id: u32) -> Result<()> {
        let market = &mut ctx.accounts.market;
        market.is_settled = true;
        Ok(())
    }

    pub fn initialize_pool(ctx: Context<InitializePool>, market_id: u32) -> Result<()> {
        let market = &mut ctx.accounts.market;
        market.pool_initialized = true;
        Ok(())
    }

    pub fn add_liquidity(ctx: Context<AddLiquidity>, market_id: u32, amount: u64) -> Result<()> { Ok(()) }
    pub fn swap(ctx: Context<Swap>, market_id: u32, outcome_index: u8, amount_in: u64) -> Result<()> { Ok(()) }
    pub fn set_winner(ctx: Context<SetWinner>, market_id: u32, winning_index: u8) -> Result<()> { Ok(()) }
    pub fn claim_rewards(ctx: Context<ClaimRewards>, market_id: u32) -> Result<()> { Ok(()) }
}