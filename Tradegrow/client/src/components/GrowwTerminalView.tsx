import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, Bell, RefreshCw, ShoppingCart, ArrowUp, ArrowDown,
  Activity, Sun, Moon, Maximize2, Minimize2, ChevronUp, ChevronDown,
  X, CheckCircle2, AlertTriangle, Layers, TrendingUp, List, DollarSign,
  Zap, Clock, ShieldAlert, Sparkles, SlidersHorizontal, Eye, Briefcase, ArrowLeft
} from 'lucide-react';
import { MarketTick, Wallet, Position, Order } from '../types';
import { useSubscribeTokens, useMarketSocket } from '../hooks/useMarketSocket';
import { TradingChart } from './charts/TradingChart/TradingChart';
import { playAlertChime } from '../utils/notifications';
import { getLotSizeForSymbol } from '../utils/lotSize';
import { useToast } from '../context/ToastContext';
import { soundManager } from '../utils/soundManager';
import { LivePriceCell } from './ui/LivePriceCell';

interface GrowwTerminalViewProps {
  token: string | null;
  ticks?: Map<string, MarketTick>;
  wallet: Wallet | null;
  onRefreshWallet: () => void;
  initialSymbol?: string;
  initialToken?: string;
  initialExchange?: 'NSE' | 'BSE' | 'MCX';
  theme?: 'light' | 'dark';
  onToggleTheme?: () => void;
}

interface InstrumentItem {
  token: string;
  symbol: string;
  name: string;
  exchange: 'NSE' | 'BSE' | 'MCX';
  segment?: string;
  lotSize: number;
  fallbackPrice: number;
  fallbackPct: number;
}

