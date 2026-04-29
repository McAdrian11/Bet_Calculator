import { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCcw, Copy, Plus, Trash2, CheckCircle2 } from 'lucide-react';

type Mode = 'BUDGET' | 'PROFIT';

interface OddField {
  id: string;
  odd: number;
  stake: number;
  isFixed: boolean;
  grossReturn: number;
}

export default function App() {
  const [mode, setMode] = useState<Mode>('BUDGET');
  const [targetValue, setTargetValue] = useState<number>(0);
  const [odds, setOdds] = useState<OddField[]>([
    { id: '1', odd: 0, stake: 0, isFixed: false, grossReturn: 0 },
    { id: '2', odd: 0, stake: 0, isFixed: false, grossReturn: 0 },
  ]);
  const [isRounded, setIsRounded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const mainInputRef = useCallback((node: HTMLInputElement | null) => {
    if (node) node.focus();
  }, []);

  const [isMainInputVisible, setIsMainInputVisible] = useState(false);

  const handleTargetValueChange = (val: number) => {
    setTargetValue(val || 0);
    // When the user changes the main target, we reset all scales to AUTO to ensure a fresh, balanced calculation
    setOdds(prev => prev.map(o => ({ ...o, isFixed: false })));
  };

  // Core Calculation Logic
  const results = useMemo(() => {
    const validOdds = odds.filter(o => o.odd > 1);
    const probSum = validOdds.reduce((sum, item) => sum + (1 / item.odd), 0);
    
    // Trigger color shifts only when we have at least 2 valid odds
    const hasEnoughData = validOdds.length >= 2;
    const isSurebet = hasEnoughData && probSum > 0 && probSum < 1;

    // Financial metrics
    const totalInvestment = odds.reduce((sum, o) => sum + o.stake, 0);
    
    // Potencial return (using the minimum potential return across stakes)
    const activeReturns = odds.filter(o => o.odd > 1 && o.stake > 0).map(o => o.stake * o.odd);
    const grossReturn = activeReturns.length > 0 ? Math.min(...activeReturns) : 0;

    const netProfit = grossReturn - totalInvestment;
    
    // Theoretical ROI based on odds alone if no stakes are set, otherwise actual ROI
    let roi = 0;
    if (totalInvestment > 0) {
      roi = (netProfit / totalInvestment) * 100;
    } else if (hasEnoughData && probSum > 0) {
      roi = ((1 / probSum) - 1) * 100;
    }

    return { 
      totalInvestment, 
      grossReturn, 
      netProfit, 
      roi, 
      isSurebet,
      hasEnoughData,
      probSum
    };
  }, [odds]);

  // Theme colors based on state
  const theme = {
    color: !results.hasEnoughData ? 'text-white/20' : (results.isSurebet ? 'text-[#00e676]' : 'text-[#ff5252]'),
    border: !results.hasEnoughData ? 'border-[#333333]' : (results.isSurebet ? 'border-[#00e676]' : 'border-[#ff5252]'),
    bg: !results.hasEnoughData ? 'bg-[#333333]' : (results.isSurebet ? 'bg-[#00e676]' : 'bg-[#ff5252]'),
    focus: !results.hasEnoughData ? 'focus:border-white/40' : (results.isSurebet ? 'focus:border-[#00e676]' : 'focus:border-[#ff5252]'),
  };

  // Effect to update AUTO stakes and keep targetValue in sync with total investment when stakes are fixed
  useEffect(() => {
    const validOdds = odds.filter(o => o.odd > 1);
    const fixedOdds = odds.filter(o => o.isFixed && o.stake > 0);
    
    // If we don't have enough to calculate, return
    if (validOdds.length < 2 && fixedOdds.length === 0) return;

    if (fixedOdds.length > 0) {
      const anchor = fixedOdds[0];
      const targetReturn = anchor.stake * anchor.odd;
      const balancedOdds = odds.map(o => {
        if (o.isFixed) return o;
        const rawStake = o.odd > 1 ? targetReturn / o.odd : 0;
        return { ...o, stake: isRounded ? Math.round(rawStake) : rawStake };
      });
      
      const currentTotal = balancedOdds.reduce((sum, o) => sum + o.stake, 0);
      const actualReturns = balancedOdds.filter(o => o.odd > 1).map(o => o.stake * o.odd);
      const minReturn = actualReturns.length > 0 ? Math.min(...actualReturns) : 0;

      if (mode === 'BUDGET') {
        if (Math.abs(currentTotal - targetValue) > 0.01) {
          setTargetValue(currentTotal);
        }
      } else {
        const actualProfit = minReturn - currentTotal;
        if (Math.abs(actualProfit - targetValue) > 0.01) {
          setTargetValue(actualProfit);
        }
      }
      setOdds(balancedOdds);
    } else if (targetValue > 0) {
      const totalProb = validOdds.reduce((sum, item) => sum + (1 / item.odd), 0);
      if (totalProb > 0) {
        let baseReturn = 0;
        if (mode === 'BUDGET') {
          baseReturn = targetValue / totalProb;
        } else {
          const denom = (1 / totalProb) - 1;
          baseReturn = denom !== 0 ? (targetValue / denom) + targetValue : (targetValue * 2);
        }

        // Optimization for Rounded Mode: Find the "best" return anchor that minimizes spread
        let optimizedReturn = baseReturn;
        if (isRounded) {
          let bestSpread = Infinity;
          for (let i = -10; i <= 10; i++) {
            const testReturn = baseReturn * (1 + i * 0.001);
            const testStakes = validOdds.map(o => Math.round(testReturn / o.odd));
            const returns = testStakes.map((s, idx) => s * validOdds[idx].odd);
            const spread = Math.max(...returns) - Math.min(...returns);
            if (spread < bestSpread) {
              bestSpread = spread;
              optimizedReturn = testReturn;
            }
          }
        }

        const balancedOdds = odds.map(o => {
          const s = o.odd > 1 ? optimizedReturn / o.odd : 0;
          return { ...o, stake: isRounded ? Math.round(s) : s };
        });

        const currentTotal = balancedOdds.reduce((sum, o) => sum + o.stake, 0);
        const actualReturns = balancedOdds.filter(o => o.odd > 1).map(o => o.stake * o.odd);
        const minVal = actualReturns.length > 0 ? Math.min(...actualReturns) : 0;

        if (mode === 'BUDGET') {
          if (Math.abs(currentTotal - targetValue) > 0.01) {
            setTargetValue(currentTotal);
          }
        } else {
          const actualProfit = minVal - currentTotal;
          if (Math.abs(actualProfit - targetValue) > 0.01) {
            setTargetValue(actualProfit);
          }
        }
        setOdds(balancedOdds);
      }
    }
  }, [mode, targetValue, isRounded, odds.map(o => o.odd).join(','), odds.filter(o => o.isFixed).map(o => o.stake).join(',')]);

  const handleAddOdd = () => {
    setOdds([...odds, { 
      id: Math.random().toString(36).substr(2, 9), 
      odd: 0, 
      stake: 0, 
      isFixed: false, 
      grossReturn: 0 
    }]);
  };

  const handleRemoveOdd = (id: string) => {
    if (odds.length > 2) {
      setOdds(odds.filter(o => o.id !== id));
    }
  };

  const updateOddValue = (id: string, value: number) => {
    setOdds(odds.map(o => o.id === id ? { ...o, odd: value || 0 } : o));
  };

  const updateStakeValue = (id: string, value: number) => {
    setOdds(odds.map(o => 
      o.id === id 
        ? { ...o, stake: value || 0, isFixed: true } 
        : { ...o, isFixed: false }
    ));
  };

  const toggleFixed = (id: string, state: boolean) => {
    if (state) {
      setOdds(odds.map(o => o.id === id ? { ...o, isFixed: true } : { ...o, isFixed: false }));
    } else {
      setOdds(odds.map(o => o.id === id ? { ...o, isFixed: false } : o));
    }
  };

  const reset = () => {
    setMode('BUDGET');
    setTargetValue(0);
    setOdds([
      { id: '1', odd: 0, stake: 0, isFixed: false, grossReturn: 0 },
      { id: '2', odd: 0, stake: 0, isFixed: false, grossReturn: 0 },
    ]);
    setIsRounded(false);
    setToast('CALCULADORA REINICIADA');
    setTimeout(() => setToast(null), 2000);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setToast('COPIADO AL PORTAPAPELES');
    setTimeout(() => setToast(null), 2000);
  };

  return (
    <div className="flex flex-col min-h-screen font-sans">
      {/* TopAppBar */}
      <header className="flex justify-between items-center h-12 px-4 w-full bg-[#0f0f0f] border-b border-[#333333] fixed top-0 z-50">
        <div className="flex items-center">
          <span className={`text-xl font-black tracking-tighter transition-colors duration-200 ${theme.color}`}>BET_CALCULATOR</span>
        </div>
      </header>

      <main className="mt-12 flex-grow container mx-auto max-w-xl p-4 flex flex-col space-y-4">
        {/* Mode Selector & Main Input */}
        <section className="bg-[#1a1a1a] border border-[#333333] p-1">
          <div className="flex mb-2">
            <button 
              onClick={() => {
                setMode('BUDGET');
                setOdds(prev => prev.map(o => ({ ...o, isFixed: false })));
                setIsMainInputVisible(true);
              }}
              className={`flex-1 py-3 font-bold text-[10px] tracking-widest transition-all duration-300 ${
                mode === 'BUDGET' ? `${theme.color} border-b-2 ${theme.border} bg-[#0f0f0f]` : 'text-white/40 hover:bg-[#252525]'
              }`}
            >
              PRESUPUESTO TOTAL
            </button>
            <button 
              onClick={() => {
                setMode('PROFIT');
                setOdds(prev => prev.map(o => ({ ...o, isFixed: false })));
                setIsMainInputVisible(true);
              }}
              className={`flex-1 py-3 font-bold text-[10px] tracking-widest transition-all duration-300 ${
                mode === 'PROFIT' ? `${theme.color} border-b-2 ${theme.border} bg-[#0f0f0f]` : 'text-white/40 hover:bg-[#252525]'
              }`}
            >
              GANANCIA DESEADA
            </button>
          </div>
          <div className="p-4 bg-[#0f0f0f]">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 font-bold">S/</span>
                <input 
                type="number"
                value={targetValue > 0 ? parseFloat(targetValue.toFixed(2)) : ''}
                onFocus={(e) => e.target.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const nextInput = document.querySelector('input[data-index="0"]') as HTMLInputElement;
                    if (nextInput) nextInput.focus();
                  }
                }}
                onChange={(e) => handleTargetValueChange(parseFloat(e.target.value))}
                className={`w-full bg-[#1a1a1a] border border-[#333333] text-4xl font-bold pl-12 pr-4 py-4 outline-none tabular-nums transition-all duration-200 ${theme.focus} ${theme.color}`}
                placeholder="0.00"
              />
            </div>
          </div>
        </section>

        {/* Odds Table */}
        <section className="bg-[#1a1a1a] border border-[#333333]">
          <div className="grid grid-cols-12 font-bold text-[9px] text-white/30 uppercase tracking-widest p-2 border-b border-[#333333] items-center">
            <div className="col-span-3">CUOTA</div>
            <div className="col-span-6 flex items-center justify-between">
              <span>STAKE / COPIAR</span>
              <div className="flex space-x-1">
                <button 
                  onClick={reset}
                  className={`px-2 py-1 border font-black text-[8px] tracking-tighter transition-all duration-200 uppercase flex items-center hover:bg-white/5 ${theme.color} ${theme.border}`}
                >
                  <RefreshCcw className="w-2.5 h-2.5 mr-1" />
                  Reset
                </button>
                <button 
                  onClick={() => {
                    setIsRounded(!isRounded);
                    setToast(isRounded ? 'MOSTRANDO DECIMALES' : 'APUESTAS REDONDEADAS');
                    setTimeout(() => setToast(null), 2000);
                  }}
                  className={`px-2 py-1 border font-black text-[8px] tracking-tighter transition-all duration-200 uppercase ${isRounded ? `${theme.bg} text-[#0f0f0f] ${theme.border}` : `text-white/40 border-[#333333] hover:text-white`}`}
                >
                  Redondear
                </button>
              </div>
            </div>
            <div className="col-span-3 text-right">MODO</div>
          </div>
          
          <div className="divide-y divide-[#333333]">
            {odds.map((item, index) => (
              <div key={item.id} className="p-3 bg-[#0f0f0f] relative group">
                <div className="grid grid-cols-12 gap-3 items-center">
                  <div className="col-span-3">
                    <input 
                      ref={index === 0 ? mainInputRef : undefined}
                      type="number"
                      step="0.01"
                      data-index={index}
                      value={item.odd || ''}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const nextInput = document.querySelector(`input[data-index="${index + 1}"]`) as HTMLInputElement;
                          if (nextInput) nextInput.focus();
                        }
                      }}
                      onChange={(e) => updateOddValue(item.id, parseFloat(e.target.value))}
                      className={`w-full bg-[#1a1a1a] border border-[#333333] p-2 text-sm font-medium text-white outline-none tabular-nums transition-all duration-300 ${theme.focus}`}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="col-span-6">
                    <div className="relative group/field">
                        <input 
                        type="number"
                        step="0.01"
                        value={item.stake > 0 ? parseFloat(item.stake.toFixed(2)) : ''}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => updateStakeValue(item.id, parseFloat(e.target.value))}
                        className={`w-full bg-[#1a1a1a] border p-2 pr-8 text-sm font-bold tabular-nums outline-none transition-all duration-200 ${
                          item.isFixed ? 'border-white text-white' : `border-[#333333] ${theme.color}`
                        } ${theme.focus}`}
                        placeholder="0.00"
                      />
                      <button 
                        onClick={() => copyToClipboard(Number(item.stake.toFixed(2)).toString())}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 text-white/20 transition-colors ${results.isSurebet ? 'hover:text-[#00e676]' : results.hasEnoughData ? 'hover:text-[#ff5252]' : 'hover:text-white'}`}
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="col-span-3 flex flex-col items-end">
                    <div className="flex border border-[#333333] mb-2">
                      <button 
                        onClick={() => toggleFixed(item.id, true)}
                        className={`px-2 py-1.5 text-[9px] font-bold transition-all ${
                          item.isFixed ? 'bg-white text-[#0f0f0f]' : 'text-white/40 hover:text-white'
                        }`}
                      >
                        FIJO
                      </button>
                      <button 
                        onClick={() => toggleFixed(item.id, false)}
                        className={`px-2 py-1.5 text-[9px] font-bold transition-all duration-500 ${
                          !item.isFixed ? `${theme.bg} text-[#0f0f0f]` : 'text-white/40 hover:text-white'
                        }`}
                      >
                        AUTO
                      </button>
                    </div>
                    
                    <div className="flex flex-col items-end">
                      <span className="text-[7px] font-black text-white/30 uppercase leading-none mb-1 text-right">Retorno Bruto</span>
                      <span className={`text-xs font-bold tabular-nums leading-none transition-colors duration-200 ${!results.hasEnoughData ? 'text-white/20' : (results.isSurebet ? 'text-[#00e676]' : 'text-[#ff5252]')}`}>
                        S/ {(item.stake * item.odd).toFixed(2)}
                      </span>
                    </div>

                    {odds.length > 2 && (
                      <button 
                        onClick={() => handleRemoveOdd(item.id)}
                        className="mt-2 text-white/20 hover:text-[#ff5252] transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={handleAddOdd}
            className={`w-full py-3 bg-[#1a1a1a] text-[10px] font-bold tracking-widest text-white/40 hover:bg-[#202020] transition-all duration-500 flex justify-center items-center ${results.isSurebet ? 'hover:text-[#00e676]' : results.hasEnoughData ? 'hover:text-[#ff5252]' : 'hover:text-white'}`}
          >
            <Plus className="w-3 h-3 mr-2" />
            AÑADIR OTRA CUOTA
          </button>
        </section>

        {/* Immediate Result Card */}
        <motion.section 
          layout
          className={`border-l-4 p-6 flex flex-col items-center justify-center text-center transition-colors duration-200 ${
            !results.hasEnoughData 
              ? 'bg-[#1a1a1a] border-[#333333]' 
              : results.isSurebet 
                ? 'bg-[#1a1a1a] border-[#00e676]' 
                : 'bg-[#1a1a1a] border-[#ff5252]'
          }`}
        >
          <span className="font-bold text-[10px] text-white/50 uppercase tracking-[0.3em] mb-2">
            {!results.isSurebet && results.hasEnoughData ? 'Estimación de Pérdida' : results.netProfit >= 0 ? 'Ganancia Neta' : 'Déficit Estimado'}
          </span>
          <div className={`text-6xl font-black tracking-tighter mb-1 tabular-nums transition-colors duration-200 ${
            !results.hasEnoughData 
              ? 'text-white/20' 
              : results.isSurebet 
                ? 'text-[#00e676]' 
                : 'text-[#ff5252]'
          }`}>
            {results.netProfit > 0 && results.isSurebet ? '+' : ''}S/ {results.netProfit.toFixed(2)}
          </div>
          
          {/* Detailed breakdown: Gross Return - Total Investment */}
          <div className="flex flex-col items-center mb-4">
            <div className="flex items-center space-x-6">
              <div className="flex flex-col items-center">
                <span className="text-[14px] font-black tabular-nums text-white">S/ {results.grossReturn.toFixed(2)}</span>
                <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest mt-1">Pago Final</span>
              </div>
              <div className="text-white/10 font-thin text-xl">-</div>
              <div className="flex flex-col items-center">
                <span className="text-[14px] font-black tabular-nums text-white">S/ {results.totalInvestment.toFixed(2)}</span>
                <span className="text-[8px] font-bold text-white/20 uppercase tracking-widest mt-1">Inversión</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className={`text-[10px] font-black px-2 py-1 tabular-nums transition-colors duration-200 ${
              !results.hasEnoughData 
                ? 'bg-[#333333] text-white/40'
                : results.isSurebet 
                  ? 'bg-[#00e676] text-[#0f0f0f]' 
                  : 'bg-[#ff5252] text-[#0f0f0f]'
            }`}>
              ROI: {results.roi.toFixed(2)}%
            </span>
            <span className={`text-[11px] font-black tracking-widest transition-colors duration-200 ${
              !results.hasEnoughData
                ? 'text-white/10'
                : results.isSurebet ? 'text-[#00e676]' : 'text-[#ff5252]'
            }`}>
              {!results.hasEnoughData ? 'ESPERANDO CUOTAS' : results.isSurebet ? 'SUREBET DETECTADA' : 'NO ES SUREBET'}
            </span>
          </div>
        </motion.section>
      </main>

      <AnimatePresence>
        {toast && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 text-[#0f0f0f] px-6 py-3 font-bold text-[10px] tracking-widest shadow-2xl z-[100] flex items-center transition-colors duration-500 ${theme.bg}`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 mr-2" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="p-4 text-center opacity-20 pointer-events-none">
        <span className="text-[10px] font-bold tracking-widest">SUREBET_ENGINE_CORE_V1.0</span>
      </footer>
    </div>
  );
}
