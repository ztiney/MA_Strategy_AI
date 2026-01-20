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

// Fetch 4H candles with multi-strategy redundancy
export const fetchKlines = async (symbol: string, limit: number = 300): Promise<Kline[]> => {
  // Use unique timestamp to prevent caching
  const ts = Date.now();
  const binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=4h&limit=${limit}`;
  const dataApiUrl = `https://data-api.binance.vision/api/v3/klines?symbol=${symbol}&interval=4h&limit=${limit}`;

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

  console.error(`All fetch strategies failed for ${symbol}. This usually indicates a network block or API rate limit.`);
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

export const analyzeSymbol = async (symbol: string): Promise<TradeSetup | null> => {
  const klines = await fetchKlines(symbol);
  if (klines.length < 150) return null; // Need enough data

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

  // Check valid calculations
  if (!mas.ma120 || !mas.ema120) return null;

  // --- 1. Density Calculation (Spread of 6 lines) ---
  const allValues = Object.values(mas);
  const maxVal = Math.max(...allValues);
  const minVal = Math.min(...allValues);
  const spread = maxVal - minVal;
  const densityScore = (spread / currentPrice) * 100; // Spread Percentage

  // --- 2. Price Deviation Calculation ---
  // How far is the price from the "center" of the moving averages?
  // If Price is too far away, it's not a consolidation, it's a breakout/runaway.
  const averageMA = allValues.reduce((sum, val) => sum + val, 0) / allValues.length;
  const priceDeviation = Math.abs(currentPrice - averageMA) / currentPrice * 100;

  // Thresholds for 4H chart
  const DENSE_THRESHOLD = 2.0; // Lines must be within 2% of each other
  const PRICE_DEV_THRESHOLD = 3.0; // Price must be within 3% of the MA center

  // Strict Definition of "Watch/Consolidation":
  // 1. MAs are tight.
  // 2. Price is still NEAR the MAs (hasn't pumped/dumped away yet).
  const isDense = (densityScore < DENSE_THRESHOLD) && (priceDeviation < PRICE_DEV_THRESHOLD);

  let signal = SignalType.WAIT;
  let reason = "均线发散，无明确形态";

  // Trend determination using Long Term lines
  const isBullishAlignment = mas.ma20 > mas.ma60 && mas.ma60 > mas.ma120;
  const isBearishAlignment = mas.ma20 < mas.ma60 && mas.ma60 < mas.ma120;

  if (isDense) {
    signal = SignalType.WATCH;
    reason = `6线高度密集 (宽${densityScore.toFixed(2)}%) 且价格在均线附近 (偏${priceDeviation.toFixed(2)}%)，静待变盘。`;
  } else {
    // If MAs are tight but Price is far, it fails isDense and falls here.
    
    if (isBullishAlignment && currentPrice > maxVal) {
      signal = SignalType.LONG;
      reason = "均线多头排列 (MA20>60>120) 且价格站上所有均线，趋势向上。";
    } else if (isBearishAlignment && currentPrice < minVal) {
      signal = SignalType.SHORT;
      reason = "均线空头排列 (MA20<60<120) 且价格跌破所有均线，趋势向下。";
    } else if (densityScore < DENSE_THRESHOLD && priceDeviation >= PRICE_DEV_THRESHOLD) {
       // Special case: MAs are tight, but Price ran away
       signal = SignalType.WAIT;
       reason = `均线虽然密集，但价格已大幅偏离 (${priceDeviation.toFixed(2)}%)，不宜追单，防范回落。`;
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
    price: currentPrice,
    mas,
    densityScore,
    atr,
    signal,
    entryPrice: currentPrice,
    stopLoss,
    takeProfit,
    isDense,
    reason
  };
};