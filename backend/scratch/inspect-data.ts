import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function test() {
  const markets = await prisma.market.findMany({
    take: 10,
    select: {
      id: true,
      question: true,
      yesPrice: true,
      category: true,
      resolutionDetail: true
    }
  });
  console.log(JSON.stringify(markets, null, 2));
  await prisma.$disconnect();
}

test();
