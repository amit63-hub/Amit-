import { motion } from "motion/react";

interface TypingIndicatorProps {
  isLightMode?: boolean;
  text?: string;
}

export default function TypingIndicator({ isLightMode = false, text }: TypingIndicatorProps) {
  const displayText = text || "Rewon is typing";
  
  return (
    <div className={`flex items-center gap-3.5 px-5 py-3 rounded-2xl w-fit relative overflow-hidden group shadow-lg backdrop-blur-md border transition-all duration-300 ${
      isLightMode 
        ? 'bg-slate-100/90 border-slate-200/80 shadow-slate-200/50 text-slate-800' 
        : 'bg-white/5 border-white/10 shadow-black/30 text-white'
    }`}>
      {/* Background Scanning Beam */}
      <motion.div 
        className="absolute inset-0 bg-gradient-to-r from-transparent via-aura-primary/10 to-transparent w-full"
        animate={{ 
          x: ['-100%', '200%'],
        }}
        transition={{ 
          duration: 3, 
          repeat: Infinity, 
          ease: "linear",
          delay: 0.5
        }}
      />
      
      {/* Ambient Pulsing Glow */}
      <motion.div 
        className="absolute -inset-10 bg-aura-primary/5 blur-3xl rounded-full animate-pulse"
        style={{ pointerEvents: 'none' }}
      />
      
      <div className="flex gap-1.5 relative z-10 shrink-0">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full relative"
            style={{ 
              backgroundColor: "var(--color-aura-primary, #6366f1)",
              boxShadow: isLightMode ? "0 0 8px rgba(99,102,241,0.4)" : "0 0 12px var(--color-aura-primary, #6366f1)"
            }}
            animate={{ 
              y: [0, -7, 0],
              scale: [1, 1.25, 1],
              filter: ["brightness(1)", "brightness(1.3)", "brightness(1)"],
            }}
            transition={{ 
              duration: 1.1, 
              repeat: Infinity, 
              delay: i * 0.15,
              ease: [0.4, 0, 0.6, 1]
            }}
          >
            {/* Liquid Ripple Effect */}
            <motion.div 
              className={`absolute inset-0 rounded-full border ${isLightMode ? 'border-primary/20' : 'border-aura-primary/40'}`}
              animate={{ 
                scale: [1, 2.2],
                opacity: [0.6, 0],
              }}
              transition={{ 
                duration: 1.1, 
                repeat: Infinity, 
                delay: i * 0.15,
                ease: "easeOut"
              }}
            />
          </motion.div>
        ))}
      </div>
      
      <div className="flex flex-col relative z-10">
        <motion.span 
          className={`text-[10px] font-black tracking-[0.16em] uppercase ${
            isLightMode ? 'text-slate-600' : 'text-slate-300'
          }`}
          animate={{ 
            opacity: [0.6, 1, 0.6],
          }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          {displayText}
        </motion.span>
        <motion.div 
          className={`h-0.5 rounded-full mt-1 overflow-hidden w-24 ${
            isLightMode ? 'bg-slate-200' : 'bg-aura-primary/20'
          }`}
          initial={{ width: 0 }}
          animate={{ width: "96px" }}
          transition={{ duration: 0.5 }}
        >
          <motion.div 
            className="h-full bg-aura-primary"
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: "40%" }}
          />
        </motion.div>
      </div>
    </div>
  );
}
