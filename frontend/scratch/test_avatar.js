const BOT_AVATARS = [
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpndW1mZzB6Z3VndW1mZzB6Z3VndW1mZzB6Z3VndW1mZzB6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/mi6hc9rjZcPB0JzM12/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpndW1mZzB6Z3VndW1mZzB6Z3VndW1mZzB6Z3VndW1mZzB6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/M9O08f0a0dJvE0a2Lh/giphy.gif",
  "https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHpndW1mZzB6Z3VndW1mZzB6Z3VndW1mZzB6Z3VndW1mZzB6JmVwPXYxX2ludGVybmFsX2dpZl9ieV9pZCZjdD1n/ToMjGpx9F5ktZw8qPUQ/giphy.gif",
];

const getAvatar = (id, isAgent) => {
  if (isAgent) {
    const idx = Math.abs(id.split('').reduce((a, b) => (a << 5) - a + b.charCodeAt(0), 0)) % BOT_AVATARS.length;
    return BOT_AVATARS[idx];
  }
  return null;
};

console.log("momentum_bot:", getAvatar("momentum_bot", true));
console.log("sentiment_bot:", getAvatar("sentiment_bot", true));
console.log("arb_bot:", getAvatar("arb_bot", true));
console.log("liquid_bot:", getAvatar("liquid_bot", true));
