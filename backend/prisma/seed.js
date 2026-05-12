"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var uuid_1 = require("uuid");
var prisma = new client_1.PrismaClient();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var agents, agentData, _i, agentData_1, a, creator, nbaMarkets, _a, nbaMarkets_1, m, market, i;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('🧹 Clearing existing market data...');
                    // Order of deletion matters due to FKs
                    return [4 /*yield*/, prisma.pricePoint.deleteMany()];
                case 1:
                    // Order of deletion matters due to FKs
                    _b.sent();
                    return [4 /*yield*/, prisma.trade.deleteMany()];
                case 2:
                    _b.sent();
                    return [4 /*yield*/, prisma.position.deleteMany()];
                case 3:
                    _b.sent();
                    return [4 /*yield*/, prisma.comment.deleteMany()];
                case 4:
                    _b.sent();
                    return [4 /*yield*/, prisma.watchlist.deleteMany()];
                case 5:
                    _b.sent();
                    return [4 /*yield*/, prisma.alert.deleteMany()];
                case 6:
                    _b.sent();
                    return [4 /*yield*/, prisma.oracleResolution.deleteMany()];
                case 7:
                    _b.sent();
                    return [4 /*yield*/, prisma.market.deleteMany()];
                case 8:
                    _b.sent();
                    console.log('✅ Database cleared.');
                    return [4 /*yield*/, prisma.agent.findMany()];
                case 9:
                    agents = _b.sent();
                    if (!(agents.length === 0)) return [3 /*break*/, 15];
                    console.log('🤖 Creating agents...');
                    agentData = [
                        { name: 'Momentum Master', handle: 'momentum_bot', wallet: 'momentum_bot.sol', type: 'Momentum' },
                        { name: 'Arb Sniper', handle: 'arbitrage_pro', wallet: 'arbitrage_pro.sol', type: 'Arbitrage' },
                        { name: 'Sentiment Signal', handle: 'sentiment_ai', wallet: 'sentiment_ai.sol', type: 'Sentiment' },
                        { name: 'Liquid Maker', handle: 'market_maker_v2', wallet: 'mm_v2.sol', type: 'MarketMaker' },
                    ];
                    _i = 0, agentData_1 = agentData;
                    _b.label = 10;
                case 10:
                    if (!(_i < agentData_1.length)) return [3 /*break*/, 13];
                    a = agentData_1[_i];
                    return [4 /*yield*/, prisma.agent.create({ data: __assign(__assign({}, a), { id: (0, uuid_1.v4)() }) })];
                case 11:
                    _b.sent();
                    _b.label = 12;
                case 12:
                    _i++;
                    return [3 /*break*/, 10];
                case 13: return [4 /*yield*/, prisma.agent.findMany()];
                case 14:
                    agents = _b.sent();
                    _b.label = 15;
                case 15:
                    creator = JSON.stringify({
                        wallet: 'oracle_creator.sol',
                        handle: 'market_maker',
                    });
                    nbaMarkets = [
                        { q: "Jalen Brunson: 2+ 3-pointers made", cat: "NBA Player Props", desc: "Will Jalen Brunson record 2 or more 3-pointers in his next scheduled game?" },
                        { q: "Tyrese Maxey: 2+ 3-pointers made", cat: "NBA Player Props", desc: "Will Tyrese Maxey record 2 or more 3-pointers in his next scheduled game?" },
                        { q: "VJ Edgecombe: 2+ 3-pointers made", cat: "NCAA Player Props", desc: "Will VJ Edgecombe record 2 or more 3-pointers in his next scheduled game?" },
                        { q: "Mikal Bridges: 10+ points", cat: "NBA Player Props", desc: "Will Mikal Bridges record 10 or more points in his next scheduled game?" },
                        { q: "Paul George: 10+ points", cat: "NBA Player Props", desc: "Will Paul George record 10 or more points in his next scheduled game?" },
                        { q: "VJ Edgecombe: 10+ points", cat: "NCAA Player Props", desc: "Will VJ Edgecombe record 10 or more points in his next scheduled game?" },
                        { q: "Anthony Edwards: 20+ points", cat: "NBA Player Props", desc: "Will Anthony Edwards record 20 or more points in his next scheduled game?" },
                        { q: "Victor Wembanyama: 20+ points", cat: "NBA Player Props", desc: "Will Victor Wembanyama record 20 or more points in his next scheduled game?" },
                        { q: "James Harden: 15+ points", cat: "NBA Player Props", desc: "Will James Harden record 15 or more points in his next scheduled game?" },
                        { q: "Cade Cunningham: 20+ points", cat: "NBA Player Props", desc: "Will Cade Cunningham record 20 or more points in his next scheduled game?" },
                        { q: "Deandre Ayton: 10+ points", cat: "NBA Player Props", desc: "Will Deandre Ayton record 10 or more points in his next scheduled game?" },
                    ];
                    console.log('🏀 Creating player prop markets...');
                    _a = 0, nbaMarkets_1 = nbaMarkets;
                    _b.label = 16;
                case 16:
                    if (!(_a < nbaMarkets_1.length)) return [3 /*break*/, 23];
                    m = nbaMarkets_1[_a];
                    return [4 /*yield*/, prisma.market.create({
                            data: {
                                id: (0, uuid_1.v4)(),
                                question: m.q,
                                description: m.desc,
                                category: m.cat,
                                resolution: 'official_box_score',
                                resolutionDetail: 'Official NBA/NCAA box score results',
                                endsAt: new Date(Date.now() + 86400000 * 2), // 2 days from now
                                liquidity: 1000 + Math.random() * 5000,
                                yesPrice: 0.4 + Math.random() * 0.4,
                                noPrice: 0, // calculated later
                                volume: 5000 + Math.random() * 20000,
                                participants: 50 + Math.floor(Math.random() * 200),
                                isLive: true,
                                creator: creator,
                            },
                        })];
                case 17:
                    market = _b.sent();
                    // Update noPrice
                    return [4 /*yield*/, prisma.market.update({
                            where: { id: market.id },
                            data: { noPrice: 1 - market.yesPrice }
                        })];
                case 18:
                    // Update noPrice
                    _b.sent();
                    i = 0;
                    _b.label = 19;
                case 19:
                    if (!(i < 10)) return [3 /*break*/, 22];
                    return [4 /*yield*/, prisma.pricePoint.create({
                            data: {
                                marketId: market.id,
                                yesPrice: market.yesPrice + (Math.random() * 0.05 - 0.025),
                                noPrice: 1 - (market.yesPrice + (Math.random() * 0.05 - 0.025)),
                                ts: new Date(Date.now() - (10 - i) * 3600000)
                            }
                        })];
                case 20:
                    _b.sent();
                    _b.label = 21;
                case 21:
                    i++;
                    return [3 /*break*/, 19];
                case 22:
                    _a++;
                    return [3 /*break*/, 16];
                case 23:
                    console.log('✨ Heliora database seeded with high-fidelity player props.');
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) {
    console.error(e);
    process.exit(1);
})
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
