import { PrismaClient } from '@prisma/client';
import { Connection } from '@solana/web3.js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function diagnose() {
  console.log('🔍 Starting Heliora Backend Diagnosis...\n');

  // 1. Check Environment Variables
  const requiredEnv = [
    'DATABASE_URL',
    'GEMINI_API_KEY',
    'SOLANA_RPC_URL',
    'PROGRAM_ID'
  ];

  console.log('📋 Checking Environment Variables:');
  requiredEnv.forEach(env => {
    const value = process.env[env];
    if (value) {
      const masked = value.length > 10 ? `${value.substring(0, 6)}...${value.substring(value.length - 4)}` : '***';
      console.log(`  ✅ ${env}: ${masked}`);
    } else {
      console.log(`  ❌ ${env}: MISSING`);
    }
  });
  console.log('');

  // 2. Check Database Connectivity
  console.log('🗄️ Testing Database Connection (Prisma)...');
  try {
    const start = Date.now();
    await prisma.$connect();
    // Try a simple query
    await prisma.market.count();
    console.log(`  ✅ Connected successfully in ${Date.now() - start}ms`);
  } catch (error: any) {
    console.log(`  ❌ Database Connection Failed!`);
    console.log(`     Error: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
  console.log('');

  // 3. Check Solana RPC
  console.log('⛓️ Testing Solana RPC Connectivity...');
  try {
    const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const connection = new Connection(rpcUrl, 'confirmed');
    const slot = await connection.getSlot();
    console.log(`  ✅ Solana RPC reachable. Current Slot: ${slot}`);
  } catch (error: any) {
    console.log(`  ❌ Solana RPC Failed!`);
    console.log(`     Error: ${error.message}`);
  }
  console.log('');

  // 4. Check Gemini API
  console.log('🤖 Testing Gemini API Availability...');
  if (!process.env.GEMINI_API_KEY) {
    console.log('  ⚠️ Skipping Gemini test (API key missing)');
  } else {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${process.env.GEMINI_API_KEY}`);
      if (res.ok) {
        console.log('  ✅ Gemini API reachable and Key is valid.');
      } else {
        const data = await res.json();
        console.log(`  ❌ Gemini API Error: ${res.status} - ${data.error?.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.log(`  ❌ Gemini API unreachable: ${error.message}`);
    }
  }

  console.log('\n🏁 Diagnosis Complete.');
}

diagnose().catch(err => {
  console.error('Fatal diagnostic error:', err);
  process.exit(1);
});
