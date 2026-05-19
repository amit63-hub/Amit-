import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Code, Copy, Check, ExternalLink, Globe, Layout, X, Info } from 'lucide-react';

export default function IntegrationGuide({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);

  const sharedUrl = window.location.origin;
  
  const iframeCode = `<iframe 
  src="${sharedUrl}" 
  style="border:none; width:450px; height:700px; position:fixed; bottom:20px; right:20px; z-index:9999; border-radius: 20px; box-shadow: 0 20px 50px rgba(0,0,0,0.3);"
  title="AI AI Agent"
></iframe>`;

  const scriptCode = `<script>
  window.AI_AGENT_CONFIG = {
    appId: 'RE-9923-X',
    contextUrl: window.location.href
  };
  (function(d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s); js.id = id;
    js.src = '${sharedUrl}/widget.js';
    fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'ai-agent-widget'));
</script>`;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl"
          />
          
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 30 }}
            className="relative w-full max-w-5xl bg-slate-900 border border-white/10 rounded-[40px] overflow-hidden shadow-2xl flex flex-col md:flex-row h-[90vh] md:h-[700px]"
          >
            {/* Sidebar / Info */}
            <div className="w-full md:w-80 bg-white/5 p-8 border-r border-white/10 flex flex-col shrink-0">
              <div className="flex items-center gap-3 mb-10">
                <div className="w-12 h-12 rounded-2xl bg-aura-primary/20 flex items-center justify-center shadow-lg shadow-aura-primary/10">
                  <Globe className="text-aura-primary" size={24} />
                </div>
                <div>
                  <h2 className="text-white font-black text-lg">Deploy Agent</h2>
                  <p className="text-[10px] text-aura-primary uppercase tracking-[0.2em] font-black">Live Practical Guide</p>
                </div>
              </div>

              <div className="space-y-8 flex-1">
                <div className="group">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-[10px] font-black text-white border border-white/10 group-hover:bg-aura-primary group-hover:border-aura-primary transition-colors">1</div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Localhost Test</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed ml-9">Apne `localhost:5173` project ki `index.html` file open karein.</p>
                </div>

                <div className="group">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-[10px] font-black text-white border border-white/10 group-hover:bg-aura-secondary group-hover:border-aura-secondary transition-colors">2</div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Paste Snippet</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed ml-9">Niche diya gaya script code `&lt;/body&gt;` tag se thik pehle paste karein.</p>
                </div>

                <div className="group">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-[10px] font-black text-white border border-white/10 group-hover:bg-aura-accent group-hover:border-aura-accent transition-colors">3</div>
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Refresh & Live</span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed ml-9">Website refresh karein, AI Agent bottom-right corner mein aa jayega!</p>
                </div>
              </div>

              <div className="mt-auto p-5 bg-gradient-to-br from-aura-primary/10 to-transparent rounded-3xl border border-white/5">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-aura-primary animate-pulse" />
                  <span className="text-[10px] font-black text-white uppercase tracking-widest text-aura-primary">Practical Tip</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Agar aap React/Next.js use kar rahe hain, toh is script ko `_document.js` ya `index.html` mein dalein.
                </p>
              </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-10 overflow-y-auto custom-scrollbar bg-black/20">
              <div className="flex items-center justify-between mb-10">
                <div>
                  <h3 className="text-white font-black text-2xl mb-1">Integration Snippets</h3>
                  <p className="text-xs text-slate-500">Choose the method that works best for your tech stack.</p>
                </div>
                <motion.button 
                  whileHover={{ rotate: 90, scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose} 
                  className="p-3 hover:bg-white/5 rounded-2xl transition-colors text-slate-500 hover:text-white"
                >
                  <X size={24} />
                </motion.button>
              </div>

              <div className="grid gap-8">
                {/* Script Option - Most Practical */}
                <div className="relative group">
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-aura-primary to-aura-secondary rounded-3xl opacity-20 group-hover:opacity-40 transition duration-500 blur"></div>
                  <div className="relative p-8 rounded-3xl bg-slate-900 border border-white/10">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-aura-primary/20 text-aura-primary">
                          <Code size={20} />
                        </div>
                        <div>
                          <h4 className="text-white font-bold">JavaScript Snippet</h4>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Recommended for Localhost</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => copyToClipboard(scriptCode, 'script')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${
                          copied === 'script' ? 'bg-emerald-500 text-white' : 'bg-white/5 text-aura-primary hover:bg-white/10'
                        }`}
                      >
                        {copied === 'script' ? <Check size={14} /> : <Copy size={14} />}
                        {copied === 'script' ? 'COPIED' : 'COPY CODE'}
                      </button>
                    </div>
                    <pre className="p-6 rounded-2xl bg-black/50 border border-white/5 text-[11px] text-slate-300 font-mono overflow-x-auto leading-relaxed custom-scrollbar">
                      {scriptCode}
                    </pre>
                  </div>
                </div>

                {/* Iframe Option */}
                <div className="relative group">
                  <div className="relative p-8 rounded-3xl bg-slate-900/50 border border-white/5">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-aura-secondary/20 text-aura-secondary">
                          <Layout size={20} />
                        </div>
                        <div>
                          <h4 className="text-white font-bold">Iframe Embed</h4>
                          <p className="text-[10px] text-slate-500 uppercase tracking-widest">Fastest Setup</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => copyToClipboard(iframeCode, 'iframe')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all ${
                          copied === 'iframe' ? 'bg-emerald-500 text-white' : 'bg-white/5 text-aura-secondary hover:bg-white/10'
                        }`}
                      >
                        {copied === 'iframe' ? <Check size={14} /> : <Copy size={14} />}
                        {copied === 'iframe' ? 'COPIED' : 'COPY CODE'}
                      </button>
                    </div>
                    <pre className="p-6 rounded-2xl bg-black/50 border border-white/5 text-[11px] text-slate-300 font-mono overflow-x-auto leading-relaxed custom-scrollbar">
                      {iframeCode}
                    </pre>
                  </div>
                </div>
              </div>

              <div className="mt-10 flex items-center gap-6 p-6 rounded-3xl bg-aura-primary/5 border border-aura-primary/10">
                <div className="p-4 rounded-2xl bg-black/40 border border-white/5 flex-shrink-0">
                  <ExternalLink className="text-aura-primary" size={24} />
                </div>
                <div>
                  <h4 className="text-white font-bold text-sm mb-1">Localhost Practical Demo</h4>
                  <p className="text-xs text-slate-400">Ye code aapke localhost par tabhi chalega jab aapka browser is URL ko access kar sake. Make sure your local site allows cross-origin scripts for testing.</p>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
