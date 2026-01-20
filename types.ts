export interface Kline {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
}

export enum SignalType {
  LONG = '做多 (Long)',
  SHORT = '做空 (Short)',
  WAIT = '观望 (Wait)',
  WATCH = '密集关注 (Watch)' // Dense consolidation
}

export interface MASet {
  ma20: number;
  ma60: number;
  ma120: number;
  ema20: number;
  ema60: number;
  ema120: number;
}

export interface TradeSetup {
  symbol: string;
  price: number;
  mas: MASet;
  densityScore: number; // Percentage spread between highest and lowest MA
  priceDeviation: number; // Percentage distance of price from the average of all MAs
  atr: number;
  signal: SignalType;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  isDense: boolean; 
  reason: string;
}

export interface AIAnalysisResult {
  symbol: string;
  analysis: string;
  confidence: 'High' | 'Medium' | 'Low';
}

export const TARGET_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT', 
  'DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT',
  'MATICUSDT', 'LTCUSDT', 'ATOMUSDT', 'NEARUSDT', 'APTUSDT'
];