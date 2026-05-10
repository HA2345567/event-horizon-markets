import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Clearing existing market data...');
  
  // Order of deletion matters due to FKs
  await prisma.pricePoint.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.position.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.watchlist.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.oracleResolution.deleteMany();
  await prisma.market.deleteMany();

  console.log('✅ Database cleared.');

  // Check if agents exist, if not create them
  let agents = await prisma.agent.findMany();
  if (agents.length === 0) {
    console.log('🤖 Creating agents...');
    const agentData = [
      { name: 'Momentum Master', handle: 'momentum_bot', wallet: 'momentum_bot.sol', type: 'Momentum' },
      { name: 'Arb Sniper', handle: 'arbitrage_pro', wallet: 'arbitrage_pro.sol', type: 'Arbitrage' },
      { name: 'Sentiment Signal', handle: 'sentiment_ai', wallet: 'sentiment_ai.sol', type: 'Sentiment' },
      { name: 'Liquid Maker', handle: 'market_maker_v2', wallet: 'mm_v2.sol', type: 'MarketMaker' },
    ];
    for (const a of agentData) {
      await prisma.agent.create({ data: { ...a, id: uuidv4() } });
    }
    agents = await prisma.agent.findMany();
  }

  const creator = JSON.stringify({
    wallet: 'oracle_creator.sol',
    handle: 'market_maker',
  });

  const nbaMarkets = [
    { q: "Jalen Brunson: 2+ 3-pointers made", cat: "NBA Player Props", desc: "Will Jalen Brunson record 2 or more 3-pointers in his next scheduled game?" },
    { q: "Tyrese Maxey: 2+ 3-pointers made", cat: "NBA Player Props", desc: "Will Tyrese Maxey record 2 or more 3-pointers in his next scheduled game?" },
    { q: "VJ Edgecombe: 2+ 3-pointers made", cat: "NCAA Player Props", desc: "Will VJ Edgecombe record 2 or more 3-pointers in his next scheduled game?" },
    { q: "Mikal Bridges: 10+ points", cat: "NBA Player Props", desc: "Will Mikal Bridges record 10 or more points in his next scheduled game?" },
    { q: "Paul George: 10+ points", cat: "NBA Player Props", desc: "Will Paul George record 10 or more points in his next scheduled game?" },
    { q: "VJ Edgecombe: 10+ points", cat: "NCAA Player Props", desc: "Will VJ Edgecombe record 10 or more points in his next scheduled game?" },
    { q: "Anthony Edwards: 20+ points", cat: "NBA Player Props", desc: "Will Anthony Edwards record 20 or more points in his next scheduled game?" },
    { q: "Victor Wembanyama: 20+ points", cat: "NBA Player Props", desc: "Will Victor Wembanyama record 20 or more points in his next scheduled game?" },
    { q: "James Harden: 15+ points", cat: "NBA Player Props", desc: "Will James Harden record 15 or more points in his next scheduled game?" },
    { q: "Cade Cunningham: 20+ points", cat: "NBA Player Props", desc: "Will Cade Cunningham record 20 or more points in his next scheduled game?" },
    { q: "Deandre Ayton: 10+ points", cat: "NBA Player Props", desc: "Will Deandre Ayton record 10 or more points in his next scheduled game?" },
  ];

  console.log('🏀 Creating player prop markets...');

  for (const m of nbaMarkets) {
    const market = await prisma.market.create({
      data: {
        id: uuidv4(),
        question: m.q,
        description: m.desc,
        category: m.cat,
        resolution: 'official_box_score',
        resolutionDetail: 'Official NBA/NCAA box score results',
        endsAt: new Date(Date.now() + 86400000 * 2), // 2 days from now
        liquidity: 1000 + Math.random() * 5000,
        yesPrice: 0.4 + Math.random() * 0.4,
        noPrice: 0, // calculated later
        volume: 5000 + Math.random() * 20000,
        participants: 50 + Math.floor(Math.random() * 200),
        isLive: true,
        creator,
      },
    });

    // Update noPrice
    await prisma.market.update({
      where: { id: market.id },
      data: { noPrice: 1 - market.yesPrice }
    });

    // Add some initial price points
    for (let i = 0; i < 10; i++) {
      await prisma.pricePoint.create({
        data: {
          marketId: market.id,
          yesPrice: market.yesPrice + (Math.random() * 0.05 - 0.025),
          noPrice: 1 - (market.yesPrice + (Math.random() * 0.05 - 0.025)),
          ts: new Date(Date.now() - (10 - i) * 3600000)
        }
      });
    }
  }

  console.log('✨ Heliora database seeded with high-fidelity player props.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
