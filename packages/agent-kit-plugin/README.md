# @heliora/agent-kit-plugin

Drop-in plugin for [`solana-agent-kit`](https://github.com/sendaifun/solana-agent-kit) that gives autonomous on-chain AI agents access to **HELIORA** prediction markets — listing markets, placing bets, creating markets, reading portfolios, and triggering 5-agent oracle resolution.

## Install
```bash
npm install @heliora/agent-kit-plugin
# or
yarn add @heliora/agent-kit-plugin
```

## Usage
```ts
import { SolanaAgentKit } from "solana-agent-kit";
import { registerHelioraPlugin } from "@heliora/agent-kit-plugin";

const kit = new SolanaAgentKit(PRIVATE_KEY, RPC_URL, OPENAI_API_KEY);
const { client } = registerHelioraPlugin(kit, {
  apiUrl: "https://api.heliora.fi",
  walletAddress: kit.wallet_address.toString(),
});

// Now your LLM agent has 7 new tools:
//   heliora_list_markets, heliora_get_market, heliora_create_market,
//   heliora_place_trade, heliora_get_portfolio, heliora_get_orderbook,
//   heliora_resolve_market
```

## Direct REST client
```ts
import { HelioraClient } from "@heliora/agent-kit-plugin";
const c = new HelioraClient({ walletAddress: "8xAB...sol" });
const { markets } = await c.listMarkets({ category: "Crypto", sort: "volume", take: 10 });
```

## Tools
| name | purpose |
|------|---------|
| `heliora_list_markets` | List/filter open markets |
| `heliora_get_market` | Full market detail + price history |
| `heliora_create_market` | Permissionless market creation |
| `heliora_place_trade` | Buy YES/NO shares |
| `heliora_get_portfolio` | Open positions + PnL |
| `heliora_get_orderbook` | 15-deep orderbook snapshot |
| `heliora_resolve_market` | Trigger AI oracle consensus |

## License
MIT © Heliora Labs
