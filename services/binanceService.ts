import { Kline, TradeSetup, SignalType, MASet } from '../types';

// Helper to format raw Binance data
const mapData = (data: any[]): Kline[] => {
  if (!Array.isArray(data)) return [];
  return data.map((d: any[]) => ({
    openTime: d[0],
    open: d[1],
    high: d[2],
    low: d[3],
    close: d[4],
    volume: d[5],
    closeTime: d[6]
  }));
};

// Fetch candles with interval support
export const fetchKlines = async (symbol: string, interval: string, limit: number = 300): Promise<Kline[]> => {
  // Use unique timestamp to prevent caching
  const ts = Date.now();
  const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const dataApiUrl = `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;

  // Define strategies in order of preference
  const strategies = [
    {
      name: 'Binance Data API (Direct)',
      getUrl: () => `${dataApiUrl}&_t=${ts}`,
      useHeaders: true
    },
    {
      name: 'CodeTabs Proxy',
      getUrl: () => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(binanceUrl)}`,
      useHeaders: false
    },
    {
      name: 'CORS Proxy (corsproxy.io)',
      getUrl: () => `https://corsproxy.io/?${encodeURIComponent(binanceUrl)}`,
      useHeaders: false
    },
    {
      name: 'AllOrigins (Raw)',
      getUrl: () => `https://api.allorigins.win/raw?url=${encodeURIComponent(binanceUrl)}`,
      useHeaders: false
    },
    {
        name: 'AllOrigins (JSON)',
        getUrl: () => `https://api.allorigins.win/get?url=${encodeURIComponent(binanceUrl)}`,
        isJsonWrapper: true,
        useHeaders: false
    }
  ];

  for (const strategy of strategies) {
    try {
      const url = strategy.getUrl();
      const options: RequestInit = { method: 'GET' };
      
      // Only add headers if the strategy supports it (direct usually does, proxies often fail preflight with custom headers)
      if (strategy.useHeaders) {
          options.headers = {
              'Cache-Control': 'no-cache',
              'Pragma': 'no-cache'
          };
      }

      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      let data = await response.json();

      // Handle AllOrigins JSON wrapper
      if (strategy.isJsonWrapper && data.contents) {
          try {
            data = JSON.parse(data.contents);
          } catch(e) {
             throw new Error("Failed to parse inner JSON from AllOrigins");
          }
      }
      
      // Basic validation to ensure we got an array
      if (Array.isArray(data) && data.length > 0) {
        return mapData(data);
      } else if (data.code && data.msg) {
         throw new Error(`API Error: ${data.msg}`);
      } else {
        throw new Error('Invalid data format received');
      }
    } catch (error) {
       // Silent fail to try next strategy
    }
  }

  console.error(`All fetch strategies failed for ${symbol} ${interval}.`);
  return [];
};

const calculateEMA = (klines: Kline[], period: number): number[] => {
  if (klines.length < period) return [];
  const k = 2 / (period + 1);
  let emaArray: number[] = [];
  
  // Initial SMA as first EMA
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += parseFloat(klines[i].close);
  }
  let previousEma = sum / period;
  // Fill initial undefined periods to align array indices
  for(let i=0; i<period-1; i++) emaArray.push(0); 
  emaArray.push(previousEma);

  for (let i = period; i < klines.length; i++) {
    const close = parseFloat(klines[i].close);
    const currentEma = close * k + previousEma * (1 - k);
    emaArray.push(currentEma);
    previousEma = currentEma;
  }
  return emaArray;
};

const calculateSMA = (klines: Kline[], period: number): number[] => {
  if (klines.length < period) return [];
  let smaArray: number[] = [];
  
  // Pad beginning
  for(let i=0; i<period-1; i++) smaArray.push(0);

  for (let i = period - 1; i < klines.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) {
      sum += parseFloat(klines[i - j].close);
    }
    smaArray.push(sum / period);
  }
  return smaArray;
};

const calculateATR = (klines: Kline[], period: number = 14): number => {
  if (klines.length < period + 1) return 0;
  let trSum = 0;
  for (let i = klines.length - period; i < klines.length; i++) {
    const high = parseFloat(klines[i].high);
    const low = parseFloat(klines[i].low);
    const prevClose = parseFloat(klines[i-1].close);
    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trSum += tr;
  }
  return trSum / period;
};

