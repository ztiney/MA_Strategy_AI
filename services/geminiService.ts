import { GoogleGenAI } from "@google/genai";
import { TradeSetup, SignalType } from '../types';

export const getGeminiAnalysis = async (setup: TradeSetup): Promise<string> => {
  try {
    // Vite replaces process.env.API_KEY with the actual string during build.
    // We access it directly to ensure the replacement works correctly.
    const apiKey = process.env.API_KEY;
    
    if (!apiKey) {
      return "请先设置 API Key 以获取 AI 分析。";
    }

    const ai = new GoogleGenAI({ apiKey });
    const modelId = 'gemini-2.5-flash-latest'; 

    const direction = setup.signal === SignalType.LONG ? "做多趋势" : 
                      setup.signal === SignalType.SHORT ? "做空趋势" : 
                      setup.signal === SignalType.WATCH ? "均线高度密集(变盘前夕)" : "观望/震荡";

    const intervalStr = setup.interval === '1h' ? '1小时 (1H)' : '4小时 (4H)';

    const prompt = `
      请作为资深加密货币技术分析师，基于“双均线密集系统”（MA+EMA 20/60/120 共6根线）分析以下数据。
      
      交易对: ${setup.symbol}
      当前价格: ${setup.price.toFixed(4)}
      分析周期: ${intervalStr}
      
      **双均线系统数据 (6根线):**
      - 短期: MA20=${setup.mas.ma20.toFixed(4)}, EMA20=${setup.mas.ema20.toFixed(4)}
      - 中期: MA60=${setup.mas.ma60.toFixed(4)}, EMA60=${setup.mas.ema60.toFixed(4)}
      - 长期: MA120=${setup.mas.ma120.toFixed(4)}, EMA120=${setup.mas.ema120.toFixed(4)}
      
      **形态状态:**
      - 6线整体偏离度: ${setup.densityScore.toFixed(2)}% (越低越密集)
      - 价格中心偏离度: ${setup.priceDeviation.toFixed(2)}%
      - 是否密集: ${setup.isDense ? '是 (注意变盘)' : '否 (趋势中或发散)'}
      - 系统信号: ${direction}
      - 建议理由: ${setup.reason}
      
      **交易计划:**
      - 止损 (SL): ${setup.stopLoss.toFixed(4)}
      - 止盈 (TP): ${setup.takeProfit.toFixed(4)}

      **分析任务:**
      1. **均线形态解读**: 在 ${intervalStr} 级别下，6根线是纠缠（变盘）还是排列（趋势）？
      2. **操作建议**: 
         - 如果密集：是该埋伏还是等待突破确认？
         - 如果趋势：当前是否适合追涨杀跌？
      3. **风险提示**: 结合ATR止损位点评风险。

      请用中文回答，风格专业犀利，直接给出结论，字数控制在200字以内。
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });

    return response.text || "AI 分析生成中...";

  } catch (error) {
    console.error("Gemini API Error:", error);
    return "AI 服务暂时不可用，请稍后再试。";
  }
};