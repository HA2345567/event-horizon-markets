import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function wipe() {
  console.log('🗑️ Starting complete database wipe...');
  
  try {
    // Delete in order to respect foreign key constraints
    await prisma.trade.deleteMany({});
    await prisma.comment.deleteMany({});
    await prisma.pricePoint.deleteMany({});
    await prisma.market.deleteMany({});
    
    console.log('✅ All markets and related data have been removed.');
  } catch (error) {
    console.error('❌ Failed to wipe database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

wipe();
