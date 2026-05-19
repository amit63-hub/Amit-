import { motion } from "motion/react";

interface WaveformProps {
  isListening?: boolean;
  isSpeaking?: boolean;
  isActive?: boolean;
  color?: string;
}

export default function Waveform({ isListening, isSpeaking, isActive, color }: WaveformProps) {
  const bars = Array.from({ length: 24 });
  const isCurrentlyActive = isActive || isListening || isSpeaking;
  const waveformColor = color || (isListening ? "#6366f1" : "#a855f7");

  if (!isCurrentlyActive) return null;

  return (
    <div className="flex items-center justify-center gap-1.5 h-12 px-4 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
      {bars.map((_, i) => {
        // Create a symmetric effect from center
        const distanceToCenter = Math.abs(i - 7.5);
        const delay = distanceToCenter * 0.05;
        
        return (
          <motion.div
            key={i}
            className="w-1.5 rounded-full shadow-lg"
            style={{
              backgroundColor: waveformColor,
              boxShadow: `0 0 15px ${waveformColor}40`
            }}
            animate={{
              height: isCurrentlyActive 
                ? [12, Math.max(15, 45 - Math.abs(i - 11.5) * 3) + Math.random() * 15, 12] 
                : 12,
              opacity: isCurrentlyActive ? [0.4, 1, 0.4] : 0.2
            }}
            transition={{
              duration: 0.6 + Math.random() * 0.4,
              repeat: Infinity,
              delay: delay,
              ease: "easeInOut",
            }}
          />
        );
      })}
    </div>
  );
}
