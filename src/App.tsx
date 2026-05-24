import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Server, Activity, Power, PowerOff, RefreshCw, Zap, Play, Square, Network, Settings2, Share2, Layers } from 'lucide-react';
import { LbState, Backend } from './types';

export default function App() {
  const [state, setState] = useState<LbState | null>(null);
  const [trafficActive, setTrafficActive] = useState(false);
  const trafficIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    const es = new EventSource('/api/lb/state');
    es.onmessage = (event) => {
      const data: LbState = JSON.parse(event.data);
      setState(data);
    };
    return () => es.close();
  }, []);

  const toggleBackend = async (id: string) => {
    await fetch(`/api/lb/backend/${id}/toggle`, { method: 'POST' });
  };

  const changeAlgorithm = async (algo: 'round-robin' | 'least-connections') => {
    await fetch('/api/lb/algorithm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ algorithm: algo }),
    });
  };

  const resetStats = async () => {
    await fetch('/api/lb/reset', { method: 'POST' });
  };

  const sendRequest = async () => {
    try {
      await fetch('/api/lb/proxy', { method: 'GET' });
    } catch (e) {
      // Ignored
    }
  };

  const sendBatch = async (count: number) => {
    for (let i = 0; i < count; i++) {
      sendRequest();
    }
  };

  const toggleContinuousTraffic = () => {
    if (trafficActive) {
      if (trafficIntervalRef.current) clearInterval(trafficIntervalRef.current);
      trafficIntervalRef.current = null;
      setTrafficActive(false);
    } else {
      setTrafficActive(true);
      trafficIntervalRef.current = window.setInterval(() => {
        // Send small bursts to build up visual concurrent connections
        sendBatch(5);
      }, 100);
    }
  };

  if (!state) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300">
        <RefreshCw className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-6 overflow-hidden selection:bg-indigo-500/30 flex flex-col">
      <div className="max-w-[1200px] w-full mx-auto flex flex-col flex-1 h-full">
        {/* Header */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 pb-2">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-lg flex items-center justify-center border border-indigo-400 shadow-[0_0_15px_rgba(79,70,229,0.4)]">
              <Network className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white mb-0.5">
                L7 Load Balancer
              </h1>
              <p className="text-xs text-slate-400 font-mono">
                Real-time HTTP Proxy | Node.js Runtime
              </p>
            </div>
          </div>
          <div className="flex gap-4 mt-4 md:mt-0">
            <div className="flex flex-col items-end px-4 py-1">
              <span className="text-[10px] uppercase tracking-widest text-slate-500">Total Requests</span>
              <span className="text-sm font-mono text-slate-200">
                {state.totalServed.toLocaleString()}
              </span>
            </div>
          </div>
        </header>

        {/* Dashboard Grid */}
        <main className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 items-stretch">
          
          {/* Controls Sidebar */}
          <div className="col-span-1 md:col-span-4 flex flex-col gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col shadow-xl">
              <div className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                <Settings2 className="w-4 h-4" />
                Algorithm Engine
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => changeAlgorithm('round-robin')}
                  className={`px-4 py-3 rounded-xl text-xs font-bold transition-colors ${
                    state.algorithm === 'round-robin' 
                      ? 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/30' 
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                  } flex items-center justify-center gap-2`}
                >
                  <RefreshCw className={`w-4 h-4 ${state.algorithm === 'round-robin' ? 'animate-spin-slow text-indigo-400' : ''}`} style={{animationDuration: '3s'}} />
                  ROUND ROBIN
                </button>
                <button
                  onClick={() => changeAlgorithm('least-connections')}
                  className={`px-4 py-3 rounded-xl text-xs font-bold transition-colors ${
                    state.algorithm === 'least-connections' 
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' 
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                  } flex items-center justify-center gap-2`}
                >
                  <Layers className={`w-4 h-4 ${state.algorithm === 'least-connections' ? 'text-emerald-400' : ''}`} />
                  LEAST CONNECTIONS
                </button>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 flex flex-col relative overflow-hidden flex-1">
              <div className="text-sm font-semibold text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Traffic Generator
              </div>
              <div className="space-y-3 flex-1">
                <button
                  onClick={() => sendBatch(1)}
                  className="w-full px-4 py-3 bg-slate-800/50 hover:bg-slate-800 text-slate-200 text-xs font-bold rounded-xl transition-colors border border-slate-800 hover:border-slate-700 active:scale-95 flex items-center justify-between"
                >
                  SEND 1 REQUEST
                  <Zap className="w-4 h-4 text-emerald-400" />
                </button>
                <button
                  onClick={() => sendBatch(100)}
                  className="w-full px-4 py-3 bg-slate-800/50 hover:bg-slate-800 text-slate-200 text-xs font-bold rounded-xl transition-colors border border-slate-800 hover:border-slate-700 active:scale-95 flex items-center justify-between"
                >
                  BURST 100 REQUESTS
                  <Zap className="w-4 h-4 text-indigo-400" />
                </button>
                <button
                  onClick={toggleContinuousTraffic}
                  className={`w-full px-4 py-3 text-xs font-bold rounded-xl transition-colors flex items-center justify-between active:scale-95 ${
                    trafficActive 
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30' 
                      : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500/30'
                  }`}
                >
                  {trafficActive ? 'STOP CONTINUOUS' : 'START CONTINUOUS'}
                  {trafficActive ? <Square className="w-4 h-4 fill-rose-400/50" /> : <Play className="w-4 h-4 fill-indigo-400/50" />}
                </button>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-800">
                <button
                  onClick={resetStats}
                  className="w-full px-4 py-2 text-xs font-medium text-slate-500 hover:text-slate-300 transition-colors bg-transparent"
                >
                  Reset Analytics
                </button>
              </div>
            </div>
          </div>

          {/* Visualization Area */}
          <div className="col-span-1 md:col-span-8 bg-slate-900/50 border border-slate-800 rounded-2xl p-6 relative overflow-hidden flex flex-col items-center justify-center min-h-[500px]">
            
            {/* The Load Balancer Node */}
            <div className="relative z-10 mb-16 group mt-8">
              <div className="absolute inset-0 bg-indigo-500/20 rounded-2xl blur-xl group-hover:bg-indigo-500/30 transition-colors"></div>
              <div className="relative bg-slate-900 border border-indigo-500/50 rounded-2xl p-6 shadow-2xl flex flex-col items-center gap-3 w-48">
                <Share2 className="w-8 h-8 text-indigo-400" />
                <div className="text-xs font-bold text-white uppercase tracking-wider text-center">Proxy Node</div>
                <div className="text-[10px] font-mono text-indigo-300">port: 3000</div>
              </div>
              {/* Traffic incoming indicator */}
              <AnimatePresence>
                {trafficActive && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="absolute -top-12 left-1/2 -translate-x-1/2 flex flex-col items-center"
                  >
                    <motion.div 
                      animate={{ y: [0, 5, 0] }} 
                      transition={{ repeat: Infinity, duration: 0.5 }}
                      className="w-1 h-8 bg-gradient-to-b from-transparent to-indigo-500"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Connecting lines container (pure CSS styling) */}
            <div className="relative w-full max-w-3xl flex-1 flex justify-center">
              <div className="absolute top-0 left-1/2 w-[1px] h-12 bg-indigo-500/30 -translate-x-1/2 -translate-y-full hidden md:block"></div>
              <div className="absolute top-0 left-[15%] right-[15%] h-[1px] bg-slate-800 hidden md:block"></div>
            </div>

            {/* Backends Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full relative z-10">
              {state.backends.map((backend) => {
                const isDown = !backend.healthy || backend.forcedDown;
                const isBusy = backend.activeConnections > 0;
                
                return (
                  <motion.div 
                    layout
                    key={backend.id}
                    className={`relative p-5 rounded-xl border transition-all duration-300 ${
                      isDown 
                        ? 'bg-slate-900/50 border-rose-500/30 opacity-70' 
                        : isBusy 
                          ? 'bg-slate-800 border-indigo-500/40 shadow-[0_0_30px_rgba(99,102,241,0.1)]' 
                          : 'bg-slate-900/80 border-slate-700 hover:border-slate-600'
                    }`}
                  >
                    {/* Activity Indicator / Glow */}
                    <AnimatePresence>
                       {!isDown && isBusy && (
                         <motion.div 
                           initial={{ opacity: 0 }}
                           animate={{ opacity: 1 }}
                           exit={{ opacity: 0 }}
                           className="absolute rounded-xl inset-0 bg-indigo-500/5 mix-blend-screen pointer-events-none"
                         />
                       )}
                    </AnimatePresence>

                    <div className="flex justify-between items-start mb-4 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${isDown ? 'bg-rose-500/10' : 'bg-slate-800'}`}>
                          <Server className={`w-5 h-5 ${isDown ? 'text-rose-400' : 'text-slate-400'}`} />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white uppercase">{backend.id}</div>
                          <div className="text-[10px] font-mono text-slate-500">:{backend.port}</div>
                        </div>
                      </div>
                      
                      <button 
                        onClick={() => toggleBackend(backend.id)}
                        className={`p-1.5 rounded-md transition-colors ${
                          backend.forcedDown 
                            ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30' 
                            : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700 hover:bg-slate-700'
                        }`}
                        title={backend.forcedDown ? "Bring Online" : "Force Offline"}
                      >
                        {backend.forcedDown ? <PowerOff className="w-3 h-3" /> : <Power className="w-3 h-3" />}
                      </button>
                    </div>

                    <div className="space-y-4 relative z-10">
                      <div>
                        <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1.5">Status</div>
                        <div className="flex items-center gap-2">
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            backend.forcedDown ? 'bg-rose-500' :
                            !backend.healthy ? 'bg-amber-500' :
                            'bg-emerald-400'
                          }`}></div>
                          <span className={`text-[10px] font-bold ${
                            backend.forcedDown ? 'text-rose-400' :
                            !backend.healthy ? 'text-amber-400' :
                            'text-emerald-400'
                          }`}>
                            {backend.forcedDown ? 'FORCED DOWN' : !backend.healthy ? 'UNHEALTHY' : 'READY'}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                         <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-2.5">
                           <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Active / Conn</div>
                           <motion.div 
                              key={backend.activeConnections}
                              initial={{ scale: 1.1, color: '#818cf8' }}
                              animate={{ scale: 1, color: '#e2e8f0' }}
                              className="text-lg font-mono tracking-tight text-white"
                           >
                              {backend.activeConnections}
                           </motion.div>
                         </div>
                         <div className="bg-slate-950/50 border border-slate-800 rounded-lg p-2.5">
                           <div className="text-[10px] uppercase font-bold tracking-widest text-slate-500 mb-1">Total Hits</div>
                           <div className="text-lg font-mono tracking-tight text-slate-300">
                              {backend.totalRequests}
                           </div>
                         </div>
                      </div>
                    </div>
                    
                    {/* Visual Connector element for md screens */}
                    <div className="absolute -top-4 left-1/2 w-[1px] h-4 bg-slate-800 -translate-x-1/2 hidden md:block" />
                    {/* Active highlight line */}
                    {!isDown && isBusy && (
                      <div className="absolute -top-4 left-1/2 w-[1px] h-4 bg-indigo-500/50 -translate-x-1/2 hidden md:block" />
                    )}
                  </motion.div>
                );
              })}
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}
