import { runMarketCreatorAgent } from '../backend/src/utils/agent-runner';
import { prisma } from '../backend/src/prisma';

async function main() {
  console.log('🚀 Triggering manual institutional market sync...');
  await runMarketCreatorAgent();
  console.log('✅ Sync complete.');
  await prisma.$disconnect();
  process.exit(0);
}

main().catch(e => {
  console.error('❌ Sync failed:', e);
  process.exit(1);
});
