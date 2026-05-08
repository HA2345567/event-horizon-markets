const crypto = require('crypto');

function getDiscriminator(name, type = 'account') {
  const hash = crypto.createHash('sha256').update(`${type}:${name}`).digest();
  return Array.from(hash.slice(0, 8));
}

console.log('market:', getDiscriminator('Market'));
console.log('oracleRegistry:', getDiscriminator('OracleRegistry'));
console.log('agentTemplate:', getDiscriminator('AgentTemplate'));
console.log('agentAccount:', getDiscriminator('AgentAccount'));
console.log('oracleVote:', getDiscriminator('OracleVote'));
console.log('dispute:', getDiscriminator('Dispute'));
console.log('globalConfig:', getDiscriminator('GlobalConfig'));
