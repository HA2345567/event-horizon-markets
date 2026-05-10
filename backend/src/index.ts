import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { prisma } from './prisma';

dotenv.config();

// Initialize Express and HTTP server
const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize WebSocket
const wss = new WebSocketServer({ server: httpServer });

// Middleware
const corsOrigin = (process.env.CORS_ORIGIN || '*').replace(/\/$/, '');
app.use(cors({
  origin: corsOrigin === '*' ? '*' : corsOrigin,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes
import agentsRouter from './routes/agents';
import marketsRouter from './routes/markets';
import tradesRouter from './routes/trades';
import statsRouter from './routes/stats';
import oracleRouter from './routes/oracle';
import portfolioRouter from './routes/portfolio';
import socialRouter from './routes/social';
import liveRouter from './routes/live';
import faucetRouter from './routes/faucet';
import { initializeWebSocket } from './routes/ws';
import { AgentRunner } from './utils/agent-runner';
import { syncKalshiMarkets, seedFallbackMarkets, clearAllMarkets } from './utils/market-data-service';

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/agents', agentsRouter);
app.use('/api/markets', marketsRouter);
app.use('/api/trades', tradesRouter);
app.use('/api/stats', statsRouter);
app.use('/api/oracle', oracleRouter);
app.use('/api/portfolio', portfolioRouter);
app.use('/api/social', socialRouter);
app.use('/api/live', liveRouter);
app.use('/api/faucet', faucetRouter);

// Initialize WebSocket
initializeWebSocket(wss);

// Error handling middleware
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
  });
});

// Start server
const startServer = async () => {
  try {
    // In Cloud Run, we should listen as soon as possible to pass health checks
    httpServer.listen(Number(PORT), '0.0.0.0', async () => {
      console.log(`✓ Server listening on 0.0.0.0:${PORT}`);
      console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
      
      try {
        // Test database connection in background
        console.log('... Connecting to database');
        await prisma.$connect();
        console.log('✓ Database connected successfully');
        
        // Sync real-time markets from Kalshi (fallback to curated set)
        console.log('✓ Syncing real-time markets...');
        syncKalshiMarkets()
          .then(n => {
            if (n === 0) return seedFallbackMarkets();
            return;
          })
          .catch(() => seedFallbackMarkets())
          .finally(() => console.log('✓ Live markets ready'));
        
        // Start autonomous agents
        AgentRunner.start(30000); // Tick every 30 seconds
      } catch (dbError) {
        console.error('✗ Database connection failed:', dbError);
        // We don't exit here so the health check endpoint can still respond
      }
    });
  } catch (error) {
    console.error('✗ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await prisma.$disconnect();
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason) => {
  console.error('⚠️ Unhandled Rejection at:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('⚠️ Uncaught Exception:', err);
});

startServer();
