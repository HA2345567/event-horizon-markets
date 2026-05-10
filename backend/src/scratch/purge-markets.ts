import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function clear() {
  console.log('Purging all market data...');
  try {
    await prisma.pricePoint.deleteMany({});
    console.log('✓ Price points cleared');
    await prisma.trade.deleteMany({});
    console.log('✓ Trades cleared');
    await prisma.comment.deleteMany({});
    console.log('✓ Comments cleared');
    await prisma.market.deleteMany({});
    console.log('✓ Markets cleared');
    console.log('DONE. Database is clean.');
  } catch (e) {
    console.error('Error during purge:', e);
  } finally {
    await prisma.$disconnect();
  }
}

clear();
