import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function purge() {
  console.log('🗑️ Purging all markets and related data...');
  await prisma.trade.deleteMany({});
  await prisma.pricePoint.deleteMany({});
  await prisma.position.deleteMany({});
  await prisma.oracleResolution.deleteMany({});
  await prisma.comment.deleteMany({});
  const { count } = await prisma.market.deleteMany({});
  console.log(`✅ Successfully purged ${count} markets.`);
  await prisma.$disconnect();
}

purge();
