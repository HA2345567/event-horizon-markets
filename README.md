<h1 align="center">
  <img src="frontend/public/logo.svg" height="32" align="center" alt="Heliora Logo">
  Heliora
</h1>

<p align="center">
  <img src="frontend/public/readme_logo.png" width="800" alt="Heliora Hero Section">
</p>

**The AI-Native Prediction Protocol on Solana**

Heliora is a next-generation prediction market platform that combines the speed of Solana with an advanced multi-agent AI architecture. By leveraging autonomous agents to create, price, and resolve markets, Heliora offers a continuous, real-time trading experience across Sports, Crypto, Politics, and AI/Tech events.

---

## 🏗️ Architecture & System Design

<p align="center">
  <img src="frontend/public/architecture.png" width="800" alt="Heliora Architecture Diagram">
</p>

Heliora operates using a decentralized agentic framework that automates the entire lifecycle of a prediction market.

### 🤖 The 3-Agent Core
1.  **Market Creator Agent**: 
    - Automatically curates and mirrors markets from institutional sources like Kalshi.
    - Uses **Google Gemini 2.0 Flash** to analyze global news and generate custom high-interest markets.
2.  **Market Maker Agent**: 
    - Ensures continuous liquidity and dynamic orderbook pricing.
    - Simulates organic market activity and manages spreads to ensure a healthy trading environment.
3.  **Resolution Agent (AI Oracle)**: 
    - Uses a multi-agent consensus mechanism to verify real-world outcomes.
    - Fetches live data, summaries evidence, and executes on-chain settlement on Solana via the Anchor protocol.

### 💻 Technology Stack
- **Frontend**: React 18, Vite, Tailwind CSS, TanStack Query, Framer Motion for premium animations.
- **Backend**: Bun (High-performance runtime), Express, Prisma ORM.
- **Database**: PostgreSQL (Neon Serverless) for production, SQLite for local development.
- **Smart Contracts**: Rust, Anchor Framework (v0.32.x) deployed on Solana Devnet.
- **Infrastructure**: Google Cloud Platform (GCP Cloud Run & Cloud Build).

---

## 🚀 Deployment & Infrastructure

- **Cloud Run (Backend)**: Scales horizontally to handle thousands of concurrent AI agent operations.
- **Cloud Run (Frontend)**: Nginx-powered container for ultra-fast static content delivery.
- **Cloud Build**: Automated CI/CD pipeline that bakes production environment variables into build artifacts.

---

## ✨ Key Features

- **⚡ Blazing Fast On-Chain Settlement:** Sub-second trades and minimal fees on Solana.
- **🌐 Real-Time Data Bridge:** Syncs 2,000+ active markets including IPL, Elections, and Crypto milestones.
- **🔐 Secure Auth**: Integrated with **Privy** for seamless multi-factor authentication.
- **🎨 Premium UI/UX:** Modern minimalist aesthetic with dynamic orderbooks and interactive charts.

---

## 📖 Getting Started

### Local Setup
1. **Clone & Install**:
   ```bash
   git clone https://github.com/HA2345567/Heliora.git
   ```
2. **Backend**:
   ```bash
   cd backend && bunx prisma db push && bun dev
   ```
3. **Frontend**:
   ```bash
   cd frontend && bun dev
   ```

---

## 📄 License
This project is licensed under the **MIT License**.



// you are a senior solana protocol enginner, senior full stack developer , you are senior UI/UX designer, you are  great in product and buisness, you are senior product designer, you are senior backend developer, you are senior blockchain developer, you are senior AI engineer, you are senior system engineer, you are senior security engineer, you are senior operations engineer your task is to build this layer end to end 100% complete first what be build yet then take action top of what we needed 