export const GrowwTerminalView: React.FC<GrowwTerminalViewProps> = ({
  token: authToken,
  ticks: propsTicks,
  wallet,
  onRefreshWallet,
  initialSymbol = 'RELIANCE',
  initialToken,
  initialExchange = 'NSE',
  theme = 'dark',
  onToggleTheme,
}) => {
  const navigate = useNavigate();
  const toast = useToast();
  const { ticks: socketTicks } = useMarketSocket();
  const ticks = socketTicks.size > 0 ? socketTicks : (propsTicks ?? new Map<string, MarketTick>());

  // --------------------------------------------------------------------------
  // Selected Instrument State
  // --------------------------------------------------------------------------
  const [selectedSymbol, setSelectedSymbol] = useState<string>(initialSymbol);
  const [selectedToken, setSelectedToken] = useState<string>(
    initialToken ||
    (initialSymbol === 'NIFTY 50' ? 'NSE_NIFTY50' : (initialSymbol === 'SENSEX' ? 'BSE_SENSEX' : `NSE_${initialSymbol}`))
  );
  const [exchange, setExchange] = useState<'NSE' | 'BSE' | 'MCX'>(initialExchange);

  const [lotSize, setLotSize] = useState<number>(() => getLotSizeForSymbol(initialSymbol));
  const [lots, setLots] = useState<number>(1);

  // Sync lot size dynamically on instrument change
  useEffect(() => {
    setLotSize(getLotSizeForSymbol(selectedSymbol));
  }, [selectedSymbol]);

  // --------------------------------------------------------------------------
  // Responsive Mobile Workspace State (<1024px)
  // --------------------------------------------------------------------------
  const [isMobileViewport, setIsMobileViewport] = useState<boolean>(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  const [mobileWorkspaceTab, setMobileWorkspaceTab] = useState<'CHART' | 'WATCHLIST' | 'TRADE' | 'POSITIONS'>('CHART');

  useEffect(() => {
    const handleResize = () => setIsMobileViewport(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // --------------------------------------------------------------------------
  // Watchlist & Live Search State
  // --------------------------------------------------------------------------
  const [activeWatchlistTab, setActiveWatchlistTab] = useState<'INDICES' | 'FO' | 'STOCKS' | 'COMMODITIES' | 'SEARCH'>('INDICES');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<InstrumentItem[]>([]);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Static curated base lists with synchronized exchange lot sizes
  const indicesList: InstrumentItem[] = [
    { symbol: 'NIFTY 50', token: 'NSE_NIFTY50', name: 'Nifty 50 Index', exchange: 'NSE', lotSize: 65, fallbackPrice: 24328.50, fallbackPct: 0.28 },
    { symbol: 'BANKNIFTY', token: 'NSE_BANKNIFTY', name: 'Nifty Bank Index', exchange: 'NSE', lotSize: 30, fallbackPrice: 51840.20, fallbackPct: 0.45 },
    { symbol: 'FINNIFTY', token: 'NSE_FINNIFTY', name: 'Fin Nifty Index', exchange: 'NSE', lotSize: 60, fallbackPrice: 23890.40, fallbackPct: 0.12 },
    { symbol: 'SENSEX', token: 'BSE_SENSEX', name: 'BSE Sensex Index', exchange: 'BSE', lotSize: 20, fallbackPrice: 73600.00, fallbackPct: 0.05 },
    { symbol: 'MIDCPNIFTY', token: 'NSE_MIDCPNIFTY', name: 'Nifty Midcap 50', exchange: 'NSE', lotSize: 120, fallbackPrice: 13120.60, fallbackPct: 0.62 },
    { symbol: 'BANKEX', token: 'BSE_BANKEX', name: 'BSE Bankex Index', exchange: 'BSE', lotSize: 30, fallbackPrice: 58450.10, fallbackPct: 0.38 },
  ];

  const foList: InstrumentItem[] = [
    { symbol: 'NIFTY 24500 CE', token: 'NFO_NIFTY_24500_CE', name: 'Nifty Call Option', exchange: 'NSE', lotSize: 65, fallbackPrice: 142.50, fallbackPct: 8.5 },
    { symbol: 'NIFTY 24500 PE', token: 'NFO_NIFTY_24500_PE', name: 'Nifty Put Option', exchange: 'NSE', lotSize: 65, fallbackPrice: 88.20, fallbackPct: -6.4 },
    { symbol: 'NIFTY 24600 CE', token: 'NFO_NIFTY_24600_CE', name: 'Nifty Call Option', exchange: 'NSE', lotSize: 25, fallbackPrice: 95.10, fallbackPct: 11.2 },
    { symbol: 'NIFTY 24400 PE', token: 'NFO_NIFTY_24400_PE', name: 'Nifty Put Option', exchange: 'NSE', lotSize: 25, fallbackPrice: 62.40, fallbackPct: -12.1 },
    { symbol: 'BANKNIFTY 52000 CE', token: 'NFO_BANKNIFTY_52000_CE', name: 'BankNifty Call', exchange: 'NSE', lotSize: 15, fallbackPrice: 320.10, fallbackPct: 12.1 },
    { symbol: 'BANKNIFTY 51500 PE', token: 'NFO_BANKNIFTY_51500_PE', name: 'BankNifty Put', exchange: 'NSE', lotSize: 15, fallbackPrice: 210.80, fallbackPct: -9.5 },
    { symbol: 'SENSEX 80000 CE', token: 'BFO_SENSEX_80000_CE', name: 'Sensex Call Option', exchange: 'BSE', lotSize: 10, fallbackPrice: 215.40, fallbackPct: 4.8 },
    { symbol: 'SENSEX 79500 PE', token: 'BFO_SENSEX_79500_PE', name: 'Sensex Put Option', exchange: 'BSE', lotSize: 10, fallbackPrice: 175.20, fallbackPct: -3.6 },
  ];

  const stocksList: InstrumentItem[] = [
    { symbol: 'RELIANCE', token: 'NSE_RELIANCE', name: 'Reliance Industries', exchange: 'NSE', lotSize: 1, fallbackPrice: 2456.30, fallbackPct: 1.9 },
    { symbol: 'TCS', token: 'NSE_TCS', name: 'Tata Consultancy Services', exchange: 'NSE', lotSize: 1, fallbackPrice: 4125.80, fallbackPct: 1.2 },
    { symbol: 'INFY', token: 'NSE_INFY', name: 'Infosys Limited', exchange: 'NSE', lotSize: 1, fallbackPrice: 1845.60, fallbackPct: 2.8 },
    { symbol: 'HDFCBANK', token: 'NSE_HDFCBANK', name: 'HDFC Bank', exchange: 'NSE', lotSize: 1, fallbackPrice: 1670.25, fallbackPct: -0.5 },
    { symbol: 'ICICIBANK', token: 'NSE_ICICIBANK', name: 'ICICI Bank', exchange: 'NSE', lotSize: 1, fallbackPrice: 1210.50, fallbackPct: 0.8 },
    { symbol: 'SBIN', token: 'NSE_SBIN', name: 'State Bank of India', exchange: 'NSE', lotSize: 1, fallbackPrice: 840.15, fallbackPct: 1.4 },
    { symbol: 'BHARTIARTL', token: 'NSE_BHARTIARTL', name: 'Bharti Airtel', exchange: 'NSE', lotSize: 1, fallbackPrice: 1480.90, fallbackPct: -0.3 },
    { symbol: 'ITC', token: 'NSE_ITC', name: 'ITC Limited', exchange: 'NSE', lotSize: 1, fallbackPrice: 498.75, fallbackPct: 0.4 },
    { symbol: 'LT', token: 'NSE_LT', name: 'Larsen & Toubro', exchange: 'NSE', lotSize: 1, fallbackPrice: 3620.00, fallbackPct: 0.9 },
    { symbol: 'TATAMOTORS', token: 'NSE_TATAMOTORS', name: 'Tata Motors Limited', exchange: 'NSE', lotSize: 1, fallbackPrice: 985.40, fallbackPct: 3.2 },
    { symbol: 'TATASTEEL', token: 'NSE_TATASTEEL', name: 'Tata Steel Limited', exchange: 'NSE', lotSize: 1, fallbackPrice: 154.20, fallbackPct: 1.1 },
    { symbol: 'MARUTI', token: 'NSE_MARUTI', name: 'Maruti Suzuki India', exchange: 'NSE', lotSize: 1, fallbackPrice: 12350.00, fallbackPct: 0.6 },
    { symbol: 'BAJFINANCE', token: 'NSE_BAJFINANCE', name: 'Bajaj Finance', exchange: 'NSE', lotSize: 1, fallbackPrice: 7250.00, fallbackPct: 1.5 },
    { symbol: 'WIPRO', token: 'NSE_WIPRO', name: 'Wipro Limited', exchange: 'NSE', lotSize: 1, fallbackPrice: 540.80, fallbackPct: 0.7 },
    { symbol: 'ADANIENT', token: 'NSE_ADANIENT', name: 'Adani Enterprises', exchange: 'NSE', lotSize: 1, fallbackPrice: 2980.50, fallbackPct: -0.4 },
    { symbol: 'ZOMATO', token: 'NSE_ZOMATO', name: 'Zomato Limited (Eternal)', exchange: 'NSE', lotSize: 1, fallbackPrice: 260.40, fallbackPct: 2.5 },
    { symbol: 'KOTAKBANK', token: 'NSE_KOTAKBANK', name: 'Kotak Mahindra Bank', exchange: 'NSE', lotSize: 1, fallbackPrice: 1785.00, fallbackPct: 0.3 },
    { symbol: 'AXISBANK', token: 'NSE_AXISBANK', name: 'Axis Bank', exchange: 'NSE', lotSize: 1, fallbackPrice: 1195.00, fallbackPct: 0.8 },
    { symbol: 'SUNPHARMA', token: 'NSE_SUNPHARMA', name: 'Sun Pharmaceutical', exchange: 'NSE', lotSize: 1, fallbackPrice: 1890.00, fallbackPct: 1.2 },
    { symbol: 'TATAPOWER', token: 'NSE_TATAPOWER', name: 'Tata Power Company', exchange: 'NSE', lotSize: 1, fallbackPrice: 435.50, fallbackPct: 1.8 },
  ];

  const commoditiesList: InstrumentItem[] = [
    { symbol: 'CRUDEOIL', token: 'MCX_CRUDEOIL', name: 'Crude Oil Future', exchange: 'MCX', lotSize: 100, fallbackPrice: 5890.00, fallbackPct: -0.85 },
    { symbol: 'GOLD', token: 'MCX_GOLD', name: 'Gold 1KG Future', exchange: 'MCX', lotSize: 100, fallbackPrice: 73450.00, fallbackPct: 0.35 },
    { symbol: 'SILVER', token: 'MCX_SILVER', name: 'Silver 30KG Future', exchange: 'MCX', lotSize: 30, fallbackPrice: 89120.00, fallbackPct: 1.15 },
    { symbol: 'NATURALGAS', token: 'MCX_NATURALGAS', name: 'Natural Gas Future', exchange: 'MCX', lotSize: 1250, fallbackPrice: 195.40, fallbackPct: -2.10 },
  ];

  // Subscribe to all tokens currently shown in watchlists
  const subscribedTokens = [
    ...indicesList.map(i => i.token),
    ...foList.map(f => f.token),
    ...stocksList.map(s => s.token),
    ...commoditiesList.map(c => c.token),
    selectedToken
  ];
  useSubscribeTokens(subscribedTokens);

  // Live Scrip Search via /api/v1/instruments/search
  useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const q = encodeURIComponent(searchQuery.trim());
        const res = await fetch(`/api/v1/instruments/search?q=${q}&limit=20`);
        const data = await res.json();
        if (data.success && Array.isArray(data.instruments)) {
          const mapped: InstrumentItem[] = data.instruments.map((inst: any) => ({
            token: inst.token,
            symbol: inst.symbol,
            name: inst.name,
            exchange: inst.exchange || 'NSE',
            segment: inst.segment,
            lotSize: inst.lotSize || 1,
            fallbackPrice: inst.strikePrice || 100,
            fallbackPct: 0
          }));
          setSearchResults(mapped);
          setActiveWatchlistTab('SEARCH');
        }
      } catch (_) {
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Current active watchlist items
  const currentList = activeWatchlistTab === 'SEARCH'
    ? searchResults
    : activeWatchlistTab === 'FO'
    ? foList
    : activeWatchlistTab === 'STOCKS'
    ? stocksList
    : activeWatchlistTab === 'COMMODITIES'
    ? commoditiesList
    : indicesList;

  // --------------------------------------------------------------------------
  // Live Active Tick & Market Depth Calculation
  // --------------------------------------------------------------------------
  const getTick = (tok: string, sym: string): MarketTick | undefined => {
    return ticks.get(tok) || ticks.get(`NSE_${sym}`) || ticks.get(sym) || ticks.get(`BSE_${sym}`) || ticks.get(`MCX_${sym}`) || (sym === 'SENSEX' ? ticks.get('BSE_SENSEX') : undefined);
  };

  const currentTick = getTick(selectedToken, selectedSymbol);
  const currentLtp = currentTick?.ltp || 2456.30;
  const currentChange = currentTick?.change ?? 12.50;
  const currentChangePct = currentTick?.changePercent ?? 0.85;
  const currentHigh = currentTick?.high || (currentLtp * 1.015);
  const currentLow = currentTick?.low || (currentLtp * 0.985);
  const currentOpen = currentTick?.open || (currentLtp * 0.995);
  const currentVolume = currentTick?.volume || 1425800;
  const isGain = currentChangePct >= 0;

  // Day Range percentage
  const dayRangeProgress = Math.max(0, Math.min(100,
    ((currentLtp - currentLow) / Math.max(0.01, currentHigh - currentLow)) * 100
  ));

  // --------------------------------------------------------------------------
  // Order Pad State & Execution
  // --------------------------------------------------------------------------
  const [orderSide, setOrderSide] = useState<'BUY' | 'SELL'>('BUY');
  const [productType, setProductType] = useState<'MIS' | 'NRML' | 'CNC'>('MIS');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT' | 'SL' | 'SL_M'>('LIMIT');
  const [quantity, setQuantity] = useState<number>(lotSize * lots);
  const [priceInput, setPriceInput] = useState<string>(currentLtp.toFixed(2));
  const [triggerPriceInput, setTriggerPriceInput] = useState<string>((currentLtp * 0.98).toFixed(2));
  const [orderSubmitting, setOrderSubmitting] = useState<boolean>(false);
  const [orderFeedback, setOrderFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Sync price when selected instrument changes
  useEffect(() => {
    setPriceInput(currentLtp.toFixed(2));
    setTriggerPriceInput((currentLtp * (orderSide === 'BUY' ? 0.98 : 1.02)).toFixed(2));
  }, [selectedToken]);

  // Keep quantity in sync with lotSize & lots
  useEffect(() => {
    setQuantity(lotSize * lots);
  }, [lotSize, lots]);

  // Handle symbol selection
  const handleSelectInstrument = (item: InstrumentItem) => {
    setSelectedSymbol(item.symbol);
    setSelectedToken(item.token);
    setExchange(item.exchange);
    const newLotSize = item.lotSize || getLotSizeForSymbol(item.symbol);
    setLotSize(newLotSize);
    setLots(1);
    setQuantity(newLotSize);
    const tick = getTick(item.token, item.symbol);
    const newPrice = tick?.ltp || item.fallbackPrice;
    setPriceInput(newPrice.toFixed(2));
    setOrderFeedback(null);
    if (isMobileViewport) {
      setMobileWorkspaceTab('CHART');
    }
  };

  // Required margin calculation
  const limitOrMarketPrice = orderType === 'MARKET' ? currentLtp : parseFloat(priceInput || '0');
  const orderValue = limitOrMarketPrice * quantity;
  const isOption = selectedSymbol.includes(' CE') || selectedSymbol.includes(' PE');
  // Options buying requires 100% premium; Equity intraday (MIS) is 5x leverage; Delivery is 1x
  const requiredMargin = isOption
    ? orderValue
    : productType === 'MIS'
    ? orderValue / 5
    : orderValue;

  const availableFunds = wallet?.cashBalance ?? 0;
  const isMarginSufficient = availableFunds >= requiredMargin;

  // Order Execution - STAYS ON TERMINAL, NO REDIRECT
  const handleExecuteOrder = async () => {
    if (!authToken) {
      setOrderFeedback({ type: 'error', message: 'Authentication required. Please log in.' });
      return;
    }

    setOrderSubmitting(true);
    setOrderFeedback(null);
    soundManager.playSound('order_placed');

    const execPrice = orderType === 'MARKET' ? 0 : parseFloat(priceInput || '0');
    const triggerPrice = (orderType === 'SL' || orderType === 'SL_M') ? parseFloat(triggerPriceInput || '0') : 0;

    try {
      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          instrumentToken: selectedToken,
          exchange,
          symbol: selectedSymbol,
          side: orderSide,
          quantity: Number(quantity),
          price: execPrice,
          triggerPrice,
          orderType,
          productType
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.trade({
          status: 'EXECUTED',
          side: orderSide,
          symbol: selectedSymbol,
          quantity: Number(quantity),
          price: execPrice || currentLtp,
          orderType
        });
        setOrderFeedback({
          type: 'success',
          message: `Order Executed: ${orderSide} ${quantity} ${selectedSymbol} @ ₹${(execPrice || currentLtp).toFixed(2)}`
        });
        onRefreshWallet();
        fetchPositionsAndOrders();
      } else {
        const errMsg = data.error?.message || data.message || 'Risk Limit Exceeded';
        toast.trade({
          status: 'REJECTED',
          side: orderSide,
          symbol: selectedSymbol,
          quantity: Number(quantity),
          reason: errMsg
        });
        setOrderFeedback({
          type: 'error',
          message: `Order Rejected: ${errMsg}`
        });
      }
    } catch (err: any) {
      toast.trade({
        status: 'REJECTED',
        side: orderSide,
        symbol: selectedSymbol,
        quantity: Number(quantity),
        reason: err.message || 'Order Failed'
      });
      setOrderFeedback({
        type: 'error',
        message: `Order Failed: ${err.message}`
      });
    } finally {
      setOrderSubmitting(false);
    }
  };

  // --------------------------------------------------------------------------
  // Bottom Docked Console State & Operations (OpenTerminal style)
  // --------------------------------------------------------------------------
  const [isConsoleOpen, setIsConsoleOpen] = useState<boolean>(true);
  const [consoleHeight, setConsoleHeight] = useState<'compact' | 'expanded'>('compact');
  const [consoleTab, setConsoleTab] = useState<'POSITIONS' | 'ORDERS' | 'TRADES' | 'LEDGER'>('POSITIONS');
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const fetchPositionsAndOrders = async () => {
    if (!authToken) return;
    try {
      const [posRes, ordRes] = await Promise.allSettled([
        fetch('/api/v1/portfolio/positions?todayOnly=true', { headers: { Authorization: `Bearer ${authToken}` } }).then(r => r.json()),
        fetch('/api/v1/orders?todayOnly=true', { headers: { Authorization: `Bearer ${authToken}` } }).then(r => r.json())
      ]);

      if (posRes.status === 'fulfilled' && posRes.value?.success && Array.isArray(posRes.value.positions)) {
        setPositions(posRes.value.positions);
      }
      if (ordRes.status === 'fulfilled' && ordRes.value?.success && Array.isArray(ordRes.value.orders)) {
        setOrders(ordRes.value.orders);
      }
    } catch (_) {}
  };

  useEffect(() => {
    fetchPositionsAndOrders();
    const interval = setInterval(fetchPositionsAndOrders, 4000);
    return () => clearInterval(interval);
  }, [authToken]);

  // 1-Click Square-Off Position
  const handleSquareOffPosition = async (pos: Position) => {
    if (!authToken || actionLoadingId) return;
    setActionLoadingId(pos.id);

    try {
      const exitSide = pos.netQty > 0 ? 'SELL' : 'BUY';
      const exitQty = Math.abs(pos.netQty);

      const res = await fetch('/api/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({
          instrumentToken: `NSE_${pos.symbol}`,
          exchange: pos.exchange || 'NSE',
          symbol: pos.symbol,
          side: exitSide,
          quantity: exitQty,
          price: 0,
          orderType: 'MARKET',
          productType: pos.productType || 'MIS'
        })
      });

      const data = await res.json();
      if (data.success) {
        toast.trade({
          status: 'EXECUTED',
          side: exitSide,
          symbol: pos.symbol,
          quantity: exitQty,
          orderType: 'MARKET',
        });
        setOrderFeedback({
          type: 'success',
          message: `Squared Off ${pos.symbol}: ${exitSide} ${exitQty} @ MARKET`
        });
        onRefreshWallet();
        fetchPositionsAndOrders();
      } else {
        const errMsg = data.error?.message || 'Error executing square off';
        toast.trade({
          status: 'REJECTED',
          side: exitSide,
          symbol: pos.symbol,
          quantity: exitQty,
          reason: errMsg,
        });
        setOrderFeedback({
          type: 'error',
          message: `Square-Off failed: ${errMsg}`
        });
      }
    } catch (err: any) {
      toast.trade({
        status: 'REJECTED',
        side: pos.netQty > 0 ? 'SELL' : 'BUY',
        symbol: pos.symbol,
        quantity: Math.abs(pos.netQty),
        reason: err.message || 'Square-off failed',
      });
      setOrderFeedback({ type: 'error', message: `Square-Off failed: ${err.message}` });
    } finally {
      setActionLoadingId(null);
    }
  };

  // 1-Click Cancel Pending Order
  const handleCancelOrder = async (orderId: string) => {
    if (!authToken || actionLoadingId) return;
    setActionLoadingId(orderId);

    try {
      const res = await fetch(`/api/v1/orders/${orderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (data.success) {
        toast.trade({
          status: 'CANCELLED',
          side: 'BUY',
          symbol: `Order #${orderId.slice(-6)}`,
          quantity: '',
        });
        setOrderFeedback({ type: 'success', message: 'Order cancelled successfully.' });
        fetchPositionsAndOrders();
      } else {
        const errMsg = data.error?.message || 'Unable to cancel order';
        toast.error('Cancel Failed', errMsg);
        setOrderFeedback({ type: 'error', message: `Cancel failed: ${errMsg}` });
      }
    } catch (err: any) {
      toast.error('Cancel Failed', err.message);
      setOrderFeedback({ type: 'error', message: `Cancel failed: ${err.message}` });
    } finally {
      setActionLoadingId(null);
    }
  };

  // --------------------------------------------------------------------------
  // Realistic 5-Level Market Depth with Clickable Rows
  // --------------------------------------------------------------------------
  const step = currentLtp > 10000 ? 5 : currentLtp > 1000 ? 0.5 : 0.05;
  const bestBid = currentTick?.bid && currentTick.bid > 0 ? currentTick.bid : Number((currentLtp - step).toFixed(2));
  const bestAsk = currentTick?.ask && currentTick.ask > 0 ? currentTick.ask : Number((currentLtp + step).toFixed(2));

  const depthLevels = [1, 2, 3, 4, 5].map((level) => {
    const bidPrice = Number((bestBid - (level - 1) * step).toFixed(2));
    const askPrice = Number((bestAsk + (level - 1) * step).toFixed(2));
    const bidQty = Math.max(50, Math.floor((currentTick?.bidQty || 1200) / level + (level * 180)));
    const askQty = Math.max(50, Math.floor((currentTick?.askQty || 1100) / level + (level * 150)));
    return { bidPrice, askPrice, bidQty, askQty };
  });

  const totalBidQty = depthLevels.reduce((acc, d) => acc + d.bidQty, 0);
  const totalAskQty = depthLevels.reduce((acc, d) => acc + d.askQty, 0);
  const totalVol = Math.max(1, totalBidQty + totalAskQty);
  const buyerPct = Math.round((totalBidQty / totalVol) * 100);
  const sellerPct = 100 - buyerPct;

  // Filter open positions vs closed
  const openPositions = positions.filter(p => p.netQty !== 0);
  const pendingOrders = orders.filter(o => o.status === 'PENDING' || o.status === 'OPEN' || o.status === 'TRIGGER_PENDING');
  const filledOrders = orders.filter(o => o.status === 'FILLED' || o.status === 'COMPLETE');

  // Total Open P&L
  const totalUnrealizedPnl = openPositions.reduce((acc, p) => acc + (Number(p.unrealizedPnl) || 0), 0);

  const renderConsoleContent = () => (
    <>
      {/* TAB 1: POSITIONS */}
      {consoleTab === 'POSITIONS' && (
        <div className="w-full overflow-x-auto">
          {openPositions.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No open positions. Place an order to start trading.
            </div>
          ) : (
            <table className="w-full text-left text-xs font-mono">
              <thead className="sticky top-0 bg-[#0b0e14] border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                <tr>
                  <th className="py-2 px-3">Symbol</th>
                  <th className="py-2 px-3">Product</th>
                  <th className="py-2 px-3 text-right">Net Qty</th>
                  <th className="py-2 px-3 text-right">Avg Price</th>
                  <th className="py-2 px-3 text-right">LTP</th>
                  <th className="py-2 px-3 text-right">Unrealized P&L</th>
                  <th className="py-2 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {openPositions.map((pos) => {
                  const isPosGain = (Number(pos.unrealizedPnl) || 0) >= 0;
                  return (
                    <tr key={pos.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2 px-3 font-bold text-white whitespace-nowrap">
                        {pos.symbol}
                        <span className="text-[10px] text-slate-400 ml-1.5 font-normal">({pos.exchange || 'NSE'})</span>
                      </td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                          {pos.productType}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-200 tabular-nums">
                        {pos.netQty}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-300 tabular-nums">
                        ₹{Number(pos.averagePrice || 0).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-white tabular-nums">
                        ₹{Number(pos.ltp || 0).toFixed(2)}
                      </td>
                      <td className={`py-2 px-3 text-right font-black tabular-nums ${isPosGain ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPosGain ? '+' : ''}₹{Number(pos.unrealizedPnl || 0).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <button
                          onClick={() => handleSquareOffPosition(pos)}
                          disabled={actionLoadingId === pos.id}
                          className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white text-[11px] font-bold transition-all disabled:opacity-50"
                        >
                          {actionLoadingId === pos.id ? 'Exiting...' : 'Exit'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB 2: PENDING ORDERS */}
      {consoleTab === 'ORDERS' && (
        <div className="w-full overflow-x-auto">
          {pendingOrders.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No active pending orders.
            </div>
          ) : (
            <table className="w-full text-left text-xs font-mono">
              <thead className="sticky top-0 bg-[#0b0e14] border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                <tr>
                  <th className="py-2 px-3">Symbol</th>
                  <th className="py-2 px-3">Side</th>
                  <th className="py-2 px-3">Type</th>
                  <th className="py-2 px-3 text-right">Price</th>
                  <th className="py-2 px-3 text-right">Qty</th>
                  <th className="py-2 px-3">Status</th>
                  <th className="py-2 px-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {pendingOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-3 font-bold text-white whitespace-nowrap">{ord.symbol}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className={`font-bold ${ord.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {ord.side}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-300 whitespace-nowrap">{ord.order_type}</td>
                    <td className="py-2 px-3 text-right font-bold text-white tabular-nums">₹{Number(ord.price || 0).toFixed(2)}</td>
                    <td className="py-2 px-3 text-right text-slate-300 tabular-nums">{ord.quantity}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400">
                        {ord.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <button
                        onClick={() => handleCancelOrder(ord.id)}
                        disabled={actionLoadingId === ord.id}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-bold transition-all disabled:opacity-50"
                      >
                        {actionLoadingId === ord.id ? 'Cancelling...' : 'Cancel'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB 3: TRADES */}
      {consoleTab === 'TRADES' && (
        <div className="w-full overflow-x-auto">
          {filledOrders.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No trades executed today yet.
            </div>
          ) : (
            <table className="w-full text-left text-xs font-mono">
              <thead className="sticky top-0 bg-[#0b0e14] border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                <tr>
                  <th className="py-2 px-3">Time</th>
                  <th className="py-2 px-3">Symbol</th>
                  <th className="py-2 px-3">Side</th>
                  <th className="py-2 px-3 text-right">Filled Qty</th>
                  <th className="py-2 px-3 text-right">Avg Fill Price</th>
                  <th className="py-2 px-3">Product</th>
                  <th className="py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filledOrders.map((ord) => (
                  <tr key={ord.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                      {ord.created_at ? new Date(ord.created_at).toLocaleTimeString('en-IN') : '--'}
                    </td>
                    <td className="py-2 px-3 font-bold text-white whitespace-nowrap">{ord.symbol}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className={`font-bold ${ord.side === 'BUY' ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {ord.side}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-slate-200 tabular-nums">{ord.filled_quantity || ord.quantity}</td>
                    <td className="py-2 px-3 text-right text-emerald-400 font-bold tabular-nums">
                      ₹{Number(ord.average_price || ord.price || 0).toFixed(2)}
                    </td>
                    <td className="py-2 px-3 text-slate-300 whitespace-nowrap">{ord.product_type}</td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">
                        FILLED
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* TAB 4: MARGIN & RISK LEDGER */}
      {consoleTab === 'LEDGER' && (
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 font-mono">
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Cash Balance</span>
            <span className="text-sm font-extrabold text-white">
              ₹{wallet ? wallet.cashBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Used Margin</span>
            <span className="text-sm font-extrabold text-amber-400">
              ₹{wallet ? wallet.usedMargin.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Realized P&L</span>
            <span className={`text-sm font-extrabold ${(wallet?.realizedPnl || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {(wallet?.realizedPnl || 0) >= 0 ? '+' : ''}₹{(wallet?.realizedPnl || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Buying Power</span>
            <span className="text-sm font-extrabold text-emerald-400">
              ₹{wallet ? wallet.buyingPower.toLocaleString('en-IN', { minimumFractionDigits: 2 }) : '0.00'}
            </span>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="h-[calc(100vh-60px)] md:h-[calc(100vh-64px)] w-full overflow-hidden flex flex-col bg-[#0b0e14] text-slate-100 font-sans select-none">
      
      {/* ============================================================ */}
      {/* 1. TOP PRO TERMINAL HEADER BAR */}
      {/* ============================================================ */}
      <nav className="h-13 min-h-[52px] flex items-center justify-between px-3 md:px-4 bg-[#131722] border-b border-slate-800 shrink-0 z-30">
        
        {/* Left: Active Symbol Overview & OHLC Strip */}
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto scrollbar-none py-1">
          {/* Back button on mobile */}
          {isMobileViewport && (
            <button
              onClick={() => navigate(-1)}
              className="p-1 -ml-1 mr-0.5 text-slate-400 hover:text-white rounded-lg active:scale-95 transition-all"
              title="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}

          {/* Symbol & Segment Badges */}
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base tracking-tight text-white">{selectedSymbol}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              {exchange}
            </span>
            {isOption && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold uppercase bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                OPTIONS
              </span>
            )}
          </div>

          {/* Live LTP & Change with dynamic color flash */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-slate-900/80 border border-slate-800">
            <LivePriceCell
              value={currentLtp}
              prefix="₹"
              decimals={2}
              className={`!text-sm !font-black !p-0 !bg-transparent ${isGain ? '!text-emerald-400' : '!text-rose-400'}`}
            />
            <span className={`text-xs font-bold flex items-center tabular-nums ${isGain ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isGain ? <ArrowUp className="w-3 h-3 mr-0.5" /> : <ArrowDown className="w-3 h-3 mr-0.5" />}
              {Math.abs(currentChange).toFixed(2)} ({isGain ? '+' : ''}{currentChangePct.toFixed(2)}%)
            </span>
          </div>

          {/* OHLC Badges */}
          <div className="hidden xl:flex items-center gap-3 text-[11px] text-slate-400 font-mono tabular-nums">
            <span>O: <strong className="text-slate-200">{currentOpen.toFixed(2)}</strong></span>
            <span>H: <strong className="text-emerald-400">{currentHigh.toFixed(2)}</strong></span>
            <span>L: <strong className="text-rose-400">{currentLow.toFixed(2)}</strong></span>
            <span>Vol: <strong className="text-slate-200">{(currentVolume / 1000).toFixed(1)}k</strong></span>
          </div>

          {/* Day Range Bar */}
          <div className="hidden 2xl:flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
            <span>L: {currentLow.toFixed(1)}</span>
            <div className="w-20 h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
              <div 
                className="h-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500 rounded-full"
                style={{ width: `${dayRangeProgress}%` }}
              />
            </div>
            <span>H: {currentHigh.toFixed(1)}</span>
          </div>
        </div>

        {/* Right: Quick Command Search, Available Margin, Theme */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Search Trigger */}
          <div className="relative hidden md:block w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search 200,000+ scrips (Ctrl+K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0b0e14] border border-slate-800 text-xs rounded-lg pl-8 pr-7 py-1.5 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Available Margin Pill */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs">
            <span className="text-slate-400 hidden sm:inline">Margin:</span>
            <span className="font-extrabold text-emerald-400 tabular-nums">
              ₹{wallet ? wallet.cashBalance.toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '0'}
            </span>
          </div>

          {/* Theme Toggle */}
          {onToggleTheme && (
            <button
              onClick={onToggleTheme}
              className="p-1.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-xl transition-colors"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
            </button>
          )}
        </div>
      </nav>

      {/* Mobile Workspace Switcher (Visible on lg:hidden) */}
      {isMobileViewport && (
        <div className="flex lg:hidden items-center justify-around bg-[#131722] border-b border-slate-800 px-2 py-1.5 shrink-0 z-20">
          {[
            { id: 'CHART', label: 'Chart', icon: TrendingUp },
            { id: 'WATCHLIST', label: 'Watchlist', icon: List },
            { id: 'TRADE', label: 'Order Pad', icon: Zap },
            { id: 'POSITIONS', label: `Positions (${openPositions.length})`, icon: Briefcase },
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = mobileWorkspaceTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setMobileWorkspaceTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-xs'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/* 2. MAIN WORKSPACE (WATCHLIST | CHART | ORDER PAD | MOBILE CONSOLE) */}
      {/* ============================================================ */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* PANE 1: LEFT WATCHLIST & LIVE SCRIP SEARCH */}
        <div className={`${isMobileViewport ? (mobileWorkspaceTab === 'WATCHLIST' ? 'flex flex-1 w-full h-full' : 'hidden') : 'w-72 md:w-80 flex-shrink-0 flex'} bg-[#131722] border-r border-slate-800 flex-col z-20`}>
          
          {/* Watchlist Tabs */}
          <div className="p-2 border-b border-slate-800 bg-[#0b0e14]/60">
            <div className="grid grid-cols-4 gap-1 text-[11px] font-bold uppercase tracking-wider">
              {(['INDICES', 'FO', 'STOCKS', 'COMMODITIES'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveWatchlistTab(tab);
                    setSearchQuery('');
                  }}
                  className={`py-1.5 rounded-lg text-center transition-all ${
                    activeWatchlistTab === tab
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                  }`}
                >
                  {tab === 'COMMODITIES' ? 'MCX' : tab}
                </button>
              ))}
            </div>
          </div>

          {/* Watchlist Items Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {isSearching && (
              <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                <span>Searching markets...</span>
              </div>
            )}

            {!isSearching && currentList.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-500">
                No matching instruments found.
              </div>
            )}

            {!isSearching && currentList.map((item) => {
              const tick = getTick(item.token, item.symbol);
              const price = tick ? tick.ltp : item.fallbackPrice;
              const changePct = tick ? tick.changePercent : item.fallbackPct;
              const isItemGain = changePct >= 0;
              const isSelected = selectedToken === item.token;

              return (
                <div
                  key={item.token}
                  onClick={() => handleSelectInstrument(item)}
                  className={`flex justify-between items-center p-3 cursor-pointer group transition-all relative border-l-2 ${
                    isSelected
                      ? 'bg-slate-800/80 border-l-emerald-400'
                      : 'border-l-transparent hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-xs text-white truncate">{item.symbol}</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                        {item.exchange}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 truncate mt-0.5">{item.name}</span>
                  </div>

                  <div className="flex flex-col items-end font-mono tabular-nums flex-shrink-0">
                    <LivePriceCell
                      value={price}
                      prefix=""
                      decimals={2}
                      className={`!text-xs !font-bold !p-0 !bg-transparent ${isItemGain ? '!text-emerald-400' : '!text-rose-400'}`}
                    />
                    <span className={`text-[10px] font-semibold flex items-center mt-0.5 ${isItemGain ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isItemGain ? <ArrowUp className="w-2.5 h-2.5 mr-0.5" /> : <ArrowDown className="w-2.5 h-2.5 mr-0.5" />}
                      {Math.abs(changePct).toFixed(2)}%
                    </span>
                  </div>

                  {/* Quick B / S Action Buttons on Hover */}
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800/95 pl-2 py-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectInstrument(item);
                        setOrderSide('BUY');
                      }}
                      className="px-2 py-1 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 text-[11px] font-black transition-colors"
                    >
                      B
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectInstrument(item);
                        setOrderSide('SELL');
                      }}
                      className="px-2 py-1 rounded bg-rose-500/20 text-rose-400 hover:bg-rose-500 hover:text-white text-[11px] font-black transition-colors"
                    >
                      S
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="p-2 border-t border-slate-800 bg-[#0b0e14]/60 text-[10px] text-slate-500 text-center flex items-center justify-between px-3">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Dhan Feed
            </span>
            <span>{currentList.length} Symbols</span>
          </div>
        </div>

        {/* PANE 2: CENTER TRADINGVIEW CHART ENGINE */}
        <div className={`${isMobileViewport ? (mobileWorkspaceTab === 'CHART' ? 'flex flex-1 w-full h-full' : 'hidden') : 'flex-1 flex'} flex-col min-w-0 lg:min-w-[380px] bg-[#0b0e14] relative z-10 overflow-hidden`}>
          <TradingChart
            exchange={exchange}
            symbol={selectedSymbol}
            token={selectedToken}
            latestTick={currentTick}
            theme={theme}
            onBuyClick={(sym, p) => {
              setOrderSide('BUY');
              setPriceInput(p.toFixed(2));
              if (isMobileViewport) setMobileWorkspaceTab('TRADE');
            }}
            onSellClick={(sym, p) => {
              setOrderSide('SELL');
              setPriceInput(p.toFixed(2));
              if (isMobileViewport) setMobileWorkspaceTab('TRADE');
            }}
          />

          {/* Mobile Quick BUY/SELL floating action bar on chart */}
          {isMobileViewport && (
            <div className="absolute bottom-3 left-3 right-3 z-30 flex items-center gap-3">
              <button
                onClick={() => {
                  setOrderSide('BUY');
                  setMobileWorkspaceTab('TRADE');
                }}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-emerald-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span>BUY</span>
                <span className="font-mono text-xs font-extrabold opacity-90">₹{currentLtp.toFixed(2)}</span>
              </button>
              <button
                onClick={() => {
                  setOrderSide('SELL');
                  setMobileWorkspaceTab('TRADE');
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-rose-500/25 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span>SELL</span>
                <span className="font-mono text-xs font-extrabold opacity-90">₹{currentLtp.toFixed(2)}</span>
              </button>
            </div>
          )}
        </div>

        {/* PANE 3: RIGHT ORDER ENTRY & 5-LEVEL DEPTH */}
        <div className={`${isMobileViewport ? (mobileWorkspaceTab === 'TRADE' ? 'flex flex-1 w-full h-full' : 'hidden') : 'w-80 md:w-84 flex-shrink-0 flex'} bg-[#131722] border-l border-slate-800 flex-col overflow-y-auto`}>
          
          {/* Order Placement Box */}
          <div className="p-4 border-b border-slate-800 bg-[#0b0e14]/50 relative">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm text-white">Order Entry</h3>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-extrabold uppercase">
                {selectedSymbol}
              </span>
            </div>

            {/* BUY / SELL TOGGLE */}
            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl mb-3 font-bold text-xs">
              <button
                onClick={() => setOrderSide('BUY')}
                className={`py-2 rounded-lg transition-all ${
                  orderSide === 'BUY'
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                BUY
              </button>
              <button
                onClick={() => setOrderSide('SELL')}
                className={`py-2 rounded-lg transition-all ${
                  orderSide === 'SELL'
                    ? 'bg-rose-500 text-white font-black shadow-lg shadow-rose-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                SELL
              </button>
            </div>

            {/* PRODUCT TYPE (MIS / NRML / CNC) */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl mb-3 text-[11px] font-bold">
              <button
                onClick={() => setProductType('MIS')}
                className={`py-1 rounded-lg transition-all ${
                  productType === 'MIS'
                    ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Intraday Margin (Auto square-off before market close)"
              >
                MIS (Intra)
              </button>
              <button
                onClick={() => setProductType('NRML')}
                className={`py-1 rounded-lg transition-all ${
                  productType === 'NRML'
                    ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Normal Carry Forward for Derivatives"
              >
                NRML (Carry)
              </button>
              <button
                onClick={() => setProductType('CNC')}
                className={`py-1 rounded-lg transition-all ${
                  productType === 'CNC'
                    ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Cash & Carry (Delivery Equity)"
              >
                CNC (Deliv)
              </button>
            </div>

            {/* ORDER TYPE (MARKET / LIMIT / SL / SL_M) */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl mb-3 text-[10px] font-bold">
              {(['LIMIT', 'MARKET', 'SL', 'SL_M'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setOrderType(type)}
                  className={`py-1 rounded-md transition-all ${
                    orderType === type
                      ? 'bg-slate-800 text-white border border-slate-700'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {type === 'SL_M' ? 'SL-M' : type}
                </button>
              ))}
            </div>

            {/* QTY / LOTS & PRICE INPUTS */}
            <div className="space-y-3 mb-3">
              {/* Lots & Quantity */}
              <div>
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold mb-1">
                  <span>LOTS / QTY</span>
                  <span className="font-mono text-emerald-400">Lot Size: {lotSize}</span>
                </div>
                <div className="flex items-center gap-2">
                  {lotSize > 1 && (
                    <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                      <button 
                        onClick={() => setLots(Math.max(1, lots - 1))}
                        className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded text-sm font-bold"
                      >
                        -
                      </button>
                      <span className="w-8 text-center text-xs font-bold text-white font-mono">{lots}</span>
                      <button 
                        onClick={() => setLots(lots + 1)}
                        className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-800 rounded text-sm font-bold"
                      >
                        +
                      </button>
                    </div>
                  )}
                  <input
                    type="number"
                    min="1"
                    value={quantity}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value) || 1);
                      setQuantity(val);
                      if (lotSize > 1) {
                        setLots(Math.max(1, Math.round(val / lotSize)));
                      }
                    }}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500 tabular-nums"
                  />
                </div>

                {/* Quick Lot Multipliers for F&O */}
                {lotSize > 1 && (
                  <div className="flex gap-1.5 mt-1.5">
                    {[1, 2, 5, 10].map((multiplier) => (
                      <button
                        key={multiplier}
                        type="button"
                        onClick={() => setLots(multiplier)}
                        className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                          lots === multiplier
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-bold'
                            : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {multiplier}x ({multiplier * lotSize})
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Limit Price */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  PRICE (₹)
                </label>
                <input
                  type="number"
                  step="0.05"
                  disabled={orderType === 'MARKET' || orderType === 'SL_M'}
                  value={orderType === 'MARKET' || orderType === 'SL_M' ? currentLtp.toFixed(2) : priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500 tabular-nums disabled:opacity-40"
                />
              </div>

              {/* Trigger Price for SL / SL_M */}
              {(orderType === 'SL' || orderType === 'SL_M') && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-amber-400 mb-1">
                    TRIGGER PRICE (₹)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={triggerPriceInput}
                    onChange={(e) => setTriggerPriceInput(e.target.value)}
                    className="w-full bg-slate-900 border border-amber-500/40 rounded-lg px-3 py-1.5 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400 tabular-nums"
                  />
                </div>
              )}
            </div>

            {/* MARGIN & FUNDS CHECK */}
            <div className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl mb-3 space-y-1 text-xs font-mono">
              <div className="flex justify-between items-center">
                <span className="text-slate-400">Margin Required</span>
                <span className="font-bold text-white tabular-nums">₹{requiredMargin.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-[11px]">
                <span className="text-slate-500">Available Funds</span>
                <span className={`font-bold tabular-nums ${isMarginSufficient ? 'text-emerald-400' : 'text-rose-400'}`}>
                  ₹{availableFunds.toFixed(2)}
                </span>
              </div>
            </div>

            {/* ACTION FEEDBACK ALERT */}
            {orderFeedback && (
              <div className={`mb-3 p-2.5 rounded-xl text-xs font-bold border flex items-start gap-2 ${
                orderFeedback.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              }`}>
                {orderFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                )}
                <span>{orderFeedback.message}</span>
              </div>
            )}

            {/* PLACE ORDER BUTTON */}
            <button
              onClick={handleExecuteOrder}
              disabled={orderSubmitting}
              className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md active:scale-[0.98] flex items-center justify-center gap-2 ${
                orderSide === 'BUY'
                  ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/25'
                  : 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-500/25'
              }`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span>{orderSubmitting ? 'Submitting Order...' : `Place ${orderSide} Order`}</span>
            </button>
          </div>

          {/* 5-LEVEL L2 MARKET DEPTH */}
          <div className="p-4 flex-1">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-bold text-xs text-white flex items-center gap-1.5">
                <span>Market Depth (L2)</span>
                <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">5x5</span>
              </h4>
              <span className="text-[10px] text-slate-500 font-mono">Click row to set price</span>
            </div>

            {/* Buyer vs Seller Ratio Bar */}
            <div className="mb-2">
              <div className="flex justify-between text-[10px] font-mono mb-1">
                <span className="text-emerald-400 font-bold">{buyerPct}% Buyers</span>
                <span className="text-rose-400 font-bold">{sellerPct}% Sellers</span>
              </div>
              <div className="w-full h-1.5 bg-rose-500/40 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: `${buyerPct}%` }} />
              </div>
            </div>

            {/* 5-Level Depth Table */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              {/* Bids */}
              <div>
                <div className="flex justify-between text-[10px] text-slate-400 border-b border-slate-800 pb-1 uppercase font-bold">
                  <span>Bid Qty</span>
                  <span>Bid</span>
                </div>
                <div className="space-y-1 mt-1">
                  {depthLevels.map((lvl, idx) => (
                    <div 
                      key={idx}
                      onClick={() => {
                        setPriceInput(lvl.bidPrice.toFixed(2));
                        setOrderType('LIMIT');
                      }}
                      className="flex justify-between py-1 px-1 rounded cursor-pointer hover:bg-emerald-500/20 relative group transition-colors"
                    >
                      <span className="tabular-nums text-slate-400 text-[11px]">{lvl.bidQty}</span>
                      <span className="tabular-nums text-emerald-400 font-bold text-[11px]">{lvl.bidPrice.toFixed(2)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-1 border-t border-slate-800 text-[10px] text-slate-400 font-bold">
                    <span>Total</span>
                    <span className="text-emerald-400">{totalBidQty.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>

              {/* Asks */}
              <div>
                <div className="flex justify-between text-[10px] text-slate-400 border-b border-slate-800 pb-1 uppercase font-bold">
                  <span>Ask</span>
                  <span>Ask Qty</span>
                </div>
                <div className="space-y-1 mt-1">
                  {depthLevels.map((lvl, idx) => (
                    <div 
                      key={idx}
                      onClick={() => {
                        setPriceInput(lvl.askPrice.toFixed(2));
                        setOrderType('LIMIT');
                      }}
                      className="flex justify-between py-1 px-1 rounded cursor-pointer hover:bg-rose-500/20 relative group transition-colors"
                    >
                      <span className="tabular-nums text-rose-400 font-bold text-[11px]">{lvl.askPrice.toFixed(2)}</span>
                      <span className="tabular-nums text-slate-400 text-[11px]">{lvl.askQty}</span>
                    </div>
                  ))}
                  <div className="flex justify-between pt-1 border-t border-slate-800 text-[10px] text-slate-400 font-bold">
                    <span>Total</span>
                    <span className="text-rose-400">{totalAskQty.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* PANE 4 (MOBILE ONLY): FULL SCREEN POSITIONS, ORDERS & CONSOLE */}
        {isMobileViewport && mobileWorkspaceTab === 'POSITIONS' && (
          <div className="flex-1 w-full h-full bg-[#131722] flex flex-col overflow-hidden">
            {/* Console Tabs Bar */}
            <div className="flex items-center justify-between px-3 py-2 bg-[#0b0e14] border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
                <button
                  onClick={() => setConsoleTab('POSITIONS')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    consoleTab === 'POSITIONS'
                      ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Positions</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900 text-slate-300 font-mono">
                    {openPositions.length}
                  </span>
                </button>

                <button
                  onClick={() => setConsoleTab('ORDERS')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    consoleTab === 'ORDERS'
                      ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Orders</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900 text-slate-300 font-mono">
                    {pendingOrders.length}
                  </span>
                </button>

                <button
                  onClick={() => setConsoleTab('TRADES')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                    consoleTab === 'TRADES'
                      ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Trades</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900 text-slate-300 font-mono">
                    {filledOrders.length}
                  </span>
                </button>

                <button
                  onClick={() => setConsoleTab('LEDGER')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                    consoleTab === 'LEDGER'
                      ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Margin
                </button>
              </div>

              <div className="flex items-center gap-2">
                {openPositions.length > 0 && (
                  <span className={`text-xs font-mono font-black tabular-nums ${totalUnrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {totalUnrealizedPnl >= 0 ? '+' : ''}₹{totalUnrealizedPnl.toFixed(2)}
                  </span>
                )}
                <button
                  onClick={fetchPositionsAndOrders}
                  className="p-1 text-slate-400 hover:text-white transition-colors"
                  title="Refresh Console"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Console Tab Content */}
            <div className="flex-1 overflow-auto">
              {renderConsoleContent()}
            </div>
          </div>
        )}

      </div>

      {/* ============================================================ */}
      {/* 3. DOCKED BOTTOM CONSOLE (DESKTOP ONLY) */}
      {/* ============================================================ */}
      {!isMobileViewport && isConsoleOpen && (
        <div className={`border-t border-slate-800 bg-[#131722] flex flex-col transition-all duration-200 z-30 shrink-0 ${
          consoleHeight === 'expanded' ? 'h-72' : 'h-48'
        }`}>
          
          {/* Console Header Bar with Tabs & Actions */}
          <div className="flex items-center justify-between px-4 py-1.5 bg-[#0b0e14] border-b border-slate-800">
            {/* Tabs */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConsoleTab('POSITIONS')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  consoleTab === 'POSITIONS'
                    ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Positions</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900 text-slate-300 font-mono">
                  {openPositions.length}
                </span>
              </button>

              <button
                onClick={() => setConsoleTab('ORDERS')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  consoleTab === 'ORDERS'
                    ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Pending Orders</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900 text-slate-300 font-mono">
                  {pendingOrders.length}
                </span>
              </button>

              <button
                onClick={() => setConsoleTab('TRADES')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                  consoleTab === 'TRADES'
                    ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>Trade Book</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900 text-slate-300 font-mono">
                  {filledOrders.length}
                </span>
              </button>

              <button
                onClick={() => setConsoleTab('LEDGER')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  consoleTab === 'LEDGER'
                    ? 'bg-slate-800 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Margin & Risk
              </button>
            </div>

            {/* Right: Live Total P&L & Console Size Toggles */}
            <div className="flex items-center gap-3">
              {openPositions.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs font-mono">
                  <span className="text-slate-400">Total P&L:</span>
                  <span className={`font-black tabular-nums ${totalUnrealizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {totalUnrealizedPnl >= 0 ? '+' : ''}₹{totalUnrealizedPnl.toFixed(2)}
                  </span>
                </div>
              )}

              <button
                onClick={fetchPositionsAndOrders}
                className="p-1 text-slate-400 hover:text-white transition-colors"
                title="Refresh Console"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setConsoleHeight(consoleHeight === 'compact' ? 'expanded' : 'compact')}
                className="p-1 text-slate-400 hover:text-white transition-colors"
                title={consoleHeight === 'compact' ? 'Expand Console' : 'Compact Console'}
              >
                {consoleHeight === 'compact' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              <button
                onClick={() => setIsConsoleOpen(false)}
                className="p-1 text-slate-400 hover:text-white transition-colors"
                title="Hide Console"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Console Tab Contents */}
          <div className="flex-1 overflow-auto">
            {renderConsoleContent()}
          </div>

        </div>
      )}

      {/* Floating Re-Open Button when Console is closed */}
      {!isMobileViewport && !isConsoleOpen && (
        <button
          onClick={() => setIsConsoleOpen(true)}
          className="fixed bottom-4 left-4 z-40 px-3 py-1.5 rounded-xl bg-[#131722] border border-slate-800 text-xs font-bold text-slate-300 hover:text-white shadow-xl flex items-center gap-1.5 transition-all"
        >
          <ChevronUp className="w-4 h-4 text-emerald-400" />
          <span>Open Positions ({openPositions.length})</span>
        </button>
      )}

    </div>
  );
};
