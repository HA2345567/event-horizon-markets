import { useEffect, useState, useRef } from 'react';

interface OrderbookEntry {
  price: number;
  size: number;
}

interface MarketMessage {
  type: 'price';
  yesPrice: number;
  noPrice: number;
  orderbook: {
    buyYes: OrderbookEntry[];
    sellYes: OrderbookEntry[];
  };
  ts: string;
}

export function useMarketSocket(marketId: string | undefined) {
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [orderbook, setOrderbook] = useState<{ buyYes: OrderbookEntry[]; sellYes: OrderbookEntry[] } | null>(null);
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed' | 'error'>('connecting');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!marketId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host; // Use the actual host and port from the window (e.g., localhost:8080)
    const url = `${protocol}//${host}/ws/${marketId}`;

    console.log(`Connecting to WebSocket: ${url}`);
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('open');
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data: MarketMessage = JSON.parse(event.data);
        if (data.type === 'price') {
          setLivePrice(data.yesPrice);
          setOrderbook(data.orderbook);
        }
      } catch (e) {
        console.error('WebSocket parse error:', e);
      }
    };

    ws.onclose = () => {
      setStatus('closed');
      console.log('WebSocket closed');
    };

    ws.onerror = () => {
      setStatus('error');
      console.error('WebSocket error');
    };

    return () => {
      ws.close();
    };
  }, [marketId]);

  return { livePrice, orderbook, status };
}
