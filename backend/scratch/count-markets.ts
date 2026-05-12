import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function count() {
  const c = await prisma.market.count();
  const k = await prisma.market.count({ where: { resolutionDetail: { startsWith: 'kalshi:' } } });
  const p = await prisma.market.count({ where: { resolutionDetail: { startsWith: 'poly:' } } });
  const ai = await prisma.market.count({ where: { resolutionDetail: { startsWith: 'heliora:' } } });
  
  console.log(`Total Markets: ${c}`);
  console.log(`Kalshi: ${k}`);
  console.log(`Polymarket: ${p}`);
  console.log(`AI-Native: ${ai}`);
  
  await prisma.$disconnect();
}

count();
