import { fetchKalshiMarkets } from '../src/utils/market-data-service';

async function test() {
  console.log('Testing Kalshi...');
  const k = await fetchKalshiMarkets(1);
  console.log('Kalshi Sample:', JSON.stringify(k[0], null, 2));
}

test();
