import React, { useEffect, useState, useCallback } from 'react';
import { TARGET_SYMBOLS, TradeSetup, SignalType } from './types';
import { analyzeSymbol } from './services/binanceService';
import SignalCard from './components/SignalCard';
import { AdjustmentsHorizontalIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

const App: React.FC = () => {
  const [setups, setSetups] = useState<TradeSetup[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<SignalType | 'ALL'>('ALL');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [progress, setProgress] = useState<number>(0);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setProgress(0);
    
    const results: (TradeSetup | null)[] = [];
    // Process 1 symbol at a time (Sequential) to guarantee network reliability
    const batchSize = 1; 

    for (let i = 0; i < TARGET_SYMBOLS.length; i += batchSize) {
      const batch = TARGET_SYMBOLS.slice(i, i + batchSize);
      
      const batchResults = await Promise.all(batch.map(symbol => analyzeSymbol(symbol)));
      results.push(...batchResults);
      
      // Update progress for UI
      setProgress(Math.round(((i + batchSize) / TARGET_SYMBOLS.length) * 100));

      // 1.5 second delay between requests - Very conservative to ensure success
      if (i + batchSize < TARGET_SYMBOLS.length) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
    
    // Filter out nulls and sort by "watch" status then signal strength
    const validSetups = results.filter((s): s is TradeSetup => s !== null);
    
    // Custom sort: Dense/Watch first, then setups with clear signals
    validSetups.sort((a, b) => {
        if (a.signal === SignalType.WATCH && b.signal !== SignalType.WATCH) return -1;
        if (b.signal === SignalType.WATCH && a.signal !== SignalType.WATCH) return 1;
        return 0;
    });

    setSetups(validSetups);
    setLastUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAllData();
    // Auto refresh every 5 minutes
    const interval = setInterval(fetchAllData, 300000);
    return () => clearInterval(interval);
  }, [fetchAllData]);

  const filteredSetups = setups.filter(s => {
    if (filter === 'ALL') return true;
    return s.signal === filter;
  });

  return (
    <div className="min-h-screen bg-crypto-dark text-crypto-light font-sans pb-10">
      {/* Header */}
      <header className="bg-crypto-card border-b border-gray-800 sticky top-0 z-10 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">
              V2
            </div>
            <h1 className="text-xl font-bold tracking-tight flex flex-col sm:flex-row sm:items-baseline sm:gap-2">
              <span>Binance Strategy</span>
              <span className="text-crypto-yellow text-sm font-mono bg-crypto-yellow/10 px-2 py-0.5 rounded">六线纠缠系统 (20/60/120)</span>
            </h1>
          </div>
          <div className="text-xs text-gray-500 hidden sm:block">
            Power by Gemini Flash 2.5
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-semibold mb-1 flex items-center gap-2">
              4小时均线密集策略
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded border border-green-500/30">Live Data</span>
            </h2>
            <p className="text-sm text-gray-400">
               核心逻辑：MA & EMA (20/60/120) 六线密集度检测 + AI 变盘预测
            </p>
          </div>

          <div className="flex items-center gap-3">
             <div className="bg-slate-800 p-1 rounded-lg flex items-center text-xs font-medium">
                <button 
                  onClick={() => setFilter('ALL')}
                  className={`px-3 py-1.5 rounded-md transition-all ${filter === 'ALL' ? 'bg-slate-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  全部
                </button>
                <button 
                  onClick={() => setFilter(SignalType.WATCH)}
                  className={`px-3 py-1.5 rounded-md transition-all ${filter === SignalType.WATCH ? 'bg-crypto-yellow text-black' : 'text-gray-400 hover:text-white'}`}
                >
                  密集关注
                </button>
                <button 
                   onClick={() => setFilter(SignalType.LONG)}
                   className={`px-3 py-1.5 rounded-md transition-all ${filter === SignalType.LONG ? 'bg-crypto-green text-black' : 'text-gray-400 hover:text-white'}`}
                >
                  做多
                </button>
                <button 
                   onClick={() => setFilter(SignalType.SHORT)}
                   className={`px-3 py-1.5 rounded-md transition-all ${filter === SignalType.SHORT ? 'bg-crypto-red text-white' : 'text-gray-400 hover:text-white'}`}
                >
                  做空
                </button>
             </div>

             <button 
                onClick={fetchAllData}
                disabled={loading}
                className="p-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white transition-colors disabled:opacity-50"
                title="刷新数据"
             >
                <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
             </button>
          </div>
        </div>

        {/* Content */}
        {loading && setups.length === 0 ? (
           <div className="flex flex-col items-center justify-center py-20">
              <div className="w-16 h-16 relative flex items-center justify-center">
                 <div className="absolute w-full h-full border-4 border-slate-700 rounded-full"></div>
                 <div className="absolute w-full h-full border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                 <span className="text-xs font-mono text-white">{progress}%</span>
              </div>
              <p className="text-gray-400 mt-4 animate-pulse">正在逐个分析币种数据，请耐心等待...</p>
              <p className="text-xs text-gray-600 mt-2">为防止数据接口限流，加载速度已优化</p>
           </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSetups.map((setup) => (
                <SignalCard key={setup.symbol} setup={setup} />
              ))}
            </div>

            {filteredSetups.length === 0 && (
              <div className="text-center py-20 bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
                <AdjustmentsHorizontalIcon className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">当前筛选条件下没有符合策略的信号。</p>
                <button onClick={() => setFilter('ALL')} className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm font-medium">
                  查看全部币种
                </button>
              </div>
            )}
            
            <div className="mt-8 text-center text-xs text-gray-500">
              最后更新时间: {lastUpdated.toLocaleTimeString()}
              <br/>
              风险提示: 本系统仅供技术分析参考，不构成投资建议。Gemini AI分析可能存在误差。
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default App;