import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as anchor from "@coral-xyz/anchor";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { IDL } from "./idl.js";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const PROGRAM_ID = new PublicKey("By5KbxUEFGs7NrQYLXcjmptft6yX2saVWvoA8sx7HzqT");
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
const BACKEND_URL = process.env.HELIORA_BACKEND_URL || "https://api.heliora.fi";

class HelioraMCPServer {
  private server: Server;
  private connection: Connection;
  private program: anchor.Program;

  constructor() {
    this.server = new Server(
      {
        name: "heliora-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.connection = new Connection(RPC_URL, "confirmed");
    // Mock wallet for read-only MCP operations
    const wallet = new anchor.Wallet(Keypair.generate());
    const provider = new anchor.AnchorProvider(this.connection, wallet, {
      preflightCommitment: "confirmed",
    });
    this.program = new anchor.Program(IDL, provider);

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "list_markets",
          description: "Retrieve a list of active prediction markets on Heliora.",
          inputSchema: {
            type: "object",
            properties: {
              category: { type: "string", enum: ["Crypto", "Sports", "Politics", "Memes", "NFTs", "DeFi"] },
              minVolume: { type: "number" },
            },
          },
        },
        {
          name: "get_market",
          description: "Get detailed information about a specific market including odds and resolution rules.",
          inputSchema: {
            type: "object",
            properties: {
              id: { type: "string", description: "Market ID (u32 or PDA address)" },
            },
            required: ["id"],
          },
        },
        {
          name: "create_market",
          description: "Deploy a new prediction market on Solana. Requires natural language parameters.",
          inputSchema: {
            type: "object",
            properties: {
              question: { type: "string" },
              resolutionCriteria: { type: "string" },
              resolutionSource: { type: "string", enum: ["authority", "pyth", "switchboard", "ai", "dao"] },
              endDate: { type: "string", description: "ISO Date string" },
            },
            required: ["question", "resolutionSource", "endDate"],
          },
        },
        {
          name: "get_leaderboard",
          description: "Fetch the top performing traders and AI agents on the platform.",
          inputSchema: { type: "object", properties: {} },
        },
        {
          name: "get_agent_stats",
          description: "Get performance metrics for a specific autonomous agent.",
          inputSchema: {
            type: "object",
            properties: {
              agent_id: { type: "string" },
            },
            required: ["agent_id"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case "list_markets":
            return await this.handleListMarkets(args);
          case "get_market":
            return await this.handleGetMarket(args);
          case "get_leaderboard":
            return await this.handleGetLeaderboard();
          case "get_agent_stats":
            return await this.handleGetAgentStats(args);
          default:
            throw new Error(`Tool not found: ${name}`);
        }
      } catch (error: any) {
        return {
          content: [{ type: "text", text: `Error: ${error.message}` }],
          isError: true,
        };
      }
    });
  }

  private async handleListMarkets(args: any) {
    const markets = await (this.program.account as any).market.all();
    const formatted = markets.map((m: any) => ({
      id: m.account.marketId,
      pda: m.publicKey.toBase58(),
      question: m.account.question,
      deadline: new Date(m.account.settlementDeadline.toNumber() * 1000).toLocaleString(),
      isSettled: m.account.isSettled,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(formatted, null, 2) }],
    };
  }

  private async handleGetMarket(args: any) {
    // Logic to fetch single market by ID or PDA
    return { content: [{ type: "text", text: "Market details fetched (Mock)" }] };
  }

  private async handleGetLeaderboard() {
    const response = await axios.get(`${BACKEND_URL}/api/leaderboard`);
    return {
      content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
    };
  }

  private async handleGetAgentStats(args: any) {
    const response = await axios.get(`${BACKEND_URL}/api/agents/${args.agent_id}/stats`);
    return {
      content: [{ type: "text", text: JSON.stringify(response.data, null, 2) }],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Heliora MCP Server running on stdio");
  }
}

const server = new HelioraMCPServer();
server.run();
