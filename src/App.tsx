import React, { useState } from 'react';
import ChatWidget from './components/ChatWidget';
import IntegrationGuide from './components/IntegrationGuide';
import ThreeBackground from './components/ThreeBackground';
import { motion } from 'motion/react';
import { Sparkles, Layout, Shield, Zap } from 'lucide-react';

function App() {
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-slate-950 overflow-hidden font-sans selection:bg-aura-primary/30 selection:text-aura-accent">
      {/* Immersive Background */}
      <ThreeBackground />
      
      {/* Main Content Layer */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="max-w-4xl"
        >
          {/* Logo / Brand Header */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="relative group">
              <div className="absolute -inset-2 bg-gradient-to-r from-aura-primary to-aura-secondary rounded-2xl opacity-40 blur group-hover:opacity-75 transition duration-500"></div>
              <div className="relative p-3 bg-slate-900 border border-white/10 rounded-2xl">
                <Sparkles className="text-aura-primary" size={28} />
              </div>
            </div>
            <motion.h1 
              initial={{ letterSpacing: '0.2em', opacity: 0 }}
              animate={{ letterSpacing: '-0.02em', opacity: 1 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="text-4xl md:text-6xl font-black text-white tracking-tighter uppercase italic drop-shadow-[0_0_25px_rgba(var(--aura-primary-rgb),0.3)]"
            >
              REWON <span className="text-transparent bg-clip-text bg-gradient-to-r from-aura-primary to-aura-accent">AI</span>
            </motion.h1>
          </div>

          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ 
              opacity: 1, 
              y: [0, -5, 0],
            }}
            transition={{ 
              opacity: { duration: 0.8, delay: 0.4 },
              y: { duration: 4, repeat: Infinity, ease: "easeInOut" }
            }}
            className="text-2xl md:text-4xl font-bold text-white mb-6 leading-tight select-none"
          >
            The World's Most <span className="text-aura-accent relative">
              Advanced
              <motion.span 
                className="absolute inset-0 blur-lg bg-aura-accent/20 rounded-full"
                animate={{ opacity: [0, 0.5, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
            </span> Enterprise AI Assistant
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0.6, 1, 0.6],
            }}
            transition={{ 
              opacity: { duration: 3, repeat: Infinity, ease: "easeInOut" },
              delay: 0.6 
            }}
            className="text-slate-400 text-lg md:text-xl mb-12 max-w-2xl mx-auto leading-relaxed font-display select-none"
          >
            Revolutionize customer engagement with real-time video calls, 
            intelligent lead capture, and multi-lingual support.
          </motion.p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsGuideOpen(true)}
              className="px-8 py-4 bg-white text-slate-950 rounded-2xl font-black text-sm uppercase tracking-widest flex items-center gap-3 shadow-2xl hover:shadow-aura-primary/25 transition-all cursor-pointer relative overflow-hidden group"
            >
              <div className="relative flex items-center justify-center">
                <Layout size={18} className="relative z-10 transition-transform group-hover:scale-110" />
                <motion.div 
                  animate={{ scale: [1, 2, 1], opacity: [0, 0.5, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="absolute inset-0 bg-aura-primary/30 rounded-full blur-md"
                />
              </div>
              <span className="relative z-10">Setup Guide</span>
              
              <motion.div
                animate={{ x: ['-200%', '200%'] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 bg-gradient-to-r from-transparent via-black/5 to-transparent skew-x-[30deg] pointer-events-none"
              />
            </motion.button>
            
            <div className="flex items-center gap-6 text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">
              <span className="flex items-center gap-2 hover:text-white transition-colors group">
                <div className="relative flex items-center justify-center">
                  <Shield size={14} className="text-aura-primary relative z-10 transition-transform group-hover:scale-110" />
                  <motion.div 
                    animate={{ scale: [1, 1.8, 1], opacity: [0, 0.3, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 bg-aura-primary rounded-full blur-md"
                  />
                </div>
                <span>Verified</span>
              </span>
              
              <span className="w-1 h-1 rounded-full bg-slate-800" />
              
              <span className="flex items-center gap-2 hover:text-white transition-colors group">
                <div className="relative flex items-center justify-center">
                  <Zap size={14} className="text-aura-accent relative z-10 transition-transform group-hover:scale-110" />
                  <motion.div 
                    animate={{ scale: [1, 1.8, 1], opacity: [0, 0.3, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay: 1 }}
                    className="absolute inset-0 bg-aura-accent rounded-full blur-md"
                  />
                </div>
                <span>Low Latency</span>
              </span>
            </div>
          </div>
        </motion.div>

        {/* Feature Bento Grid (Brief) */}
        <div className="mt-24 grid md:grid-cols-3 gap-6 max-w-5xl w-full">
           {[
             { title: 'Video Sync', icon: <Zap size={24} />, color: 'aura-primary', desc: 'Real-time interactive presentations' },
             { title: 'Lead Capture', icon: <Sparkles size={24} />, color: 'aura-accent', desc: 'Predictive intent detection' },
             { title: 'Enterprise', icon: <Shield size={24} />, color: 'aura-secondary', desc: 'Secure & role-based access' }
           ].map((feat, i) => (
             <motion.div
               key={i}
               initial={{ opacity: 0, y: 30 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.2 + i * 0.1 }}
               className="p-8 rounded-[32px] bg-white/5 border border-white/10 backdrop-blur-sm text-left hover:bg-white/10 transition-colors group"
             >
               <div className={`p-3 rounded-2xl bg-white/5 text-white w-fit mb-6 group-hover:scale-110 transition-transform`}>
                 {feat.icon}
               </div>
               <h3 className="text-white font-black uppercase text-sm tracking-widest mb-2 italic">{feat.title}</h3>
               <p className="text-slate-500 text-xs leading-relaxed">{feat.desc}</p>
             </motion.div>
           ))}
        </div>
      </div>

      {/* Floating Chat Widget */}
      <ChatWidget />

      {/* Deployment Guide Modal */}
      <IntegrationGuide isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
      
      {/* Global Status Bar (Bottom) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 z-[50] pointer-events-none italic">
        <div className="max-w-7xl mx-auto flex items-center justify-between opacity-30 text-[9px] font-black uppercase tracking-[0.4em] text-white">
          <div className="flex items-center gap-3">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
             NODE_STATUS_READY
          </div>
          <div>REWON_v2.4.0_STABLE</div>
          <div>ENV_PRODUCTION</div>
        </div>
      </div>
    </div>
  );
}

export default App;
