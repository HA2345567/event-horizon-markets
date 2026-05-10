
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  try {
    await prisma.$connect();
    console.log('Successfully connected to the database');
    await prisma.$disconnect();
  } catch (error) {
    console.error('Failed to connect to the database:', error);
    process.exit(1);
  }
}

test();
