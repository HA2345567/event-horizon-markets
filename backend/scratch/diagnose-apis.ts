import { fetchPolymarketMarkets, fetchKalshiMarkets } from '../src/utils/market-data-service';

async function test() {
  console.log('Testing Kalshi...');
  const k = await fetchKalshiMarkets(5);
  console.log('Kalshi Sample:', JSON.stringify(k[0], null, 2));
  
  console.log('Testing Poly...');
  const p = await fetchPolymarketMarkets(5);
  console.log('Poly Sample:', JSON.stringify(p[0], null, 2));
}

test();
