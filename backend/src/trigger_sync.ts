import { runMarketCreatorAgent } from './utils/agent-runner';
import { clearAllMarkets } from './utils/market-data-service';
import { prisma } from './prisma';

async function main() {
  console.log('🚀 Clearing garbage and triggering manual institutional market sync...');
  await clearAllMarkets();
  await runMarketCreatorAgent();
  console.log('✅ Sync complete.');
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(e => {
  console.error('❌ Sync failed:', e);
  process.exit(1);
});
