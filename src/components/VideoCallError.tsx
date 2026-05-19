import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertCircle, 
  ShieldAlert, 
  Zap, 
  RotateCw, 
  Loader2, 
  X, 
  Camera, 
  Mic, 
  WifiOff, 
  MonitorOff,
  ChevronRight,
  Check
} from 'lucide-react';

export type CallErrorType = 'NETWORK' | 'PERMISSION' | 'NOT_FOUND' | 'COMPATIBILITY' | 'BUSY' | 'UNKNOWN' | 'SHARING';

interface VideoCallErrorProps {
  error: { type: CallErrorType; message: string; code?: string } | null;
  onRetry: () => void;
  onClose: () => void;
  isRetrying?: boolean;
  isLightMode?: boolean;
}

const VideoCallError: React.FC<VideoCallErrorProps> = ({ 
  error, 
  onRetry, 
  onClose, 
  isRetrying = false, 
  isLightMode = false 
}) => {
  const [copied, setCopied] = React.useState(false);
  if (!error) return null;

  const copyToClipboard = () => {
    const errorText = `Error Type: ${error.type}\nMessage: ${error.message}\nCode: ${error.code || 'N/A'}\nTimestamp: ${new Date().toISOString()}`;
    navigator.clipboard.writeText(errorText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getErrorContent = () => {
    switch (error.type) {
      case 'PERMISSION':
        return {
          title: 'Media Permissions Required',
          icon: <Camera size={32} />,
          iconBg: 'bg-amber-500/10 text-amber-500',
          message: 'REWON AI needs access to your camera and microphone to enable the video call experience.',
          steps: [
            'Look for the camera icon in the top-right of your browser address bar',
            'Toggle your browser settings to "Always allow search.rewon.ai to access your camera and microphone"',
            'If you see a "Blocked" status, click "Manage" to reset permissions',
            'Check your system privacy settings (System Settings > Privacy & Security)',
            'Ensure you haven\'t switched off a physical privacy shutter on your hardware'
          ]
        };
      case 'NETWORK':
        return {
          title: 'Connection Disrupted',
          icon: <WifiOff size={32} />,
          iconBg: 'bg-red-500/10 text-red-500',
          message: 'It seems your connection to our servers has been interrupted.',
          steps: [
            'Confirm your device is still connected to Wi-Fi or local data',
            'Try disabling your VPN if one is active, as it can block media streams',
            'Verify your local firewall allows peer-to-peer (P2P) connections',
            'Run a speed test to ensure you have sufficient bandwidth for video',
            'Reload the page to re-establish a fresh secure socket connection'
          ]
        };
      case 'COMPATIBILITY':
        return {
          title: 'Environment Incompatibility',
          icon: <ShieldAlert size={32} />,
          iconBg: 'bg-purple-500/10 text-purple-500',
          message: 'Your current browser or connection doesn\'t support modern video standards.',
          steps: [
            'Switch to a modern browser like Chrome, Edge, Safari, or Firefox',
            'Update your current browser to the latest stable version',
            'Ensure you are using HTTPS, as browsers block camera access on HTTP',
            'Disable browser extensions that specifically manage camera/privacy',
            'If on mobile, ensure you are using the native browser (Safari for iOS)'
          ]
        };
      case 'NOT_FOUND':
        return {
          title: 'Hardware Link Failed',
          icon: <Mic size={32} />,
          iconBg: 'bg-slate-500/10 text-slate-500',
          message: 'We couldn\'t detect any compatible media hardware on your device.',
          steps: [
            'Physically re-plug your camera or microphone if using external units',
            'Check that your Bluetooth headset is connected and has battery',
            'Restart your computer to re-initialize your system audio/video drivers',
            'If using a laptop, ensure the lid is open and the camera is not covered',
            'Update your USB or integrated camera drivers in Device Manager'
          ]
        };
      case 'BUSY':
        return {
          title: 'Device Is Engaged',
          icon: <Loader2 size={32} />,
          iconBg: 'bg-blue-500/10 text-blue-500',
          message: 'Another application is currently using your camera or microphone.',
          steps: [
            'Close other browser tabs that might have active meet sessions',
            'Quit applications like Zoom, Microsoft Teams, Slack, or Skype',
            'Check if recording software (OBS, Loom) is active in the background',
            'Restart your browser to force-release any stuck media locks'
          ]
        };
      case 'SHARING':
        return {
          title: 'Screen Capture Denied',
          icon: <MonitorOff size={32} />,
          iconBg: 'bg-red-500/10 text-red-500',
          message: 'The system was unable to initiate screen sharing.',
          steps: [
            'When the popup appears, select the specific window or tab you want to share',
            'Check your System Preferences -> Privacy -> Screen Recording permissions',
            'Ensure your browser has permission to capture screen contents',
            'Try sharing a dynamic window instead of the entire screen'
          ]
        };
      default:
        return {
          title: 'REWON Protocol Error',
          icon: <AlertCircle size={32} />,
          iconBg: 'bg-red-500/10 text-red-500',
          message: 'An unexpected internal error occurred while initializing the call.',
          steps: [
            'Perform a hard refresh (Ctrl/Cmd + Shift + R)',
            'Check if you have an active internet connection',
            'If the problem persists, try clearing your browser cache',
            'Contact REWON support with the error code provided'
          ]
        };
    }
  };

  const content = getErrorContent();

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl"
      >
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className={`max-w-md w-full border border-white/10 p-8 rounded-[40px] text-center shadow-[0_40px_80px_rgba(0,0,0,0.5)] relative bg-slate-900/40 backdrop-blur-3xl overflow-hidden`}
        >
          {/* Decorative Background Elements */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-red-500/10 blur-[100px] rounded-full" />
          <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-blue-500/10 blur-[100px] rounded-full" />

          {/* Top Actions */}
          <div className="absolute top-6 left-6 right-6 flex justify-between z-10">
            <button 
              onClick={copyToClipboard}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white flex items-center gap-2"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <AlertCircle size={12} />}
              {copied ? 'Copied' : 'Copy Log'}
            </button>
            <button 
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-white/10 transition-colors text-slate-500 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>

          {/* Icon Area */}
          <motion.div 
            initial={{ scale: 0.8 }}
            animate={{ scale: 1 }}
            className={`w-20 h-20 ${content.iconBg} rounded-[28px] flex items-center justify-center mx-auto mb-8 mt-4 relative group shadow-2xl border border-white/5`}
          >
            <motion.div
              animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 4 }}
              className="absolute inset-0 bg-current rounded-[28px] blur-xl opacity-20"
            />
            <div className="relative z-10">{content.icon}</div>
          </motion.div>

          {/* Title & Message */}
          <h3 className="text-2xl font-display font-bold mb-3 text-white tracking-tight">
            {content.title}
          </h3>
          <p className="text-sm mb-10 leading-relaxed text-slate-400 font-medium px-4">
            {content.message}
          </p>

          {/* Troubleshooting Steps */}
          <div className="mb-10 text-left bg-white/5 rounded-3xl p-6 border border-white/5">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] mb-5 text-white/40">
              Recovery Protocol
            </h4>
            <div className="space-y-4">
              {content.steps.map((step, idx) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + (idx * 0.1) }}
                  key={idx} 
                  className="flex items-start gap-4 group"
                >
                  <div className="mt-0.5 w-5 h-5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:border-white/30 transition-colors">
                    <ChevronRight size={12} className="text-emerald-400" />
                  </div>
                  <span className="text-xs leading-relaxed font-medium text-slate-300">
                    {step}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-4">
            <motion.button 
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={onRetry}
              disabled={isRetrying}
              className={`w-full py-4.5 font-bold rounded-2xl transition-all flex items-center justify-center gap-3 relative overflow-hidden group shadow-2xl ${
                isRetrying ? 'opacity-50 cursor-not-allowed' : ''
              } bg-white text-slate-950`}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-aura-primary/10 to-aura-accent/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10 flex items-center gap-3">
                {isRetrying ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  error.type === 'NETWORK' ? <Zap size={20} /> : <RotateCw size={20} />
                )}
                <span className="text-sm uppercase tracking-widest font-black">
                  {isRetrying ? 'System Diagnostics...' : (error.type === 'NETWORK' ? 'Force Reconnect' : 'Initialize Recovery')}
                </span>
              </div>
            </motion.button>
            
            <button 
              onClick={onClose}
              className="w-full py-4 text-[10px] font-black uppercase tracking-[0.3em] rounded-2xl transition-all text-slate-500 hover:text-white hover:bg-white/5"
            >
              Terminate Session
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default VideoCallError;
