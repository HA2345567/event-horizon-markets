import * as dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { Connection } from '@solana/web3.js';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

async function diagnose() {
  console.log('🔍 Starting Heliora Backend Diagnosis (Express Mode)...');

  // 1. Check Environment Variables
  console.log('\n📋 Checking Environment Variables:');
  const vars = [
    'DATABASE_URL',
    'GEMINI_API_KEY',
    'GEMINI_MODEL'
  ];

  vars.forEach(v => {
    if (process.env[v]) {
      console.log(`  ✅ ${v}: ${process.env[v]?.substring(0, 8)}...`);
    } else {
      console.log(`  ❌ ${v}: MISSING`);
    }
  });

  // 2. Test Database Connection
  console.log('\n🗄️ Testing Database Connection (Prisma)...');
  const prisma = new PrismaClient();
  try {
    const start = Date.now();
    await prisma.$connect();
    console.log(`  ✅ Connected successfully in ${Date.now() - start}ms`);
  } catch (e: any) {
    console.error(`  ❌ Database connection failed: ${e.message}`);
  } finally {
    await prisma.$disconnect();
  }

  // 3. Test Vertex AI Express Mode
  console.log('\n🤖 Testing Vertex AI Express Mode Availability...');
  try {
    const client = new GoogleGenAI({
        vertexai: true,
        apiKey: process.env.GEMINI_API_KEY || '',
    });
    
    const model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
    
    console.log(`  Attempting to reach model: ${model}...`);
    
    const result = await client.models.generateContent({
      model: model,
      contents: [{ role: 'user', parts: [{ text: 'Hello, are you online?' }] }],
    });

    console.log(`  ✅ Vertex AI Response: "${result.text?.trim()}"`);
    console.log('  🎉 SUCCESS: Your AI agents are now using Express Mode with your credits!');
  } catch (e: any) {
    console.error(`  ❌ Vertex AI Express Mode Test Failed: ${e.message}`);
  }
}

diagnose().catch(console.error);
