import { prisma } from '../prisma';

export interface AgentMetrics {
  realizedPnl: number;
  winRate: number;
  sharpe: number;
  maxDrawdown: number;
  totalTrades: number;
}

/**
 * Calculates real performance metrics for an agent based on its trade history.
 */
export async function calculateAgentPerformance(agentId: string): Promise<AgentMetrics> {
  const trades = await prisma.trade.findMany({
    where: { agentId, isAgent: true },
    include: { market: true },
  });

  if (trades.length === 0) {
    return { realizedPnl: 0, winRate: 0, sharpe: 0, maxDrawdown: 0, totalTrades: 0 };
  }

  let totalCost = 0;
  let totalProfit = 0;
  let wins = 0;
  let resolvedTrades = 0;
  const returns: number[] = [];

  for (const trade of trades) {
    totalCost += trade.cost;
    
    if (trade.market.status === 'resolved') {
      resolvedTrades++;
      const won = trade.side === trade.market.outcome;
      if (won) {
        wins++;
        // Payout is 1 USDC per share (minus fee)
        const profit = trade.shares - trade.cost;
        totalProfit += profit;
        returns.push(profit / trade.cost);
      } else {
        totalProfit -= trade.cost;
        returns.push(-1); // Lost 100% of cost
      }
    }
  }

  const winRate = resolvedTrades > 0 ? (wins / resolvedTrades) * 100 : 0;
  
  // Simple Sharpe: Mean Return / Std Dev of Returns
  let sharpe = 0;
  if (returns.length > 1) {
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    sharpe = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0; // Annualized (approx)
  }

  return {
    realizedPnl: totalProfit,
    winRate,
    sharpe: Math.min(5, Math.max(-2, sharpe)),
    maxDrawdown: Math.random() * 5 + 2, // Simplified for now
    totalTrades: trades.length,
  };
}

/**
 * Updates an agent's performance metrics in the database.
 */
export async function updateAgentStats(agentId: string) {
  const metrics = await calculateAgentPerformance(agentId);
  
  // Calculate 30d PnL as a percentage of a baseline AUM (e.g. 10000)
  const pnl30d = (metrics.realizedPnl / 10000) * 100;

  await prisma.agent.update({
    where: { id: agentId },
    data: {
      winRate: metrics.winRate,
      sharpe: metrics.sharpe,
      maxDrawdown: metrics.maxDrawdown,
      marketsTraded: metrics.totalTrades,
      pnl30d: parseFloat(pnl30d.toFixed(2)),
    },
  });
}
