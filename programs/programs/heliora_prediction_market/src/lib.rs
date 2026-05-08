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
        config.protocol_fee_bps = 20;
        config.creator_fee_bps = 30;
        config.lp_fee_bps = 50;
        config.bump = ctx.bumps.config;
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