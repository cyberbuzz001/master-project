export interface FnOStock {
  symbol: string;
  name: string;
  exchange: string;
  symbolToken: string;
  internalToken: string;
  price: number;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePercent: number;
  volume: number;
  sparkline: number[];
  logo: string;
}

export class FnOStockService {
  private static instance: FnOStockService;

  public static getInstance(): FnOStockService {
    if (!FnOStockService.instance) {
      FnOStockService.instance = new FnOStockService();
    }
    return FnOStockService.instance;
  }

  // Official NSE F&O Stocks Master
  private stocks: FnOStock[] = [
    { symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'NSE', symbolToken: '2885', internalToken: 'NSE_RELIANCE', price: 3014.20, open: 2950.00, high: 3025.00, low: 2940.00, close: 2945.80, change: 68.40, changePercent: 2.32, volume: 4521102, sparkline: [2940, 2960, 2980, 2975, 3000, 3014.2], logo: '🔵' },
    { symbol: 'TCS', name: 'Tata Consultancy', exchange: 'NSE', symbolToken: '11536', internalToken: 'NSE_TCS', price: 4210.50, open: 4120.00, high: 4225.00, low: 4110.00, close: 4118.40, change: 92.10, changePercent: 2.24, volume: 1840920, sparkline: [4110, 4130, 4150, 4190, 4210.5], logo: '🟦' },
    { symbol: 'INFY', name: 'Infosys Limited', exchange: 'NSE', symbolToken: '1594', internalToken: 'NSE_INFY', price: 1890.30, open: 1905.00, high: 1912.00, low: 1885.00, close: 1902.70, change: -12.40, changePercent: -0.65, volume: 3210400, sparkline: [1910, 1905, 1898, 1892, 1890.3], logo: '🔹' },
    { symbol: 'HDFCBANK', name: 'HDFC Bank', exchange: 'NSE', symbolToken: '1333', internalToken: 'NSE_HDFCBANK', price: 1642.80, open: 1630.00, high: 1650.00, low: 1625.00, close: 1628.50, change: 14.30, changePercent: 0.88, volume: 8940120, sparkline: [1625, 1630, 1635, 1640, 1642.8], logo: '🏦' },
    { symbol: 'ICICIBANK', name: 'ICICI Bank', exchange: 'NSE', symbolToken: '4963', internalToken: 'NSE_ICICIBANK', price: 1210.45, open: 1195.00, high: 1215.00, low: 1190.00, close: 1192.10, change: 18.35, changePercent: 1.54, volume: 6420100, sparkline: [1190, 1195, 1200, 1205, 1210.45], logo: '🏦' },
    { symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE', symbolToken: '3045', internalToken: 'NSE_SBIN', price: 845.60, open: 830.00, high: 850.00, low: 828.00, close: 831.20, change: 14.40, changePercent: 1.73, volume: 9812400, sparkline: [828, 835, 838, 842, 845.6], logo: '🏛️' },
    { symbol: 'BHARTIARTL', name: 'Bharti Airtel', exchange: 'NSE', symbolToken: '10604', internalToken: 'NSE_BHARTIARTL', price: 1485.30, open: 1460.00, high: 1492.00, low: 1455.00, close: 1458.10, change: 27.20, changePercent: 1.87, volume: 5412030, sparkline: [1455, 1465, 1470, 1480, 1485.3], logo: '📡' },
    { symbol: 'TATAMOTORS', name: 'Tata Motors', exchange: 'NSE', symbolToken: '3456', internalToken: 'NSE_TATAMOTORS', price: 1024.15, open: 990.00, high: 1030.00, low: 988.00, close: 992.00, change: 32.15, changePercent: 3.24, volume: 11204000, sparkline: [988, 995, 1005, 1015, 1024.15], logo: '🚗' },
    { symbol: 'TATASTEEL', name: 'Tata Steel', exchange: 'NSE', symbolToken: '3499', internalToken: 'NSE_TATASTEEL', price: 168.40, open: 162.00, high: 170.00, low: 161.50, close: 162.10, change: 6.30, changePercent: 3.89, volume: 18450100, sparkline: [161.5, 163, 165, 167, 168.4], logo: '⚙️' },
    { symbol: 'HAL', name: 'Hindustan Aeronaut.', exchange: 'NSE', symbolToken: '2303', internalToken: 'NSE_HAL', price: 4886.70, open: 4640.00, high: 4910.00, low: 4600.00, close: 4645.00, change: 241.70, changePercent: 5.20, volume: 2818585, sparkline: [4600, 4650, 4720, 4820, 4886.7], logo: '✈️' },
    { symbol: 'MARUTI', name: 'Maruti Suzuki', exchange: 'NSE', symbolToken: '10999', internalToken: 'NSE_MARUTI', price: 12450.00, open: 12200.00, high: 12500.00, low: 12180.00, close: 12210.00, change: 240.00, changePercent: 1.97, volume: 842100, sparkline: [12180, 12250, 12320, 12400, 12450], logo: '🏎️' },
    { symbol: 'BAJFINANCE', name: 'Bajaj Finance', exchange: 'NSE', symbolToken: '317', internalToken: 'NSE_BAJFINANCE', price: 6890.10, open: 7000.00, high: 7020.00, low: 6850.00, close: 7012.00, change: -121.90, changePercent: -1.74, volume: 1420500, sparkline: [7010, 6980, 6930, 6900, 6890.1], logo: '💳' },
    { symbol: 'SUNPHARMA', name: 'Sun Pharma', exchange: 'NSE', symbolToken: '3351', internalToken: 'NSE_SUNPHARMA', price: 1720.80, open: 1690.00, high: 1730.00, low: 1685.00, close: 1692.00, change: 28.80, changePercent: 1.70, volume: 2104000, sparkline: [1685, 1695, 1705, 1715, 1720.8], logo: '💊' },
    { symbol: 'ITC', name: 'ITC Limited', exchange: 'NSE', symbolToken: '1660', internalToken: 'NSE_ITC', price: 495.20, open: 490.00, high: 498.00, low: 488.00, close: 489.50, change: 5.70, changePercent: 1.16, volume: 12405000, sparkline: [488, 490, 492, 494, 495.2], logo: '🚬' },
    { symbol: 'HINDUNILVR', name: 'Hindustan Unilever', exchange: 'NSE', symbolToken: '1394', internalToken: 'NSE_HINDUNILVR', price: 2710.00, open: 2740.00, high: 2750.00, low: 2695.00, close: 2742.00, change: -32.00, changePercent: -1.17, volume: 1840200, sparkline: [2740, 2730, 2720, 2715, 2710], logo: '🧼' },
    { symbol: 'NTPC', name: 'NTPC Limited', exchange: 'NSE', symbolToken: '11630', internalToken: 'NSE_NTPC', price: 412.30, open: 398.00, high: 415.00, low: 396.00, close: 397.50, change: 14.80, changePercent: 3.72, volume: 16402100, sparkline: [396, 402, 408, 410, 412.3], logo: '⚡' },
    { symbol: 'POWERGRID', name: 'Power Grid Corp', exchange: 'NSE', symbolToken: '14977', internalToken: 'NSE_POWERGRID', price: 348.60, open: 338.00, high: 351.00, low: 336.00, close: 337.20, change: 11.40, changePercent: 3.38, volume: 14201000, sparkline: [336, 340, 344, 346, 348.6], logo: '🔌' },
    { symbol: 'M&M', name: 'Mahindra & Mahindra', exchange: 'NSE', symbolToken: '2031', internalToken: 'NSE_M&M', price: 2940.50, open: 2880.00, high: 2960.00, low: 2870.00, close: 2875.00, change: 65.50, changePercent: 2.28, volume: 3210400, sparkline: [2870, 2890, 2910, 2930, 2940.5], logo: '🚜' },
    { symbol: 'TITAN', name: 'Titan Company', exchange: 'NSE', symbolToken: '3506', internalToken: 'NSE_TITAN', price: 3480.00, open: 3520.00, high: 3530.00, low: 3460.00, close: 3525.00, change: -45.00, changePercent: -1.28, volume: 980400, sparkline: [3520, 3500, 3490, 3485, 3480], logo: '⌚' },
    { symbol: 'ULTRACEMCO', name: 'UltraTech Cement', exchange: 'NSE', symbolToken: '11532', internalToken: 'NSE_ULTRACEMCO', price: 11450.00, open: 11200.00, high: 11500.00, low: 11180.00, close: 11210.00, change: 240.00, changePercent: 2.14, volume: 420100, sparkline: [11180, 11250, 11320, 11400, 11450], logo: '🏗️' },
    { symbol: 'ADANIENT', name: 'Adani Enterprises', exchange: 'NSE', symbolToken: '25', internalToken: 'NSE_ADANIENT', price: 3180.40, open: 3080.00, high: 3210.00, low: 3060.00, close: 3072.00, change: 108.40, changePercent: 3.53, volume: 5410200, sparkline: [3060, 3100, 3140, 3160, 3180.4], logo: '🏢' },
    { symbol: 'ADANIPORTS', name: 'Adani Ports & SEZ', exchange: 'NSE', symbolToken: '15083', internalToken: 'NSE_ADANIPORTS', price: 1540.20, open: 1500.00, high: 1555.00, low: 1495.00, close: 1498.00, change: 42.20, changePercent: 2.82, volume: 6420100, sparkline: [1495, 1510, 1525, 1535, 1540.2], logo: '⚓' },
    { symbol: 'LT', name: 'Larsen & Toubro', exchange: 'NSE', symbolToken: '11483', internalToken: 'NSE_LT', price: 3680.50, open: 3620.00, high: 3710.00, low: 3615.00, close: 3618.90, change: 61.60, changePercent: 1.70, volume: 2145000, sparkline: [3615, 3635, 3655, 3670, 3680.5], logo: '🏗️' },
    { symbol: 'AXISBANK', name: 'Axis Bank', exchange: 'NSE', symbolToken: '5900', internalToken: 'NSE_AXISBANK', price: 1185.20, open: 1165.00, high: 1192.00, low: 1160.00, close: 1162.80, change: 22.40, changePercent: 1.93, volume: 5410200, sparkline: [1160, 1170, 1175, 1182, 1185.2], logo: '🏦' },
    { symbol: 'KALYANKJIL', name: 'Kalyan Jewellers', exchange: 'NSE', symbolToken: '18290', internalToken: 'NSE_KALYANKJIL', price: 612.40, open: 585.00, high: 620.00, low: 580.00, close: 584.20, change: 28.20, changePercent: 4.83, volume: 7890200, sparkline: [580, 590, 600, 608, 612.40], logo: '💎' },
  ];

  public getAllStocks(): FnOStock[] {
    return this.stocks;
  }

  public getTopMovers(): {
    gainers: FnOStock[];
    losers: FnOStock[];
    volumeShockers: FnOStock[];
    allStocks: FnOStock[];
  } {
    const sortedByGain = [...this.stocks].sort((a, b) => b.changePercent - a.changePercent);
    const sortedByLoss = [...this.stocks].sort((a, b) => a.changePercent - b.changePercent);
    const sortedByVolume = [...this.stocks].sort((a, b) => b.volume - a.volume);

    return {
      gainers: sortedByGain.slice(0, 8),
      losers: sortedByLoss.slice(0, 8),
      volumeShockers: sortedByVolume.slice(0, 8),
      allStocks: this.stocks,
    };
  }
}

export const fnOStockService = FnOStockService.getInstance();
