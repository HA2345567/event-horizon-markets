import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SolanaProvider } from "@/components/wallet/SolanaProvider";
import Index from "./pages/Index.tsx";
import Markets from "./pages/Markets.tsx";
import MarketDetail from "./pages/MarketDetail.tsx";
import CreateMarket from "./pages/CreateMarket.tsx";
import Portfolio from "./pages/Portfolio.tsx";
import Agents from "./pages/Agents.tsx";
import AgentDetail from "./pages/AgentDetail.tsx";
import Oracle from "./pages/Oracle.tsx";
import Developers from "./pages/Developers.tsx";
import Token from "./pages/Token.tsx";
import Live from "./pages/Live.tsx";
import Governance from "./pages/Governance.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient({
  defaultOptions: { 
    queries: { 
      staleTime: 60_000, 
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      refetchOnWindowFocus: false, 
      retry: 1 
    } 
  },
});

const persister = createSyncStoragePersister({
  storage: window.localStorage,
});

persistQueryClient({
  queryClient: queryClient as any,
  persister,
});


import DocsDetail from "./pages/DocsDetail.tsx";

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SolanaProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/markets" element={<Markets />} />
            <Route path="/markets/create" element={<CreateMarket />} />
            <Route path="/markets/:id" element={<MarketDetail />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/agents/:id" element={<AgentDetail />} />
            <Route path="/oracle" element={<Oracle />} />
            <Route path="/developers" element={<Developers />} />
            <Route path="/docs" element={<DocsDetail />} />
            <Route path="/docs/:slug" element={<DocsDetail />} />
            <Route path="/privacy" element={<DocsDetail />} />
            <Route path="/terms" element={<DocsDetail />} />

            <Route path="/live" element={<Live />} />
            <Route path="/live/:id" element={<MarketDetail />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </SolanaProvider>
  </QueryClientProvider>
);


export default App;
