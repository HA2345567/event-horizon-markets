import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function list() {
  const markets = await prisma.market.findMany({
    select: { id: true, question: true }
  });
  console.log(JSON.stringify(markets, null, 2));
  await prisma.$disconnect();
}

list();
