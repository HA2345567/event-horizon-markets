import { prisma } from "./prisma";

async function main() {
  try {
    console.log("Attempting to connect to database...");
    const count = await prisma.market.count();
    console.log(`Connection successful! Total markets in DB: ${count}`);
    process.exit(0);
  } catch (err: any) {
    console.error("Database connection FAILED!");
    console.error(err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
