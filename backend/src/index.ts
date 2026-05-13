import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { prisma } from './prisma';

// Modular Routes
import marketRoutes from './routes/markets';
import tradeRoutes from './routes/trades';
import portfolioRoutes from './routes/portfolio';
import agentRoutes from './routes/agents';
import liveRoutes from './routes/live';
import statsRoutes from './routes/stats';
import oracleRoutes from './routes/oracle';
import socialRoutes from './routes/social';
import faucetRoutes from './routes/faucet';
import governanceRoutes from './routes/governance';
import { initializeWebSocket } from './routes/ws';

import * as marketDataService from './utils/market-data-service';
import { AgentRunner } from './utils/agent-runner';

// Environment variables initialized via import 'dotenv/config'

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 8080;

// Initialize WebSocket
const wss = new WebSocketServer({ server: httpServer });
initializeWebSocket(wss);

// Middleware
app.use(cors({
  origin: true, // Echoes the origin of the request for development
  credentials: true
}));
app.use(express.json());

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Register Routes
console.log('... Registering API routes');
app.use('/api/markets', marketRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/portfolio', portfolioRoutes);
app.use('/api/agents', agentRoutes);
app.use('/api/live', liveRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/oracle', oracleRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/faucet', faucetRoutes);
app.use('/api/governance', governanceRoutes);
console.log('✓ All API routes registered');

// Start the server
async function bootstrap() {
  try {
    // 1. Start listening immediately so frontend can connect even while we're booting
    httpServer.listen(PORT, () => {
      console.log(`✓ Heliora Server listening on 0.0.0.0:${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // 2. Connect to Database
    console.log('... Connecting to database');
    await prisma.$connect();
    console.log('✓ Database connected successfully');

    // 3. Kick off sync processes in background (non-blocking)
    console.log('✓ Syncing real-time markets in background...');
    marketDataService.syncKalshiMarkets()
      .then(k => console.log(`✓ Kalshi markets synced: ${k}`))
      .catch(err => console.error('❌ Kalshi Sync Error:', err));
      
    marketDataService.syncPolymarketMarkets()
      .then(p => console.log(`✓ Polymarket markets synced: ${p}`))
      .catch(err => console.error('❌ Polymarket Sync Error:', err));

    // 4. Start AI Agent Lifecycle
    console.log('🚀 Starting Heliora AI Agent Runner...');
    AgentRunner.start();
    
  } catch (error) {
    console.error('❌ Bootstrap failed:', error);
    // Don't exit immediately in dev, let the developer see the error
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}

bootstrap();