const analyzeInterval = async (symbol: string, interval: '1h' | '4h'): Promise<TradeSetup | null> => {
  const klines = await fetchKlines(symbol, interval);
  if (klines.length < 150) return null;

  const currentPrice = parseFloat(klines[klines.length - 1].close);
  const atr = calculateATR(klines, 14);

  // Calculate the 6 lines
  const ma20Arr = calculateSMA(klines, 20);
  const ma60Arr = calculateSMA(klines, 60);
  const ma120Arr = calculateSMA(klines, 120);
  const ema20Arr = calculateEMA(klines, 20);
  const ema60Arr = calculateEMA(klines, 60);
  const ema120Arr = calculateEMA(klines, 120);

  const mas: MASet = {
    ma20: ma20Arr[ma20Arr.length - 1],
    ma60: ma60Arr[ma60Arr.length - 1],
    ma120: ma120Arr[ma120Arr.length - 1],
    ema20: ema20Arr[ema20Arr.length - 1],
    ema60: ema60Arr[ema60Arr.length - 1],
    ema120: ema120Arr[ema120Arr.length - 1],
  };

  if (!mas.ma120 || !mas.ema120) return null;

  // --- 1. Density Calculation ---
  const allValues = Object.values(mas);
  const maxVal = Math.max(...allValues);
  const minVal = Math.min(...allValues);
  const spread = maxVal - minVal;
  const densityScore = (spread / currentPrice) * 100;

  // --- 2. Price Deviation ---
  const averageMA = allValues.reduce((sum, val) => sum + val, 0) / allValues.length;
  const priceDeviation = Math.abs(currentPrice - averageMA) / currentPrice * 100;

  // Thresholds (Slightly looser for 1H might be needed, but keeping consistent for now)
  const DENSE_THRESHOLD = 2.0; 
  const PRICE_DEV_THRESHOLD = 3.0;

  const isDense = (densityScore < DENSE_THRESHOLD) && (priceDeviation < PRICE_DEV_THRESHOLD);

  let signal = SignalType.WAIT;
  let reason = `[${interval}] 均线发散，无明确形态`;

  const isBullishAlignment = mas.ma20 > mas.ma60 && mas.ma60 > mas.ma120;
  const isBearishAlignment = mas.ma20 < mas.ma60 && mas.ma60 < mas.ma120;

  if (isDense) {
    signal = SignalType.WATCH;
    reason = `[${interval}] 6线高度密集 (宽${densityScore.toFixed(2)}%) 且价格在均线附近，关注变盘。`;
  } else {
    if (isBullishAlignment && currentPrice > maxVal) {
      signal = SignalType.LONG;
      reason = `[${interval}] 均线多头排列且价格站上所有均线。`;
    } else if (isBearishAlignment && currentPrice < minVal) {
      signal = SignalType.SHORT;
      reason = `[${interval}] 均线空头排列且价格跌破所有均线。`;
    } else if (densityScore < DENSE_THRESHOLD && priceDeviation >= PRICE_DEV_THRESHOLD) {
       signal = SignalType.WAIT;
       reason = `[${interval}] 均线密集但价格偏离过大 (${priceDeviation.toFixed(2)}%)。`;
    }
  }

  // Calculate SL/TP
  let stopLoss = 0;
  let takeProfit = 0;
  const slBuffer = atr * 2; 

  if (signal === SignalType.LONG || signal === SignalType.WATCH) {
    stopLoss = minVal - slBuffer; 
    takeProfit = currentPrice + (currentPrice - stopLoss) * 2; 
  } else {
    stopLoss = maxVal + slBuffer; 
    takeProfit = currentPrice - (stopLoss - currentPrice) * 2;
  }

  return {
    symbol,
    interval,
    price: currentPrice,
    mas,
    densityScore,
    priceDeviation,
    atr,
    signal,
    entryPrice: currentPrice,
    stopLoss,
    takeProfit,
    isDense,
    reason
  };
};

// Main Export: dual timeframe analysis
export const analyzeSymbol = async (symbol: string): Promise<TradeSetup | null> => {
  // Parallel fetch for speed, but error handled individually inside
  const [setup4h, setup1h] = await Promise.all([
    analyzeInterval(symbol, '4h'),
    analyzeInterval(symbol, '1h')
  ]);

  // Priority Logic to decide which one to show:
  
  // 1. WATCH (Dense) is the most valuable signal
  if (setup4h?.signal === SignalType.WATCH) return setup4h;
  if (setup1h?.signal === SignalType.WATCH) return setup1h;

  // 2. Trend (LONG/SHORT) is next
  if (setup4h && (setup4h.signal === SignalType.LONG || setup4h.signal === SignalType.SHORT)) return setup4h;
  if (setup1h && (setup1h.signal === SignalType.LONG || setup1h.signal === SignalType.SHORT)) return setup1h;

  // 3. Fallback to 4H if it exists, else 1H
  return setup4h || setup1h || null;
};