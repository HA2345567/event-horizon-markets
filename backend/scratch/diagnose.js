"use strict";
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
var dotenv = require("dotenv");
var client_1 = require("@prisma/client");
var genai_1 = require("@google/genai");
dotenv.config();
function diagnose() {
    return __awaiter(this, void 0, void 0, function () {
        var vars, prisma, start, e_1, client, model, result, e_2;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('🔍 Starting Heliora Backend Diagnosis (Express Mode)...');
                    // 1. Check Environment Variables
                    console.log('\n📋 Checking Environment Variables:');
                    vars = [
                        'DATABASE_URL',
                        'GEMINI_API_KEY',
                        'GEMINI_MODEL'
                    ];
                    vars.forEach(function (v) {
                        var _a;
                        if (process.env[v]) {
                            console.log("  \u2705 ".concat(v, ": ").concat((_a = process.env[v]) === null || _a === void 0 ? void 0 : _a.substring(0, 8), "..."));
                        }
                        else {
                            console.log("  \u274C ".concat(v, ": MISSING"));
                        }
                    });
                    // 2. Test Database Connection
                    console.log('\n🗄️ Testing Database Connection (Prisma)...');
                    prisma = new client_1.PrismaClient();
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, 4, 6]);
                    start = Date.now();
                    return [4 /*yield*/, prisma.$connect()];
                case 2:
                    _b.sent();
                    console.log("  \u2705 Connected successfully in ".concat(Date.now() - start, "ms"));
                    return [3 /*break*/, 6];
                case 3:
                    e_1 = _b.sent();
                    console.error("  \u274C Database connection failed: ".concat(e_1.message));
                    return [3 /*break*/, 6];
                case 4: return [4 /*yield*/, prisma.$disconnect()];
                case 5:
                    _b.sent();
                    return [7 /*endfinally*/];
                case 6:
                    // 3. Test Vertex AI Express Mode
                    console.log('\n🤖 Testing Vertex AI Express Mode Availability...');
                    _b.label = 7;
                case 7:
                    _b.trys.push([7, 9, , 10]);
                    client = new genai_1.GoogleGenAI({
                        vertexai: true,
                        apiKey: process.env.GEMINI_API_KEY || '',
                    });
                    model = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
                    console.log("  Attempting to reach model: ".concat(model, "..."));
                    return [4 /*yield*/, client.models.generateContent({
                            model: model,
                            contents: [{ role: 'user', parts: [{ text: 'Hello, are you online?' }] }],
                        })];
                case 8:
                    result = _b.sent();
                    console.log("  \u2705 Vertex AI Response: \"".concat((_a = result.text) === null || _a === void 0 ? void 0 : _a.trim(), "\""));
                    console.log('  🎉 SUCCESS: Your AI agents are now using Express Mode with your credits!');
                    return [3 /*break*/, 10];
                case 9:
                    e_2 = _b.sent();
                    console.error("  \u274C Vertex AI Express Mode Test Failed: ".concat(e_2.message));
                    return [3 /*break*/, 10];
                case 10: return [2 /*return*/];
            }
        });
    });
}
diagnose().catch(console.error);
