function getIndex(id) {
  const idx = Math.abs(id.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0)) % 3;
  return idx;
}

console.log("momentum_bot:", getIndex("momentum_bot"));
console.log("sentiment_bot:", getIndex("sentiment_bot"));
console.log("arbitrage_bot:", getIndex("arbitrage_bot"));
console.log("market_maker_bot:", getIndex("market_maker_bot"));
