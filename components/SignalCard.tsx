import React, { useState } from 'react';
import { TradeSetup, SignalType } from '../types';
import { getGeminiAnalysis } from '../services/geminiService';
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon, EyeIcon, BoltIcon, SparklesIcon } from '@heroicons/react/24/solid';

interface SignalCardProps {
  setup: TradeSetup;
}

const SignalCard: React.FC<SignalCardProps> = ({ setup }) => {
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);

  const handleAskAI = async () => {
    setLoadingAi(true);
    const analysis = await getGeminiAnalysis(setup);
    setAiAnalysis(analysis);
    setLoadingAi(false);
  };

  const getStatusColor = (signal: SignalType) => {
    switch (signal) {
      case SignalType.LONG: return 'text-crypto-green border-crypto-green';
      case SignalType.SHORT: return 'text-crypto-red border-crypto-red';
      case SignalType.WATCH: return 'text-crypto-yellow border-crypto-yellow';
      default: return 'text-crypto-gray border-crypto-gray';
    }
  };

  const getIcon = (signal: SignalType) => {
     switch (signal) {
      case SignalType.LONG: return <ArrowTrendingUpIcon className="w-6 h-6 text-crypto-green" />;
      case SignalType.SHORT: return <ArrowTrendingDownIcon className="w-6 h-6 text-crypto-red" />;
      case SignalType.WATCH: return <EyeIcon className="w-6 h-6 text-crypto-yellow" />;
      default: return <BoltIcon className="w-6 h-6 text-crypto-gray" />;
    }
  };

  return (
    <div className={`bg-crypto-card rounded-xl p-6 border-l-4 shadow-lg hover:shadow-xl transition-shadow ${getStatusColor(setup.signal).split(' ')[1]}`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            {setup.symbol}
            {setup.isDense && <span className="bg-crypto-yellow text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">密集变盘区</span>}
          </h3>
          <p className="text-2xl font-mono text-white mt-1">${setup.price.toFixed(setup.price < 1 ? 4 : 2)}</p>
        </div>
        <div className={`flex flex-col items-end ${getStatusColor(setup.signal).split(' ')[0]}`}>
          {getIcon(setup.signal)}
          <span className="font-bold text-sm mt-1">{setup.signal.split(' ')[0]}</span>
        </div>
      </div>

      {/* MA Density Visualizer */}
      <div className="mb-4 bg-slate-800/80 rounded-lg p-3">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-gray-400">均线系统 (MA/EMA 20,60,120)</span>
          <div className="flex gap-2">
            <span className={`text-xs font-mono px-2 rounded ${setup.priceDeviation > 3 ? 'bg-red-900/40 text-red-400 border border-red-800' : 'bg-slate-700 text-gray-400'}`} title="价格距离均线中心的偏离度">
               偏离: {setup.priceDeviation.toFixed(2)}%
            </span>
            <span className={`text-xs font-mono px-2 rounded ${setup.densityScore < 2 ? 'bg-crypto-yellow/20 text-crypto-yellow' : 'bg-slate-700 text-gray-400'}`} title="6根均线之间的最大差距">
               密集: {setup.densityScore.toFixed(2)}%
            </span>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
           <div className="flex flex-col gap-1">
             <span className="text-gray-500">20周期 (短)</span>
             <div className="flex justify-between"><span className="text-gray-400">MA</span> <span className="text-white">{setup.mas.ma20.toFixed(setup.price<1?4:2)}</span></div>
             <div className="flex justify-between"><span className="text-gray-400">EMA</span> <span className="text-white">{setup.mas.ema20.toFixed(setup.price<1?4:2)}</span></div>
           </div>
           <div className="flex flex-col gap-1 border-l border-slate-600 pl-2">
             <span className="text-gray-500">60周期 (中)</span>
             <div className="flex justify-between"><span className="text-gray-400">MA</span> <span className="text-white">{setup.mas.ma60.toFixed(setup.price<1?4:2)}</span></div>
             <div className="flex justify-between"><span className="text-gray-400">EMA</span> <span className="text-white">{setup.mas.ema60.toFixed(setup.price<1?4:2)}</span></div>
           </div>
           <div className="flex flex-col gap-1 border-l border-slate-600 pl-2">
             <span className="text-gray-500">120周期 (长)</span>
             <div className="flex justify-between"><span className="text-gray-400">MA</span> <span className="text-white">{setup.mas.ma120.toFixed(setup.price<1?4:2)}</span></div>
             <div className="flex justify-between"><span className="text-gray-400">EMA</span> <span className="text-white">{setup.mas.ema120.toFixed(setup.price<1?4:2)}</span></div>
           </div>
        </div>
      </div>

      {/* Trade Plan */}
      <div className="mb-4 space-y-2 text-sm border-t border-slate-700 pt-3">
         <div className="flex justify-between">
            <span className="text-crypto-gray">止盈 (TP):</span>
            <span className="text-crypto-green font-mono">${setup.takeProfit.toFixed(setup.price < 1 ? 4 : 2)}</span>
         </div>
         <div className="flex justify-between">
            <span className="text-crypto-gray">止损 (SL):</span>
            <span className="text-crypto-red font-mono">${setup.stopLoss.toFixed(setup.price < 1 ? 4 : 2)}</span>
         </div>
         <div className="text-xs text-crypto-gray mt-2 italic bg-slate-900/50 p-2 rounded border-l-2 border-crypto-gray">
            "{setup.reason}"
         </div>
      </div>

      {/* AI Section */}
      <div className="mt-4 pt-3 border-t border-slate-700">
        {!aiAnalysis ? (
          <button 
            onClick={handleAskAI}
            disabled={loadingAi}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors disabled:opacity-50 text-sm font-medium"
          >
            {loadingAi ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                AI 正在解析六线形态...
              </>
            ) : (
              <>
                <SparklesIcon className="w-4 h-4" />
                Gemini 深度策略分析
              </>
            )}
          </button>
        ) : (
          <div className="bg-slate-800/50 p-3 rounded-lg border border-indigo-500/30">
            <div className="flex items-center gap-2 text-indigo-400 mb-2">
              <SparklesIcon className="w-4 h-4" />
              <span className="font-bold text-xs uppercase">Gemini 策略建议</span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-line">
              {aiAnalysis}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SignalCard;