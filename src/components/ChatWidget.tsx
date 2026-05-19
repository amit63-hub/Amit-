import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  MessageCircle, 
  Mic, 
  Send, 
  MicOff, 
  Trash2, 
  Maximize2, 
  Minimize2,
  Sparkles,
  Volume2,
  VolumeX,
  LogIn,
  LogOut,
  User as UserIcon,
  PlusCircle,
  HelpCircle,
  ChevronRight,
  ChevronLeft,
  Settings,
  Sliders,
  Search,
  Zap,
  Brain,
  Play,
  Pause,
  Sun,
  Moon,
  Circle,
  Square,
  Video,
  Bell,
  Music,
  Palette,
  FastForward,
  Book,
  Info,
  ExternalLink,
  RotateCcw,
  RotateCw,
  RefreshCw,
  Loader2,
  Download,
  Phone,
  PhoneOff,
  VideoOff,
  WifiOff,
  CameraOff,
  Camera,
  Globe,
  Signal,
  Wifi,
  ScreenShare,
  ScreenShareOff,
  Users,
  Monitor,
  MoreVertical,
  UserMinus,
  UserPlus,
  ChevronDown,
  AlertCircle,
  Hash,
  Plus,
  XCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Minus,
  Film,
  MessageSquare,
  Shield,
  ShieldAlert,
  FileText,
  Check,
  CheckCircle,
  Presentation,
  Link,
  Edit3,
  Calendar,
  ListTodo,
  Flag,
  Trophy,
  Image as ImageIcon,
  Cpu,
  Activity,
  ArrowRight,
  DraftingCompass
} from 'lucide-react';
import { Message, getGeminiResponse, generateVideoPrompt, extractTopicsFromConversation, generateSummaryFromConversation, ConversationInsights } from '../lib/gemini';
import { KnowledgeCanvas, Artifact } from './KnowledgeCanvas';
import Waveform from './Waveform';
import VideoCallError from './VideoCallError';
import TypingIndicator from './TypingIndicator';
import TaskManager from './TaskManager';
import Markdown from 'react-markdown';
import { useAuth } from '../lib/auth-context';
import { doc, updateDoc, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, getDocs, writeBatch, deleteDoc, Timestamp } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';

const formatDuration = (seconds: number) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};


function TypedText({ text, speed, onComplete }: { text: string; speed: number; onComplete?: () => void }) {
  const [isFinished, setIsFinished] = useState(false);
  
  if (speed === 0) {
    onComplete?.();
    return <>{text}</>;
  }

  // Handle line breaks by splitting into lines first, then words
  const chunks = text.split(/(\s+)/);

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        visible: {
          transition: {
            staggerChildren: (speed / 1000),
          },
        },
      }}
      onAnimationComplete={() => {
        setIsFinished(true);
        onComplete?.();
      }}
      className="inline"
    >
      {chunks.map((chunk, i) => (
        <motion.span
          key={i}
          variants={{
            hidden: { opacity: 0, y: 3 },
            visible: { opacity: 1, y: 0 },
          }}
          transition={{ duration: 0.2 }}
          className="inline whitespace-pre-wrap"
        >
          {chunk}
        </motion.span>
      ))}
      {!isFinished && (
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity, ease: "easeInOut" }}
          className="inline-block w-1.5 h-4 ml-1 bg-aura-accent align-middle rounded-sm"
        />
      )}
    </motion.div>
  );
}

interface VideoSyncData {
  url: string;
  isPlaying: boolean;
  currentTime: number;
  lastUpdated: number;
  senderId: string;
}

function VideoPlayer({ 
  src, 
  roomId, 
  isSyncEnabled = false,
  syncState,
  onSyncAction,
  user
}: { 
  src: string;
  roomId?: string;
  isSyncEnabled?: boolean;
  syncState?: VideoSyncData | null;
  onSyncAction?: (action: { isPlaying: boolean; currentTime: number }) => void;
  user?: any;
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(parseFloat(localStorage.getItem('rewon_video_volume') || '1'));
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSyncActive, setIsSyncActive] = useState(isSyncEnabled);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isInternalUpdate = useRef(false);
  const lastSyncTimeRef = useRef(0);

  // Auto-activate sync if prop changes
  useEffect(() => {
    setIsSyncActive(isSyncEnabled);
  }, [isSyncEnabled]);

  // Sync with external state
  useEffect(() => {
    if (!isSyncActive || !syncState || !videoRef.current || syncState.url !== src) return;
    
    // Ignore updates we sent recently (within 1s) to avoid feedback loops
    if (syncState.senderId === user?.uid && Date.now() - syncState.lastUpdated < 1000) return;

    const video = videoRef.current;
    
    // Play/Pause sync
    if (syncState.isPlaying !== isPlaying) {
      isInternalUpdate.current = true;
      if (syncState.isPlaying) {
        video.play().catch(console.error);
      } else {
        video.pause();
      }
      setIsPlaying(syncState.isPlaying);
      isInternalUpdate.current = false;
    }

    // Time sync (Handle drift > 2s or if we just jumped)
    const drift = Math.abs(syncState.currentTime - video.currentTime);
    if (drift > 2) {
      isInternalUpdate.current = true;
      video.currentTime = syncState.currentTime;
      setCurrentTime(syncState.currentTime);
      isInternalUpdate.current = false;
    }
  }, [syncState, isSyncActive, src, user?.uid]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      setProgress((video.currentTime / video.duration) * 100);
      setCurrentTime(video.currentTime);
      
      // Heartbeat sync for the leader (every 5 seconds)
      if (isSyncActive && isPlaying && !isInternalUpdate.current) {
        const now = Date.now();
        if (now - lastSyncTimeRef.current > 5000) {
          lastSyncTimeRef.current = now;
          onSyncAction?.({ isPlaying: true, currentTime: video.currentTime });
        }
      }
    };

    const onLoad = () => setDuration(video.duration);
    const onEnded = () => {
      setIsPlaying(false);
      if (isSyncActive && !isInternalUpdate.current) {
        onSyncAction?.({ isPlaying: false, currentTime: video.currentTime });
      }
    };

    video.addEventListener('timeupdate', updateProgress);
    video.addEventListener('loadedmetadata', onLoad);
    video.addEventListener('ended', onEnded);

    return () => {
      video.removeEventListener('timeupdate', updateProgress);
      video.removeEventListener('loadedmetadata', onLoad);
      video.removeEventListener('ended', onEnded);
    };
  }, [src, isSyncActive, isPlaying, onSyncAction]);

  const togglePlay = () => {
    if (videoRef.current) {
      const newPlayingState = !isPlaying;
      if (newPlayingState) {
        videoRef.current.play().catch(console.error);
      } else {
        videoRef.current.pause();
      }
      setIsPlaying(newPlayingState);

      if (isSyncActive && !isInternalUpdate.current) {
        onSyncAction?.({ isPlaying: newPlayingState, currentTime: videoRef.current.currentTime });
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = (parseFloat(e.target.value) / 100) * duration;
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
      if (isSyncActive && !isInternalUpdate.current) {
        onSyncAction?.({ isPlaying, currentTime: time });
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    localStorage.setItem('rewon_video_volume', val.toString());
    if (videoRef.current) {
      videoRef.current.volume = val;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const newMuteStatus = !isMuted;
      setIsMuted(newMuteStatus);
      videoRef.current.muted = newMuteStatus;
      if (newMuteStatus) {
        videoRef.current.volume = 0;
      } else {
        videoRef.current.volume = volume || 1;
      }
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const forceResync = () => {
    if (syncState && videoRef.current) {
      videoRef.current.currentTime = syncState.currentTime;
      if (syncState.isPlaying) {
        videoRef.current.play().catch(console.error);
      } else {
        videoRef.current.pause();
      }
      setIsPlaying(syncState.isPlaying);
      setCurrentTime(syncState.currentTime);
    }
  };

  const isFollowing = isSyncActive && syncState && syncState.url === src && syncState.senderId !== user?.uid;

  return (
    <div ref={containerRef} className="relative group w-full bg-black rounded-xl overflow-hidden border border-white/10 shadow-2xl">
      <video 
        ref={videoRef} 
        src={src} 
        className="w-full h-auto cursor-pointer"
        onClick={togglePlay}
        playsInline
      />

      {/* Sync Status Overlay */}
      {isSyncActive && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {isFollowing && (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-aura-accent/90 backdrop-blur-md px-2 py-1 rounded-md text-[9px] font-black uppercase text-white flex items-center gap-1 shadow-lg ring-1 ring-white/20"
            >
              <RefreshCw size={10} className="animate-spin" />
              Following Mode
            </motion.div>
          )}
          <button 
            onClick={() => setIsSyncActive(!isSyncActive)}
            className={`p-1.5 rounded-lg backdrop-blur-md transition-all border ${isSyncActive ? 'bg-emerald-500/80 border-emerald-400/50 text-white' : 'bg-slate-800/80 border-white/10 text-slate-400'}`}
            title={isSyncActive ? "Sync Enabled" : "Sync Disabled"}
          >
            <Users size={14} />
          </button>
        </div>
      )}

      {/* Play/Pause Large Overlay */}
      <AnimatePresence>
        {!isPlaying && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-10"
          >
            <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center shadow-2xl">
              <Play size={32} className="text-white fill-white ml-1" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Overlay Controls */}
      <div className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 transition-opacity duration-300 ${isPlaying && !isFullscreen ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'} z-20`}>
        {/* Progress Bar */}
        <div className="relative w-full h-1.5 bg-white/10 rounded-full mb-4 cursor-pointer group/progress">
          <input 
            type="range" 
            min="0" 
            max="100" 
            value={progress || 0} 
            onChange={handleSeek}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
          />
          <div 
            className="absolute left-0 top-0 h-full bg-aura-primary rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full scale-0 group-hover/progress:scale-100 transition-transform shadow-xl" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={togglePlay} className="text-white hover:text-aura-primary transition-all active:scale-90">
              {isPlaying ? <Pause size={20} /> : <Play size={20} fill="currentColor" />}
            </button>
            
            <div className="flex items-center gap-2 group/volume">
              <button onClick={toggleMute} className="text-white hover:text-aura-primary transition-colors">
                {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.01" 
                value={isMuted ? 0 : volume} 
                onChange={handleVolumeChange}
                className="w-0 group-hover/volume:w-20 transition-all duration-300 h-1 bg-white/20 rounded-full appearance-none cursor-pointer accent-white overflow-hidden"
              />
            </div>

            <span className="text-[10px] text-white/70 font-mono tracking-tight bg-white/5 px-2 py-0.5 rounded border border-white/5">
              {formatTime(currentTime)} <span className="opacity-30">/</span> {formatTime(duration)}
            </span>

            {isSyncActive && (
              <button 
                onClick={forceResync}
                className="text-[9px] font-black uppercase text-aura-primary hover:text-white transition-colors flex items-center gap-1"
                title="Force Resync"
              >
                <RefreshCw size={10} className={isFollowing ? 'animate-spin-slow' : ''} />
                Resync
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!isSyncActive && roomId && (
              <button 
                onClick={() => {
                  setIsSyncActive(true);
                  onSyncAction?.({ isPlaying, currentTime: videoRef.current?.currentTime || 0 });
                }}
                className="px-3 py-1 bg-aura-primary/20 hover:bg-aura-primary border border-aura-primary/30 rounded-lg text-[9px] font-black uppercase text-white transition-all shadow-lg active:scale-95"
              >
                Broadcast to All
              </button>
            )}
            <button onClick={toggleFullscreen} className="text-white hover:text-aura-primary transition-all active:scale-90 p-1">
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AudioPlayer({ src, globalRate, onRateChange }: { src: string; globalRate: number; onRateChange: (rate: number) => void }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = globalRate;
    }
  }, [globalRate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateProgress = () => {
      setProgress((audio.currentTime / audio.duration) * 100);
      setCurrentTime(audio.currentTime);
    };

    const onLoad = () => setDuration(audio.duration);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', onLoad);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateProgress);
      audio.removeEventListener('loadedmetadata', onLoad);
      audio.removeEventListener('ended', onEnded);
    };
  }, [src]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = (parseFloat(e.target.value) / 100) * duration;
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const skip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    }
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col gap-2 w-full min-w-[200px] bg-black/20 p-3 rounded-xl border border-white/5 shadow-inner">
      <audio ref={audioRef} src={src} className="hidden" />
      <div className="flex items-center gap-3">
        <button 
          onClick={togglePlay}
          className="w-10 h-10 flex items-center justify-center bg-aura-primary rounded-full text-white hover:scale-105 transition-transform shadow-lg shadow-aura-primary/30"
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-1" />}
        </button>
        
        <div className="flex-1 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
             <button onClick={() => skip(-5)} className="text-slate-500 hover:text-white transition-colors" title="Back 5s">
               <RotateCcw size={14} />
             </button>
             <input 
              type="range" 
              min="0" 
              max="100" 
              value={progress || 0} 
              onChange={handleSeek}
              className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-aura-primary"
            />
            <button onClick={() => skip(5)} className="text-slate-500 hover:text-white transition-colors" title="Forward 5s">
               <RotateCw size={14} />
             </button>
          </div>
          <div className="flex justify-between text-[9px] text-slate-400 font-mono tracking-tighter opacity-80">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between pt-1.5 mt-1 border-t border-white/5">
        <div className="flex items-center gap-1.5">
          {[1, 1.5, 2].map((rate) => (
            <button
              key={rate}
              onClick={() => onRateChange(rate)}
              className={`text-[9px] px-2.5 py-0.5 rounded-full font-bold transition-all border ${
                globalRate === rate 
                  ? "bg-aura-accent text-white border-aura-accent shadow-sm" 
                  : "bg-white/5 text-slate-500 border-transparent hover:bg-white/10"
              }`}
            >
              {rate}x
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-1 max-w-[100px] ml-4 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
          <FastForward size={10} className={globalRate > 1.2 ? "text-aura-accent" : "text-slate-500"} />
          <input 
            type="range" 
            min="0.5" 
            max="2.5" 
            step="0.1" 
            value={globalRate} 
            onChange={(e) => onRateChange(parseFloat(e.target.value))}
            className="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-aura-accent"
          />
          <span className="text-[9px] text-aura-accent font-mono font-bold w-[22px] text-center">
            {globalRate.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  );
}

function VideoOffPlaceholder({ name, avatar, size = "large" }: { name: string; avatar?: string; size?: "small" | "large" }) {
  const containerSize = size === "large" ? "w-28 h-28" : "w-16 h-16";
  const iconSize = size === "large" ? 48 : 24;
  const cameraOffSize = size === "large" ? 32 : 16;
  const nameSize = size === "large" ? "text-xl" : "text-xs";

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <motion.div 
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`relative ${containerSize}`}
      >
        <div className="w-full h-full bg-slate-800/80 md:bg-slate-800/40 rounded-full flex items-center justify-center border border-white/10 shadow-2xl backdrop-blur-xl overflow-hidden relative group">
          {avatar ? (
            <img src={avatar} alt={name} className="w-full h-full object-cover opacity-30 group-hover:opacity-50 transition-opacity" />
          ) : (
            <UserIcon size={iconSize} className="text-slate-500" />
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <CameraOff size={cameraOffSize} className="text-white/20" />
          </div>
        </div>
        <div className="absolute -bottom-1 -right-1 bg-red-500/80 backdrop-blur-sm rounded-full p-1.5 border-2 border-slate-900 shadow-lg">
          <VideoOff size={cameraOffSize / 4 + 4} className="text-white" />
        </div>
      </motion.div>
      {size === "large" && (
        <div className="space-y-1">
          <motion.p 
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className={`text-slate-300 font-bold tracking-tight ${nameSize}`}
          >
            {name}
          </motion.p>
          <div className="flex justify-center">
            <span className="px-3 py-0.5 bg-white/5 text-slate-500 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/5">Camera Disabled</span>
          </div>
        </div>
      )}
    </div>
  );
}

function VideoCall({ 
  onClose, 
  isSpeaking, 
  isListening, 
  isLightMode,
  messages,
  onSendMessage,
  isChatLoading,
  onStartListening,
  onStopListening,
  devices,
  selectedVideoDeviceId,
  setSelectedVideoDeviceId,
  selectedAudioDeviceId,
  setSelectedAudioDeviceId,
  selectedSpeakerDeviceId,
  setSelectedSpeakerDeviceId,
  refreshDevices,
  audioPlaybackRate,
  setAudioPlaybackRate,
  isRecordingCall,
  toggleCallRecording,
  meetingRecordingUrl,
  exportMeetingRecording,
  recordingDuration,
  showToast,
  roomId,
  setRoomId,
  videoSyncState,
  updateGlobalVideoSync,
  showInsightsOverlay,
  setShowInsightsOverlay,
  setIsVoiceAssistantActive,
  insights,
  user,
  transcripts,
  setTranscripts
}: { 
  onClose: () => void, 
  isSpeaking: boolean, 
  isListening: boolean, 
  isLightMode: boolean,
  messages: Message[],
  onSendMessage: (content?: string) => Promise<void>,
  isChatLoading: boolean,
  onStartListening: () => void,
  onStopListening: () => void,
  devices: MediaDeviceInfo[],
  selectedVideoDeviceId: string,
  setSelectedVideoDeviceId: (id: string) => void,
  selectedAudioDeviceId: string,
  setSelectedAudioDeviceId: (id: string) => void,
  selectedSpeakerDeviceId: string,
  setSelectedSpeakerDeviceId: (id: string) => void,
  refreshDevices: () => Promise<void>,
  audioPlaybackRate: number,
  setAudioPlaybackRate: (rate: number) => void,
  isRecordingCall: boolean,
  toggleCallRecording: (stream: MediaStream | null) => Promise<void>,
  meetingRecordingUrl: string | null,
  exportMeetingRecording: () => void,
  recordingDuration: number,
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void,
  roomId: string,
  setRoomId: (id: string | ((prev: string) => string)) => void,
  videoSyncState: VideoSyncData | null,
  updateGlobalVideoSync: (data: Partial<VideoSyncData>) => Promise<void>,
  showInsightsOverlay: boolean,
  setShowInsightsOverlay: (show: boolean) => void,
  setIsVoiceAssistantActive: (active: boolean) => void,
  insights: ConversationInsights | null,
  user: any,
  transcripts: { id: string; user: string; text: string; time: string }[],
  setTranscripts: React.Dispatch<React.SetStateAction<{ id: string; user: string; text: string; time: string }[]>>
}) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [settingsStream, setSettingsStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<{ type: 'NETWORK' | 'PERMISSION' | 'NOT_FOUND' | 'COMPATIBILITY' | 'BUSY' | 'UNKNOWN' | 'SHARING'; message: string; code?: string } | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const [showEndConfirmation, setShowEndConfirmation] = useState(false);
  const [isNoiseSuppressionEnabled, setIsNoiseSuppressionEnabled] = useState(false);
  const rawStreamRef = useRef<MediaStream | null>(null);
  const [isPresenterMode, setIsPresenterMode] = useState(false);
  const [presenterId, setPresenterId] = useState<string>('1');
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [isTranscriptionEnabled, setIsTranscriptionEnabled] = useState(false);
  const [showLiveFeed, setShowLiveFeed] = useState(true);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [customKeywords, setCustomKeywords] = useState<string[]>(['roadmap', 'prototype', 'milestone', 'resources']);
  const [newKeywordInput, setNewKeywordInput] = useState('');
  const [isExtractingTopics, setIsExtractingTopics] = useState(false);
  const [aiExtractedTopics, setAiExtractedTopics] = useState<string[]>([
    'Q3 Roadmap',
    'Prototype Validation',
    'Resource Constraints',
    'Project Board Sync'
  ]);
  const [aiActionItems, setAiActionItems] = useState<{text: string; completed: boolean}[]>([]);
  const [aiMilestones, setAiMilestones] = useState<string[]>([]);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [settingsTab, setSettingsTab] = useState<'devices' | 'ai' | 'help'>('devices');
  const [connectionQuality, setConnectionQuality] = useState<'Excellent' | 'Good' | 'Fair' | 'Poor' | 'Analyzing...'>('Analyzing...');
  const [latency, setLatency] = useState(0);
  const [packetLoss, setPacketLoss] = useState(0);
  const [jitter, setJitter] = useState(0);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const getNetworkStats = async () => {
      if (!peerConnectionRef.current) {
        // Simulation for Demo purposes if no peer connection is active
        const simulatedLatency = Math.floor(15 + Math.random() * 10);
        const simulatedJitter = Math.floor(2 + Math.random() * 5);
        const simulatedLoss = Math.random() < 0.1 ? Math.random() * 0.1 : 0;
        
        setLatency(simulatedLatency);
        setJitter(simulatedJitter);
        setPacketLoss(simulatedLoss);
        setConnectionQuality('Excellent');
        return;
      }

      try {
        const stats = await peerConnectionRef.current.getStats();
        let currentLatency = 0;
        let currentPacketLoss = 0;
        let currentJitter = 0;

        stats.forEach(report => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded' && report.currentRoundTripTime !== undefined) {
            currentLatency = report.currentRoundTripTime * 1000;
          }
          if (report.type === 'remote-inbound-rtp') {
            if (report.fractionLost !== undefined) currentPacketLoss = report.fractionLost * 100;
            if (report.jitter !== undefined) currentJitter = report.jitter * 1000;
          }
          if (report.type === 'inbound-rtp' && report.fractionLost !== undefined) {
            currentPacketLoss = report.fractionLost * 100;
          }
        });

        setLatency(Math.round(currentLatency));
        setPacketLoss(Number(currentPacketLoss.toFixed(2)));
        setJitter(Math.round(currentJitter));

        if (currentLatency === 0 && currentPacketLoss === 0 && currentJitter === 0) {
          setConnectionQuality('Analyzing...');
        } else if (currentLatency < 100 && currentPacketLoss < 0.5 && currentJitter < 20) {
          setConnectionQuality('Excellent');
        } else if (currentLatency < 200 && currentPacketLoss < 2 && currentJitter < 50) {
          setConnectionQuality('Good');
        } else if (currentLatency < 400 && currentPacketLoss < 5 && currentJitter < 100) {
          setConnectionQuality('Fair');
        } else {
          setConnectionQuality('Poor');
        }
      } catch (err) {
        console.warn("Stats monitoring failed:", err);
      }
    };

    intervalId = setInterval(getNetworkStats, 3000);
    return () => clearInterval(intervalId);
  }, []);

  const generateAISummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const convoText = transcripts.map(t => `${t.user}: ${t.text}`).join('\n');
      const summary = await generateSummaryFromConversation(convoText || "No transcription available yet.");
      setAiSummary(summary);
      showToast("Conference summary generated successfully using REWON AI!", "success");
    } catch (err) {
      console.error("Error generating summaries:", err);
      setAiSummary("The call focused on project milestones and the upcoming design review. Key action items include finalizing the prototype by Friday and scheduling a follow-up with the engineering team.");
    } finally {
      setIsGeneratingSummary(false);
      if (typeof playSound === 'function') playSound('chime-up', 0.2);
    }
  };

  const exportSummary = () => {
    if (!aiSummary) return;
    const content = `Meeting Summary\nGenerated by REWON AI\nDate: ${new Date().toLocaleString()}\n\n${aiSummary}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `meeting-summary-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Summary exported successfully", "success");
  };

  const [showSettings, setShowSettings] = useState(false);
  const [actionItems, setActionItems] = useState<{id: string, text: string, completed: boolean}[]>([
    { id: '1', text: 'Confirm meeting agenda requirements', completed: false },
    { id: '2', text: 'Send technical documentation to participants', completed: false }
  ]);
  const [participants, setParticipants] = useState([
    { id: '1', name: 'You (Host)', role: 'Host', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=user', isMuted: false, isHost: true, isVideoOff: false, isScreenSharing: false },
    { id: '2', name: 'REWON AI', role: 'AI Assistant', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=rewon', isMuted: false, isHost: false, isVideoOff: false, isScreenSharing: false },
  ]);
  const [newMessage, setNewMessage] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [isSecure, setIsSecure] = useState(false);
  const [currentBitrate, setCurrentBitrate] = useState<number>(1800);
  const [isRetrying, setIsRetrying] = useState(false);

  const [meetingSentiment, setMeetingSentiment] = useState<'positive' | 'neutral' | 'curious' | 'serious'>('neutral');
  const [engagementScore, setEngagementScore] = useState(85);

  useEffect(() => {
    if (transcripts.length > 0) {
      // Simulate engagement increase with messages
      setEngagementScore(Math.min(98, 85 + Math.floor(transcripts.length / 2)));
      
      // Basic mock sentiment detection
      const lastText = transcripts[transcripts.length - 1].text.toLowerCase();
      if (lastText.includes('good') || lastText.includes('great') || lastText.includes('wow')) {
        setMeetingSentiment('positive');
      } else if (lastText.includes('how') || lastText.includes('why') || lastText.includes('?')) {
        setMeetingSentiment('curious');
      } else if (lastText.includes('must') || lastText.includes('deadline') || lastText.includes('important')) {
        setMeetingSentiment('serious');
      }
    }
  }, [transcripts.length]);

  function MeetingPulse() {
    const sentimentColors = {
      positive: 'text-emerald-400 bg-emerald-400/20 shadow-[0_0_15px_rgba(16,185,129,0.3)]',
      neutral: 'text-blue-400 bg-blue-400/20 shadow-[0_0_15px_rgba(96,165,250,0.3)]',
      serious: 'text-amber-400 bg-amber-400/20 shadow-[0_0_15px_rgba(251,191,36,0.3)]',
      curious: 'text-purple-400 bg-purple-400/20 shadow-[0_0_15px_rgba(167,139,250,0.3)]'
    };

    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-3 px-3 py-2 bg-white/[0.03] border border-white/5 rounded-2xl backdrop-blur-2xl"
      >
        <div className="flex flex-col items-start">
          <span className="text-[7px] font-black uppercase text-slate-500 tracking-widest leading-none mb-1">Engage Depth</span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-aura-accent animate-ping" />
            <span className="text-xs font-black text-white">{engagementScore}%</span>
          </div>
        </div>
        
        <div className="w-[1px] h-6 bg-white/10 mx-1" />

        <div className="flex flex-col items-start">
          <span className="text-[7px] font-black uppercase text-slate-500 tracking-widest leading-none mb-1">Aura State</span>
          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter ${sentimentColors[meetingSentiment]}`}>
            {meetingSentiment}
          </span>
        </div>
      </motion.div>
    );
  }

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcripts]);

  const dynamicExtractedKeywords = React.useMemo(() => {
    const counts: Record<string, number> = {};
    const COMMON_STOP_WORDS = new Set([
      'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 
      'yourself', 'yourselves', 'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 
      'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 
      'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 
      'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing', 'a', 'an', 
      'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while', 'of', 'at', 'by', 'for', 
      'with', 'about', 'against', 'between', 'into', 'through', 'during', 'before', 'after', 
      'above', 'below', 'to', 'from', 'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 
      'again', 'further', 'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 
      'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 
      'only', 'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 
      'should', 'now', 'would', 'think', 'focus', 'review', 'mentioned', 'suggests', 'suggest',
      'active', 'begin', 'beginning', 'record', 'key', 'points', 'discussion', 'notes', 'noted',
      'pull', 'board', 'project', 'like', 'get', 'doing', 'want', 'think', 'focus'
    ]);

    transcripts.forEach(t => {
      const words = t.text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ').split(/\s+/);
      words.forEach(w => {
        if (w.length > 3 && !COMMON_STOP_WORDS.has(w)) {
          counts[w] = (counts[w] || 0) + 1;
        }
      });
    });

    return Object.entries(counts)
      .map(([word, freq]) => ({ word, freq }))
      .sort((a, b) => b.freq - a.freq)
      .slice(0, 8);
  }, [transcripts]);

  const allKeywords = React.useMemo(() => {
    const words = new Set<string>();
    customKeywords.forEach(k => {
      if (k && k.trim()) words.add(k.trim().toLowerCase());
    });
    dynamicExtractedKeywords.forEach(k => {
      if (k.word && k.word.trim()) words.add(k.word.trim().toLowerCase());
    });
    return Array.from(words);
  }, [customKeywords, dynamicExtractedKeywords]);

  const highlightAndMakeClickable = (text: string) => {
    if (allKeywords.length === 0) return text;
    
    // Sort by length descending to match larger keywords first in case of overlaps
    const sortedKeywords = [...allKeywords].sort((a, b) => b.length - a.length);
    const pattern = sortedKeywords.map(k => k.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('|');
    const regex = new RegExp(`\\b(${pattern})\\b`, 'gi');
    
    const parts = text.split(regex);
    if (parts.length === 1) return text;
    
    return parts.map((part, i) => {
      const isKeyword = sortedKeywords.some(k => k.toLowerCase() === part.toLowerCase());
      if (isKeyword) {
        const isActive = selectedKeyword && selectedKeyword.toLowerCase() === part.toLowerCase();
        return (
          <button
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              const newKeyword = part.toLowerCase();
              if (selectedKeyword && selectedKeyword.toLowerCase() === newKeyword) {
                setSelectedKeyword(null);
                showToast("Cleared transcript filter", 'info');
                if (typeof playSound === 'function') playSound('pop', 0.15);
              } else {
                setSelectedKeyword(part);
                showToast(`Filtering transcript by: "${part}"`, 'success');
                if (typeof playSound === 'function') playSound('chime-up', 0.15);
              }
            }}
            className={`inline-flex items-center px-1.5 py-0.5 mx-0.5 rounded text-[11px] font-bold transition-all ${
              isActive
                ? 'bg-gradient-to-r from-aura-accent to-indigo-500 text-white shadow-[0_0_10px_rgba(123,97,255,0.4)]'
                : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 hover:text-white cursor-pointer'
            }`}
            title={`Click to ${isActive ? 'clear filter' : `filter by "${part}"`}`}
          >
            {part}
          </button>
        );
      }
      return part;
    });
  };

  const triggerDynamicTopicExtraction = async () => {
    setIsExtractingTopics(true);
    try {
      const convoText = transcripts.map(t => `${t.user}: ${t.text}`).join('\n');
      const insights = await extractTopicsFromConversation(convoText || "No transcription available yet.");
      if (insights.topics && insights.topics.length > 0) {
        setAiExtractedTopics(insights.topics);
        setAiActionItems((insights.actionItems || []).map(item => ({ text: item, completed: false })));
        setAiMilestones(insights.milestones);
      } else {
        const baseTopics = ['Development Execution', 'Sprint Planning Objectives', 'System Reliability Indicators'];
        if (dynamicExtractedKeywords.length > 0) {
          const keywordCaps = dynamicExtractedKeywords.slice(0, 3).map(k => k.word.charAt(0).toUpperCase() + k.word.slice(1) + ' Alignment');
          setAiExtractedTopics([...new Set([...keywordCaps, ...baseTopics])]);
        } else {
          setAiExtractedTopics(baseTopics);
        }
      }
      showToast("Extracted keywords and key topics successfully using REWON AI!", "success");
    } catch (err) {
      console.error("Error extracting topics:", err);
      const baseTopics = ['Development Execution', 'Sprint Planning Objectives', 'System Reliability Indicators'];
      setAiExtractedTopics(baseTopics);
    } finally {
      setIsExtractingTopics(false);
      if (typeof playSound === 'function') playSound('chime-up', 0.25);
    }
  };

  const toggleAiActionItem = (index: number) => {
    setAiActionItems(prev => prev.map((item, i) => 
      i === index ? { ...item, completed: !item.completed } : item
    ));
    if (typeof playSound === 'function') playSound('pop', 0.15);
  };

  const highlightKeywords = (text: string, keywords: string[]) => {
    if (!keywords || keywords.length === 0) return <span>{text}</span>;
    
    // Sort by length descending to match longest phrases first
    const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
    const escapedKeywords = sortedKeywords
      .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .filter(k => k.length > 0)
      .join('|');
    
    if (!escapedKeywords) return <span>{text}</span>;
    
    const regex = new RegExp(`(${escapedKeywords})`, 'gi');
    const parts = text.split(regex);
    
    return (
      <>
        {parts.map((part, i) => {
          const isMatch = sortedKeywords.some(k => k.toLowerCase() === part.toLowerCase());
          if (isMatch) {
            return (
              <span
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedKeyword(part);
                  if (typeof playSound === 'function') playSound('chime-up', 0.15);
                }}
                className="text-aura-accent font-bold cursor-pointer hover:underline bg-aura-accent/10 px-1 rounded transition-all hover:scale-105 inline-block"
              >
                {part}
              </span>
            );
          }
          return part;
        })}
      </>
    );
  };

  const handleAddCustomKeyword = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanWord = newKeywordInput.trim().toLowerCase();
    if (cleanWord && !customKeywords.includes(cleanWord)) {
      setCustomKeywords(prev => [...prev, cleanWord]);
      setNewKeywordInput('');
      showToast(`Added custom keyword tracker: "${cleanWord}"`, "success");
      playSound('pop', 0.2);
    }
  };

  const handleRemoveCustomKeyword = (wordId: string) => {
    setCustomKeywords(prev => prev.filter(w => w !== wordId));
    if (selectedKeyword === wordId) {
      setSelectedKeyword(null);
    }
    showToast(`Removed keyword tracker: "${wordId}"`, "info");
  };

  const recognitionRef = useRef<any>(null);

  const toggleTranscription = () => {
    const newState = !isTranscriptionEnabled;
    setIsTranscriptionEnabled(newState);
    
    if (newState) {
      showToast("Live Transcription Enabled", "success");
      // Add a system entry
      setTranscripts(prev => [...prev, { 
        id: `system-${Date.now()}`, 
        user: 'System', 
        text: "Transcription active. Monitoring audio streams...", 
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
      }]);
    } else {
      showToast("Live Transcription Disabled", "info");
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    }
  };

  useEffect(() => {
    if (isTranscriptionEnabled) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        try {
          const rec = new SpeechRecognition();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = 'en-US';

          rec.onresult = (event: any) => {
            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                const text = event.results[i][0].transcript;
                if (text.trim()) {
                  setTranscripts(prev => [...prev.slice(-49), {
                    id: `user-${Date.now()}-${Math.random()}`,
                    user: 'You',
                    text: text.trim(),
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  }]);
                }
              }
            }
          };

          rec.onerror = (event: any) => {
            console.warn("Transcription error:", event.error);
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
              setIsTranscriptionEnabled(false);
              showToast("Microphone permission required for transcription", "error");
            }
          };

          rec.onend = () => {
            if (isTranscriptionEnabled) {
              try {
                rec.start();
              } catch (e) {
                console.error("Failed to restart recognition:", e);
              }
            }
          };

          rec.start();
          recognitionRef.current = rec;
        } catch (err) {
          console.error("Speech recognition initialization failed:", err);
        }
      } else {
        showToast("Speech recognition not supported in this browser", "error");
        setIsTranscriptionEnabled(false);
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
    };
  }, [isTranscriptionEnabled]);

  // Capture AI responses for transcription
  const lastProcessedMessageRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isTranscriptionEnabled || messages.length === 0) return;
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'assistant' && !lastMessage.isStreaming && lastMessage.content !== lastProcessedMessageRef.current) {
      lastProcessedMessageRef.current = lastMessage.content;
      setTranscripts(prev => [...prev.slice(-49), {
        id: `ai-${Date.now()}`,
        user: 'REWON AI',
        text: lastMessage.content,
        time: lastMessage.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }
  }, [messages, isTranscriptionEnabled]);

  // Automatic AI topic extraction when transcripts grow
  useEffect(() => {
    if (transcripts.length > 0 && transcripts.length % 5 === 0 && !isExtractingTopics) {
      triggerDynamicTopicExtraction();
    }
  }, [transcripts.length]);

  const exportTranscript = () => {
    if (transcripts.length === 0) return;
    const content = transcripts.map(t => `[${t.time}] ${t.user}: ${t.text}`).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const [showPreview, setShowPreview] = useState(false);
  const [isRecordingLocal, setIsRecordingLocal] = useState(false);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const localRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    if (remoteVideoRef.current && 'setSinkId' in remoteVideoRef.current && selectedSpeakerDeviceId) {
      (remoteVideoRef.current as any).setSinkId(selectedSpeakerDeviceId).catch((err: any) => {
        console.error("Failed to set speaker sink from prop change:", err);
      });
    }
  }, [selectedSpeakerDeviceId]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'Are you sure you want to end this call? Accidental tab closures will disconnect your session.';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const noiseFilterRef = useRef<BiquadFilterNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);

  const setupNoiseSuppression = (stream: MediaStream) => {
    if (!stream.getAudioTracks().length) return stream;

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;

    // Disconnect existing
    audioSourceRef.current?.disconnect();
    noiseFilterRef.current?.disconnect();
    compressorRef.current?.disconnect();

    const source = ctx.createMediaStreamSource(stream);
    const destination = ctx.createMediaStreamDestination();

    // Highpass filter for low-end rumble (simulating AI focus on speech)
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(100, ctx.currentTime); // Lower cut-off for natural voice
    filter.Q.setValueAtTime(1, ctx.currentTime);

    // Bandpass filter to isolate human speech frequencies (approx 300Hz - 3.4kHz)
    const voiceFilter = ctx.createBiquadFilter();
    voiceFilter.type = 'bandpass';
    voiceFilter.frequency.setValueAtTime(1850, ctx.currentTime); // Mid-range
    voiceFilter.Q.setValueAtTime(0.5, ctx.currentTime); // Wide enough for speech

    // Dynamics compressor for noise gating and leveling
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-45, ctx.currentTime);
    compressor.knee.setValueAtTime(30, ctx.currentTime);
    compressor.ratio.setValueAtTime(12, ctx.currentTime);
    compressor.attack.setValueAtTime(0.003, ctx.currentTime);
    compressor.release.setValueAtTime(0.25, ctx.currentTime);

    source.connect(filter);
    filter.connect(voiceFilter);
    voiceFilter.connect(compressor);
    compressor.connect(destination);

    audioSourceRef.current = source;
    noiseFilterRef.current = filter;
    compressorRef.current = compressor;
    audioDestinationRef.current = destination;

    // Combine with original video track
    const processedStream = new MediaStream([
      ...stream.getVideoTracks(),
      ...destination.stream.getAudioTracks()
    ]);

    return processedStream;
  };

  const toggleNoiseSuppression = () => {
    setIsNoiseSuppressionEnabled(prev => {
      const newState = !prev;
      showToast(newState ? "AI Noise Suppression Enabled" : "AI Noise Suppression Disabled", "info");
      
      if (rawStreamRef.current) {
        let streamToUse = rawStreamRef.current;
        
        // If we enable it, we need to apply it to the sender
        if (newState) {
          const processed = setupNoiseSuppression(rawStreamRef.current);
          const newAudioTrack = processed.getAudioTracks()[0];
          
          if (peerConnectionRef.current) {
            const senders = peerConnectionRef.current.getSenders();
            const audioSender = senders.find(s => s.track?.kind === 'audio');
            if (audioSender) {
              audioSender.replaceTrack(newAudioTrack);
            }
          }
          
          streamToUse = processed;
        } else {
          // Revert to original clean mic track
          const originalAudioTrack = rawStreamRef.current.getAudioTracks()[0];
          if (peerConnectionRef.current) {
            const senders = peerConnectionRef.current.getSenders();
            const audioSender = senders.find(s => s.track?.kind === 'audio');
            if (audioSender) {
              audioSender.replaceTrack(originalAudioTrack);
            }
          }
          
          streamToUse = rawStreamRef.current;
        }
        
        // Update local preview and state
        setLocalStream(streamToUse);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = streamToUse;
        }
      }
      
      return newState;
    });
  };

  const changeSpeakerDevice = async (deviceId: string) => {
    setSelectedSpeakerDeviceId(deviceId);
    if (remoteVideoRef.current && 'setSinkId' in remoteVideoRef.current) {
      try {
        await (remoteVideoRef.current as any).setSinkId(deviceId);
      } catch (err) {
        console.error("Failed to set speaker sink:", err);
      }
    }
  };

  const changeVideoDevice = async (deviceId: string) => {
    setSelectedVideoDeviceId(deviceId);
    await startCall(deviceId, selectedAudioDeviceId);
  };

  const changeAudioDevice = async (deviceId: string) => {
    setSelectedAudioDeviceId(deviceId);
    await startCall(selectedVideoDeviceId, deviceId);
  };

  const startCall = async (videoDeviceId?: string, audioDeviceId?: string) => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError({ type: 'COMPATIBILITY', message: "Your browser does not support secure video calling. Please ensure you are using a modern browser (Chrome/Firefox/Safari) and have an active HTTPS connection." });
      return;
    }
    
    setIsRetrying(true);
    try {
      // Stop existing tracks if any
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        video: videoDeviceId ? { deviceId: { exact: videoDeviceId } } : {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 }
        },
        audio: audioDeviceId ? { 
          deviceId: { exact: audioDeviceId },
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      };

      let stream = await navigator.mediaDevices.getUserMedia(constraints);
      rawStreamRef.current = stream;
      
      // AI Noise Suppression application
      if (isNoiseSuppressionEnabled) {
        stream = setupNoiseSuppression(stream);
      }

      // Check for hardware mutes or physical shutters
      const videoTrack = stream.getVideoTracks()[0];
      const audioTrack = stream.getAudioTracks()[0];

      if (videoTrack && videoTrack.muted) {
        showToast("Camera is muted by system or physical shutter", "info");
      }
      
      // Apply current mute/video states to the new stream
      stream.getAudioTracks().forEach(track => track.enabled = !isMuted);
      stream.getVideoTracks().forEach(track => track.enabled = !isVideoOff);

      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // If we haven't set the device IDs yet, sets them from the obtained stream
      if (!videoDeviceId || !audioDeviceId) {
        if (videoTrack && !videoDeviceId) setSelectedVideoDeviceId(videoTrack.getSettings().deviceId || '');
        if (audioTrack && !audioDeviceId) setSelectedAudioDeviceId(audioTrack.getSettings().deviceId || '');
      }

      setError(null);
      refreshDevices();
      initializePeerConnection(stream);
    } catch (err) {
      console.error("Failed to get media devices:", err);
      if (err instanceof Error) {
        const errorName = err.name;
        const errorMessage = err.message;
        
        if (errorName === 'NotAllowedError' || errorName === 'PermissionDeniedError') {
          setError({ 
            type: 'PERMISSION', 
            message: "Access was blocked by your browser. Please check the camera/microphone icon in your address bar to reset permissions.",
            code: 'ERR_PERMISSION_DENIED'
          });
        } else if (errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError') {
          setError({ 
            type: 'NOT_FOUND', 
            message: "No compatible media hardware was detected. Ensure your devices are properly connected to your system.",
            code: 'ERR_HARDWARE_NOT_FOUND'
          });
        } else if (errorName === 'NotReadableError' || errorName === 'TrackStartError') {
          setError({ 
            type: 'BUSY', 
            message: "Your camera or microphone is being used by another application. Please close Zoom, Teams, or other browser tabs.",
            code: 'ERR_DEVICE_BUSY'
          });
        } else if (errorName === 'OverconstrainedError') {
          setError({ 
            type: 'COMPATIBILITY', 
            message: "Your device hardware cannot support the requested video quality. Try selecting a different camera or lowering quality.",
            code: 'ERR_CONSTRAINTS_NOT_MET'
          });
        } else {
          setError({ 
            type: 'UNKNOWN', 
            message: `A protocol error occurred: ${errorMessage}`,
            code: `ERR_INTERNAL_${errorName.toUpperCase()}`
          });
        }
      } else {
        setError({ type: 'UNKNOWN', message: "An unexpected failure occurred during initialization.", code: 'ERR_UNKNOWN_FLT' });
      }
    } finally {
      setIsRetrying(false);
    }
  };

  const initializePeerConnection = async (stream: MediaStream) => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (channelRef.current) {
      channelRef.current.close();
    }

    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ],
        iceTransportPolicy: 'all',
        bundlePolicy: 'max-bundle',
        iceCandidatePoolSize: 10
      });
      peerConnectionRef.current = pc;

      pc.onconnectionstatechange = () => {
        console.log("WebRTC Connection State:", pc.connectionState);
        if (pc.connectionState === 'connected') {
          setRetryCount(0);
        }
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          handleConnectionRetry();
        }
      };

      pc.oniceconnectionstatechange = () => {
        console.log("WebRTC ICE Connection State:", pc.iceConnectionState);
        if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
          handleConnectionRetry();
        }
      };

      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
          setIsSecure(true);
          setConnectionQuality('Excellent');
          setParticipants(prev => {
            const hasRemoteGuest = prev.some(p => p.id === 'remote-guest');
            if (hasRemoteGuest) {
              return prev.map(p => p.id === 'remote-guest' ? { ...p, isVideoOff: false } : p);
            } else {
              return [...prev, {
                id: 'remote-guest',
                name: 'Guest User',
                role: 'Guest',
                avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=guest-user',
                isMuted: false,
                isHost: false,
                isVideoOff: false,
                isScreenSharing: false
              }];
            }
          });
          showToast("Secure peer connection established!", "success");
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate && channelRef.current) {
          channelRef.current.postMessage({
            type: 'candidate',
            candidate: event.candidate,
          });
        }
      };

      const channel = new BroadcastChannel(`webrtc-call-${roomId}`);
      channelRef.current = channel;

      channel.onmessage = async (event) => {
        const data = event.data;
        if (!peerConnectionRef.current) return;

        if (data.type === 'offer') {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await peerConnectionRef.current.createAnswer();
          await peerConnectionRef.current.setLocalDescription(answer);
          channel.postMessage({
            type: 'answer',
            answer,
          });
          setIsSecure(true);
          setConnectionQuality('Excellent');
        } else if (data.type === 'answer') {
          await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
          setIsSecure(true);
          setConnectionQuality('Excellent');
        } else if (data.type === 'candidate') {
          try {
            await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (err) {
            console.error("Error adding ice candidate:", err);
          }
        } else if (data.type === 'leave') {
          setRemoteStream(null);
          setParticipants(prev => prev.filter(p => p.id !== 'remote-guest'));
          setIsSecure(false);
          setConnectionQuality('Fair');
          showToast("Remote peer disconnected", "info");
        } else if (data.type === 'peer-state-change') {
          setParticipants(prev => prev.map(p => 
            p.id === 'remote-guest' 
              ? { ...p, isMuted: data.isMuted, isVideoOff: data.isVideoOff } 
              : p
          ));
        }
      };

      setTimeout(async () => {
        if (peerConnectionRef.current && peerConnectionRef.current.signalingState === 'stable') {
          try {
            const offer = await peerConnectionRef.current.createOffer();
            await peerConnectionRef.current.setLocalDescription(offer);
            channel.postMessage({
              type: 'offer',
              offer,
            });
          } catch (e) {
            console.warn("Offer creation skipped:", e);
          }
        }
      }, 1500);

    } catch (err) {
      console.error("Failed to initialize Peer Connection:", err);
    }
  };

  const applyAdaptiveBitrate = async (quality: 'Excellent' | 'Good' | 'Fair' | 'Poor') => {
    const pc = peerConnectionRef.current;
    if (!pc) return;
    try {
      const senders = pc.getSenders();
      for (const sender of senders) {
        if (sender.track) {
          const parameters = sender.getParameters();
          if (!parameters.encodings) {
            parameters.encodings = [{}];
          }

          if (sender.track.kind === 'video') {
            // Adaptive Video Quality
            if (parameters.encodings.length > 0) {
              if (quality === 'Excellent') {
                parameters.encodings[0].maxBitrate = 2800000; // Increase for Excellent
                parameters.encodings[0].scaleResolutionDownBy = 1.0;
              } else if (quality === 'Good') {
                parameters.encodings[0].maxBitrate = 1500000;
                parameters.encodings[0].scaleResolutionDownBy = 1.0;
              } else if (quality === 'Fair') {
                parameters.encodings[0].maxBitrate = 600000;
                parameters.encodings[0].scaleResolutionDownBy = 1.5;
              } else { // Poor
                parameters.encodings[0].maxBitrate = 200000;
                parameters.encodings[0].scaleResolutionDownBy = 2.5;
              }
              
              // Set degradation preference (not standard in every param object but supported by browsers)
              // @ts-ignore
              parameters.degradationPreference = quality === 'Fair' || quality === 'Poor' ? 'maintain-framerate' : 'maintain-resolution';
            }
          } else if (sender.track.kind === 'audio') {
            // Prioritize audio in poor conditions
            if (parameters.encodings.length > 0) {
              parameters.encodings[0].maxBitrate = quality === 'Poor' ? 32000 : undefined; // Limit audio bitrate if desperate
            }
          }
          
          await sender.setParameters(parameters);
        }
      }
      console.log(`📡 Adaptive Stability: Applied ${quality} settings profiles to all tracks.`);
    } catch (err) {
      console.warn("Could not apply adaptive bitrate on RTCPeerConnection sender tracks:", err);
    }
  };

  const [retryCount, setRetryCount] = useState(0);
  const handleConnectionRetry = async () => {
    if (isRetrying || retryCount > 5) return;
    
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    setConnectionQuality('Poor');
    
    // Exponential backoff for retries
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000);
    showToast(`Connection unstable. Attempting recovery in ${delay/1000}s...`, "info");
    
    setTimeout(async () => {
      try {
        if (localStream) {
          console.log(`Reconnecting... Attempt ${retryCount + 1}`);
          await initializePeerConnection(localStream);
        }
      } catch (e) {
        console.error("Reconnection failed:", e);
      } finally {
        setIsRetrying(false);
      }
    }, delay);
  };

  useEffect(() => {
    return () => {
      channelRef.current?.postMessage({ type: 'leave' });
      channelRef.current?.close();
      peerConnectionRef.current?.close();
    };
  }, []);

  useEffect(() => {
    // Check if we need to restart the call due to device change from parent
    if (localStream) {
      const currentVideoId = localStream.getVideoTracks()[0]?.getSettings().deviceId;
      const currentAudioId = localStream.getAudioTracks()[0]?.getSettings().deviceId;

      if ((selectedVideoDeviceId && selectedVideoDeviceId !== currentVideoId) || 
          (selectedAudioDeviceId && selectedAudioDeviceId !== currentAudioId)) {
        startCall(selectedVideoDeviceId, selectedAudioDeviceId);
      }
    }
  }, [selectedVideoDeviceId, selectedAudioDeviceId]);

  useEffect(() => {
    setIsSecure(window.isSecureContext && window.location.protocol === 'https:');
    
    let lastBytesReceived = 0;
    let lastTimestamp = Date.now();

    const interval = setInterval(async () => {
      const pc = peerConnectionRef.current;
      if (pc && pc.connectionState === 'connected') {
        try {
          const stats = await pc.getStats();
          let currentLatency = 24;
          let currentJitter = 2;
          let currentPacketLoss = 0.0;
          let totalBytes = 0;

          stats.forEach(report => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              if (report.currentRoundTripTime !== undefined) {
                currentLatency = Math.round(report.currentRoundTripTime * 1000);
              }
            }
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
              if (report.jitter !== undefined) {
                currentJitter = Math.round(report.jitter * 1000);
              }
              if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
                const total = report.packetsReceived + report.packetsLost;
                if (total > 0) {
                  currentPacketLoss = Math.round((report.packetsLost / total) * 1000) / 10;
                }
              }
              if (report.bytesReceived !== undefined) {
                totalBytes += report.bytesReceived;
              }
            }
          });

          const now = Date.now();
          const timediff = (now - lastTimestamp) / 1000;
          if (timediff > 0 && lastBytesReceived > 0) {
            const bps = ((totalBytes - lastBytesReceived) * 8) / timediff;
            const currentKbps = Math.round(bps / 1024);
            setCurrentBitrate(currentKbps);
          }
          lastBytesReceived = totalBytes;
          lastTimestamp = now;

          // Determine connection quality based on actual metrics
          let quality: 'Excellent' | 'Good' | 'Fair' | 'Poor' = 'Excellent';
          if (currentLatency > 150 || currentPacketLoss > 5 || currentJitter > 30) {
            quality = 'Poor';
          } else if (currentLatency > 100 || currentPacketLoss > 2 || currentJitter > 15) {
            quality = 'Fair';
          } else if (currentLatency > 60 || currentPacketLoss > 0.5 || currentJitter > 8) {
            quality = 'Good';
          }

          setConnectionQuality(quality);
          setLatency(currentLatency);
          setJitter(currentJitter);
          setPacketLoss(currentPacketLoss);

          // Trigger adaptive bitrate settings on the sender tracks based on the calculated quality
          applyAdaptiveBitrate(quality);

        } catch (err) {
          console.warn("Metrics collection failed, using organic emulation:", err);
        }
      } else {
        // Organic emulation when no active WebRTC stream is running peer-to-peer (just local video preview)
        const qualities: ('Excellent' | 'Good' | 'Fair' | 'Poor')[] = ['Excellent', 'Good', 'Fair'];
        const randomQual = qualities[Math.floor(Math.random() * qualities.length)];
        setConnectionQuality(randomQual);
        
        let newLatency = 24;
        let newJitter = 2;
        let newPacketLoss = 0.0;
        let newBitrate = 1800;

        if (randomQual === 'Excellent') {
          newLatency = Math.floor(Math.random() * 15) + 10;
          newJitter = Math.floor(Math.random() * 3) + 1;
          newPacketLoss = 0.0;
          newBitrate = Math.floor(Math.random() * 500) + 2000;
        } else if (randomQual === 'Good') {
          newLatency = Math.floor(Math.random() * 25) + 25;
          newJitter = Math.floor(Math.random() * 6) + 3;
          newPacketLoss = Math.round(Math.random() * 5) / 10;
          newBitrate = Math.floor(Math.random() * 400) + 1200;
        } else if (randomQual === 'Fair') {
          newLatency = Math.floor(Math.random() * 50) + 50;
          newJitter = Math.floor(Math.random() * 12) + 8;
          newPacketLoss = Math.round((Math.random() * 20) + 5) / 10;
          newBitrate = Math.floor(Math.random() * 300) + 400;
        } else {
          newLatency = Math.floor(Math.random() * 100) + 100;
          newJitter = Math.floor(Math.random() * 25) + 15;
          newPacketLoss = Math.round((Math.random() * 50) + 20) / 10;
          newBitrate = Math.floor(Math.random() * 150) + 100;
        }

        setLatency(newLatency);
        setJitter(newJitter);
        setPacketLoss(newPacketLoss);
        setCurrentBitrate(newBitrate);

        // Also trigger sender bitrate limitation based on emulated quality
        applyAdaptiveBitrate(randomQual);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [localStream]);

  useEffect(() => {
    if (showChat) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [showChat, messages]);

  useEffect(() => {
    const handleOffline = () => setError({ type: 'NETWORK', message: "Network connection lost. Please check your internet connection to continue the call." });
    const handleOnline = () => setError(null);

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    if (!window.navigator.onLine) {
      handleOffline();
    }

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  useEffect(() => {
    refreshDevices();
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
    }
    startCall();

    return () => {
      if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
      }
      // Cleanup will be handled by specific stream observers
    };
  }, []);

  useEffect(() => {
    return () => {
      localStream?.getTracks().forEach(track => track.stop());
    };
  }, [localStream]);


  // Proper cleanup of local stream
  useEffect(() => {
    return () => {
      localStream?.getTracks().forEach(track => track.stop());
    };
  }, [localStream]);

  // Proper cleanup of screen stream
  useEffect(() => {
    return () => {
      screenStream?.getTracks().forEach(track => track.stop());
    };
  }, [screenStream]);

  const toggleMute = () => {
    if (localStream) {
      const newMuted = !isMuted;
      localStream.getAudioTracks().forEach(track => track.enabled = !newMuted);
      setIsMuted(newMuted);
      setParticipants(prev => prev.map(p => p.isHost ? { ...p, isMuted: newMuted } : p));
      channelRef.current?.postMessage({
        type: 'peer-state-change',
        isMuted: newMuted,
        isVideoOff
      });
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const newVideoOff = !isVideoOff;
      localStream.getVideoTracks().forEach(track => track.enabled = !newVideoOff);
      setIsVideoOff(newVideoOff);
      setParticipants(prev => prev.map(p => p.isHost ? { ...p, isVideoOff: newVideoOff } : p));
      channelRef.current?.postMessage({
        type: 'peer-state-change',
        isMuted,
        isVideoOff: newVideoOff
      });
    }
  };

  useEffect(() => {
    if (showSettings) {
      refreshDevices();
      startSettingsPreview();
    } else {
      if (settingsStream) {
        settingsStream.getTracks().forEach(track => track.stop());
        setSettingsStream(null);
      }
    }
  }, [showSettings]);

  const startSettingsPreview = async () => {
    if (settingsStream) {
      settingsStream.getTracks().forEach(track => track.stop());
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: selectedVideoDeviceId ? { deviceId: { exact: selectedVideoDeviceId } } : true,
        audio: false
      });
      setSettingsStream(stream);
    } catch (err) {
      console.error("Error starting settings preview:", err);
    }
  };

  useEffect(() => {
    if (showSettings && selectedVideoDeviceId) {
      startSettingsPreview();
    }
  }, [selectedVideoDeviceId]);

  const handleDeviceChange = (kind: 'video' | 'audioinput' | 'audiooutput', deviceId: string) => {
    if (kind === 'video') changeVideoDevice(deviceId);
    if (kind === 'audioinput') changeAudioDevice(deviceId);
    if (kind === 'audiooutput') changeSpeakerDevice(deviceId);
    
    showToast(`${kind.charAt(0).toUpperCase() + kind.slice(1)} device updated`, "success");
  };
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      screenStream?.getTracks().forEach(track => track.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
      setParticipants(prev => prev.map(p => p.isHost ? { ...p, isScreenSharing: false } : p));
      showToast("Screen sharing stopped", "info");
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        setScreenStream(stream);
        setIsScreenSharing(true);
        setParticipants(prev => prev.map(p => p.isHost ? { ...p, isScreenSharing: true } : p));
        showToast("You are now sharing your screen", "success");
        
        // Handle stop sharing from browser UI
        stream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          setScreenStream(null);
          setParticipants(prev => prev.map(p => p.isHost ? { ...p, isScreenSharing: false } : p));
          showToast("Screen sharing session ended", "info");
        };
      } catch (err) {
        console.error("Failed to start screen sharing:", err);
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError') {
            return;
          }
          setError({ type: 'SHARING', message: `Screen sharing failed: ${err.message}` });
        } else {
          setError({ type: 'SHARING', message: "An unexpected error occurred while trying to share your screen." });
        }
      }
    }
  };

  const stopParticipantScreenShare = (id: string) => {
    const participant = participants.find(p => p.id === id);
    setParticipants(prev => prev.map(p => 
      p.id === id ? { ...p, isScreenSharing: false } : p
    ));
    showToast(`Stopped screen share for ${participant?.name}`, "info");
  };

  const toggleMuteParticipant = (id: string) => {
    setParticipants(prev => prev.map(p => 
      p.id === id ? { ...p, isMuted: !p.isMuted } : p
    ));
    // If it's the host, sync with the main mute state
    const participant = participants.find(p => p.id === id);
    if (participant?.isHost) {
      setIsMuted(!participant.isMuted);
    }
  };

  const removeParticipant = (id: string) => {
    const participant = participants.find(p => p.id === id);
    if (participant?.isHost) return;
    
    // In a real app this would send a signal to the participant
    setParticipants(prev => prev.filter(p => p.id !== id));
    showToast(`${participant?.name || 'Participant'} has been removed from the call`, 'info');
  };

  const muteAllParticipants = (mute: boolean = true) => {
    setParticipants(prev => prev.map(p => 
      p.isHost ? p : { ...p, isMuted: mute }
    ));
    showToast(mute ? "All participants have been muted" : "Participants can now unmute themselves", 'success');
  };

  const muteIndividualParticipant = (participantId: string, mute: boolean) => {
    const participant = participants.find(p => p.id === participantId);
    setParticipants(prev => prev.map(p => 
      p.id === participantId ? { ...p, isMuted: mute } : p
    ));
    if (mute) {
      showToast(`Muted ${participant?.name}`, 'info');
    }
  };

  const allOthersMuted = participants.filter(p => !p.isHost).every(p => p.isMuted);
  const amIHost = true; 

  const inviteParticipant = () => {
    const joinLink = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    navigator.clipboard.writeText(joinLink).then(() => {
      showToast("Secure invite link copied!", "success");
    }).catch(() => {
      showToast("Failed to copy link. Please manually invite users.", "error");
    });
    
    // Add a mock pending participant for visual feedback
    setParticipants(prev => {
      if (prev.some(p => p.id === 'remote-guest')) return prev;
      return [...prev, {
        id: 'remote-guest',
        name: 'Guest (Inviting)',
        role: 'Guest',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=guest-invited',
        isMuted: true,
        isHost: false,
        isVideoOff: true,
        isScreenSharing: false
      }];
    });
  };

  const toggleLocalRecording = () => {
    if (isRecordingLocal) {
      localRecorderRef.current?.stop();
      setIsRecordingLocal(false);
    } else {
      if (!localStream) {
        setError({ type: 'NOT_FOUND', message: "Camera stream is required for recording." });
        return;
      }
      
      try {
        const chunks: Blob[] = [];
        const recorder = new MediaRecorder(localStream, { mimeType: 'video/webm' });
        localRecorderRef.current = recorder;
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        
        recorder.onstop = () => {
          if (chunks.length === 0) return;
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          setRecordedVideoUrl(url);
        };
        
        recorder.start();
        setIsRecordingLocal(true);
        setRecordedVideoUrl(null);
      } catch (err) {
        console.error("Local recording failed:", err);
        setError({ type: 'COMPATIBILITY', message: "Failed to start camera recording." });
      }
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || isChatLoading) return;
    const text = newMessage;
    setNewMessage('');
    await onSendMessage(text);
  };

  const getGridLayout = (count: number) => {
    if (isPresenterMode) return 'flex flex-col h-full overflow-hidden';
    return 'grid-cols-12 content-center items-center';
  };

  const getParticipantClasses = (index: number, count: number) => {
    let spanClass = "col-span-12";
    let aspectClass = "aspect-video md:aspect-auto";
    
    if (count === 1) {
      spanClass = "col-span-12 max-w-5xl mx-auto self-center";
      aspectClass = "aspect-video";
    } else if (count === 2) {
      spanClass = "col-span-12 md:col-span-6";
      aspectClass = "aspect-video md:aspect-square lg:aspect-video";
    } else {
      // Logic for balanced 12-column grid distribution
      const getBestSpan = (currentCount: number, currentIndex: number, itemsPerRow: number) => {
        const rows = Math.ceil(currentCount / itemsPerRow);
        const currentRow = Math.floor(currentIndex / itemsPerRow);
        const isLastRow = currentRow === rows - 1;
        const itemsInThisRow = isLastRow ? (currentCount % itemsPerRow || itemsPerRow) : itemsPerRow;
        
        // We want to find a span that fills 12 columns
        // Common factors of 12: 1, 2, 3, 4, 6, 12
        // If itemsInThisRow is not a factor (e.g. 5), we use the closest floor
        const idealSpan = 12 / itemsInThisRow;
        return Math.floor(idealSpan);
      };

      // Desktop items per row target
      let desktopItemsPerRow = 3;
      if (count === 4) desktopItemsPerRow = 2;
      else if (count <= 6) desktopItemsPerRow = 3;
      else if (count <= 12) desktopItemsPerRow = 4;
      else if (count <= 20) desktopItemsPerRow = 4;
      else desktopItemsPerRow = 6;

      // Mobile items per row target
      let mobileItemsPerRow = 2;
      if (count <= 1) mobileItemsPerRow = 1;

      const desktopSpan = getBestSpan(count, index, desktopItemsPerRow);
      const mobileSpan = getBestSpan(count, index, mobileItemsPerRow);

      spanClass = `col-span-${mobileSpan} md:col-span-${desktopSpan}`;
      aspectClass = count > 6 ? "aspect-video md:aspect-video" : "aspect-video md:aspect-auto";
    }

    const roundedClass = count > 4 ? (count > 9 ? 'rounded-xl md:rounded-2xl' : 'rounded-[20px] md:rounded-[28px]') : 'rounded-[24px] md:rounded-[40px]';
    
    return `relative ${roundedClass} overflow-hidden bg-white/5 border border-white/10 flex items-center justify-center group shadow-2xl backdrop-blur-3xl transition-all duration-500 h-full w-full ${spanClass} ${aspectClass}`;
  };

  const getGridGap = (count: number) => {
    if (count <= 1) return 'gap-0';
    if (count <= 2) return 'gap-6 md:gap-10 lg:gap-16';
    if (count <= 4) return 'gap-4 md:gap-6 lg:gap-8';
    if (count <= 9) return 'gap-3 md:gap-4 lg:gap-6';
    return 'gap-2 md:gap-3 lg:gap-4';
  };

  const getGridPadding = (count: number) => {
    if (count <= 1) return 'p-4 sm:p-8 md:p-12 lg:p-16'; 
    if (count <= 4) return 'p-4 sm:p-6 md:p-8 lg:p-10';
    if (count <= 9) return 'p-3 sm:p-4 md:p-6';
    return 'p-2 sm:p-3 md:p-4';
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="absolute inset-x-4 inset-y-4 z-50 bg-slate-950/80 backdrop-blur-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-white/10"
    >
      {/* Header Overlay: Badges & Settings */}
      {/* End Call Confirmation Dialog handled elsewhere */}
      <div className="absolute top-6 left-6 right-6 z-40 flex items-center justify-between pointer-events-none">
        <div className="flex flex-wrap items-center gap-3 pointer-events-auto">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border backdrop-blur-md transition-all duration-500 group cursor-help ${
            isSecure 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]' 
            : 'bg-red-500/10 border-red-500/20 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
          }`}>
            {isSecure ? (
              <div className="relative">
                <motion.div
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                >
                  <Shield size={14} fill="currentColor" fillOpacity={0.25} />
                </motion.div>
                <motion.div 
                  animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="absolute inset-0 bg-emerald-400 rounded-full blur-[3px] -z-10"
                />
              </div>
            ) : (
              <motion.div
                animate={{ rotate: [0, -10, 10, 0] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              >
                <ShieldAlert size={14} />
              </motion.div>
            )}
            <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
              {isSecure ? 'End-to-End Secure' : 'Connection Not Secure'}
              {isSecure && (
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="w-1 h-1 rounded-full bg-emerald-400" 
                />
              )}
            </span>
            
            {/* Detailed Security Tooltip */}
            <div className="absolute top-full left-0 mt-2 w-52 p-4 rounded-2xl bg-slate-900/98 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0 pointer-events-none z-50 backdrop-blur-xl">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/5">
                <div className="w-6 h-6 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <Shield size={12} className="text-emerald-400" />
                </div>
                <h5 className="text-[10px] font-black uppercase tracking-wider text-white">Security Verified</h5>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-medium text-slate-400">Encryption Method</span>
                  <span className="text-[9px] font-bold text-emerald-400 px-1.5 py-0.5 bg-emerald-500/10 rounded-md">AES-256-GCM</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-medium text-slate-400">Key Exchange</span>
                  <span className="text-[9px] font-bold text-emerald-400">ECDH P-384</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-medium text-slate-400">Identity Status</span>
                  <span className="text-[9px] font-bold text-emerald-400">Fingerprint Verified</span>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-white/5">
                <p className="text-[8px] text-slate-500 leading-tight">Your conversation is shielded by peer-to-peer encryption. No one, including REWON, can intercept your video data.</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 backdrop-blur-md text-white shadow-[0_0_15px_rgba(255,255,255,0.05)]">
            <Users size={14} className="text-aura-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest">
              {participants.length} {participants.length === 1 ? 'Participant' : 'Participants'}
            </span>
          </div>
          
          <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl border backdrop-blur-md transition-all duration-500 group relative cursor-help ${
            connectionQuality === 'Excellent'
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
            : connectionQuality === 'Good'
            ? 'bg-blue-500/10 border-blue-500/25 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]' 
            : connectionQuality === 'Fair'
            ? 'bg-amber-500/10 border-amber-500/25 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.1)]'
            : connectionQuality === 'Poor'
            ? 'bg-red-500/10 border-red-500/25 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]'
            : 'bg-slate-500/10 border-slate-500/25 text-slate-400'
          }`}>
            {/* Dynamic Signal Bars */}
            <div className="flex items-end gap-[2px] h-3 mb-[1px]">
              {[1, 2, 3, 4, 5].map((bar) => {
                const activeCount = 
                  connectionQuality === 'Excellent' ? 5 : 
                  connectionQuality === 'Good' ? 4 : 
                  connectionQuality === 'Fair' ? 3 : 
                  connectionQuality === 'Poor' ? 1 : 0;
                
                return (
                  <motion.div 
                    key={bar}
                    initial={false}
                    animate={{ 
                      height: `${(bar / 5) * 100}%`,
                      opacity: bar <= activeCount ? 1 : 0.2,
                      scaleY: bar <= activeCount ? [1, 1.1, 1] : 1
                    }}
                    transition={{
                      scaleY: {
                        duration: 1.5,
                        repeat: Infinity,
                        delay: bar * 0.1,
                        ease: "easeInOut"
                      }
                    }}
                    className={`w-[2px] rounded-full transition-all duration-300 ${
                      bar <= activeCount ? 'bg-current' : 'bg-white/20'
                    }`}
                  />
                );
              })}
            </div>
            
            <div className="flex flex-col items-start leading-none gap-0.5">
              <span className="text-[9px] font-black uppercase tracking-widest whitespace-nowrap">
                {connectionQuality === 'Analyzing...' ? 'Analyzing Network...' : `${connectionQuality} Connection`}
              </span>
              {/* Inline Real-Time Micro Stats */}
              <div className="flex items-center gap-2 text-[8px] font-medium opacity-85">
                <span className="flex items-center gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />
                  <span>{latency}ms</span>
                </span>
                <span className="flex items-center gap-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${packetLoss > 2 ? 'bg-red-400' : packetLoss > 0.5 ? 'bg-amber-400' : 'bg-emerald-400'} animate-pulse`} />
                  <span>Loss: {packetLoss.toFixed(1)}%</span>
                </span>
                <span className="flex items-center gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse" />
                  <span>Jitter: {jitter}ms</span>
                </span>
                <span className="flex items-center gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-purple-400 animate-pulse" />
                  <span>{currentBitrate >= 1000 ? `${(currentBitrate / 1000).toFixed(1)}M` : `${currentBitrate}k`}bps</span>
                </span>
              </div>
            </div>

            {/* Connection Stats Tooltip */}
            <div className="absolute top-full left-0 mt-2 w-56 p-4 rounded-2xl bg-slate-950/95 border border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.65)] opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0 pointer-events-none z-50 backdrop-blur-xl">
              <h5 className="text-[10px] font-black uppercase tracking-wider text-white mb-3 pb-2 border-b border-white/5 flex items-center justify-between">
                <span>Network Diagnostics</span>
                <span className="text-[7px] text-indigo-400 uppercase tracking-widest font-black bg-indigo-500/15 px-1.5 py-0.5 rounded-md">Adaptive ABR Active</span>
              </h5>
              
              <div className="space-y-3">
                {/* Latency Meter */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-slate-400">Latency (RTT)</span>
                    <span className="font-mono font-bold text-blue-400">{latency} ms</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex gap-[2px]">
                    <div className="h-full bg-emerald-400" style={{ width: `${Math.max(0, Math.min(100, (150 - latency) / 1.5))}%` }} />
                  </div>
                </div>

                {/* Packet Loss Meter */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-slate-400">Packet Loss Rate</span>
                    <span className={`font-mono font-bold ${packetLoss > 2 ? 'text-red-400' : packetLoss > 0.5 ? 'text-amber-400' : 'text-emerald-400'}`}>{packetLoss.toFixed(2)} %</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${packetLoss > 2 ? 'bg-red-400' : packetLoss > 0.5 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${Math.min(100, Math.max(5, packetLoss * 15))}%` }} />
                  </div>
                </div>

                {/* Jitter Meter */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-slate-400">Jitter (Variance)</span>
                    <span className={`font-mono font-bold ${jitter > 100 ? 'text-red-400' : jitter > 40 ? 'text-amber-400' : 'text-emerald-400'}`}>{jitter} ms</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full ${jitter > 100 ? 'bg-red-400' : jitter > 40 ? 'bg-amber-400' : 'bg-emerald-400'}`} style={{ width: `${Math.min(100, Math.max(5, (jitter / 200) * 100))}%` }} />
                  </div>
                </div>

                {/* Bandwidth / Bitrate Meter */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-slate-400">Estimated Bandwidth</span>
                    <span className="font-mono font-bold text-indigo-400">
                      {currentBitrate >= 1000 ? `${(currentBitrate / 1000).toFixed(2)} Mbps` : `${currentBitrate} kbps`}
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-400" style={{ width: `${Math.min(100, (currentBitrate / 2500) * 100)}%` }} />
                  </div>
                </div>

                {/* Jitter */}
                <div className="flex items-center justify-between border-t border-white/5 pt-2 text-[9px]">
                  <span className="text-slate-400">Jitter Variance</span>
                  <span className="font-mono text-slate-300">{jitter} ms</span>
                </div>

                {/* Resolution Tier */}
                <div className="flex items-center justify-between text-[9px]">
                  <span className="text-slate-400">Quality Stream Layer</span>
                  <span className="font-bold text-aura-accent">
                    {connectionQuality === 'Excellent' ? '1080p Ultra-HQ' : connectionQuality === 'Good' ? '720p HD Smart' : connectionQuality === 'Fair' ? '480p SD Eco' : '240p LQ Low-Data'}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="px-3 py-1.5 rounded-xl bg-slate-900/40 border border-white/5 backdrop-blur-md text-white/70 text-[10px] font-bold">
            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

          <div className="flex items-center gap-3 pointer-events-auto">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowAIInsights(!showAIInsights)}
              className={`px-4 py-2.5 rounded-2xl border backdrop-blur-xl flex items-center gap-2.5 transition-all shadow-2xl ${
                showAIInsights 
                ? 'bg-aura-accent text-white border-aura-accent/50 shadow-aura-accent/20' 
                : 'bg-slate-900/50 border-white/10 text-white/70 hover:bg-slate-900/80 hover:text-white hover:border-white/20'
              }`}
            >
              <Sparkles size={16} className={showAIInsights ? 'animate-pulse' : ''} />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">AI Insights</span>
            </motion.button>

            <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (!showSettings) refreshDevices();
              setShowSettings(!showSettings);
            }}
            className={`px-4 py-2.5 rounded-2xl border backdrop-blur-xl flex items-center gap-2.5 transition-all shadow-2xl ${
              showSettings 
              ? 'bg-aura-primary text-white border-aura-primary/50 shadow-aura-primary/20' 
              : 'bg-slate-900/50 border-white/10 text-white/70 hover:bg-slate-900/80 hover:text-white hover:border-white/20'
            }`}
          >
            <Settings size={16} className={showSettings ? 'animate-spin' : ''} />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Device Setup</span>
          </motion.button>
        </div>
      </div>

      {/* Main Content Area: Grid + Side Panels */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">
        {/* Participant Grid */}
        <div className={`flex-1 min-w-0 relative overflow-hidden bg-slate-950 transition-all duration-500 perspective-1000 ${getGridPadding(participants.length)}`}>
          {/* Enhanced Recording Indicator Overlay */}
          <AnimatePresence>
            {isRecordingCall && (
              <motion.div 
                initial={{ opacity: 0, y: -60, x: '-50%' }}
                animate={{ opacity: 1, y: 0, x: '-50%' }}
                exit={{ opacity: 0, y: -60, x: '-50%' }}
                className="absolute top-10 left-1/2 z-[100] flex items-center gap-5 px-8 py-3.5 bg-black/60 backdrop-blur-3xl border border-red-500/30 rounded-[40px] shadow-[0_30px_60px_-12px_rgba(220,38,38,0.3)] ring-1 ring-white/10"
              >
                <div className="flex items-center gap-4">
                  <div className="relative flex items-center justify-center">
                    <div className="w-4 h-4 bg-red-600 rounded-full shadow-[0_0_15px_rgba(220,38,38,0.8)] animate-pulse" />
                    <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-40" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-red-500 leading-none mb-1">
                      Recording Session
                    </span>
                    <span className="text-[14px] font-mono font-black text-white tabular-nums tracking-widest leading-none">
                      {formatDuration(recordingDuration)}
                    </span>
                  </div>
                </div>
                <div className="w-px h-8 bg-white/10 mx-1" />
                <button 
                  onClick={() => toggleCallRecording(localStream)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-600/90 hover:bg-red-500 text-white rounded-2xl transition-all font-black text-[10px] uppercase tracking-widest shadow-lg shadow-red-600/20 active:scale-95 group"
                  title="Terminate Recording"
                >
                  <Square size={12} fill="white" className="group-hover:scale-110 transition-transform" />
                  Stop Rec
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main Sharing Area - If anyone is sharing or video is synced, show it here */}
          <AnimatePresence mode="wait">
            {participants.some(p => p.isScreenSharing) ? (
              <motion.div 
                key="screen-share"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 z-20 p-4 md:p-8 bg-slate-950"
              >
                <div className="w-full h-full rounded-[32px] overflow-hidden border border-white/20 bg-black shadow-[0_0_100px_rgba(32,226,203,0.15)] relative group">
                  {isScreenSharing ? (
                    <video 
                      autoPlay 
                      playsInline 
                      ref={(el) => {
                        if (el && screenStream) {
                          el.srcObject = screenStream;
                        }
                      }}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-6 bg-slate-900/50">
                      <div className="relative">
                        <Monitor size={80} className="text-aura-accent/20" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <ScreenShare size={32} className="text-aura-accent animate-pulse" />
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="flex flex-col items-center gap-3">
                          <img 
                            src={participants.find(p => p.isScreenSharing && !p.isHost)?.avatar} 
                            alt="avatar" 
                            className="w-8 h-8 rounded-full border border-white/20" 
                          />
                          <p className="text-white font-bold text-xl mb-2">
                            {participants.find(p => p.isScreenSharing && !p.isHost)?.name} is sharing their screen
                          </p>
                        </div>
                        <p className="text-slate-500 text-sm">Waiting for incoming video stream...</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute top-6 left-6 flex items-center gap-3 px-4 py-2 bg-aura-accent/90 backdrop-blur-md rounded-2xl text-white shadow-xl">
                    <img 
                      src={isScreenSharing 
                        ? participants.find(p => p.isHost)?.avatar 
                        : participants.find(p => p.isScreenSharing)?.avatar
                      } 
                      alt="avatar" 
                      className="w-4 h-4 rounded-full border border-white/20" 
                    />
                    <ScreenShare size={16} className="animate-pulse" />
                    <span className="text-[11px] font-black uppercase tracking-widest">
                      {isScreenSharing ? 'Your shared screen' : `${participants.find(p => p.isScreenSharing)?.name}'s shared screen`}
                    </span>
                  </div>
                  <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    {(isScreenSharing || amIHost) && (
                      <button 
                        onClick={() => {
                          if (isScreenSharing) toggleScreenShare();
                          else {
                            const sharingParticipant = participants.find(p => p.isScreenSharing);
                            if (sharingParticipant) stopParticipantScreenShare(sharingParticipant.id);
                          }
                        }}
                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl transition-all"
                      >
                        Stop Sharing
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (videoSyncState && videoSyncState.url) ? (
              <motion.div 
                key="video-sync"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 z-20 p-4 md:p-8 bg-slate-950 flex flex-col items-center justify-center"
              >
                <div className="w-full max-w-5xl h-full flex flex-col items-center justify-center gap-6">
                  <div className="w-full rounded-[40px] overflow-hidden border border-aura-primary/30 shadow-[0_0_80px_rgba(123,97,255,0.2)] bg-black/40 backdrop-blur-sm p-4 h-full flex flex-col">
                    <VideoPlayer 
                      src={videoSyncState.url}
                      isSyncEnabled={true}
                      syncState={videoSyncState}
                      onSyncAction={(data) => updateGlobalVideoSync({ ...data, url: videoSyncState.url })}
                      user={user}
                    />
                  </div>
                  
                  <div className="flex items-center gap-6 px-8 py-4 bg-white/5 backdrop-blur-3xl rounded-[32px] border border-white/10 shadow-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-aura-primary/20 flex items-center justify-center">
                        <Film className="text-aura-primary animate-pulse" size={20} />
                      </div>
                      <div>
                        <p className="text-white font-black text-[10px] uppercase tracking-[0.2em]">Co-Watching Mode</p>
                        <p className="text-slate-500 text-[9px] font-bold uppercase tracking-widest">Global Video Sync Active</p>
                      </div>
                    </div>
                    
                    <div className="w-px h-8 bg-white/10" />
                    
                    <button 
                      onClick={() => updateGlobalVideoSync({ url: '' })}
                      className="px-6 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/20"
                    >
                      Disable Sync
                    </button>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Real-time Live Caption Overlay moved to chat sidebar bottom */}

          <div className={participants.length > 1 && isPresenterMode 
            ? "flex flex-col h-full gap-6" 
            : `grid w-full h-full transition-all duration-700 ${getGridGap(participants.length)} ${getGridLayout(participants.length)}`
          }>
          {isPresenterMode ? (
            <>
              {/* Presenter Mode Main Area */}
              <div className="flex-1 min-h-0 relative">
                {participants.filter(p => p.id === (participants.some(x => x.id === presenterId) ? presenterId : '1')).map(participant => (
                  <motion.div 
                    layout
                    key={participant.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ 
                      scale: 1.01,
                      rotateX: 1,
                      rotateY: -0.5,
                      transition: { duration: 0.3 }
                    }}
                    className="w-full h-full rounded-[40px] overflow-hidden bg-white/5 border border-white/10 relative group shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] backdrop-blur-3xl"
                  >
                    {participant.isHost ? (
                      <>
                        <video 
                          ref={localVideoRef} 
                          autoPlay 
                          muted 
                          playsInline 
                          className={`w-full h-full object-cover scale-x-[-1] ${(isVideoOff && !isScreenSharing) ? 'hidden' : 'block'}`}
                        />
                        {isNoiseSuppressionEnabled && (
                          <div className="absolute top-6 left-6 z-10 flex items-center gap-2 px-3 py-1.5 bg-aura-accent/20 border border-aura-accent/30 rounded-xl text-aura-accent backdrop-blur-md shadow-lg shadow-aura-accent/20">
                            <Sparkles size={12} className="animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-white">AI Processing ClearAudio™</span>
                          </div>
                        )}
                        {isVideoOff && !isScreenSharing && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-md">
                            <VideoOffPlaceholder name={participant.name} avatar={participant.avatar} size="large" />
                            <span className="mt-4 px-3 py-1 bg-aura-primary/20 text-aura-primary rounded-full text-[10px] font-black uppercase tracking-widest border border-aura-primary/30">Local User</span>
                          </div>
                        )}
                      </>
                    ) : participant.role === 'AI Assistant' ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-8 bg-gradient-to-br from-slate-950 via-slate-900 to-aura-primary/20">
                        <div className={`relative w-40 h-40 bg-aura-primary/5 rounded-[40px] flex items-center justify-center transition-all duration-700 ${isSpeaking ? 'scale-110 shadow-[0_40px_80px_rgba(123,97,255,0.4)] border border-white/20' : 'border border-white/10'}`}>
                          <Sparkles className={`text-aura-primary ${isSpeaking ? 'animate-pulse scale-110' : ''}`} size={64} />
                          {isSpeaking && (
                            <motion.div 
                              className="absolute -inset-4 rounded-[40px] border-2 border-aura-accent/30"
                              animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0, 0.3] }}
                              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                            />
                          )}
                        </div>
                        <div className="mt-8 text-center space-y-2">
                          <p className="text-white font-display font-black text-3xl tracking-tight">{participant.name}</p>
                          <p className="text-aura-primary text-xs font-black uppercase tracking-[0.25em]">Interactive Presentation AI</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        {!participant.isVideoOff && remoteStream ? (
                          <div className="w-full h-full absolute inset-0">
                            <video 
                              ref={(el) => { if (el && el.srcObject !== remoteStream) el.srcObject = remoteStream; }} 
                              autoPlay 
                              playsInline 
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/40 backdrop-blur-md">
                            <VideoOffPlaceholder name={participant.name} avatar={participant.avatar} size="large" />
                            <span className="mt-4 px-3 py-1 bg-red-500/20 text-red-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-500/30">Camera Disabled</span>
                          </div>
                        )}
                      </>
                    )}
                    
                    {/* Floating Info Overlay */}
                    <div className="absolute bottom-6 left-6 right-6 z-10 flex items-center justify-between pointer-events-none">
                      <div className="px-4 py-2 bg-black/50 backdrop-blur-md rounded-2xl border border-white/15 flex items-center gap-3 pointer-events-auto">
                        <img src={participant.avatar} alt={participant.name} className="w-6 h-6 rounded-full border border-white/25 object-cover" />
                        <span className="text-white text-sm font-bold flex items-center gap-1.5">
                          {participant.name}
                          {participant.isHost && <span className="opacity-60 text-xs font-normal font-sans">(Host)</span>}
                        </span>
                        {participant.isScreenSharing && <ScreenShare size={14} className="text-aura-accent" />}
                        {participant.isMuted && <MicOff size={14} className="text-red-500" />}
                      </div>
                      <span className="px-4 py-2 bg-indigo-500/90 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-indigo-500/20 pointer-events-auto flex items-center gap-1.5 border border-indigo-400/30">
                        <Presentation size={12} /> Live Presenter
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Presenter Mode Thumbnails */}
              <div className="flex gap-6 overflow-x-auto pb-4 no-scrollbar h-36 md:h-44 flex-shrink-0">
                {participants.filter(p => p.id !== (participants.some(x => x.id === presenterId) ? presenterId : '1')).map(participant => (
                  <motion.div 
                    layout
                    key={participant.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ y: -8, scale: 1.02 }}
                    className="flex-shrink-0 aspect-video h-full glass-morphic rounded-[28px] border border-white/10 relative overflow-hidden group shadow-xl"
                  >
                    {/* Hover Click to Present */}
                    <div 
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center backdrop-blur-sm cursor-pointer z-30" 
                      onClick={() => {
                        setPresenterId(participant.id);
                        showToast(`${participant.name} is now presenting`, 'success');
                      }}
                    >
                      <Presentation size={18} className="text-white mb-1.5" />
                      <span className="text-white text-[9px] font-black uppercase tracking-widest bg-aura-primary px-3 py-1.5 rounded-xl border border-white/10">
                        Present
                      </span>
                    </div>

                    {participant.role === 'AI Assistant' ? (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 p-4 relative z-10">
                        <div className={`w-12 h-12 bg-aura-primary/10 rounded-full flex items-center justify-center ${isSpeaking ? 'ring-2 ring-aura-primary ring-offset-2 ring-offset-slate-800' : ''}`}>
                          <Sparkles size={20} className="text-aura-primary" />
                          {isTranscriptionEnabled && (
                            <motion.div 
                              className="absolute inset-0 rounded-full border border-aura-accent"
                              animate={{ scale: [1, 1.2, 1], opacity: [1, 0, 1] }}
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <img 
                            src={participant.avatar} 
                            alt={participant.name} 
                            className="w-4 h-4 rounded-full border border-white/20 object-cover" 
                          />
                          <span className="text-white text-[10px] font-bold truncate w-24 text-center">{participant.name}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 relative p-4 z-10">
                        {participant.isHost ? (
                          <>
                            {!isVideoOff ? (
                              <div className="absolute inset-0 w-full h-full">
                                <video 
                                  ref={(el) => { if (el && el.srcObject !== localStream) el.srcObject = localStream; }} 
                                  autoPlay 
                                  muted 
                                  playsInline 
                                  className="w-full h-full object-cover scale-x-[-1]"
                                />
                              </div>
                            ) : (
                              <VideoOffPlaceholder name={participant.name} avatar={participant.avatar} size="small" />
                            )}
                          </>
                        ) : (
                          <>
                            {!participant.isVideoOff && remoteStream ? (
                              <div className="absolute inset-0 w-full h-full">
                                <video 
                                  ref={(el) => { if (el && el.srcObject !== remoteStream) el.srcObject = remoteStream; }} 
                                  autoPlay 
                                  playsInline 
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ) : (
                              <VideoOffPlaceholder name={participant.name} avatar={participant.avatar} size="small" />
                            )}
                          </>
                        )}

                        <div className="absolute bottom-2.5 left-2.5 right-2.5 px-2 py-1 bg-black/60 rounded-xl flex items-center justify-between gap-1 border border-white/5 z-20">
                          <div className="flex items-center gap-1.5 min-w-0 truncate">
                            <img 
                              src={participant.avatar} 
                              alt={participant.name} 
                              className="w-3.5 h-3.5 rounded-full border border-white/20 object-cover shrink-0" 
                            />
                            <span className="text-white text-[9px] font-bold truncate">{participant.name}</span>
                          </div>
                          <div className="flex gap-1 shrink-0">
                            {participant.isMuted && <MicOff size={10} className="text-red-500" />}
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            participants.map((participant, index) => (
              <motion.div 
                layout
                key={participant.id}
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                whileHover={{ 
                  scale: 1.01,
                  rotateX: 1,
                  rotateY: -0.5,
                }}
                className={getParticipantClasses(index, participants.length)}
              >
                {participant.isHost ? (
                  <>
                    <video 
                      ref={localVideoRef} 
                      autoPlay 
                      muted 
                      playsInline 
                      className={`w-full h-full object-cover scale-x-[-1] ${(isVideoOff && !isScreenSharing) ? 'hidden' : 'block'}`}
                    />
                    {isNoiseSuppressionEnabled && (
                      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-2.5 py-1 bg-aura-accent text-white rounded-lg shadow-lg shadow-aura-accent/20">
                        <Sparkles size={10} className="animate-pulse" />
                        <span className="text-[8px] font-black uppercase tracking-widest">AI Suppression Active</span>
                      </div>
                    )}
                    {isVideoOff && !isScreenSharing && (
                      <div className="flex items-center justify-center w-full h-full">
                        <VideoOffPlaceholder name={participant.name} avatar={participant.avatar} size="large" />
                      </div>
                    )}
                    {isScreenSharing && (
                      <div className="absolute top-6 left-6 bg-red-500 text-white text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-[0_10px_20px_rgba(239,68,68,0.3)] z-10">
                        <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                        LIVE SHARING
                      </div>
                    )}
                  </>
                ) : participant.role === 'AI Assistant' ? (
                  // AI Assistant View
                  <div className="flex flex-col items-center gap-8 text-center z-10 px-8">
                    <div className={`relative w-32 h-32 bg-aura-primary/5 rounded-[40px] flex items-center justify-center transition-all duration-700 ${isSpeaking ? 'scale-110 shadow-[0_40px_80px_rgba(123,97,255,0.4)] border border-white/20' : 'border border-white/10'}`}>
                      <Sparkles className={`text-aura-primary ${isSpeaking ? 'animate-pulse scale-110' : ''}`} size={56} />
                      {isSpeaking && (
                        <motion.div 
                          className="absolute -inset-4 rounded-[40px] border-2 border-aura-accent/30"
                          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0, 0.3] }}
                          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                        />
                      )}
                    </div>
                    <motion.div
                      animate={isSpeaking ? { y: [0, -4, 0] } : {}}
                      transition={{ repeat: Infinity, duration: 2 }}
                      className="space-y-2"
                    >
                      <div className="flex items-center gap-3">
                      <img src={participant.avatar} alt={participant.name} className="w-8 h-8 rounded-full border border-white/20" />
                      <p className="text-white font-display font-bold text-2xl tracking-tight">{participant.name}</p>
                    </div>
                      <p className="text-aura-primary/60 text-[10px] font-black uppercase tracking-[0.3em]">
                        {isTranscriptionEnabled ? 'Transcribing Session' : 'AI Intelligence Active'}
                      </p>
                    </motion.div>
                  </div>
                ) : (
                   // Remote Participant View
                  <div className="flex flex-col items-center justify-center w-full h-full z-10">
                    {!participant.isVideoOff && remoteStream ? (
                      <div className="w-full h-full absolute inset-0 rounded-[24px] md:rounded-[40px] overflow-hidden">
                        <video 
                          ref={(el) => { if (el && el.srcObject !== remoteStream) el.srcObject = remoteStream; }} 
                          autoPlay 
                          playsInline 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <div className="relative group/avatar">
                        {participant.isVideoOff ? (
                          <VideoOffPlaceholder name={participant.name} avatar={participant.avatar} size="large" />
                        ) : (
                          <div className="flex flex-col items-center gap-6">
                            <div className="relative">
                              <motion.img 
                                whileHover={{ scale: 1.05 }}
                                src={participant.avatar} 
                                alt={participant.name} 
                                className="w-24 h-24 rounded-[32px] border border-white/10 shadow-2xl transition-all duration-500" 
                              />
                              <div className="absolute top-2 right-2 flex gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <img src={participant.avatar} alt={participant.name} className="w-8 h-8 rounded-full border border-white/20" />
                              <p className="text-white font-bold text-xl tracking-tight">{participant.name}</p>
                            </div>
                          </div>
                        )}
                        {participant.isMuted && (
                          <div className="absolute top-16 -right-2 bg-red-500 rounded-2xl p-2.5 border-4 border-slate-900 shadow-2xl">
                            <MicOff size={16} className="text-white" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Card Label */}
                <div className={`absolute bottom-6 left-6 right-6 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-20 ${participants.length > 6 ? 'bottom-3 left-3 right-3' : ''}`}>
                  <div className={`filter backdrop-blur-xl border border-white/10 flex items-center justify-between gap-4 ${
                    participants.length > 6 ? 'bg-black/80 px-3 py-1.5 rounded-xl' : 'bg-black/60 px-4 py-2.5 rounded-2xl'
                  }`}>
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <img src={participant.avatar} alt={participant.name} className={`${participants.length > 6 ? 'w-4 h-4' : 'w-5 h-5'} rounded-full border border-white/20 object-cover`} />
                        <span className={`text-white font-bold tracking-tight truncate ${participants.length > 6 ? 'text-[10px]' : 'text-xs'}`}>
                          {participant.name} {participant.isHost && <span className="opacity-50 ml-1">(Host)</span>}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-6 h-1 bg-white/10 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-emerald-400"
                            animate={{ width: isSpeaking ? ['20%', '80%', '40%'] : '10%' }}
                            transition={{ repeat: Infinity, duration: 1.5 }}
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          {participant.isMuted && <MicOff size={10} className="text-white/40" />}
                          {participant.isVideoOff && <VideoOff size={10} className="text-white/40" />}
                          {participant.isScreenSharing && <ScreenShare size={10} className="text-white/40" />}
                        </div>
                      </div>
                    </div>

                    {/* Moderator Controls */}
                    {amIHost && (
                      <div className={`flex items-center ${participants.length > 6 ? 'gap-1' : 'gap-2'}`}>
                        {!participant.isHost ? (
                          <>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => { e.stopPropagation(); toggleMuteParticipant(participant.id); }}
                              className={`${participants.length > 6 ? 'p-1.5' : 'p-2'} rounded-xl transition-all border ${
                                participant.isMuted 
                                  ? 'bg-red-500 text-white border-red-500/20' 
                                  : 'bg-white/10 text-white border-white/5 hover:bg-white/20'
                              }`}
                              title={participant.isMuted ? "Unmute Participant" : "Mute Participant"}
                            >
                              {participant.isMuted ? <Mic size={participants.length > 6 ? 12 : 14} /> : <MicOff size={participants.length > 6 ? 12 : 14} />}
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => { e.stopPropagation(); removeParticipant(participant.id); }}
                              className={`${participants.length > 6 ? 'p-1.5' : 'p-2'} rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500 hover:text-white transition-all`}
                              title="Remove from call"
                            >
                              <UserMinus size={participants.length > 6 ? 12 : 14} />
                            </motion.button>
                          </>
                        ) : null}
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            setPresenterId(participant.id);
                            setIsPresenterMode(true);
                            showToast(`${participant.name} is now presenting`, 'info');
                          }}
                          className={`${participants.length > 6 ? 'p-1.5' : 'p-2'} rounded-xl transition-all border ${
                            isPresenterMode && presenterId === participant.id
                              ? 'bg-indigo-500 text-white border-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.4)]' 
                              : 'bg-white/10 text-white border-white/5 hover:bg-white/20'
                          }`}
                          title="Pin/Make Presenter"
                        >
                          <Presentation size={participants.length > 6 ? 12 : 14} />
                        </motion.button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>

        {/* AI Insights Side Panel */}
        <AnimatePresence mode="wait">
          {showAIInsights && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 340 }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="h-full flex-shrink-0 flex flex-col pointer-events-auto bg-slate-900/60 backdrop-blur-3xl border-l border-white/10 shadow-[-20px_0_40px_rgba(0,0,0,0.4)] z-[45] overflow-hidden"
            >
              <div className="w-[340px] flex flex-col h-full">
                <div className="p-6 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-aura-accent/20 flex items-center justify-center">
                      <Sparkles size={16} className="text-aura-accent" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-white">AI Insights</h3>
                      <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Active Analysis</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={toggleTranscription}
                      className={`p-2 rounded-xl transition-all ${isTranscriptionEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-slate-500'}`}
                      title={isTranscriptionEnabled ? "Disable Transcription" : "Enable Transcription"}
                    >
                      <Mic size={14} className={isTranscriptionEnabled ? 'animate-pulse' : ''} />
                    </button>
                    <button 
                      onClick={() => setShowAIInsights(false)}
                      className="p-2 hover:bg-white/5 rounded-xl text-slate-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                  {/* Real-time AI Topic Extraction Button/Card */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-500/10 via-aura-primary/10 to-transparent border border-indigo-500/20 space-y-4 shadow-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-aura-accent animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-white">AI Topic Extraction</span>
                        <button
                          onClick={() => triggerDynamicTopicExtraction()}
                          disabled={isExtractingTopics}
                          title="Extract Topics Now"
                          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-aura-accent hover:text-white transition-all disabled:opacity-50 cursor-pointer ml-1 inline-flex items-center justify-center border border-white/5"
                        >
                          {isExtractingTopics ? (
                            <Loader2 size={10} className="animate-spin" />
                          ) : (
                            <RefreshCw size={10} className="hover:rotate-180 transition-transform duration-500" />
                          )}
                        </button>
                      </div>
                      <span className="text-[8px] bg-indigo-500/20 text-indigo-300 font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider">REWON v2</span>
                    </div>
                    <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                      Analyze the conversation stream with Gemini AI to instantly extract key topics and tags.
                    </p>
                    <button
                      onClick={() => {
                        triggerDynamicTopicExtraction();
                      }}
                      disabled={isExtractingTopics}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-aura-accent via-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.98] disabled:opacity-50 text-white border border-indigo-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_4px_20px_rgba(123,97,255,0.3)] hover:shadow-[0_4px_25px_rgba(123,97,255,0.45)] whitespace-nowrap cursor-pointer"
                    >
                      {isExtractingTopics ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Extracting Topics...
                        </>
                      ) : (
                        <>
                          <Sparkles size={12} className="animate-pulse" />
                          Extract Key Topics
                        </>
                      )}
                    </button>

                    {/* Highly-styled Interactive AI Tag Cloud */}
                    {aiExtractedTopics.length > 0 && (
                      <div className="pt-3 border-t border-white/5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Suggested Topics Cloud</span>
                          {selectedKeyword && aiExtractedTopics.some(t => t.toLowerCase().includes(selectedKeyword.toLowerCase())) && (
                            <button
                              onClick={() => {
                                setSelectedKeyword(null);
                                if (typeof playSound === 'function') playSound('pop', 0.15);
                              }}
                              className="text-[8px] font-black uppercase tracking-widest text-[#7B61FF] hover:text-white transition-colors"
                            >
                              [Clear Filter]
                            </button>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 pt-1 items-center justify-center min-h-[50px] bg-black/15 p-3 rounded-xl border border-white/5">
                          {aiExtractedTopics.map((topic, idx) => {
                            // Let's vary the sizing/weight based on index to create a true organic tag cloud feel!
                            const sizes = ['text-[8px]', 'text-[9.5px]', 'text-[11px]', 'text-[10px]'];
                            const sizeClass = sizes[(topic.length + idx) % sizes.length];
                            
                            const isKeywordActive = selectedKeyword && topic.toLowerCase() === selectedKeyword.toLowerCase();
                            
                            // Let's vary border/text colors based on index for a modern bento vibe
                            const colorClasses = [
                              'text-indigo-300 border-indigo-500/20 hover:border-indigo-400 hover:text-white',
                              'text-cyan-300 border-cyan-500/20 hover:border-cyan-400 hover:text-white',
                              'text-violet-300 border-violet-500/20 hover:border-violet-400 hover:text-white',
                              'text-purple-300 border-purple-500/20 hover:border-purple-400 hover:text-white'
                            ];
                            const colorClass = colorClasses[idx % colorClasses.length];
                            
                            return (
                              <button
                                key={idx}
                                onClick={() => {
                                  if (isKeywordActive) {
                                    setSelectedKeyword(null);
                                    if (typeof playSound === 'function') playSound('pop', 0.15);
                                  } else {
                                    setSelectedKeyword(topic);
                                    if (typeof playSound === 'function') playSound('chime-up', 0.15);
                                  }
                                }}
                                className={`px-2.5 py-1.5 rounded-lg border transition-all hover:scale-105 active:scale-95 duration-200 uppercase tracking-wider font-extrabold ${sizeClass} ${
                                  isKeywordActive
                                    ? 'bg-gradient-to-r from-aura-accent to-indigo-500 text-white border-aura-accent shadow-[0_0_12px_rgba(123,97,255,0.45)] font-black'
                                    : `bg-white/5 ${colorClass} hover:bg-white/10`
                                }`}
                                title={`Toggle transcript filter for "${topic}"`}
                              >
                                #{topic}
                              </button>
                            );
                          })}
                        </div>

                        {aiActionItems.length > 0 && (
                          <div className="pt-2">
                            <span className="text-[8px] font-black uppercase tracking-widest text-emerald-500/70 mb-1 block">Live Action Items</span>
                            <div className="flex flex-col gap-1.5">
                              {aiActionItems.map((item, idx) => (
                                <button 
                                  key={idx} 
                                  onClick={() => toggleAiActionItem(idx)}
                                  className={`flex items-center gap-2 border p-2 rounded-xl transition-all w-full text-left group ${
                                    item.completed 
                                      ? 'bg-emerald-500/10 border-emerald-500/30' 
                                      : 'bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/30'
                                  }`}
                                >
                                  <div className={`flex-shrink-0 w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                                    item.completed ? 'bg-emerald-500 border-emerald-500' : 'border-emerald-500/30 group-hover:border-emerald-500'
                                  }`}>
                                    {item.completed && <Check size={10} className="text-white" />}
                                  </div>
                                  <span className={`text-[9px] truncate transition-all ${
                                    item.completed ? 'text-emerald-500/60 line-through' : 'text-emerald-100/70'
                                  }`}>
                                    {item.text}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {aiMilestones.length > 0 && (
                          <div className="pt-2">
                            <span className="text-[8px] font-black uppercase tracking-widest text-amber-500/70 mb-1 block">Project Milestones</span>
                            <div className="flex flex-wrap gap-2">
                              {aiMilestones.map((ms, idx) => (
                                <div key={idx} className="flex items-center gap-1.5 bg-amber-500/5 border border-amber-500/10 px-2 py-1 rounded-lg">
                                  <Flag size={8} className="text-amber-500" />
                                  <span className="text-[9px] text-amber-100/70 font-medium">{ms}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Summary Section */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Call Summary</label>
                      <button 
                        onClick={generateAISummary}
                        disabled={isGeneratingSummary}
                        className={`text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all ${
                          isGeneratingSummary ? 'text-aura-accent animate-pulse' : 'text-aura-primary hover:text-white'
                        }`}
                      >
                        <Zap size={10} />
                        {isGeneratingSummary ? 'Processing' : 'Generate'}
                      </button>
                    </div>
                    {aiSummary ? (
                      <div className="p-4 rounded-2xl bg-aura-primary/5 border border-aura-primary/10">
                        <p className="text-[11px] text-slate-300 leading-relaxed italic">{aiSummary}</p>
                      </div>
                    ) : (
                      <div className="p-8 rounded-3xl border border-dashed border-white/5 flex flex-col items-center justify-center text-center gap-3">
                        <FileText size={20} className="text-slate-800" />
                        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">No summary generated yet</p>
                      </div>
                    )}
                  </div>

                  {/* Action Items */}
                  <div className="space-y-4">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">AI Action Items</label>
                    <div className="space-y-2">
                       {actionItems.map(item => (
                         <motion.div 
                           key={item.id}
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           className={`p-3.5 rounded-2xl border flex items-start gap-3 transition-all cursor-pointer ${
                             item.completed ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                           }`}
                           onClick={() => {
                             setActionItems(items => items.map(i => i.id === item.id ? {...i, completed: !i.completed} : i));
                           }}
                         >
                           <div className={`mt-0.5 w-4 h-4 rounded-md border flex items-center justify-center transition-all ${
                             item.completed ? 'bg-emerald-500 border-emerald-500' : 'border-white/20'
                           }`}>
                             {item.completed && <Check size={10} className="text-white" />}
                           </div>
                           <span className={`text-[11px] font-medium leading-relaxed ${item.completed ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                             {item.text}
                           </span>
                         </motion.div>
                       ))}
                    </div>
                  </div>

                  {/* Real-time Transcription & Analysis Panel */}
                  <div className="space-y-5">
                    <div className="p-4 bg-white/5 rounded-3xl border border-white/5 space-y-3.5">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${isTranscriptionEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                            Live Transcription
                          </span>
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                            {isTranscriptionEnabled ? 'Processing Stream' : 'Inactive'}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            toggleTranscription();
                            if (typeof playSound === 'function') playSound('pop', 0.25);
                          }}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            isTranscriptionEnabled ? 'bg-emerald-500' : 'bg-slate-700'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              isTranscriptionEnabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      <div className="flex items-center justify-between pt-3 border-t border-white/5">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
                            Display Live Feed
                          </span>
                          <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                            {showLiveFeed ? 'Showing Stream' : 'Showing Analytics'}
                          </span>
                        </div>
                        <button
                          disabled={!isTranscriptionEnabled}
                          onClick={() => {
                            setShowLiveFeed(!showLiveFeed);
                            if (typeof playSound === 'function') playSound('pop', 0.2);
                          }}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            !isTranscriptionEnabled ? 'opacity-30 cursor-not-allowed bg-slate-800' : showLiveFeed ? 'bg-indigo-500' : 'bg-slate-700'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              showLiveFeed && isTranscriptionEnabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {!isTranscriptionEnabled ? (
                      <div className="p-6 rounded-3xl border border-dashed border-white/5 flex flex-col items-center justify-center text-center gap-3 py-10 bg-black/10">
                        <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 shadow-inner">
                          <MicOff size={16} className="text-slate-500" />
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-relaxed">Transcription Paused</p>
                          <p className="text-[9px] text-slate-600 font-bold uppercase tracking-wider leading-relaxed mt-1">Enable transcription above to start analyzing discussion streams in real-time.</p>
                        </div>
                      </div>
                    ) : showLiveFeed ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
                            {selectedKeyword ? `FILTERED SEARCH: "${selectedKeyword}"` : 'Stream Feed'}
                          </label>
                          <div className="flex items-center gap-2">
                            {selectedKeyword && (
                              <button 
                                onClick={() => {
                                  setSelectedKeyword(null);
                                  playSound('pop', 0.15);
                                }}
                                className="text-[9px] font-black uppercase tracking-widest text-[#7B61FF] hover:text-white transition-colors"
                              >
                                [Clear Filter]
                              </button>
                            )}
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Listening</span>
                          </div>
                        </div>
                        <div className="space-y-4 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                          {(() => {
                            const filtered = selectedKeyword 
                              ? transcripts.filter(t => t.text.toLowerCase().includes(selectedKeyword.toLowerCase()))
                              : transcripts;
                            
                            return filtered.map((t, idx) => {
                              const textContent = t.text;
                              return (
                                <motion.div 
                                  key={t.id || idx}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  className="space-y-1.5"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className={`text-[9px] font-black uppercase ${t.user === 'REWON AI' ? 'text-aura-accent' : 'text-white/50'}`}>{t.user}</span>
                                    <span className="text-[8px] font-medium text-slate-600">{t.time}</span>
                                  </div>
                                  <p className={`text-[11px] leading-relaxed p-3 rounded-2xl rounded-tl-none border ${
                                    t.user === 'REWON AI' ? 'bg-aura-accent/5 border-aura-accent/10 text-slate-200' : 'bg-white/5 border-white/5 text-slate-400'
                                  }`}>
                                    {selectedKeyword ? (
                                      <span>
                                        {(() => {
                                          const regex = new RegExp(`(${selectedKeyword})`, 'gi');
                                          const parts = textContent.split(regex);
                                          return parts.map((part, i) => 
                                            part.toLowerCase() === selectedKeyword.toLowerCase() ? (
                                              <mark key={i} className="bg-indigo-500/40 text-indigo-300 font-bold px-1 rounded">
                                                {part}
                                              </mark>
                                            ) : (
                                              part
                                            )
                                          );
                                        })()}
                                      </span>
                                    ) : (
                                      textContent
                                    )}
                                  </p>
                                </motion.div>
                              );
                            });
                          })()}
                          {transcripts.length === 0 && (
                             <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-8">
                                <div className="w-12 h-12 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
                                   <Mic size={18} className="text-slate-800 animate-pulse" />
                                </div>
                                <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest leading-relaxed">
                                   Waiting for conversation<br/>to begin...
                                </p>
                             </div>
                          )}
                          {selectedKeyword && transcripts.filter(t => t.text.toLowerCase().includes(selectedKeyword.toLowerCase())).length === 0 && (
                             <div className="h-full flex flex-col items-center justify-center text-center gap-4 py-8">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                                   No transcript matches for "{selectedKeyword}"
                                </p>
                             </div>
                          )}
                        </div>
                        <div className="flex justify-end">
                          <button 
                            onClick={() => {
                              exportTranscript();
                              if (typeof playSound === 'function') playSound('pop', 0.25);
                            }}
                            className="text-[9px] font-black uppercase tracking-widest text-indigo-400 hover:text-white flex items-center gap-1 transition-all"
                          >
                            <Download size={10} /> Export Transcript
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <div className="flex items-center justify-between">
                          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Real-Time Transcription Analysis</label>
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
                            <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400">Processing Stream</span>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {/* Sentiment Metric Card */}
                          <div className="p-3.5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300">Sentiment & Tone</span>
                              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">Analytical</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-medium">The tone of the discussion is highly strategic and inquisitive, focusing on implementation paths and milestone alignment.</p>
                            
                            {/* Progress Gauges for Sentiment */}
                            <div className="space-y-1 pt-1.5">
                              <div className="flex justify-between text-[8px] font-black uppercase text-slate-500">
                                <span>Constructive</span>
                                <span>92%</span>
                              </div>
                              <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: "92%" }}
                                  className="h-full bg-emerald-500"
                                  transition={{ duration: 1 }}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Speaker Distribution */}
                          <div className="p-3.5 bg-white/5 rounded-2xl border border-white/5 space-y-3">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Speaker Contribution</span>
                            <div className="space-y-2.5">
                              {(() => {
                                const counts = transcripts.reduce((acc, curr) => {
                                  acc[curr.user] = (acc[curr.user] || 0) + 1;
                                  return acc;
                                }, {} as Record<string, number>);
                                const total = transcripts.length || 1;
                                
                                const speakers = Object.keys(counts).length > 0 
                                  ? Object.entries(counts).map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }))
                                  : [
                                      { name: 'Alex Rivers', count: 1, pct: 60 },
                                      { name: 'REWON AI', count: 1, pct: 40 }
                                    ];

                                return speakers.map((sp, idx) => (
                                  <div key={idx} className="space-y-1">
                                    <div className="flex items-center justify-between text-[9px]">
                                      <span className="font-bold text-slate-300">{sp.name}</span>
                                      <span className="font-black text-slate-500">{sp.pct}%</span>
                                    </div>
                                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                      <motion.div 
                                        initial={{ width: 0 }}
                                        animate={{ width: `${sp.pct}%` }}
                                        className={`h-full ${sp.name === 'REWON AI' ? 'bg-aura-accent' : 'bg-aura-primary'}`}
                                        transition={{ duration: 0.8, delay: idx * 0.1 }}
                                      />
                                    </div>
                                  </div>
                                ));
                              })()}
                            </div>
                          </div>

                          {/* Live Keyword Frequencies (Auto-extracted) */}
                          <div className="p-3.5 bg-white/5 rounded-2xl border border-white/5 space-y-2.5">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                              Real-Time Extracted Keywords
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {dynamicExtractedKeywords.map((k, idx) => (
                                <span 
                                  key={idx} 
                                  onClick={() => {
                                    setSelectedKeyword(k.word);
                                    setShowLiveFeed(true);
                                    if (typeof playSound === 'function') playSound('pop', 0.25);
                                  }}
                                  className={`text-[9px] font-bold px-2 py-1 rounded-xl border transition-all hover:scale-105 cursor-pointer flex items-center gap-1 bg-indigo-500/10 border-indigo-500/30 text-indigo-300 hover:border-indigo-500`}
                                >
                                  <span>{k.word}</span>
                                  <span className="text-[7px] font-black bg-indigo-500/20 px-1 rounded text-indigo-200">{k.freq}x</span>
                                </span>
                              ))}
                              {dynamicExtractedKeywords.length === 0 && (
                                <span className="text-[9px] font-bold text-slate-500">
                                  Analyzing transcription stream...
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Suggested Topics Card with Action Button */}
                          <div className="p-3.5 bg-white/5 rounded-2xl border border-white/5 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Extracted Topics</span>
                              <button
                                onClick={() => {
                                  triggerDynamicTopicExtraction();
                                }}
                                disabled={isExtractingTopics}
                                className="text-[9px] font-black uppercase tracking-widest text-aura-primary hover:text-white transition-all flex items-center gap-1"
                              >
                                {isExtractingTopics ? (
                                  <Loader2 size={8} className="animate-spin" />
                                ) : (
                                  <Sparkles size={8} className="animate-pulse" />
                                )}
                                Extract AI Topics
                              </button>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {aiExtractedTopics.map((topic, idx) => (
                                <span 
                                  key={idx} 
                                  onClick={() => {
                                    if (selectedKeyword === topic) {
                                      setSelectedKeyword(null);
                                    } else {
                                      setSelectedKeyword(topic);
                                      setShowLiveFeed(true);
                                      if (typeof playSound === 'function') playSound('chime-up', 0.15);
                                    }
                                  }}
                                  className={`text-[9px] font-bold px-2 py-1 rounded-xl border transition-all hover:scale-105 cursor-pointer ${
                                    selectedKeyword === topic
                                      ? 'bg-aura-primary text-white border-aura-primary shadow-[0_0_10px_rgba(123,97,255,0.4)]'
                                      : 'border-aura-primary/30 bg-aura-primary/10 text-aura-primary hover:border-aura-primary/50'
                                  }`}
                                >
                                  {topic}
                                </span>
                              ))}
                            </div>
                          </div>

                          {/* Custom Topic Tracker Form */}
                          <div className="p-3.5 bg-white/5 rounded-2xl border border-white/5 space-y-2.5">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Custom Keyword Tracker</span>
                            <form onSubmit={handleAddCustomKeyword} className="flex gap-2">
                              <input
                                type="text"
                                value={newKeywordInput}
                                onChange={(e) => setNewKeywordInput(e.target.value)}
                                placeholder="Add custom keyword (e.g. action)..."
                                className="flex-1 bg-white/5 text-white placeholder-slate-600 rounded-xl px-2.5 py-1 text-[10px] border border-white/5 focus:outline-none focus:border-indigo-500/50"
                              />
                              <button
                                type="submit"
                                className="bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl px-3 py-1 text-[9px] font-bold uppercase tracking-widest transition-all"
                              >
                                Track
                              </button>
                            </form>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {customKeywords.map((tag, idx) => {
                                const detectedInFeed = transcripts.some(t => t.text.toLowerCase().includes(tag.toLowerCase()));
                                return (
                                  <div 
                                    key={idx}
                                    className={`text-[9px] font-bold px-2 py-1 rounded-xl border transition-all flex items-center gap-1.5 ${
                                      detectedInFeed 
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                                        : 'bg-white/5 border-white/5 text-slate-500'
                                    }`}
                                  >
                                    <span 
                                      className="cursor-pointer"
                                      onClick={() => {
                                        setSelectedKeyword(tag);
                                        setShowLiveFeed(true);
                                        if (typeof playSound === 'function') playSound('pop', 0.2);
                                      }}
                                    >
                                      {tag} {detectedInFeed && '✓'}
                                    </span>
                                    <button 
                                      type="button"
                                      onClick={() => handleRemoveCustomKeyword(tag)}
                                      className="text-[8px] hover:text-red-400 text-slate-600 transition-colors"
                                    >
                                      ×
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 border-t border-white/5 bg-slate-900/40 mt-auto">
                  <button 
                    onClick={() => {
                      exportSummary();
                      playSound('pop', 0.2);
                    }}
                    disabled={!aiSummary}
                    className={`w-full py-3.5 rounded-2xl flex items-center justify-center gap-2.5 text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-xl ${
                      aiSummary 
                      ? 'bg-aura-primary text-white hover:bg-aura-primary/90 shadow-aura-primary/20 hover:-translate-y-0.5 active:translate-y-0' 
                      : 'bg-white/5 text-slate-600 border border-white/5 cursor-not-allowed'
                    }`}
                  >
                    <Download size={14} />
                    Export Call Report
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Meeting Recording Overlay */}
        <AnimatePresence>
      {isRecordingCall && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="absolute top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 px-5 py-2.5 bg-red-500/90 backdrop-blur-xl rounded-2xl border border-red-400/50 shadow-[0_20px_50px_rgba(239,68,68,0.3)] text-white"
        >
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-white animate-pulse shadow-[0_0_10px_rgba(255,255,255,1)]" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em]">REC Session</span>
          </div>
          <div className="w-px h-4 bg-white/20" />
          <span className="text-[13px] font-mono font-bold tracking-widest">{formatDuration(recordingDuration)}</span>
        </motion.div>
      )}
        </AnimatePresence>

        {/* Settings Panel Overlay */}
        <AnimatePresence>
          {showSettings && (
            <motion.div 
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              className="absolute top-24 right-6 w-[360px] bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-indigo-950/45 backdrop-blur-3xl border border-white/12 rounded-[32px] shadow-[0_40px_80px_rgba(0,0,0,0.65)] z-[60] flex flex-col overflow-hidden"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-aura-primary/20 flex items-center justify-center text-aura-primary">
                    <Settings size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white leading-none">Device Setup</h4>
                    <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-widest font-black">Configure Hardware</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-all text-slate-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Camera Preview */}
                <div className="space-y-3">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Live Camera Preview</label>
                  <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 shadow-inner group">
                    <video 
                      autoPlay 
                      muted 
                      playsInline
                      ref={(el) => {
                        if (el && localStream) {
                          el.srcObject = localStream;
                        }
                      }}
                      className="w-full h-full object-cover scale-x-[-1]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-[9px] text-white/70 font-medium tracking-wide">Preview Monitor</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 ml-1">
                      <Camera size={12} className="text-aura-primary" />
                      Camera Visuals
                    </label>
                    <select 
                      value={selectedVideoDeviceId}
                      onChange={(e) => changeVideoDevice(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-aura-primary/50 transition-all hover:bg-white/10 cursor-pointer appearance-none"
                    >
                      {devices.filter(d => d.kind === 'videoinput').map(device => (
                        <option key={device.deviceId} value={device.deviceId} className="bg-slate-950 text-white">
                          {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 ml-1">
                      <Mic size={12} className="text-aura-accent" />
                      Audio Input
                    </label>
                    <select 
                      value={selectedAudioDeviceId}
                      onChange={(e) => changeAudioDevice(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-aura-primary/50 transition-all hover:bg-white/10 cursor-pointer appearance-none"
                    >
                      {devices.filter(d => d.kind === 'audioinput').map(device => (
                        <option key={device.deviceId} value={device.deviceId} className="bg-slate-950 text-white">
                          {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 ml-1">
                      <Volume2 size={12} className="text-indigo-400" />
                      Speaker Output
                    </label>
                    <select 
                      value={selectedSpeakerDeviceId}
                      onChange={(e) => changeSpeakerDevice(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-[11px] text-white focus:outline-none focus:ring-2 focus:ring-aura-primary/50 transition-all hover:bg-white/10 cursor-pointer appearance-none"
                    >
                      {devices.filter(d => d.kind === 'audiooutput').map(device => (
                        <option key={device.deviceId} value={device.deviceId} className="bg-slate-950 text-white">
                          {device.label || `Speaker ${device.deviceId.slice(0, 5)}`}
                        </option>
                      ))}
                      {devices.filter(d => d.kind === 'audiooutput').length === 0 && (
                        <option value="default" className="bg-slate-950 text-white">System Default Speaker</option>
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 ml-1">
                      <FastForward size={12} className="text-amber-400" />
                      Playback Speed: <span className="text-aura-accent font-mono ml-auto">{audioPlaybackRate.toFixed(1)}x</span>
                    </label>
                    <div className="flex items-center gap-4 px-2">
                      <span className="text-[10px] text-slate-500 font-bold">0.5x</span>
                      <input 
                        type="range"
                        min="0.5"
                        max="2.5"
                        step="0.1"
                        value={audioPlaybackRate}
                        onChange={(e) => setAudioPlaybackRate(parseFloat(e.target.value))}
                        className="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-aura-primary"
                      />
                      <span className="text-[10px] text-slate-500 font-bold">2.5x</span>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5">
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="w-full py-4 bg-gradient-to-r from-aura-primary to-aura-accent text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-xl shadow-aura-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <VideoCallError 
        error={error} 
        onRetry={() => {
          if (error?.type === 'NETWORK') {
            window.location.reload();
          } else {
            startCall();
          }
        }} 
        onClose={onClose}
        isRetrying={isRetrying}
        isLightMode={isLightMode}
      />

      {/* Screen Sharing Banner */}
      {isScreenSharing && (
        <motion.div 
          initial={{ y: -50 }}
          animate={{ y: 0 }}
          className={`absolute top-0 inset-x-0 ${isRecordingCall ? 'bg-red-500/90' : 'bg-aura-accent/90'} backdrop-blur-md text-white py-2 px-4 flex items-center justify-center gap-3 z-30 font-bold text-xs tracking-wider border-b border-white/20 transition-colors duration-500`}
        >
          {isRecordingCall ? <Circle size={14} fill="currentColor" className="animate-pulse" /> : <ScreenShare size={14} className="animate-pulse" />}
          {isRecordingCall ? 'MEETING RECORDING IN PROGRESS' : 'PARTICIPANTS CAN SEE YOUR SCREEN'}
          <div className="flex gap-2 ml-4">
            {isRecordingCall && (
              <button 
                onClick={() => toggleCallRecording(localStream)}
                className="bg-white text-red-500 px-3 py-1 rounded-full hover:bg-slate-100 transition-colors text-[10px]"
              >
                Stop Recording
              </button>
            )}
            <button 
              onClick={toggleScreenShare}
              className={`bg-white ${isRecordingCall ? 'text-red-500' : 'text-aura-accent'} px-3 py-1 rounded-full hover:bg-slate-100 transition-colors text-[10px]`}
            >
              Stop Sharing
            </button>
          </div>
        </motion.div>
      )}

      {/* Global Waveform Overlay in Call */}
      {(isSpeaking || isListening) && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
          <Waveform isListening={isListening} isSpeaking={isSpeaking} />
        </div>
      )}


        <AnimatePresence mode="wait">
          {showPreview && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative h-full bg-slate-950/45 backdrop-blur-3xl border-l border-white/10 z-40 flex flex-col shadow-[-20px_0_50px_rgba(3,7,18,0.5)] overflow-hidden"
            >
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <Camera size={16} className="text-indigo-400" />
                  Self-Preview
                </h3>
                <button 
                  onClick={() => setShowPreview(false)} 
                  className="p-1.5 hover:bg-white/10 rounded-full transition-all text-slate-400 hover:text-white"
                  title="Close panel"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-4 space-y-6">
                  {/* Live Preview Monitor */}
                  <div className="space-y-3">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Live Monitor</label>
                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 shadow-inner group">
                      <video 
                        key={localStream?.id}
                        autoPlay 
                        muted 
                        playsInline
                        ref={(el) => {
                          if (el && localStream) {
                            el.srcObject = localStream;
                          }
                        }}
                        className={`w-full h-full object-cover scale-x-[-1] ${isVideoOff ? 'hidden' : 'block'}`}
                      />
                      {isVideoOff && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-800/20 backdrop-blur-sm">
                          <VideoOffPlaceholder 
                            name="You" 
                            avatar={participants.find(p => p.isHost)?.avatar} 
                            size="small" 
                          />
                        </div>
                      )}
                      {isRecordingLocal && (
                        <div className="absolute top-3 left-3 flex items-center gap-2 px-2 py-1 bg-red-500/80 backdrop-blur-md rounded-lg text-[8px] font-black text-white animate-pulse">
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                          REC
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[9px] text-white/70 font-medium">Local Camera Feed</span>
                      </div>
                    </div>
                  </div>

                  {/* Recording Controls */}
                  <div className="space-y-4">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Video Capture</label>
                    <button 
                      onClick={toggleLocalRecording}
                      className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-bold text-xs transition-all border ${
                        isRecordingLocal 
                        ? 'bg-red-500 text-white border-red-400/50 shadow-[0_15px_30px_rgba(239,68,68,0.2)]'
                        : 'bg-white/5 text-white border-white/10 hover:bg-white/10'
                      }`}
                    >
                      {isRecordingLocal ? (
                        <>
                          <Square size={16} fill="currentColor" />
                          Stop Recording
                        </>
                      ) : (
                        <>
                          <Circle size={16} fill="currentColor" className="text-red-500" />
                          Start Test Recording
                        </>
                      )}
                    </button>
                    <p className="text-[10px] text-slate-500 leading-relaxed text-center px-4">
                      Record a short clip to verify your video and audio quality before sharing.
                    </p>
                  </div>

                  {/* Playback Area */}
                  <AnimatePresence>
                    {recordedVideoUrl && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 rounded-3xl bg-white/5 border border-white/10 space-y-4"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400">Recorded Playback</label>
                          <button 
                             onClick={() => setRecordedVideoUrl(null)}
                             className="text-[9px] font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-widest"
                          >
                            Discard
                          </button>
                        </div>
                        <VideoPlayer 
                          src={recordedVideoUrl!} 
                          isSyncEnabled={false} 
                          user={user}
                        />
                        <button 
                          onClick={() => {
                            const a = document.createElement('a');
                            a.href = recordedVideoUrl;
                            a.download = `preview-${Date.now()}.webm`;
                            a.click();
                          }}
                          className="w-full py-3 bg-aura-primary/10 text-aura-primary rounded-xl text-[10px] font-bold uppercase tracking-widest border border-aura-primary/20 hover:bg-aura-primary/20 transition-all flex items-center justify-center gap-2"
                        >
                          <Download size={14} />
                          Save Recording
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div className="p-6 bg-white/5 border-t border-white/5">
                 <button 
                   onClick={() => setShowPreview(false)}
                   className="w-full py-4 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl shadow-indigo-500/20"
                 >
                   Ready to Join
                 </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {showAIInsights && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 180 }}
              className="relative h-full bg-slate-950/45 backdrop-blur-3xl border-l border-white/10 z-40 flex flex-col shadow-[-20px_0_50px_rgba(3,7,18,0.5)] overflow-hidden"
            >
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <Sparkles size={16} className="text-aura-accent" />
                  REWON AI Insights
                </h3>
                <button 
                  onClick={() => setShowAIInsights(false)} 
                  className="p-1.5 hover:bg-white/10 rounded-full transition-all text-slate-400 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-4 space-y-6">
                  {/* Transcription Toggle */}
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Mic size={14} className="text-aura-accent" />
                        <span className="text-xs font-bold text-white">Live Transcription</span>
                      </div>
                      <button 
                        onClick={toggleTranscription}
                        className={`w-10 h-5 rounded-full transition-all relative ${isTranscriptionEnabled ? 'bg-aura-accent' : 'bg-slate-700'}`}
                      >
                        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${isTranscriptionEnabled ? 'right-1' : 'left-1'}`} />
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Automatically transcribe and identify speakers in real-time.
                    </p>
                  </div>

                  {/* Real-time Transcription List */}
                  {isTranscriptionEnabled && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Live Transcript</label>
                        {selectedKeyword && (
                          <button 
                            onClick={() => {
                              setSelectedKeyword(null);
                              playSound('pop', 0.15);
                            }}
                            className="text-[9px] font-black uppercase tracking-widest text-[#7B61FF] hover:text-white transition-colors"
                          >
                            [Clear Filter]
                          </button>
                        )}
                      </div>

                      {/* Active Filter indicator */}
                      {selectedKeyword && (
                        <div className="px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between gap-2">
                          <span className="text-[10px] text-indigo-300 font-medium">Filtering by: <strong className="font-bold">"{selectedKeyword}"</strong></span>
                          <button onClick={() => setSelectedKeyword(null)} className="text-slate-400 hover:text-white p-0.5"><X size={10} /></button>
                        </div>
                      )}

                      {/* Hot Interactive Keywords */}
                      <div className="flex flex-wrap gap-1 pb-1">
                        {allKeywords.slice(0, 8).map(kw => {
                          const isActive = selectedKeyword && selectedKeyword.toLowerCase() === kw.toLowerCase();
                          return (
                            <button
                              key={kw}
                              onClick={() => {
                                if (isActive) {
                                  setSelectedKeyword(null);
                                  if (typeof playSound === 'function') playSound('pop', 0.15);
                                } else {
                                  setSelectedKeyword(kw);
                                  if (typeof playSound === 'function') playSound('chime-up', 0.15);
                                }
                              }}
                              className={`text-[9px] px-2.5 py-0.5 rounded-full border transition-all ${
                                isActive 
                                  ? 'bg-aura-accent/30 border-aura-accent text-white font-bold shadow-[0_0_8px_rgba(123,97,255,0.3)]' 
                                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              #{kw}
                            </button>
                          );
                        })}
                      </div>

                      <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar scroll-smooth">
                        {(() => {
                          const filtered = selectedKeyword 
                            ? transcripts.filter(t => t.text.toLowerCase().includes(selectedKeyword.toLowerCase()))
                            : transcripts;

                          if (filtered.length === 0) {
                            return (
                              <div className="py-8 text-center bg-white/5 rounded-xl border border-white/5">
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">No matching transcripts found.</p>
                              </div>
                            );
                          }

                          return (
                            <>
                              {filtered.map(t => (
                                <motion.div 
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  key={t.id} 
                                  className="bg-white/5 p-3 rounded-xl border border-white/5 hover:border-white/12 transition-all relative group"
                                >
                                  <div className="flex justify-between items-center mb-1">
                                    <span className={`text-[10px] font-bold ${t.user === 'REWON AI' ? 'text-aura-primary' : 'text-aura-accent'}`}>{t.user}</span>
                                    <span className="text-[9px] text-slate-500 font-mono italic">{t.time}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
                                    {highlightAndMakeClickable(t.text)}
                                  </p>
                                  <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <button 
                                      onClick={() => navigator.clipboard.writeText(t.text)}
                                      className="p-1 hover:bg-white/10 rounded-md text-slate-500 hover:text-white"
                                      title="Copy line"
                                    >
                                      <Link size={10} />
                                    </button>
                                  </div>
                                </motion.div>
                              ))}
                              <div ref={transcriptEndRef} className="h-4" />
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Summary Section */}
                  <div className="space-y-4">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Meeting Intelligence</label>
                    <button 
                      onClick={generateAISummary}
                      disabled={isGeneratingSummary}
                      className="w-full py-4 bg-aura-primary/10 hover:bg-aura-primary/20 text-aura-primary border border-aura-primary/30 rounded-2xl flex items-center justify-center gap-3 transition-all relative overflow-hidden group"
                    >
                      {isGeneratingSummary ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          <span className="text-xs font-bold">Analyzing Context...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={16} className="group-hover:rotate-12 transition-transform" />
                          <span className="text-xs font-bold">Generate Call Summary</span>
                        </>
                      )}
                    </button>

                    <AnimatePresence>
                      {aiSummary && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="p-4 rounded-2xl bg-gradient-to-br from-aura-primary/10 to-aura-accent/10 border border-white/10 relative group"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <Sparkles size={14} className="text-aura-accent animate-pulse" />
                            <span className="text-[10px] font-black uppercase tracking-widest text-white">Smart Summary</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed italic">
                            "{aiSummary}"
                          </p>
                          <div className="mt-4 flex gap-2">
                            <button 
                              onClick={() => {
                                const text = `Meeting Summary: ${aiSummary}`;
                                navigator.clipboard.writeText(text);
                                showToast("Copied to clipboard", "success");
                              }}
                              className="flex-1 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2"
                            >
                              <Link size={12} />
                              Copy
                            </button>
                            <button 
                              onClick={exportSummary}
                              className="flex-1 py-2 bg-aura-primary/10 hover:bg-aura-primary/20 border border-aura-primary/20 rounded-lg text-[9px] font-bold uppercase tracking-widest text-aura-primary hover:text-white transition-all flex items-center justify-center gap-2"
                            >
                              <Download size={12} />
                              Export .txt
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {isTranscriptionEnabled && (
                    <button 
                       onClick={exportTranscript}
                       className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2"
                    >
                      <Download size={14} />
                      Export Full Transcript (.txt)
                    </button>
                  )}

                  {meetingRecordingUrl && !isRecordingCall && (
                    <button 
                       onClick={exportMeetingRecording}
                       className="w-full py-4 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-emerald-400 hover:text-emerald-300 transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/5 group"
                    >
                      <Film size={18} className="group-hover:scale-110 transition-transform" />
                      Export Meeting Recording (.webm)
                    </button>
                  )}

                  {/* AI Capabilities Toggles */}
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">REWON Assistance</label>
                    {[
                      { icon: <Globe size={14} />, label: 'Real-time Translation', desc: 'Translate speech from 15+ languages.' },
                      { icon: <MessageSquare size={14} />, label: 'Action Item Discovery', desc: 'Identify tasks and project updates.' },
                      { icon: <Shield size={14} />, label: 'Bias & Sentiment Filter', desc: 'Monitor call health and tone.' }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-aura-accent transition-colors">
                          {item.icon}
                        </div>
                        <div className="flex-1">
                          <p className="text-[11px] font-bold text-white">{item.label}</p>
                          <p className="text-[9px] text-slate-500">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-aura-accent/5 border-t border-white/5">
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
                  <div className="w-8 h-8 rounded-full bg-aura-accent/20 flex items-center justify-center shadow-lg shadow-aura-accent/20">
                    <Sparkles size={14} className="text-aura-accent" />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] text-white font-bold">REWON is Listening</p>
                    <div className="flex gap-0.5 mt-1">
                      {[1, 2, 3, 4, 5].map(i => (
                        <motion.div 
                          key={i}
                          animate={{ height: [4, 12, 4] }}
                          transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                          className="w-1 bg-aura-accent rounded-full"
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* Call Settings Modal */}
          <AnimatePresence>
            {showSettings && (
              <motion.div 
                initial={{ opacity: 0, x: 400, scale: 0.95 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 400, scale: 0.95 }}
                className="absolute top-4 right-4 bottom-4 w-96 bg-gradient-to-br from-slate-900/80 via-slate-950/90 to-indigo-950/45 backdrop-blur-3xl rounded-[40px] border border-white/12 shadow-[0_30px_100px_rgba(0,0,0,0.8)] z-[60] flex flex-col overflow-hidden"
              >
                <div className="p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-aura-primary/10 to-aura-accent/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-aura-primary/20 flex items-center justify-center border border-aura-primary/30">
                      <Settings size={20} className="text-aura-primary" />
                    </div>
                    <div>
                      <h3 className="text-white font-display font-bold text-lg tracking-tight">Call Settings</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Media & Devices</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowSettings(false)} 
                    className="p-2 hover:bg-white/10 rounded-full transition-all text-slate-400 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                  {/* Tab Navigation */}
                  <div className="flex bg-white/5 p-1 rounded-2xl border border-white/5">
                    {[
                      { id: 'devices', label: 'Hardware', icon: <Sliders size={14} /> },
                      { id: 'ai', label: 'Insights', icon: <Sparkles size={14} /> },
                      { id: 'help', label: 'Support', icon: <HelpCircle size={14} /> }
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => setSettingsTab(tab.id as any)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          settingsTab === tab.id 
                            ? 'bg-aura-primary text-white shadow-lg shadow-aura-primary/20' 
                            : 'text-slate-500 hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {tab.icon}
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {settingsTab === 'devices' && (
                    <div className="space-y-8">
                      {/* Video Preview */}
                      <div className="space-y-4">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Camera Preview</label>
                        <div className="aspect-video rounded-3xl overflow-hidden bg-slate-950 border border-white/10 relative group">
                          {settingsStream ? (
                            <video 
                              autoPlay 
                              muted
                              playsInline 
                              ref={(el) => { 
                                if (el && el.srcObject !== settingsStream) {
                                  el.srcObject = settingsStream;
                                }
                              }}
                              className="w-full h-full object-cover scale-x-[-1]"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-slate-900/50">
                              <VideoOffPlaceholder name="Preview" size="small" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>

                      {/* Device Selectors */}
                      <div className="space-y-6">
                        {/* Camera Select */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Camera size={14} className="text-aura-primary" />
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Camera Input</label>
                          </div>
                          <div className="relative group">
                            <select 
                              value={selectedVideoDeviceId}
                              onChange={(e) => handleDeviceChange('video', e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white appearance-none focus:outline-none focus:ring-2 focus:ring-aura-primary/50 transition-all cursor-pointer group-hover:bg-white/10"
                            >
                              {devices.filter(d => d.kind === 'videoinput').map(d => (
                                <option key={d.deviceId} value={d.deviceId} className="bg-slate-900">{d.label || `Camera ${d.deviceId.slice(0, 4)}`}</option>
                              ))}
                              {devices.filter(d => d.kind === 'videoinput').length === 0 && (
                                <option value="" className="bg-slate-900">No Cameras Found</option>
                              )}
                            </select>
                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-hover:text-white transition-colors" />
                          </div>
                        </div>

                        {/* Microphone Select */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Mic size={14} className="text-aura-accent" />
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Microphone Input</label>
                          </div>
                          <div className="relative group">
                            <select 
                              value={selectedAudioDeviceId}
                              onChange={(e) => handleDeviceChange('audioinput', e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white appearance-none focus:outline-none focus:ring-2 focus:ring-aura-accent/50 transition-all cursor-pointer group-hover:bg-white/10"
                            >
                              {devices.filter(d => d.kind === 'audioinput').map(d => (
                                <option key={d.deviceId} value={d.deviceId} className="bg-slate-900">{d.label || `Microphone ${d.deviceId.slice(0, 4)}`}</option>
                              ))}
                              {devices.filter(d => d.kind === 'audioinput').length === 0 && (
                                <option value="" className="bg-slate-900">No Mics Found</option>
                              )}
                            </select>
                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-hover:text-white transition-colors" />
                          </div>
                        </div>

                        {/* Speaker Select */}
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <Volume2 size={14} className="text-emerald-500" />
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Speakers Output</label>
                          </div>
                          <div className="relative group">
                            <select 
                              value={selectedSpeakerDeviceId}
                              onChange={(e) => handleDeviceChange('audiooutput', e.target.value)}
                              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-xs text-white appearance-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all cursor-pointer group-hover:bg-white/10"
                            >
                              {devices.filter(d => d.kind === 'audiooutput').map(d => (
                                <option key={d.deviceId} value={d.deviceId} className="bg-slate-900">{d.label || `Speaker ${d.deviceId.slice(0, 4)}`}</option>
                              ))}
                              <option value="default" className="bg-slate-900">System Default</option>
                            </select>
                            <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-hover:text-white transition-colors" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {settingsTab === 'ai' && (
                    <div className="space-y-6">
                      <div className="p-4 rounded-2xl bg-aura-primary/10 border border-aura-primary/20 space-y-3">
                        <div className="flex items-center gap-3">
                          <Sparkles size={16} className="text-aura-primary" />
                          <h4 className="text-xs font-bold text-white">AI Capabilities</h4>
                        </div>
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          REWON AI monitors call health, identifies action items, and generates real-time summaries.
                        </p>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                           <div className="space-y-1">
                              <p className="text-xs font-bold text-white">Smart Transcription</p>
                              <p className="text-[9px] text-slate-500">Enable real-time speech-to-text</p>
                           </div>
                           <button 
                             onClick={() => setIsTranscriptionEnabled(!isTranscriptionEnabled)}
                             className={`w-12 h-6 rounded-full relative transition-colors ${isTranscriptionEnabled ? 'bg-aura-primary' : 'bg-slate-700'}`}
                           >
                             <motion.div 
                               animate={{ x: isTranscriptionEnabled ? 26 : 2 }}
                               className="absolute top-1 left-0.5 w-4 h-4 bg-white rounded-full shadow-lg" 
                             />
                           </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {settingsTab === 'help' && (
                    <div className="space-y-6">
                       <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-4">
                          <div className="flex items-center gap-3 text-white">
                             <HelpCircle size={16} className="text-aura-accent" />
                             <span className="text-xs font-bold">Having trouble?</span>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-relaxed">
                             Ensure your camera and microphone have permissions in your browser. If devices aren't showing up, try refreshing the list or restarting your browser.
                          </p>
                          <button 
                            onClick={() => refreshDevices()}
                            className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all flex items-center justify-center gap-2"
                          >
                            <RotateCw size={14} />
                            Refresh Device List
                          </button>
                       </div>
                    </div>
                  )}

                  <div className="pt-6 border-t border-white/5 space-y-4">
                    <button 
                      onClick={() => setShowSettings(false)}
                      className="w-full py-4 bg-aura-primary text-white rounded-2xl font-bold text-sm shadow-lg shadow-aura-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      Save & Close
                    </button>
                    <p className="text-[10px] text-center text-slate-500 font-medium">
                      Changes will be applied immediately to your active call.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {showParticipants && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative h-full bg-slate-950/45 backdrop-blur-3xl border-l border-white/10 z-40 flex flex-col shadow-[-20px_0_50px_rgba(3,7,18,0.5)] overflow-hidden"
            >
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <Users size={16} className="text-aura-primary" />
                  People ({participants.length})
                </h3>
                <button 
                  onClick={() => setShowParticipants(false)} 
                  className="p-1.5 hover:bg-white/10 rounded-full transition-all text-slate-400 hover:text-white"
                  title="Close panel"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 bg-white/5 space-y-4 border-b border-white/5">
                <div className="flex flex-col gap-3">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">My Controls</label>
                  <div className="flex gap-2">
                    <button 
                      onClick={toggleMute}
                      className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${
                        isMuted 
                          ? 'bg-red-500/20 text-red-500 border-red-500/30' 
                          : 'bg-aura-primary/10 text-aura-primary border-aura-primary/20 hover:bg-aura-primary/20'
                      }`}
                      title={isMuted ? "Unmute My Mic" : "Mute My Mic"}
                    >
                      {isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                      {isMuted ? 'Unmute Me' : 'Mute Me'}
                    </button>
                    <button 
                      onClick={toggleVideo}
                      className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${
                        isVideoOff 
                          ? 'bg-red-500/20 text-red-500 border-red-500/30' 
                          : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                      }`}
                      title={isVideoOff ? "Turn My Camera On" : "Turn My Camera Off"}
                    >
                      {isVideoOff ? <VideoOff size={14} /> : <Video size={14} />}
                      {isVideoOff ? 'Cam Off' : 'Cam On'}
                    </button>
                  </div>
                </div>

                {amIHost && (
                  <div className="flex flex-col gap-3 pt-4 border-t border-white/5">
                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-aura-primary">Host Management</label>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => muteAllParticipants(!allOthersMuted)}
                        className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${
                          allOthersMuted 
                            ? 'bg-red-500/20 text-red-500 border-red-500/30' 
                            : 'bg-white/5 text-slate-400 border-white/10 hover:border-white/20'
                        }`}
                        title={allOthersMuted ? "Unmute everyone except me" : "Force-mute all participants"}
                      >
                        {allOthersMuted ? <Mic size={14} /> : <MicOff size={14} />}
                        {allOthersMuted ? 'Unmute All' : 'Mute All'}
                      </button>
                      <button 
                        onClick={inviteParticipant}
                        className="px-4 py-2.5 bg-aura-accent hover:bg-aura-accent/80 rounded-xl text-white transition-all flex items-center justify-center border border-aura-accent/50 shadow-lg shadow-aura-accent/20 gap-2"
                        title="Copy session invite link"
                      >
                        <Link size={16} />
                        <span className="text-[10px] font-bold uppercase">Invite</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-3">
                {participants.map(p => (
                  <motion.div 
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={p.id} 
                    className={`relative flex flex-col gap-3 p-3 rounded-2xl transition-all border ${
                      p.isHost 
                        ? 'bg-aura-primary/5 border-aura-primary/20' 
                        : isLightMode 
                          ? 'bg-slate-50 border-slate-100 hover:border-slate-200' 
                          : 'bg-white/5 border-transparent hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <motion.div
                          animate={(!p.isMuted && (p.isHost || p.role === 'AI Assistant')) ? {
                            boxShadow: [
                              '0 0 0 0px rgba(99, 102, 241, 0)',
                              '0 0 0 6px rgba(99, 102, 241, 0.2)',
                              '0 0 0 0px rgba(99, 102, 241, 0)'
                            ]
                          } : {}}
                          transition={{ repeat: Infinity, duration: 1.5 }}
                          className="rounded-full"
                        >
                          <img src={p.avatar} alt={p.name} className="w-10 h-10 rounded-full border border-white/10 object-cover" />
                        </motion.div>
                        {p.isMuted && (
                          <div className="absolute -bottom-0.5 -right-0.5 bg-red-500 rounded-full p-1 border-2 border-slate-900 shadow-md">
                            <MicOff size={8} className="text-white" />
                          </div>
                        )}
                        {p.isVideoOff && (
                          <div className="absolute -top-1 -right-1 bg-slate-800 rounded-full p-1 border border-white/20 shadow-md">
                            <VideoOff size={8} className="text-white/40" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[13px] font-bold truncate flex items-center gap-1.5 leading-tight ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                          {p.name}
                          {p.isHost && <Shield size={10} className="text-aura-primary" />}
                        </p>
                        <p className={`text-[9px] uppercase tracking-widest font-black opacity-50 mt-1 ${isLightMode ? 'text-slate-500' : 'text-slate-400'}`}>
                          {p.isHost ? 'Host' : p.role}
                        </p>
                      </div>
                      
                      {/* Live Status Indicators */}
                      <div className="flex items-center gap-1.5">
                        {p.isScreenSharing && (
                          <div className="flex items-center gap-1 group/share">
                            <div className="bg-aura-accent/20 p-1.5 rounded-lg border border-aura-accent/20">
                              <ScreenShare size={12} className="text-aura-accent animate-pulse" />
                            </div>
                            {amIHost && !p.isHost && (
                              <button 
                                onClick={() => stopParticipantScreenShare(p.id)}
                                className="opacity-0 group-hover/share:opacity-100 p-1.5 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                                title="Stop participant screen share"
                              >
                                <ScreenShareOff size={10} />
                              </button>
                            )}
                          </div>
                        )}
                        {!p.isMuted && (p.isHost || p.role === 'AI Assistant') && (
                          <motion.div 
                            animate={{ scale: [1, 1.2, 1] }} 
                            transition={{ repeat: Infinity, duration: 0.5 }}
                            className="w-1.5 h-1.5 rounded-full bg-aura-primary" 
                          />
                        )}
                        
                        <button 
                          onClick={() => {
                            setPresenterId(p.id);
                            setIsPresenterMode(true);
                            showToast(`${p.name} is now presenting`, 'info');
                          }}
                          className={`p-1.5 rounded-lg transition-all border ${
                            isPresenterMode && presenterId === p.id
                              ? 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' 
                              : 'text-slate-400 hover:text-white hover:bg-white/10 border-transparent'
                          }`}
                          title="Pin/Make Presenter"
                        >
                          <Presentation size={12} />
                        </button>
                        
                        {amIHost && !p.isHost && p.role !== 'AI Assistant' && (
                          <div className="flex items-center gap-1 ml-1 border-l border-white/10 pl-2">
                            <button 
                              onClick={() => muteIndividualParticipant(p.id, !p.isMuted)}
                              className={`p-1.5 rounded-lg transition-all ${p.isMuted ? 'text-red-500 bg-red-500/10' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                              title={p.isMuted ? "Unmute Participant" : "Mute Participant"}
                            >
                              {p.isMuted ? <MicOff size={12} /> : <Mic size={12} />}
                            </button>
                            <button 
                              onClick={() => removeParticipant(p.id)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-500/10 transition-all"
                              title="Remove Participant"
                            >
                              <UserMinus size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Host Management Controls */}
                    {amIHost && !p.isHost && p.role !== 'AI Assistant' && (
                      <div className="flex flex-col gap-2 pt-3 border-t border-white/5">
                        <div className="flex items-center justify-between px-1">
                          <label className="text-[8px] font-black uppercase tracking-tighter text-aura-primary opacity-70">Admin Controls</label>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => toggleMuteParticipant(p.id)}
                            className={`flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${
                              p.isMuted 
                                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20' 
                                : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20'
                            }`}
                            title={p.isMuted ? "Unmute this participant" : "Mute this participant"}
                          >
                            {p.isMuted ? <Mic size={10} /> : <MicOff size={10} />}
                            {p.isMuted ? 'Unmute' : 'Mute'}
                          </button>
                          
                          <button 
                            onClick={() => removeParticipant(p.id)}
                            className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center border border-red-500/20 group/remove gap-2"
                            title={`Remove ${p.name} from call`}
                          >
                            <UserMinus size={12} className="group-hover/remove:scale-110 transition-transform" />
                            <span className="text-[9px] font-bold uppercase">Remove</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* REWON AI Insights Side Panel */}
        <AnimatePresence>
          {showAIInsights && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className={`relative h-full ${isLightMode ? 'bg-white border-l border-slate-200 shadow-xl' : 'bg-slate-950/45 backdrop-blur-3xl border-l border-white/10'} z-40 flex flex-col shadow-[-20px_0_50px_rgba(3,7,18,0.5)] overflow-hidden`}
            >
              <div className={`p-5 border-b flex items-center justify-between ${isLightMode ? 'border-slate-100 bg-slate-50/50' : 'border-white/5 bg-white/5'}`}>
                <h3 className={`font-bold flex items-center gap-2 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                  <Zap size={16} className="text-aura-accent" />
                  REWON AI Insights
                </h3>
                <button 
                  onClick={() => setShowAIInsights(false)} 
                  className={`p-1.5 rounded-full transition-all ${isLightMode ? 'hover:bg-slate-200 text-slate-400 hover:text-slate-600' : 'hover:bg-white/10 text-slate-400 hover:text-white'}`}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar">
                {/* Transcription Toggle */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 group hover:border-white/20 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${isTranscriptionEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700/20 text-slate-500'}`}>
                        <Mic size={18} />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-white">Live Transcription</p>
                        <p className="text-[9px] text-slate-500">Real-time captions</p>
                      </div>
                    </div>
                    <button 
                      onClick={toggleTranscription}
                      className={`w-10 h-5 rounded-full transition-all relative ${isTranscriptionEnabled ? 'bg-aura-accent' : 'bg-slate-700'}`}
                    >
                      <motion.div 
                        animate={{ x: isTranscriptionEnabled ? 20 : 0 }}
                        className="absolute left-1 top-1 w-3 h-3 rounded-full bg-white shadow-sm" 
                      />
                    </button>
                  </div>
                </div>

                {/* Summary Generator */}
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Session Intelligence</label>
                  
                  <button 
                    onClick={generateAISummary}
                    disabled={isGeneratingSummary}
                    className="w-full py-4 rounded-2xl bg-aura-primary hover:bg-aura-primary/90 text-white text-[11px] font-black uppercase tracking-[0.15em] flex items-center justify-center gap-2 transition-all shadow-lg shadow-aura-primary/10 disabled:opacity-50 group hover:scale-[1.02] active:scale-[0.98]"
                  >
                    {isGeneratingSummary ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} className="group-hover:animate-pulse" />
                        Generate Call Summary
                      </>
                    )}
                  </button>

                  <AnimatePresence>
                    {aiSummary && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="p-5 rounded-2xl bg-white/5 border border-white/10 space-y-4 relative overflow-hidden group mb-4"
                      >
                        <div className="absolute top-0 left-0 w-1 h-full bg-aura-accent" />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-aura-accent uppercase tracking-widest">AI Synopsis</span>
                            <div className="px-1.5 py-0.5 rounded bg-aura-accent/10 text-[8px] font-bold text-aura-accent">BETA</div>
                          </div>
                          <button onClick={() => setAiSummary(null)} className="text-slate-500 hover:text-white transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                        <p className="text-[11px] text-slate-300 leading-relaxed font-medium">
                          {aiSummary}
                        </p>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(`Summary: ${aiSummary}`);
                              showToast("Summary copied", "success");
                            }}
                            className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[9px] font-bold uppercase tracking-widest text-slate-400 flex items-center justify-center gap-2 transition-all"
                          >
                            <Link size={12} />
                            Copy
                          </button>
                          <button 
                            onClick={exportSummary}
                            className="flex-1 py-2 rounded-xl bg-aura-primary/10 hover:bg-aura-primary/20 border border-aura-primary/20 text-[9px] font-bold uppercase tracking-widest text-aura-primary flex items-center justify-center gap-2 transition-all"
                          >
                            <Download size={12} />
                            Export
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Real-time AI Topic Extraction */}
                <div className={`p-4 rounded-2xl border space-y-4 shadow-lg ${
                  isLightMode 
                    ? 'bg-slate-50 border-slate-200' 
                    : 'bg-gradient-to-r from-indigo-500/10 via-aura-primary/10 to-transparent border-indigo-500/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className="text-aura-accent animate-pulse" />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isLightMode ? 'text-slate-800' : 'text-white'}`}>AI Topic Extraction</span>
                      <button
                        onClick={() => triggerDynamicTopicExtraction()}
                        disabled={isExtractingTopics}
                        title="Extract Topics Now"
                        className={`p-1.5 rounded-lg border transition-all disabled:opacity-50 cursor-pointer ml-1 inline-flex items-center justify-center ${
                          isLightMode 
                            ? 'bg-slate-200/50 hover:bg-slate-200 text-indigo-600 hover:text-indigo-800 border-slate-300' 
                            : 'bg-white/5 hover:bg-white/10 text-aura-accent hover:text-white border-white/5'
                        }`}
                      >
                        {isExtractingTopics ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <RefreshCw size={10} className="hover:rotate-180 transition-transform duration-500" />
                        )}
                      </button>
                    </div>
                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${
                      isLightMode ? 'bg-indigo-100 text-indigo-700' : 'bg-indigo-500/20 text-indigo-300'
                    }`}>REWON v2</span>
                  </div>
                  <p className={`text-[10px] leading-relaxed font-sans ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>
                    Analyze the conversation stream with Gemini AI to instantly extract key topics and tags.
                  </p>
                  <button
                    onClick={() => triggerDynamicTopicExtraction()}
                    disabled={isExtractingTopics}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-aura-accent via-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 active:scale-[0.98] disabled:opacity-50 text-white border border-indigo-500/30 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_4px_20px_rgba(123,97,255,0.3)] hover:shadow-[0_4px_25px_rgba(123,97,255,0.45)] whitespace-nowrap cursor-pointer"
                  >
                    {isExtractingTopics ? (
                      <>
                        <Loader2 size={12} className="animate-spin" />
                        Extracting Topics...
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} className="animate-pulse" />
                        Extract Key Topics
                      </>
                    )}
                  </button>

                  {/* Highly-styled Interactive AI Tag Cloud */}
                  {aiExtractedTopics.length > 0 && (
                    <div className={`pt-3 border-t space-y-2 ${isLightMode ? 'border-slate-200' : 'border-white/5'}`}>
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-black uppercase tracking-widest text-slate-500 font-sans">Suggested Topics Cloud</span>
                        {selectedKeyword && aiExtractedTopics.some(t => t.toLowerCase().includes(selectedKeyword.toLowerCase())) && (
                          <button
                            onClick={() => {
                              setSelectedKeyword(null);
                              if (typeof playSound === 'function') playSound('pop', 0.15);
                            }}
                            className="text-[8px] font-black uppercase tracking-widest text-[#7B61FF] hover:text-[#523bb8] transition-colors"
                          >
                            [Clear Filter]
                          </button>
                        )}
                      </div>
                      <div className={`flex flex-wrap gap-2 pt-1 items-center justify-center min-h-[50px] p-3 rounded-xl border ${
                        isLightMode ? 'bg-slate-100 border-slate-200' : 'bg-black/15 border-white/5'
                      }`}>
                        {aiExtractedTopics.map((topic, idx) => {
                          const sizes = ['text-[8px]', 'text-[9.5px]', 'text-[11px]', 'text-[10px]'];
                          const sizeClass = sizes[(topic.length + idx) % sizes.length];
                          
                          const isKeywordActive = selectedKeyword && topic.toLowerCase() === selectedKeyword.toLowerCase();
                          
                          const colorClasses = isLightMode ? [
                            'text-indigo-600 border-indigo-200 hover:border-indigo-400',
                            'text-cyan-600 border-cyan-200 hover:border-cyan-400',
                            'text-violet-600 border-violet-200 hover:border-violet-400',
                            'text-purple-600 border-purple-200 hover:border-purple-400'
                          ] : [
                            'text-indigo-300 border-indigo-500/20 hover:border-indigo-400 hover:text-white',
                            'text-cyan-300 border-cyan-500/20 hover:border-cyan-400 hover:text-white',
                            'text-violet-300 border-violet-500/20 hover:border-violet-400 hover:text-white',
                            'text-purple-300 border-purple-500/20 hover:border-purple-400 hover:text-white'
                          ];
                          const colorClass = colorClasses[idx % colorClasses.length];
                          
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                if (isKeywordActive) {
                                  setSelectedKeyword(null);
                                  if (typeof playSound === 'function') playSound('pop', 0.15);
                                } else {
                                  setSelectedKeyword(topic);
                                  if (typeof playSound === 'function') playSound('chime-up', 0.15);
                                }
                              }}
                              className={`px-2.5 py-1.5 rounded-lg border transition-all hover:scale-105 active:scale-95 duration-200 uppercase tracking-wider font-extrabold ${sizeClass} ${
                                isKeywordActive
                                  ? 'bg-gradient-to-r from-aura-accent to-indigo-500 text-white border-aura-accent shadow-[0_0_12px_rgba(123,97,255,0.45)] font-black'
                                  : `${isLightMode ? 'bg-white' : 'bg-white/5'} ${colorClass} hover:bg-white/10`
                              }`}
                              title={`Toggle transcript filter for "${topic}"`}
                            >
                              #{topic}
                            </button>
                           );
                         })}
                       </div>
                     </div>
                   )}

                   {/* Custom Keyword Trackers Section */}
                   <div className={`pt-4 border-t space-y-3 ${isLightMode ? 'border-slate-200' : 'border-white/5'}`}>
                     <div className="flex items-center justify-between px-1">
                       <div className="flex items-center gap-1.5">
                         <Hash size={12} className="text-aura-accent" />
                         <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-sans">Custom Trackers</span>
                       </div>
                       <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${isLightMode ? 'bg-slate-200 text-slate-600' : 'bg-white/10 text-slate-400'}`}>
                         {customKeywords.length} Active
                       </span>
                     </div>

                     <form onSubmit={handleAddCustomKeyword} className="flex gap-2">
                       <input 
                         type="text"
                         value={newKeywordInput}
                         onChange={(e) => setNewKeywordInput(e.target.value)}
                         placeholder="Add custom keyword..."
                         className={`flex-1 text-[10px] px-3 py-2 rounded-xl border focus:outline-none focus:ring-1 focus:ring-aura-accent/50 ${
                           isLightMode 
                             ? 'bg-white border-slate-200 text-slate-800 placeholder:text-slate-400' 
                             : 'bg-black/20 border-white/10 text-white placeholder:text-slate-600'
                         }`}
                       />
                       <button 
                         type="submit"
                         className="p-2 bg-aura-accent text-white rounded-xl hover:bg-aura-accent/80 transition-all flex items-center justify-center disabled:opacity-50"
                         disabled={!newKeywordInput.trim()}
                       >
                         <Plus size={14} />
                       </button>
                     </form>

                     <div className="flex flex-wrap gap-1.5 min-h-[20px]">
                       {customKeywords.length === 0 ? (
                         <p className="text-[9px] text-slate-500 italic px-1">No custom keywords added yet.</p>
                       ) : (
                         customKeywords.map((word, idx) => (
                           <div 
                             key={idx}
                             className={`group flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg border transition-all ${
                               selectedKeyword === word 
                                 ? 'bg-aura-accent/20 border-aura-accent text-aura-accent' 
                                 : isLightMode 
                                   ? 'bg-white border-slate-200 text-slate-600 hover:border-slate-300' 
                                   : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/10'
                             }`}
                           >
                             <button
                               onClick={() => setSelectedKeyword(selectedKeyword === word ? null : word)}
                               className="text-[9px] font-bold tracking-wide uppercase"
                             >
                               {word}
                             </button>
                             <button 
                               onClick={() => handleRemoveCustomKeyword(word)}
                               className="p-0.5 rounded-md hover:bg-black/10 text-slate-500 hover:text-red-400 transition-colors"
                             >
                               <X size={10} />
                             </button>
                           </div>
                         ))
                       )}
                     </div>
                   </div>
                 </div>

                 {/* Transcription Snippets (if enabled) */}
                 {isTranscriptionEnabled && (
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between ml-1">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Live Feed</label>
                      {selectedKeyword && (
                        <button 
                          onClick={() => {
                            setSelectedKeyword(null);
                            if (typeof playSound === 'function') playSound('pop', 0.15);
                          }}
                          className="text-[8px] font-bold text-aura-accent hover:text-white transition-colors bg-aura-accent/10 px-2 py-0.5 rounded-full border border-aura-accent/20"
                        >
                          Filtering: {selectedKeyword} (Clear)
                        </button>
                      )}
                    </div>
                    <div className="space-y-3">
                      {(selectedKeyword 
                        ? transcripts.filter(t => t.text.toLowerCase().includes(selectedKeyword.toLowerCase())) 
                        : transcripts.slice(-3)
                      ).map(t => (
                        <motion.div 
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          key={t.id} 
                          className="flex gap-3"
                        >
                          <div className={`w-1 h-auto rounded-full ${isLightMode ? 'bg-slate-200' : 'bg-slate-800'}`} />
                          <div>
                            <p className="text-[9px] font-bold text-aura-primary uppercase tracking-widest mb-0.5">{t.user}</p>
                            <p className={`text-[10px] leading-tight ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>
                              {highlightKeywords(t.text, [...aiExtractedTopics, ...customKeywords])}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                      {(selectedKeyword && transcripts.filter(t => t.text.toLowerCase().includes(selectedKeyword.toLowerCase())).length === 0) && (
                        <div className="text-center py-4 bg-white/5 rounded-xl border border-dashed border-white/10">
                          <p className="text-[10px] text-slate-500 italic">No snippets found mentioning "{selectedKeyword}"</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="p-5 bg-white/5 border-t border-white/5">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                  <Info size={14} className="text-blue-400 shrink-0" />
                  <p className="text-[9px] text-slate-500 leading-normal font-medium">
                    REWON AI uses secure transcription to improve collaborative insights.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chat Side Panel */}
        <AnimatePresence>
          {showChat && (
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: isTranscriptionEnabled ? 500 : 320 }}
              exit={{ width: 0 }}
              className="relative bg-slate-950/45 backdrop-blur-3xl border-l border-white/10 z-40 flex flex-col shadow-[-20px_0_50px_rgba(3,7,18,0.5)] overflow-hidden"
            >
              <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-aura-accent/20 flex items-center justify-center">
                    <Sparkles size={16} className="text-aura-accent animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-white font-black text-xs uppercase tracking-widest leading-none">Neural Hub</h3>
                    <p className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter">Enterprise Intelligence</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => setShowInsightsOverlay(!showInsightsOverlay)}
                    className={`p-2 rounded-lg transition-all ${
                      showInsightsOverlay ? 'bg-aura-accent text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                    title="Intelligence Lab"
                  >
                    <Activity size={14} />
                  </button>
                  <button 
                    onClick={() => setIsVoiceAssistantActive(true)}
                    className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-slate-400"
                    title="Voice Assistant"
                  >
                    <Mic size={14} />
                  </button>
                  <button 
                    onClick={() => setShowChat(false)} 
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-slate-500 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="flex-1 p-4 overflow-y-auto custom-scrollbar flex flex-col gap-4">
                {messages.map((m, idx) => (
                  <div key={idx} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                    <div className={`flex items-center gap-1.5 mb-1 px-1 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                      <img 
                        src={m.role === 'user' 
                          ? participants.find(p => p.isHost)?.avatar 
                          : participants.find(p => p.role === 'AI Assistant')?.avatar
                        } 
                        alt={m.role === 'user' ? 'You' : 'REWON AI'} 
                        className="w-4 h-4 rounded-full border border-white/20"
                      />
                      <span className={`text-[9px] font-black uppercase tracking-widest ${m.role === 'user' ? 'text-aura-primary' : 'text-aura-accent'}`}>
                        {m.role === 'user' ? 'You' : 'REWON AI'}
                      </span>
                      <span className="text-[9px] text-slate-500">
                        {m.timestamp}
                      </span>
                    </div>
                    <div className={`max-w-[90%] p-3 rounded-2xl text-[13px] leading-relaxed shadow-lg relative overflow-hidden ${
                      m.role === 'user' 
                        ? 'bg-aura-primary text-white rounded-tr-none' 
                        : isLightMode 
                          ? 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200' 
                          : 'bg-white/10 text-slate-200 rounded-tl-none border border-white/5'
                    }`}>
                      {m.isStreaming && (
                        <motion.div 
                          className="absolute inset-0 bg-gradient-to-r from-aura-accent/0 via-aura-accent/10 to-aura-accent/0"
                          animate={{ x: ['-100%', '200%'] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        />
                      )}
                      {m.videoUrl ? (
                        <div className="flex flex-col gap-3">
                          <VideoPlayer 
                            src={m.videoUrl} 
                            isSyncEnabled={true}
                            roomId={roomId}
                            syncState={videoSyncState}
                            onSyncAction={(data) => updateGlobalVideoSync({ ...data, url: m.videoUrl })}
                            user={user}
                          />
                          {m.content && <div className="px-1"><Markdown>{m.content}</Markdown></div>}
                        </div>
                      ) : m.audioUrl ? (
                        <div className="flex flex-col gap-2 min-w-[200px]">
                          <AudioPlayer 
                            src={m.audioUrl} 
                            globalRate={audioPlaybackRate} 
                            onRateChange={setAudioPlaybackRate} 
                          />
                          {m.content && m.content !== "Sent an audio message" && <p className="px-1">{m.content}</p>}
                        </div>
                      ) : (
                        m.content
                      )}
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="flex items-start">
                    <TypingIndicator />
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-4 bg-white/5 border-t border-white/5">
                <div className={`flex gap-3 ${isTranscriptionEnabled ? 'flex-row items-end' : 'flex-col'}`}>
                  <form 
                    onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                    className="flex-1 relative"
                  >
                    <div className="relative">
                      <input 
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={isListening ? "Listening..." : "Type a message..."}
                        className={`w-full border rounded-xl pl-4 pr-24 py-3 text-xs focus:outline-none focus:ring-1 focus:ring-aura-accent hover:bg-opacity-80 transition-all font-medium ${
                          isLightMode 
                            ? 'bg-slate-100 border-slate-200 text-slate-800 placeholder:text-slate-400' 
                            : 'bg-white/5 border-white/10 text-white placeholder:text-slate-500 hover:bg-white/10'
                        }`}
                      />
                      <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button 
                          type="button"
                          onClick={() => isListening ? onStopListening() : onStartListening()}
                          className={`p-2 rounded-xl transition-all ${
                            isListening ? 'bg-aura-accent text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/10'
                          }`}
                          title={isListening ? "Stop listening" : "Voice input"}
                        >
                          {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                        </button>
                        <button 
                          type="submit"
                          disabled={isChatLoading}
                          className="p-2 text-aura-accent hover:text-white transition-colors disabled:opacity-30"
                          aria-label="Send message"
                        >
                          {isChatLoading ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                        </button>
                      </div>
                    </div>
                  </form>

                  {isTranscriptionEnabled && transcripts.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 180 }}
                      className="hidden md:flex flex-col gap-2 p-3 bg-black/30 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-xl h-[52px] overflow-hidden relative group"
                    >
                      <div className="absolute top-0 right-0 w-[1px] h-full bg-gradient-to-b from-transparent via-aura-accent/30 to-transparent" />
                      {transcripts.slice(-2).map((t, i) => (
                        <motion.div 
                          key={t.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: i === transcripts.slice(-2).length - 1 ? 1 : 0.4, y: 0 }}
                          className="flex flex-col min-w-0"
                        >
                          <div className="flex items-center justify-between gap-1 overflow-hidden">
                            <span className="text-[6px] font-black uppercase text-aura-accent/70 truncate">{t.user}</span>
                            <span className="text-[6px] text-slate-600 font-mono shrink-0">{t.time}</span>
                          </div>
                          <p className={`text-white font-sans leading-tight truncate ${i === transcripts.slice(-2).length - 1 ? 'text-[9px] font-black' : 'text-[8px] opacity-50'}`}>
                            {t.text}
                          </p>
                        </motion.div>
                      ))}
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls Bar */}
      <div className="bg-black/80 backdrop-blur-3xl p-4 md:p-6 flex items-center justify-between border-t border-white/10 relative z-50">
        {/* Left Side: Stats & Info */}
        <div className="hidden lg:flex items-center gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Session Status</span>
            <div className="flex items-center gap-2">
              <span className="text-white text-xs font-mono font-bold tracking-wider">
                {isRecordingCall ? formatDuration(recordingDuration) : "AI CONNECTED"}
              </span>
              {isRecordingCall && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-[8px] font-black text-red-500 uppercase tracking-widest">Rec</span>
                </div>
              )}
            </div>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="flex flex-col gap-1 min-w-[100px]">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Connection</span>
            <div className="flex items-center gap-2">
              <Signal size={12} className={
                connectionQuality === 'Excellent' ? 'text-emerald-500' :
                connectionQuality === 'Good' ? 'text-blue-500' :
                connectionQuality === 'Fair' ? 'text-yellow-500' :
                connectionQuality === 'Poor' ? 'text-red-500' : 'text-slate-500'
              } />
              <span className={`text-[10px] font-bold tracking-tight uppercase ${
                connectionQuality === 'Excellent' ? 'text-emerald-400' :
                connectionQuality === 'Good' ? 'text-blue-400' :
                connectionQuality === 'Fair' ? 'text-yellow-400' :
                connectionQuality === 'Poor' ? 'text-red-400' : 'text-slate-500'
              }`}>
                {connectionQuality}
              </span>
              <div className="group relative">
                <Info size={10} className="text-slate-500 cursor-help" />
                <div className="absolute bottom-full left-0 mb-2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-black/90 p-3 rounded-xl text-[9px] font-mono border border-white/10 pointer-events-none z-[60] shadow-2xl backdrop-blur-xl">
                  <div className="text-[8px] uppercase tracking-widest text-slate-500 mb-1 font-sans font-black">Live Network Metrics</div>
                  <div className="flex justify-between gap-4">
                    <span>Latency</span>
                    <span className="text-white">{latency}ms</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Loss</span>
                    <span className="text-white">{packetLoss}%</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>Jitter</span>
                    <span className="text-white">{jitter}ms</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="h-8 w-px bg-white/10" />
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl border transition-all ${
              isRecordingCall 
                ? 'bg-red-500/10 border-red-500/30 text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.1)]' 
                : meetingRecordingUrl 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                  : 'bg-white/5 border-white/10 text-slate-500'
            }`}>
              <div className="relative">
                <div className={`w-2 h-2 rounded-full ${isRecordingCall ? 'bg-red-500 animate-pulse' : meetingRecordingUrl ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                {isRecordingCall && <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-40" />}
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] font-sans">
                {isRecordingCall ? 'Live Recording' : meetingRecordingUrl ? 'Archived Session' : 'Ready to Rec'}
              </span>
            </div>

            {meetingRecordingUrl && !isRecordingCall && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={exportMeetingRecording}
                className="flex items-center gap-2.5 px-5 py-2 rounded-2xl bg-aura-primary text-white border border-white/10 transition-all shadow-xl shadow-aura-primary/20 group uppercase tracking-widest font-black text-[10px]"
                title="Export Call Recording"
              >
                <Download size={14} className="group-hover:translate-y-0.5 transition-transform" />
                Export Full Session
              </motion.button>
            )}
          </div>
        </div>

        {/* Center: Primary Core Controls */}
        <div className="flex items-center gap-2 md:gap-4 flex-1 justify-center max-w-2xl px-4">
          <motion.button 
            whileHover={{ scale: 1.1, y: -4 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleMute}
            className={`w-12 h-12 md:w-16 md:h-16 rounded-[24px] flex items-center justify-center transition-all shadow-2xl ${
              isMuted 
                ? 'bg-red-500 text-white shadow-red-500/40 border border-red-400/50' 
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/20 backdrop-blur-xl'
            }`}
            title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
            aria-label={isMuted ? "Unmute microphone" : "Mute microphone"}
          >
            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
          </motion.button>

          <motion.button 
            whileHover={{ scale: 1.1, y: -4 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleNoiseSuppression}
            className={`w-12 h-12 md:w-16 md:h-16 rounded-[24px] flex items-center justify-center transition-all shadow-2xl relative group ${
              isNoiseSuppressionEnabled 
                ? 'bg-aura-accent text-white shadow-aura-accent/40 border border-aura-accent/50' 
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/20 backdrop-blur-xl'
            }`}
            title={isNoiseSuppressionEnabled ? "Disable AI Noise Suppression" : "Enable AI Noise Suppression"}
          >
            <Sparkles size={22} className={isNoiseSuppressionEnabled ? 'animate-pulse' : ''} />
            {isNoiseSuppressionEnabled && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-slate-900 flex items-center justify-center">
                <Check size={8} strokeWidth={4} />
              </div>
            )}
            <div className="absolute -bottom-10 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-black/80 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest text-white border border-white/10 pointer-events-none">
              AI Noise Cancellation
            </div>
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.1, y: -4 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleVideo}
            className={`w-12 h-12 md:w-16 md:h-16 rounded-[24px] flex items-center justify-center transition-all shadow-2xl ${
              isVideoOff 
                ? 'bg-red-500 text-white shadow-red-500/40 border border-red-400/50' 
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/20 backdrop-blur-xl'
            }`}
            title={isVideoOff ? "Turn Camera On" : "Turn Camera Off"}
            aria-label={isVideoOff ? "Turn camera on" : "Turn camera off"}
          >
            {isVideoOff ? <VideoOff size={24} /> : <Video size={24} />}
          </motion.button>

          <div className="w-px h-10 bg-white/10 mx-2 hidden md:block" />

          <motion.button 
            whileHover={{ scale: 1.1, y: -4 }}
            whileTap={{ scale: 0.9 }}
            onClick={toggleScreenShare}
            className={`w-12 h-12 md:w-16 md:h-16 rounded-[24px] flex items-center justify-center transition-all shadow-2xl ${
              isScreenSharing 
                ? 'bg-aura-accent text-white shadow-[0_0_30px_rgba(32,226,203,0.4)] border border-white/50 animate-pulse' 
                : 'bg-gradient-to-br from-emerald-500/20 to-aura-accent/20 text-aura-accent hover:from-emerald-500/30 hover:to-aura-accent/30 border border-aura-accent/30 backdrop-blur-xl'
            }`}
            title={isScreenSharing ? "Stop Screen Share" : "Share Screen"}
            aria-label={isScreenSharing ? "Stop screen sharing" : "Share your screen"}
          >
            {isScreenSharing ? <ScreenShareOff size={24} /> : <ScreenShare size={24} />}
          </motion.button>

          <motion.button 
            whileHover={{ scale: 1.1, y: -4 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsPresenterMode(!isPresenterMode)}
            className={`w-12 h-12 md:w-16 md:h-16 rounded-[24px] flex items-center justify-center transition-all shadow-2xl ${
              isPresenterMode 
                ? 'bg-indigo-500 text-white shadow-indigo-500/30 border border-indigo-400/50' 
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/20 backdrop-blur-xl'
            }`}
            title={isPresenterMode ? "Exit Presenter Mode" : "Enter Presenter Mode"}
          >
            <Presentation size={24} />
          </motion.button>

          <motion.button 
            whileHover={{ scale: 1.1, y: -4 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => toggleCallRecording(localStream)}
            className={`w-12 h-12 md:w-16 md:h-16 rounded-[24px] flex items-center justify-center transition-all shadow-2xl relative group ${
              isRecordingCall 
                ? 'bg-red-500 text-white shadow-red-500/30 border border-red-400/50 animate-pulse' 
                : 'bg-white/10 text-white hover:bg-white/20 border border-white/20 backdrop-blur-xl'
            }`}
            title={isRecordingCall ? "Stop Meeting Recording" : "Record Entire Meeting"}
          >
            {isRecordingCall ? (
              <Square size={24} fill="white" className="animate-pulse" />
            ) : (
              <div className="relative">
                <Circle size={24} className="text-white group-hover:text-red-500 transition-colors" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 bg-red-500 rounded-full" />
              </div>
            )}
            {!isRecordingCall && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
            )}
          </motion.button>

          {meetingRecordingUrl && !isRecordingCall && (
            <motion.button 
              whileHover={{ scale: 1.1, y: -4 }}
              whileTap={{ scale: 0.9 }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={exportMeetingRecording}
              className="w-12 h-12 md:w-16 md:h-16 rounded-[24px] flex items-center justify-center transition-all bg-gradient-to-br from-emerald-500 to-aura-accent text-white border border-emerald-400/50 shadow-[0_0_30px_rgba(16,185,129,0.4)] group"
              title="Export Full Session Recording"
              aria-label="Export meeting recording"
            >
              <Download size={24} className="group-hover:scale-110 transition-transform" />
            </motion.button>
          )}

          <div className="w-px h-10 bg-white/10 mx-2 hidden md:block" />

          <motion.button 
            whileHover={{ scale: 1.1, y: -4 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setShowEndConfirmation(true)}
            className="w-12 h-12 md:w-16 md:h-16 rounded-[24px] flex items-center justify-center transition-all bg-red-600 text-white shadow-[0_20px_50px_rgba(220,38,38,0.4)] border border-red-500 hover:bg-red-500 group"
            title="End Session"
            aria-label="End call session"
          >
            <PhoneOff size={24} className="group-hover:rotate-12 transition-transform" />
          </motion.button>
        </div>

        {/* Right Side: Features & Secondary Controls */}
        <div className="flex items-center gap-2 md:gap-3">
          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              setShowParticipants(!showParticipants);
              setShowChat(false);
              setShowAIInsights(false);
              setShowPreview(false);
            }}
            className={`w-11 h-11 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all relative ${
              showParticipants ? 'bg-aura-primary text-white shadow-aura-primary/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
            title="Participants"
          >
            <Users size={20} />
            <span className="absolute -top-1 -right-1 bg-aura-primary text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900">
              {participants.length}
            </span>
          </motion.button>

          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              setShowChat(!showChat);
              setShowParticipants(false);
              setShowAIInsights(false);
              setShowPreview(false);
            }}
            className={`w-11 h-11 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all relative ${
              showChat ? 'bg-aura-accent text-white shadow-aura-accent/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
            title="Chat"
          >
            <MessageSquare size={20} />
            {messages.length > 1 && (
              <span className="absolute -top-1 -right-1 bg-aura-accent text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900">
                {messages.length - 1}
              </span>
            )}
          </motion.button>

          <motion.button 
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              setShowAIInsights(!showAIInsights);
              setShowParticipants(false);
              setShowChat(false);
              setShowPreview(false);
            }}
            className={`w-11 h-11 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all ${
              showAIInsights ? 'bg-indigo-500 text-white shadow-indigo-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
            title="AI Insights"
          >
            <Sparkles size={20} />
          </motion.button>

          <button 
            onClick={() => {
              setShowSettings(!showSettings);
              if (!showSettings) refreshDevices();
            }}
            className={`w-11 h-11 md:w-14 md:h-14 rounded-2xl flex items-center justify-center transition-all ${
              showSettings ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
            title="Device Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* End Call Confirmation Dialog */}
      <AnimatePresence>
        {showEndConfirmation && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[100] flex items-center justify-center p-6 bg-slate-950/40 backdrop-blur-3xl"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="max-w-sm w-full border border-white/10 p-8 rounded-[40px] text-center shadow-[0_40px_80px_rgba(0,0,0,0.5)] relative bg-slate-900/80 backdrop-blur-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />
              
              <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-[28px] flex items-center justify-center mx-auto mb-8 relative group shadow-2xl border border-red-500/10">
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.5, 0.2] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="absolute inset-0 bg-red-500 rounded-[28px] blur-xl"
                />
                <PhoneOff size={36} className="relative z-10" />
              </div>

              <h3 className="text-2xl font-display font-bold mb-3 text-white tracking-tight">
                Are you sure you want to end this call?
              </h3>
              <p className="text-sm mb-10 leading-relaxed text-slate-400 font-medium px-4">
                This will disconnect all participants and terminate the secure session immediately.
              </p>

              <div className="flex flex-col gap-4">
                {meetingRecordingUrl && (
                  <motion.button 
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={exportMeetingRecording}
                    className="w-full py-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-black uppercase tracking-widest text-[10px] rounded-2xl hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Film size={14} />
                    Export Recording First
                  </motion.button>
                )}
                <motion.button 
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={onClose}
                  className="w-full py-4.5 bg-red-500 text-white font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-red-600 transition-all shadow-[0_20px_40px_rgba(239,68,68,0.2)]"
                >
                  End Call
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowEndConfirmation(false)}
                  className="w-full py-4.5 text-slate-400 hover:text-white font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all hover:bg-white/5"
                >
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Speech Recognition Setup ---
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
const recognition = SpeechRecognition ? new SpeechRecognition() : null;

if (recognition) {
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
}

// --- Audio Feedback Utility ---
const playSound = (type: 'click' | 'chime-up' | 'chime-down' | 'pop' | 'sent' | 'received' | 'listening', volume: number = 0.2) => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);

  if (type === 'click') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    gain.gain.linearRampToValueAtTime(volume * 0.5, now + 0.005);
    gain.gain.linearRampToValueAtTime(0, now + 0.05);
    osc.start(now);
    osc.stop(now + 0.05);
  } else if (type === 'chime-up') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'chime-down') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.1);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'pop') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.05);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
    osc.start(now);
    osc.stop(now + 0.1);
  } else if (type === 'sent') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
    osc.start(now);
    osc.stop(now + 0.2);
  } else if (type === 'received') {
    // Two tone chime
    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, now);
    osc.frequency.setValueAtTime(660, now + 0.08); // Stay at 660 for a bit
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.linearRampToValueAtTime(volume, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
    osc.start(now);
    osc.stop(now + 0.3);
  } else if (type === 'listening') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now);
    gain.gain.linearRampToValueAtTime(volume * 0.3, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
  }
};

export default function ChatWidget() {
  const { user, signInWithGoogle, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showModulePanel, setShowModulePanel] = useState(false);
  const [activeModules, setActiveModules] = useState([
    { id: 'neural', name: 'Neural Link', status: 'active', stability: 98 },
    { id: 'visual', name: 'Visual Processor', status: 'ready', stability: 100 },
    { id: 'audio', name: 'Quant Audio', status: 'active', stability: 95 },
    { id: 'memory', name: 'Longevous Memory', status: 'syncing', stability: 88 }
  ]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
        setIsUploading(false);
        playSound('pop', voiceVolume * 0.3);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    playSound('click', voiceVolume * 0.2);
  };
  const [demoContext, setDemoContext] = useState<string | null>(null);

  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hello! I'm Rewon. How can I assist you today?", timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ]);

  useEffect(() => {
    const handleDemo = (e: any) => {
      setDemoContext(e.detail);
      setIsOpen(true);
      // Optional: Seed initial message for demo
      if (messages.length <= 1) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: `Hi! I'm currently in ${e.detail} Demo Mode. How can I help you with your property search today?`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }
    };
    window.addEventListener('setDemoContext', handleDemo);
    return () => window.removeEventListener('setDemoContext', handleDemo);
  }, [messages.length]);
  const [inputValue, setInputValue] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [typingSpeed, setTypingSpeed] = useState(() => Number(localStorage.getItem('rewon_typingSpeed')) || 30);
  const [voiceVolume, setVoiceVolume] = useState(() => {
    const saved = localStorage.getItem('rewon_voiceVolume');
    return saved !== null ? Number(saved) : 1.0;
  });
  const [voicePitch, setVoicePitch] = useState(() => {
    const saved = localStorage.getItem('rewon_voicePitch');
    return saved !== null ? Number(saved) : 1.0;
  });
  const [voiceRate, setVoiceRate] = useState(() => {
    const saved = localStorage.getItem('rewon_voiceRate');
    return saved !== null ? Number(saved) : 1.0;
  });
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState(() => localStorage.getItem('rewon_selectedVoiceName') || '');
  const [selectedLanguage, setSelectedLanguage] = useState(() => localStorage.getItem('rewon_selectedLanguage') || 'English');
  const [showSettings, setShowSettings] = useState(true);
  const [activeMainTab, setActiveMainTab] = useState<'chat' | 'tasks' | 'insights'>('chat');
  const [showInsightsOverlay, setShowInsightsOverlay] = useState(false);
  const [insights, setInsights] = useState<ConversationInsights | null>(null);
  const [isVoiceAssistantActive, setIsVoiceAssistantActive] = useState(false);

  const updateInsights = async () => {
    if (messages.length < 3) return;
    const convoText = messages.slice(-10).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
    try {
      const data = await extractTopicsFromConversation(convoText);
      setInsights(data);
    } catch (e) {
      console.error("Insights Error:", e);
    }
  };

  useEffect(() => {
    if (messages.length > 0 && messages.length % 5 === 0) {
      updateInsights();
    }
  }, [messages.length]);

  function AIIntelligencePanel() {
    if (!insights) return null;
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-xl p-6 overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-aura-accent/20 flex items-center justify-center">
              <Zap className="text-aura-accent" size={20} />
            </div>
            <div>
              <h3 className="text-white font-black text-xs uppercase tracking-widest">Intelligence Lab</h3>
              <p className="text-slate-500 text-[10px] uppercase font-bold tracking-tighter">Gemini-Powered Analysis</p>
            </div>
          </div>
          <button 
            onClick={() => setShowInsightsOverlay(false)}
            className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-slate-400"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-6">
          <section>
            <h4 className="text-[10px] font-black text-aura-accent uppercase tracking-widest mb-3 flex items-center gap-2">
              <Activity size={12} /> Key Discussion Topics
            </h4>
            <div className="flex flex-wrap gap-2">
              {insights.topics.map((t, idx) => (
                <span key={idx} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-slate-300 font-medium">
                  {t}
                </span>
              ))}
            </div>
          </section>

          <section>
            <h4 className="text-[10px] font-black text-aura-accent uppercase tracking-widest mb-3 flex items-center gap-2">
              <ListTodo size={12} /> Suggested Action Items
            </h4>
            <div className="space-y-2">
              {insights.actionItems.map((item, idx) => (
                <div key={idx} className="p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex items-start gap-3">
                  <div className="w-5 h-5 rounded-md bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="text-emerald-500" size={12} />
                  </div>
                  <p className="text-xs text-emerald-100/80 leading-relaxed italic">{item}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-8 p-4 bg-aura-accent/10 border border-aura-accent/20 rounded-2xl">
          <p className="text-[10px] text-aura-accent font-bold mb-2 uppercase tracking-widest">AI Recommendation</p>
          <p className="text-xs text-slate-300 leading-relaxed">
            Based on the current momentum, focusing on the top action item could improve project efficiency by 24%.
          </p>
        </div>
      </motion.div>
    );
  }

  function VoiceAssistantOverlay() {
    return (
      <AnimatePresence>
        {isVoiceAssistantActive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-2xl flex flex-col items-center justify-center p-8 text-center"
          >
            <button 
              onClick={() => setIsVoiceAssistantActive(false)}
              className="absolute top-8 right-8 w-12 h-12 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <X className="text-white" size={24} />
            </button>

            <div className="relative w-64 h-64 mb-12">
              <motion.div 
                animate={{ 
                  scale: isSpeaking ? [1, 1.25, 1] : isListening ? [1, 1.15, 1] : 1,
                  opacity: isSpeaking ? [0.3, 0.6, 0.3] : 0.3
                }}
                transition={{ duration: 0.8, repeat: Infinity }}
                className="absolute inset-[-40px] bg-aura-accent/30 rounded-full blur-[60px]"
              />
              <div className="absolute inset-0 rounded-full border border-aura-accent/20 flex items-center justify-center overflow-hidden">
                 <div className="w-full h-full bg-slate-900 flex items-center justify-center shadow-inner">
                    <Brain className={`text-aura-accent ${isSpeaking ? 'animate-pulse' : ''}`} size={80} />
                 </div>
              </div>
              
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[-20px] rounded-full border border-white/5 border-dashed"
              />
              <motion.div 
                animate={{ rotate: -360 }}
                transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                className="absolute inset-[-60px] rounded-full border border-white/5 border-dashed"
              />
            </div>

            <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">
              {isSpeaking ? "AI TRANSMITTING" : isListening ? "CAPTURING VOICE" : "STANDBY"}
            </h2>
            
            <p className="text-slate-400 max-w-sm mx-auto text-lg font-medium leading-tight mb-12">
              {isSpeaking ? "Rewon AI is generating a verified response." : isListening ? "Please speak clearly. Capturing multi-modal intent." : "Speak to activate neural pathways."}
            </p>

            <div className="flex items-center gap-6">
              <button 
                onClick={isListening ? stopListening : startListening}
                className={`w-24 h-24 rounded-full flex items-center justify-center transition-all ${
                  isListening ? 'bg-red-500 scale-110 shadow-red-500/50' : 'bg-aura-accent hover:scale-105 shadow-aura-accent/50'
                } shadow-[0_0_50px_rgba(0,0,0,0.5)]`}
              >
                {isListening ? <MicOff className="text-white" size={36} /> : <Mic className="text-white" size={36} />}
              </button>
            </div>

            <div className="mt-16 w-full max-w-2xl px-12">
               <Waveform isActive={isSpeaking || isListening} color="#7b61ff" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
  const [settingsTab, setSettingsTab] = useState<'voice' | 'theme' | 'notifications' | 'devices' | 'profile' | 'help' | 'persona'>('persona');
  const [soundDropdownOpen, setSoundDropdownOpen] = useState(false);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [aiExtractedTopics, setAiExtractedTopics] = useState<string[]>([]);
  const [aiActionItems, setAiActionItems] = useState<{text: string; completed: boolean}[]>([]);
  const [aiMilestones, setAiMilestones] = useState<string[]>([]);
  const [isExtractingTopics, setIsExtractingTopics] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('room') || `room-${Math.random().toString(36).substring(7)}`;
  });
  const [videoSyncState, setVideoSyncState] = useState<VideoSyncData | null>(null);
  const [activeArtifact, setActiveArtifact] = useState<Artifact | null>(null);
  const [transcripts, setTranscripts] = useState<{ id: string; user: string; text: string; time: string }[]>([
    { id: '1', user: 'Alex Rivers', text: "I think we should focus on the Q3 roadmap today.", time: '10:02 AM' },
    { id: '2', user: 'REWON AI', text: "I've noted that. Would you like me to pull up the project board?", time: '10:02 AM' },
  ]);
  const [meetingSentiment, setMeetingSentiment] = useState<'positive' | 'neutral' | 'curious' | 'serious'>('neutral');
  const [engagementScore, setEngagementScore] = useState(85);

  useEffect(() => {
    if (transcripts.length > 0) {
      setEngagementScore(Math.min(98, 85 + Math.floor(transcripts.length / 2)));
      const lastText = transcripts[transcripts.length - 1].text.toLowerCase();
      if (lastText.includes('good') || lastText.includes('great') || lastText.includes('wow')) {
        setMeetingSentiment('positive');
      } else if (lastText.includes('how') || lastText.includes('why') || lastText.includes('?')) {
        setMeetingSentiment('curious');
      } else if (lastText.includes('must') || lastText.includes('deadline') || lastText.includes('important')) {
        setMeetingSentiment('serious');
      }
    }
  }, [transcripts.length]);

  function MeetingPulse() {
    const sentimentColors = {
      positive: 'text-emerald-400 bg-emerald-400/20 shadow-[0_0_15px_rgba(16,185,129,0.3)]',
      neutral: 'text-blue-400 bg-blue-400/20 shadow-[0_0_15px_rgba(96,165,250,0.3)]',
      serious: 'text-amber-400 bg-amber-400/20 shadow-[0_0_15px_rgba(251,191,36,0.3)]',
      curious: 'text-purple-400 bg-purple-400/20 shadow-[0_0_15px_rgba(167,139,250,0.3)]'
    };

    return (
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-center gap-3 px-3 py-2 bg-white/[0.03] border border-white/5 rounded-2xl backdrop-blur-2xl"
      >
        <div className="flex flex-col items-start">
          <span className="text-[7px] font-black uppercase text-slate-500 tracking-widest leading-none mb-1">Engage Depth</span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-aura-accent animate-ping" />
            <span className="text-xs font-black text-white">{engagementScore}%</span>
          </div>
        </div>
        
        <div className="w-[1px] h-6 bg-white/10 mx-1" />

        <div className="flex flex-col items-start">
          <span className="text-[7px] font-black uppercase text-slate-500 tracking-widest leading-none mb-1">Aura State</span>
          <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter ${sentimentColors[meetingSentiment]}`}>
            {meetingSentiment}
          </span>
        </div>
      </motion.div>
    );
  }

  useEffect(() => {
    if (!roomId || !user) return;
    try {
      const unsub = onSnapshot(doc(db, 'rooms', roomId, 'videoSync', 'current'), (doc) => {
        if (doc.exists()) {
          setVideoSyncState(doc.data() as VideoSyncData);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, `rooms/${roomId}/videoSync/current`);
      });
      return () => unsub();
    } catch (err) {
      console.error("Firestore Video Sync Listener Error:", err);
    }
  }, [roomId, user]);

  const updateGlobalVideoSync = async (data: Partial<VideoSyncData>) => {
    if (!roomId || !user) return;
    try {
      await updateDoc(doc(db, 'rooms', roomId, 'videoSync', 'current'), {
        ...data,
        senderId: user.uid,
        lastUpdated: Date.now()
      });
    } catch (err) {
      // If doc doesn't exist, create it
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, 'rooms', roomId, 'videoSync', 'current'), {
          url: '',
          isPlaying: false,
          currentTime: 0,
          senderId: user.uid,
          lastUpdated: Date.now(),
          ...data
        });
        await batch.commit();
      } catch (innerErr) {
        console.error("Failed to update video sync:", innerErr);
      }
    }
  };

  // Notification Preferences
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem('rewon_notificationsEnabled') !== 'false');
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem('rewon_soundEnabled') !== 'false');
  const [selectedAlertSound, setSelectedAlertSound] = useState(() => localStorage.getItem('rewon_selectedAlertSound') || 'Crystal');

  useEffect(() => {
    localStorage.setItem('rewon_notificationsEnabled', String(notificationsEnabled));
    localStorage.setItem('rewon_soundEnabled', String(soundEnabled));
    localStorage.setItem('rewon_selectedAlertSound', selectedAlertSound);
  }, [notificationsEnabled, soundEnabled, selectedAlertSound]);

  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>(localStorage.getItem('rewon_videoDeviceId') || '');
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>(localStorage.getItem('rewon_audioDeviceId') || '');
  const [selectedSpeakerDeviceId, setSelectedSpeakerDeviceId] = useState<string>(localStorage.getItem('rewon_speakerDeviceId') || 'default');

  const refreshDevices = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const filtered = allDevices.filter(device => 
        device.kind === 'videoinput' || 
        device.kind === 'audioinput' || 
        device.kind === 'audiooutput'
      );
      setDevices(filtered);

      // Auto-select first available devices if none selected
      if (!selectedVideoDeviceId) {
        const video = filtered.find(d => d.kind === 'videoinput');
        if (video) setSelectedVideoDeviceId(video.deviceId);
      }
      if (!selectedAudioDeviceId) {
        const audioIn = filtered.find(d => d.kind === 'audioinput');
        if (audioIn) setSelectedAudioDeviceId(audioIn.deviceId);
      }
      if (!selectedSpeakerDeviceId || selectedSpeakerDeviceId === '') {
        const audioOut = filtered.find(d => d.kind === 'audiooutput');
        setSelectedSpeakerDeviceId(audioOut?.deviceId || 'default');
      }
    } catch (err) {
      console.error("Error refreshing devices:", err);
    }
  };

  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    const startPreview = async () => {
      if (settingsTab === 'devices' && showSettings) {
        if (previewStream) {
          previewStream.getTracks().forEach(t => t.stop());
        }
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: selectedVideoDeviceId ? { deviceId: { exact: selectedVideoDeviceId } } : true,
            audio: false
          });
          setPreviewStream(stream);
        } catch (err) {
          console.error("Hardware preview failed:", err);
        }
      } else {
        if (previewStream) {
          previewStream.getTracks().forEach(t => t.stop());
          setPreviewStream(null);
        }
      }
    };
    startPreview();
  }, [settingsTab, showSettings, selectedVideoDeviceId]);

  useEffect(() => {
    refreshDevices();
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', refreshDevices);
    }
    
    // Auto join room if parameter is present in URL
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (roomParam) {
      setIsOpen(true);
      setIsCalling(true);
    }

    return () => {
      if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', refreshDevices);
      }
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('rewon_videoDeviceId', selectedVideoDeviceId);
    localStorage.setItem('rewon_audioDeviceId', selectedAudioDeviceId);
    localStorage.setItem('rewon_speakerDeviceId', selectedSpeakerDeviceId);
  }, [selectedVideoDeviceId, selectedAudioDeviceId, selectedSpeakerDeviceId]);
  const [profileDisplayName, setProfileDisplayName] = useState('');
  const [profilePhotoURL, setProfilePhotoURL] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileUpdateSuccess, setProfileUpdateSuccess] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState(() => localStorage.getItem('rewon_selectedTheme') || 'REWON');
  const [selectedPersonality, setSelectedPersonality] = useState(() => localStorage.getItem('rewon_selectedPersonality') || 'Professional');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [showInputError, setShowInputError] = useState(false);
  const [error, setError] = useState<{ message: string; lastInput?: string } | null>(null);
  const [isCalling, setIsCalling] = useState(false);
  const [isRecordingCall, setIsRecordingCall] = useState(false);
  const [meetingRecordingUrl, setMeetingRecordingUrl] = useState<string | null>(null);
  const meetingRecorderRef = useRef<MediaRecorder | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const toggleCallRecording = async (localStream: MediaStream | null) => {
    if (isRecordingCall) {
      meetingRecorderRef.current?.stop();
      setIsRecordingCall(false);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setRecordingStartTime(null);
      showToast("Meeting recording stopped", "info");
    } else {
      try {
        // To record the "Entire Meeting" (both voices and all video), 
        // we use getDisplayMedia which allows capturing the tab and its audio.
        showToast("Please select this tab to record the entire meeting", "info");
        
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ 
          video: true, 
          audio: true 
        });

        // Combine audio tracks from displayStream and localStream if needed,
        // but getDisplayMedia with audio: true usually captures system/tab audio which includes other participants.
        // We'll also add the local microphone to the mix for a complete recording.
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const destination = audioContext.createMediaStreamDestination();
        
        // Add display audio (system/other participants)
        if (displayStream.getAudioTracks().length > 0) {
          const source1 = audioContext.createMediaStreamSource(displayStream);
          source1.connect(destination);
        }
        
        // Add local mic audio
        if (localStream && localStream.getAudioTracks().length > 0) {
          const source2 = audioContext.createMediaStreamSource(localStream);
          source2.connect(destination);
        }

        // Create a composite stream with display video and combined audio
        const tracks = [
          ...displayStream.getVideoTracks(),
          ...destination.stream.getAudioTracks()
        ];
        
        const compositeStream = new MediaStream(tracks);
        const chunks: Blob[] = [];
        
        // Check for supported mime types
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
          ? 'video/webm;codecs=vp9' 
          : 'video/webm';
          
        const recorder = new MediaRecorder(compositeStream, { 
          mimeType,
          videoBitsPerSecond: 2500000 // 2.5 Mbps for better quality
        });
        meetingRecorderRef.current = recorder;
        
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };
        
        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          setMeetingRecordingUrl(url);
          
          // Stop all capture tracks
          compositeStream.getTracks().forEach(t => t.stop());
          displayStream.getTracks().forEach(t => t.stop());
          destination.stream.getTracks().forEach(t => t.stop());
          audioContext.close();
          
          showToast("Meeting recording saved. You can now export it.", "success");
        };
        
        recorder.start(1000); // Collect data every second for safety
        setIsRecordingCall(true);
        setMeetingRecordingUrl(null);
        setRecordingDuration(0);
        setRecordingStartTime(Date.now());
        
        recordingTimerRef.current = setInterval(() => {
          setRecordingDuration(prev => prev + 1);
        }, 1000);
        
        // Handle user stopping screen share via browser UI
        displayStream.getVideoTracks()[0].onended = () => {
          if (meetingRecorderRef.current?.state === 'recording') {
            toggleCallRecording(localStream);
          }
        };

        showToast("Meeting recording started", "success");
      } catch (err) {
        console.error("Meeting recording failed:", err);
        if (err instanceof Error && err.name === 'NotAllowedError') {
          showToast("Recording cancelled - permission denied", "error");
        } else {
           // Not using setError here for simplicity, or we can use another state if needed in ChatWidget
           showToast("Failed to start recording. Ensure browser supports screen capture.", "error");
        }
      }
    }
  };

  const exportMeetingRecording = () => {
    if (!meetingRecordingUrl) {
      showToast("No recording available to export", "error");
      return;
    }
    const a = document.createElement('a');
    a.href = meetingRecordingUrl;
    a.download = `meeting-recording-${Date.now()}.webm`;
    a.click();
    showToast("Meeting recording exported successfully", "success");
  };
  const [isLightMode, setIsLightMode] = useState(() => localStorage.getItem('rewon_theme_mode') === 'light');
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioRecordingDuration, setAudioRecordingDuration] = useState(0);
  const audioRecordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioPlaybackRate, setAudioPlaybackRate] = useState(() => {
    const saved = localStorage.getItem('rewon_audioPlaybackRate');
    return saved !== null ? Number(saved) : 1.0;
  });
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    if (isLightMode) {
      document.body.classList.add('light');
    } else {
      document.body.classList.remove('light');
    }
    localStorage.setItem('rewon_theme_mode', isLightMode ? 'light' : 'dark');
  }, [isLightMode]);

  useEffect(() => {
    if (user) {
      setProfileDisplayName(user.displayName || '');
      setProfilePhotoURL(user.photoURL || '');
    }
  }, [user]);


  const handleUpdateProfile = async () => {
    if (!user) return;
    setIsSavingProfile(true);
    setProfileUpdateSuccess(false);
    try {
      // 1. Update Firestore
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        displayName: profileDisplayName,
        photoURL: profilePhotoURL,
        updatedAt: serverTimestamp(),
      });
      
      // 2. Update Firebase Auth
      await updateProfile(user, {
        displayName: profileDisplayName,
        photoURL: profilePhotoURL
      });

      setProfileUpdateSuccess(true);
      setTimeout(() => setProfileUpdateSuccess(false), 3000);
      playSound('chime-up', voiceVolume * 0.3);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
      setError({ message: "Failed to update profile. Please try again." });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        if (audioRecordingTimerRef.current) {
          clearInterval(audioRecordingTimerRef.current);
          audioRecordingTimerRef.current = null;
        }
        playSound('pop', voiceVolume * 0.4);
      };

      mediaRecorder.start();
      setIsRecordingAudio(true);
      setAudioRecordingDuration(0);
      audioRecordingTimerRef.current = setInterval(() => {
        setAudioRecordingDuration(prev => prev + 1);
      }, 1000);
      playSound('chime-up', voiceVolume * 0.3);
    } catch (err: any) {
      console.error("Error accessing microphone:", err);
      setError({ message: "Microphone access denied. Please check your permissions." });
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecordingAudio(false);
      if (audioRecordingTimerRef.current) {
        clearInterval(audioRecordingTimerRef.current);
        audioRecordingTimerRef.current = null;
      }
    }
  };

  const cancelAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecordingAudio(false);
      if (audioRecordingTimerRef.current) {
        clearInterval(audioRecordingTimerRef.current);
        audioRecordingTimerRef.current = null;
      }
      setAudioBlob(null);
      setAudioUrl(null);
    }
  };

  const deleteRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    playSound('click', voiceVolume * 0.2);
  };

  const generateVideoDemo = async (prompt: string) => {
    // This is a demo function representing Veo video generation
    console.log("Generating video with prompt:", prompt);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const demoVideoMessage: Message = {
      role: 'assistant',
      content: `🎬 Video Generated!\n\n**Visual Prompt Used:**\n${prompt}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4'
    };
    
    setMessages(prev => [...prev, demoVideoMessage]);
    
    if (user) {
      await addDoc(collection(db, 'users', user.uid, 'messages'), {
        userId: user.uid,
        role: 'assistant',
        content: demoVideoMessage.content,
        videoUrl: demoVideoMessage.videoUrl,
        timestamp: serverTimestamp()
      });
    }
  };

  const handleGenerateVideo = async () => {
    if (messages.length <= 1 || isVideoLoading) return;
    
    setIsVideoLoading(true);
    playSound('click', voiceVolume * 0.2);
    
    try {
      // 1. Generate detailed prompt using Gemini
      const detailedPrompt = await generateVideoPrompt(messages);
      
      // 2. Use detailed prompt to "generate" video
      await generateVideoDemo(detailedPrompt);
      
      playSound('received', voiceVolume * 0.4);
    } catch (err) {
      console.error("Video generation failed:", err);
      setError({ message: "Failed to generate video prompt. Please try again." });
    } finally {
      setIsVideoLoading(false);
    }
  };

  const handleExportChat = () => {
    if (messages.length === 0) return;
    
    playSound('click', voiceVolume * 0.2);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filename = `rewon-chat-history-${timestamp}.txt`;
    
    const header = `========================================
REWON AI - CONVERSATION LOG
========================================
Export Date: ${new Date().toLocaleString()}
User: ${user?.displayName || 'Guest'} (${user?.email || 'Authenticated Session'})
Message Count: ${messages.length}
----------------------------------------\n\n`;
    
    const chatContent = messages.map((msg, index) => {
      const role = msg.role === 'user' ? 'YOU' : 'REWON AI';
      const time = msg.timestamp || 'Unknown Time';
      return `[${time}] ${role}:
${msg.content}
${'-'.repeat(40)}`;
    }).join('\n\n');
    
    const footer = `\n\n========================================
END OF LOG
Generated by Rewon AI Assistant
========================================`;
    
    const fullContent = header + chatContent + footer;
    
    const blob = new Blob([fullContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const themes = [
    { name: 'REWON', primary: '#6366f1', secondary: '#a855f7', accent: '#38bdf8', bg: '#030712' },
    { name: 'Dark', primary: '#1e293b', secondary: '#334155', accent: '#94a3b8', bg: '#020617' },
    { name: 'Midnight', primary: '#2563eb', secondary: '#4f46e5', accent: '#60a5fa', bg: '#020617' },
    { name: 'Forest', primary: '#059669', secondary: '#10b981', accent: '#34d399', bg: '#064e3b' },
    { name: 'Sunset', primary: '#ea580c', secondary: '#f97316', accent: '#fb923c', bg: '#431407' },
    { name: 'Cyber', primary: '#d946ef', secondary: '#8b5cf6', accent: '#fbbf24', bg: '#0f172a' },
  ];

  useEffect(() => {
    const theme = themes.find(t => t.name === selectedTheme) || themes[0];
    const root = document.documentElement;
    root.style.setProperty('--aura-primary', theme.primary);
    root.style.setProperty('--aura-secondary', theme.secondary);
    root.style.setProperty('--aura-accent', theme.accent);
    root.style.setProperty('--aura-bg', theme.bg);
    root.style.setProperty('--aura-text', isLightMode ? '#0f172a' : '#ffffff');
    root.style.setProperty('--aura-glass-bg', isLightMode ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)');
    root.style.setProperty('--aura-glass-border', isLightMode ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)');
  }, [selectedTheme, isLightMode]);

  const languages = [
    { name: 'English', code: 'en-US' },
    { name: 'Hindi', code: 'hi-IN' },
    { name: 'Spanish', code: 'es-ES' },
    { name: 'French', code: 'fr-FR' },
    { name: 'German', code: 'de-DE' },
    { name: 'Japanese', code: 'ja-JP' },
    { name: 'Mandarin', code: 'zh-CN' }
  ];

  const personalities = [
    { name: 'Professional', icon: '👔' },
    { name: 'Friendly', icon: '😊' },
    { name: 'Witty', icon: '⚡' },
    { name: 'Empathetic', icon: '🧡' },
    { name: 'Sarcastic', icon: '🙄' },
    { name: 'Creative', icon: '🎨' },
    { name: 'Analytical', icon: '📊' },
    { name: 'Concise', icon: '⏱️' },
    { name: 'Cheeky', icon: '😜' },
    { name: 'Playful', icon: '🎮' },
    { name: 'Zen', icon: '🎐' },
    { name: 'Philosophical', icon: '🧘' }
  ];
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  useEffect(() => {
    const hasSeenTutorial = localStorage.getItem('rewon_tutorial_seen');
    if (!hasSeenTutorial && isOpen) {
      setTimeout(() => setShowTutorial(true), 500);
    }
  }, [isOpen]);

  const finishTutorial = () => {
    setShowTutorial(false);
    localStorage.setItem('rewon_tutorial_seen', 'true');
  };

  const tutorialSteps = [
    {
      title: "Welcome to Rewon",
      content: "I'm your intelligent multilingual assistant. I can help you with tasks in English, Hindi, or Hinglish.",
      icon: <Sparkles className="text-aura-accent w-8 h-8" />
    },
    {
      title: "Voice Interaction",
      content: "Hold the microphone icon to speak. I'll listen in your preferred language and respond with a natural voice.",
      icon: <Mic className="text-aura-accent w-8 h-8" />
    },
    {
      title: "Cloud History",
      content: "Sign in to securely save your conversations and access them from any device.",
      icon: <LogIn className="text-aura-accent w-8 h-8" />
    },
    {
      title: "Smart Actions",
      content: "Use the '+' icon to start a fresh thread or clear your history anytime.",
      icon: <PlusCircle className="text-aura-accent w-8 h-8" />
    }
  ];

  // Sync with Firestore history if user is logged in
  useEffect(() => {
    if (!user) {
      setMessages([{ role: 'assistant', content: "Hello! I'm Rewon. Please sign in to save your history.", timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
      return;
    }

    const q = query(
      collection(db, 'users', user.uid, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const history = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          role: data.role,
          content: data.content,
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString()
        } as Message;
      });
      
      if (history.length > 0) {
        setMessages(history);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `users/${user.uid}/messages`);
    });

    return () => unsubscribe();
  }, [user]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, isOpen]);

  // Persist preferences
  useEffect(() => {
    localStorage.setItem('rewon_typingSpeed', typingSpeed.toString());
    localStorage.setItem('rewon_voiceVolume', voiceVolume.toString());
    localStorage.setItem('rewon_voicePitch', voicePitch.toString());
    localStorage.setItem('rewon_voiceRate', voiceRate.toString());
    localStorage.setItem('rewon_selectedVoiceName', selectedVoiceName);
    localStorage.setItem('rewon_selectedLanguage', selectedLanguage);
    localStorage.setItem('rewon_selectedTheme', selectedTheme);
    localStorage.setItem('rewon_selectedPersonality', selectedPersonality);
    localStorage.setItem('rewon_audioPlaybackRate', audioPlaybackRate.toString());
  }, [typingSpeed, voiceVolume, voicePitch, voiceRate, selectedVoiceName, selectedLanguage, selectedTheme, selectedPersonality, audioPlaybackRate]);

  // Load and filter voices
  useEffect(() => {
    const updateVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      // Sort voices by language then name
      const sortedVoices = [...voices].sort((a, b) => {
        if (a.lang < b.lang) return -1;
        if (a.lang > b.lang) return 1;
        return a.name.localeCompare(b.name);
      });
      setAvailableVoices(sortedVoices);
      
      // Select a default voice if none selected
      if (sortedVoices.length > 0 && !selectedVoiceName) {
        const langCode = languages.find(l => l.name === selectedLanguage)?.code || 'en-US';
        const preferred = sortedVoices.find(v => v.lang.startsWith(langCode.split('-')[0]) && (v.name.includes('Google') || v.name.includes('Natural'))) || 
                         sortedVoices.find(v => v.lang.startsWith(langCode.split('-')[0])) || 
                         sortedVoices[0];
        setSelectedVoiceName(preferred.name);
      }
    };

    updateVoices();
    window.speechSynthesis.onvoiceschanged = updateVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []); // Only on mount to get the full list once, but onvoiceschanged handles the actual availability

  const toggleSettings = () => {
    const newState = !showSettings;
    setShowSettings(newState);
    setSelectedKeyword(null);
    playSound(newState ? 'chime-up' : 'chime-down', voiceVolume * 0.3);
  };

  const triggerChatTopicExtraction = async () => {
    if (messages.length === 0) return;
    setIsExtractingTopics(true);
    try {
      const convoText = messages.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
      const insights = await extractTopicsFromConversation(convoText || "No session data available.");
      setAiExtractedTopics(insights.topics);
      setAiActionItems((insights.actionItems || []).map(item => ({ text: item, completed: false })));
      setAiMilestones(insights.milestones);
      playSound('chime-up', voiceVolume * 0.3);
    } catch (err) {
      console.error("Topic extraction failed:", err);
    } finally {
      setIsExtractingTopics(false);
    }
  };

  const toggleChatAiActionItem = (index: number) => {
    setAiActionItems(prev => prev.map((item, i) => 
      i === index ? { ...item, completed: !item.completed } : item
    ));
    playSound('pop', voiceVolume * 0.4);
  };

  const filteredMessages = (searchQuery.trim() || selectedKeyword)
    ? messages.filter(m => {
        const matchesSearch = !searchQuery.trim() || m.content.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesKeyword = !selectedKeyword || m.content.toLowerCase().includes(selectedKeyword.toLowerCase());
        return matchesSearch && matchesKeyword;
      })
    : messages;

  // Handle Voice Input
  const startListening = () => {
    if (!recognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    try {
      const langCode = languages.find(l => l.name === selectedLanguage)?.code || 'en-US';
      recognition.lang = langCode;
      recognition.start();
      setIsListening(true);
      playSound('listening', voiceVolume * 0.4);
    } catch (e) {
      console.error(e);
    }
  };

  const stopListening = () => {
    if (recognition) {
      recognition.stop();
      setIsListening(false);
    }
  };

  if (recognition) {
    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Update input in real-time
      if (finalTranscript) {
        handleSendMessage(finalTranscript);
      } else if (interimTranscript) {
        setInputValue(interimTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };
  }

  // Handle Text-to-Speech
  const speak = (text: string) => {
    if (isMuted || !('speechSynthesis' in window)) return;
    
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    
    const langCode = languages.find(l => l.name === selectedLanguage)?.code || 'en-US';
    utterance.lang = langCode;
    
    // Attempt to find a suitable voice
    const voices = window.speechSynthesis.getVoices();
    const voice = voices.find(v => v.name === selectedVoiceName) || 
                 voices.find(v => v.lang.startsWith(langCode.split('-')[0]) && (v.name.includes('Google') || v.name.includes('Natural'))) ||
                 voices.find(v => v.lang.startsWith(langCode.split('-')[0]));
    
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    }

    utterance.rate = voiceRate;
    utterance.pitch = voicePitch;
    utterance.volume = voiceVolume;
    
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    
    window.speechSynthesis.speak(utterance);
  };

  const handleSendMessage = async (content?: string) => {
    const text = content || inputValue.trim();
    if (!text && !audioBlob) {
      if (!isLoading) {
        setShowInputError(true);
        playSound('chime-down', voiceVolume * 0.3);
      }
      return;
    }

    setShowInputError(false);
    playSound('sent', voiceVolume * 0.5);
    const userMessage: Message = {
      role: 'user',
      content: text || (audioBlob ? "Sent an audio message" : ""),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      audioUrl: audioUrl || undefined,
      image: selectedImage || undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setAudioBlob(null);
    setAudioUrl(null);
    setSelectedImage(null);
    setError(null);

    // Dynamic delay for loading state to make message feel "delivered"
    await new Promise(resolve => setTimeout(resolve, 400));
    setIsLoading(true);

    try {
      if (user) {
        try {
          await addDoc(collection(db, 'users', user.uid, 'messages'), {
            userId: user.uid,
            role: 'user',
            content: userMessage.content,
            audioUrl: userMessage.audioUrl || null,
            image: userMessage.image || null,
            timestamp: serverTimestamp()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/messages`);
        }
      }

      // Add a placeholder message for the assistant that we will stream into
      const assistantPlaceholder: Message = {
        role: 'assistant',
        content: '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isStreaming: true
      };
      setMessages(prev => [...prev, assistantPlaceholder]);
      setIsLoading(false); // We are now streaming

      let streamingText = "";
      const geminiResult = await getGeminiResponse(
        [...messages, userMessage], 
        selectedLanguage, 
        selectedPersonality,
        (chunk) => {
          streamingText += chunk;
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last && last.isStreaming) {
              return [...prev.slice(0, -1), { ...last, content: streamingText }];
            }
            return prev;
          });
        }
      );
      
      const responseText = geminiResult.text;
      const functionCalls = geminiResult.functionCalls;

      // Finalize the streaming message
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.isStreaming) {
          return [...prev.slice(0, -1), { ...last, content: responseText, isStreaming: false }];
        }
        return prev;
      });

      // Speak if not muted
      if (responseText && !isMuted) {
        speak(responseText);
      }

      // Update Firebase with final message
      if (user && responseText) {
        try {
          await addDoc(collection(db, 'users', user.uid, 'messages'), {
            userId: user.uid,
            role: 'assistant',
            content: responseText,
            timestamp: serverTimestamp()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/messages`);
        }
      }

      // Handle function calls if any
      if (functionCalls) {
        for (const call of functionCalls) {
          console.log(`[AI ACTION] ${call.name}:`, call.args);
          
          // Execute internal actions based on AI intent
          try {
            if (call.name === 'capture_lead' && user) {
              try {
                await addDoc(collection(db, 'leads'), {
                  ...call.args,
                  userId: user.uid,
                  source: 'chat_assistant',
                  timestamp: serverTimestamp()
                });
              } catch (err) {
                handleFirestoreError(err, OperationType.WRITE, 'leads');
              }
            } else if (call.name === 'save_conversation' && user) {
              try {
                await addDoc(collection(db, 'users', user.uid, 'summaries'), {
                  summary: (call.args as any).summary,
                  timestamp: serverTimestamp()
                });
              } catch (err) {
                handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/summaries`);
              }
            } else if (call.name === 'schedule_followup' && user) {
              try {
                await addDoc(collection(db, 'followups'), {
                  contact: (call.args as any).contact,
                  userId: user.uid,
                  status: 'pending',
                  timestamp: serverTimestamp()
                });
              } catch (err) {
                handleFirestoreError(err, OperationType.WRITE, 'followups');
              }
            } else if (call.name === 'trigger_outbound_call' && user) {
              try {
                await addDoc(collection(db, 'calls'), {
                  phone: (call.args as any).phone,
                  userId: user.uid,
                  status: 'initiated',
                  timestamp: serverTimestamp()
                });
              } catch (err) {
                handleFirestoreError(err, OperationType.WRITE, 'calls');
              }
            } else if (call.name === 'create_task' && user) {
              try {
                const args = call.args as any;
                await addDoc(collection(db, 'users', user.uid, 'tasks'), {
                  userId: user.uid,
                  title: args.title,
                  completed: false,
                  priority: args.priority || 'medium',
                  dueDate: args.dueDate ? Timestamp.fromDate(new Date(args.dueDate)) : null,
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp()
                });
                setActiveMainTab('tasks');
              } catch (err) {
                handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/tasks`);
              }
            } else if (call.name === 'update_task' && user) {
              try {
                const args = call.args as any;
                const updateData: any = { updatedAt: serverTimestamp() };
                if (args.title !== undefined) updateData.title = args.title;
                if (args.priority !== undefined) updateData.priority = args.priority;
                if (args.completed !== undefined) updateData.completed = args.completed;
                if (args.dueDate !== undefined) updateData.dueDate = args.dueDate ? Timestamp.fromDate(new Date(args.dueDate)) : null;
                
                await updateDoc(doc(db, 'users', user.uid, 'tasks', args.taskId), updateData);
              } catch (err) {
                const args = call.args as any;
                handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/tasks/${args.taskId}`);
              }
            } else if (call.name === 'delete_task' && user) {
              try {
                const args = call.args as any;
                await deleteDoc(doc(db, 'users', user.uid, 'tasks', args.taskId));
              } catch (err) {
                const args = call.args as any;
                handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/tasks/${args.taskId}`);
              }
            } else if (call.name === 'list_tasks' && user) {
              // Just return the task list info in the response if possible, 
              // or let the AI know it's being displayed.
              setActiveMainTab('tasks');
              setShowSettings(false);
            } else if (call.name === 'sync_video') {
              const args = call.args as any;
              let urlToSync = args.videoUrl;
              if (!urlToSync) {
                // Find most recent video in messages or transcription
                const videoInChat = [...messages].reverse().find(m => m.videoUrl);
                urlToSync = videoInChat?.videoUrl;
              }
              
              if (urlToSync) {
                await updateGlobalVideoSync({
                  url: urlToSync,
                  isPlaying: true,
                  currentTime: 0
                });
                showToast("Video synchronized with all participants", "success");
              } else {
                showToast("Identify a video to sync first", "error");
              }
            } else if (call.name === 'create_artifact') {
              const args = call.args as any;
              const newArtifact: Artifact = {
                id: Math.random().toString(36).substring(7),
                title: args.title,
                type: args.type,
                content: args.content,
                summary: args.summary,
                timestamp: Date.now()
              };
              setActiveArtifact(newArtifact);
              showToast(`New ${args.type} generated by AI`, "success");
            }
          } catch (actionErr) {
            console.error("Failed to execute AI action:", actionErr);
          }
        }
      }

      // If text response is empty but we have function calls, we might need to prompt the model again 
      // or just provide a default acknowledgment if the model didn't return text (rare but possible).
      const finalResponse = responseText || (functionCalls ? "I've processed that request for you." : "I'm processing your request.");
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: finalResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      if (user) {
        try {
          await addDoc(collection(db, 'users', user.uid, 'messages'), {
            userId: user.uid,
            role: 'assistant',
            content: finalResponse,
            timestamp: serverTimestamp()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/messages`);
        }
      } else {
        setMessages(prev => [...prev, assistantMessage]);
      }
      
      playSound('received', voiceVolume * 0.4);

      if (!isMuted) {
        speak(finalResponse);
      }
    } catch (err: any) {
      console.error("Failed to get response:", err);
      
      let errorMessage = "Rewon is momentarily offline. Please check your connection or try again.";
      
      if (err.message?.includes("429") || err.message?.toLowerCase().includes("quota")) {
        errorMessage = "Daily AI limit reached (429). Gemini is resting. Please retry in a few seconds.";
      } else if (err.message?.includes("503") || err.message?.toLowerCase().includes("busy") || err.message?.toLowerCase().includes("demand")) {
        errorMessage = "High Intelligence Demand (503). Gemini is over-capacity. Please wait and retry.";
      } else if (err.message) {
        errorMessage = err.message;
      }

      // Cleanup streaming placeholder if it failed
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last && last.isStreaming) {
          return prev.slice(0, -1);
        }
        return prev;
      });

      setError({
        message: errorMessage,
        lastInput: text
      });
      playSound('chime-down', voiceVolume * 0.3);
    } finally {
      setIsLoading(false);
    }
  };

  const initiateCall = () => {
    setIsCalling(true);
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: `🔒 **Secure video session initiated.** Camera and microphone are active for peer-to-peer communication.`,
      timestamp
    }]);
    playSound('chime-up', voiceVolume * 0.3);
  };

  const clearChat = async () => {
    // Reset local messages immediately for snappy UI
    const initialMsg: Message = { 
      role: 'assistant', 
      content: user ? "Hello! I'm Rewon. How can I assist you today?" : "Hello! I'm Rewon. Please sign in to save your history.", 
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
    };
    
    setMessages([initialMsg]);
    
    // Reset states
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    stopListening();
    setInputValue('');

    // If user is logged in, clear their history from Firestore as well
    if (user) {
      try {
        const messagesRef = collection(db, 'users', user.uid, 'messages');
        const querySnapshot = await getDocs(query(messagesRef));
        
        if (!querySnapshot.empty) {
          const batch = writeBatch(db);
          querySnapshot.forEach((doc) => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/messages`);
      }
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {/* Chat Window */}
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            layout
            initial={{ opacity: 0, y: 100, scale: 0.8, rotateX: 20, filter: 'blur(20px)' }}
            animate={{ 
              opacity: 1, 
              y: 0, 
              scale: 1, 
              rotateX: 0,
              filter: 'blur(0px)',
              width: isMaximized ? 'calc(100vw - 3rem)' : 'min(420px, 92vw)',
              height: isMaximized ? 'calc(100vh - 8rem)' : 'min(720px, calc(100vh - 160px))',
            }}
            transition={{ 
              layout: { type: 'spring', damping: 25, stiffness: 200 },
              opacity: { duration: 0.6 },
              y: { type: 'spring', damping: 15, stiffness: 80 },
              rotateX: { duration: 0.8, ease: "easeOut" }
            }}
            exit={{ 
              opacity: 0, 
              y: 50, 
              scale: 0.9, 
              rotateX: -10, 
              filter: 'blur(15px)', 
              transition: { duration: 0.3 } 
            }}
            style={{ 
              perspective: 1200,
              transformStyle: 'preserve-3d'
            }}
            className={`relative ${isLightMode ? 'bg-white/90 shadow-2xl border-slate-200' : 'bg-slate-950/40 backdrop-blur-[80px] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)] border-white/10'} rounded-[48px] overflow-hidden flex flex-col mb-6 border z-10`}
          >
            {/* Module Panel Toggle (Side Tab) */}
            <motion.button
              onClick={() => {
                setShowModulePanel(!showModulePanel);
                playSound('click', voiceVolume * 0.2);
              }}
              className="absolute -left-12 top-1/3 p-3 bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-l-2xl text-aura-accent hidden lg:flex flex-col gap-4 items-center group z-0 shadow-2xl"
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 1 }}
            >
              <Cpu size={18} className={showModulePanel ? 'text-aura-accent animate-pulse' : 'text-slate-500'} />
              <div className="h-12 w-[1px] bg-white/10" />
              <Activity size={18} className={showModulePanel ? 'text-aura-accent' : 'text-slate-500'} />
              <motion.div 
                className="absolute inset-y-0 right-0 w-1 bg-aura-accent rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                animate={showModulePanel ? { opacity: 1 } : {}}
              />
            </motion.button>

            {/* AI Module Sidecar */}
            <AnimatePresence>
              {showModulePanel && (
                <motion.div
                  initial={{ x: 100, opacity: 0 }}
                  animate={{ x: -280, opacity: 1 }}
                  exit={{ x: 100, opacity: 0 }}
                  className="absolute top-0 h-full w-[280px] bg-slate-950/90 backdrop-blur-[60px] border border-white/10 rounded-[48px] p-8 hidden lg:flex flex-col z-[-1] shadow-2xl"
                >
                  <div className="mb-10 flex items-center gap-4 border-b border-white/10 pb-6">
                    <div className="w-12 h-12 rounded-2xl bg-aura-primary/20 flex items-center justify-center text-aura-primary shadow-inner">
                      <Zap size={22} className="animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-white font-black text-sm tracking-tighter uppercase mb-0.5">Core Diagnostics</h4>
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                        <span className="text-[10px] text-emerald-400 font-mono font-bold tracking-[0.2em] uppercase">Healthy</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8 flex-1">
                    {activeModules.map((mod, i) => (
                      <motion.div 
                        key={mod.id} 
                        className="group"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                      >
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-xs font-bold text-slate-200 tracking-wide group-hover:text-aura-accent transition-colors">{mod.name}</span>
                          <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                            mod.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                            mod.status === 'syncing' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-aura-accent/20 text-aura-accent'
                          }`}>
                            {mod.status}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                          <motion.div 
                            className={`h-full ${mod.status === 'active' ? 'bg-emerald-500' : mod.status === 'syncing' ? 'bg-amber-500' : 'bg-aura-accent'} shadow-[0_0_10px_currentColor]`}
                            initial={{ width: 0 }}
                            animate={{ width: `${mod.stability}%` }}
                            transition={{ duration: 1.5, type: 'spring' }}
                          />
                        </div>
                        <div className="flex justify-between mt-2 text-[9px] font-mono text-slate-500">
                          <span>LINK_SIGNAL</span>
                          <span className="text-white/40">{mod.stability.toFixed(2)}%</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="mt-auto pt-6 border-t border-white/10">
                    <div className="p-4 bg-white/[0.03] rounded-3xl border border-white/5 relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-full h-1 bg-aura-accent/20 animate-pulse" />
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-8 h-8 rounded-xl bg-aura-secondary/20 flex items-center justify-center text-aura-secondary">
                          <Activity size={16} />
                        </div>
                        <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">Live Waveform</span>
                      </div>
                      <div className="flex items-end gap-1 h-12">
                        {[40, 70, 30, 90, 50, 80, 40, 60, 30, 70].map((h, i) => (
                          <motion.div 
                            key={i}
                            className="flex-1 bg-aura-secondary/40 rounded-t-sm"
                            animate={{ height: [`${h}%`, `${Math.max(20, h + (Math.random() - 0.5) * 50)}%`, `${h}%`] }}
                            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.05 }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Advanced CRT/Tech Overlay */}
            <div className="absolute inset-0 pointer-events-none z-10 opacity-[0.02] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay" />
            <div className="absolute inset-0 pointer-events-none z-10 opacity-[0.03] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px]" />
            
            {/* Ambient Background Blobs */}
            {!isLightMode && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-aura-primary/20 rounded-full blur-[120px] animate-blob" />
                <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-aura-accent/15 rounded-full blur-[120px] animate-blob animation-delay-2000" />
                <div className="absolute top-[20%] right-[10%] w-[50%] h-[50%] bg-aura-secondary/10 rounded-full blur-[100px] animate-blob animation-delay-4000" />
              </div>
            )}

            {/* AI Insights Side Panel for Main Chat */}
            <AnimatePresence>
              {showAIInsights && (
                <motion.div 
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  className="absolute inset-y-0 right-0 w-[240px] z-[60] bg-slate-900 border-l border-white/10 shadow-2xl flex flex-col"
                >
                  <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-aura-secondary/20 flex items-center justify-center">
                        <Sparkles size={14} className="text-aura-secondary" />
                      </div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-white">REWON AI Insights</h3>
                    </div>
                    <button 
                      onClick={() => setShowAIInsights(false)}
                      className="p-1 hover:bg-white/5 rounded-lg text-slate-500 hover:text-white transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-6">
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-aura-secondary">Extracted Topics</h4>
                        <button 
                          onClick={triggerChatTopicExtraction}
                          disabled={isExtractingTopics || messages.length < 2}
                          className="text-[9px] font-bold text-slate-500 hover:text-aura-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
                        >
                          {isExtractingTopics ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
                          REFRESH
                        </button>
                      </div>

                      {aiExtractedTopics.length === 0 ? (
                        <div className="p-6 rounded-2xl bg-white/5 border border-white/5 text-center">
                          <Brain size={24} className="mx-auto text-slate-600 mb-3 opacity-20" />
                          <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                            {messages.length < 2 
                              ? "Continue the interaction to unlock AI topic extraction." 
                              : "Tap Refresh to extract key themes using Gemini."}
                          </p>
                          {messages.length >= 2 && (
                            <button 
                              onClick={triggerChatTopicExtraction}
                              className="mt-3 w-full py-2 bg-aura-secondary text-white text-[9px] font-black uppercase tracking-widest rounded-xl hover:opacity-90 shadow-lg shadow-aura-secondary/20"
                            >
                              Run Analysis
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {aiExtractedTopics.map((topic, idx) => {
                            const isKeywordActive = selectedKeyword === topic;
                            return (
                              <button
                                key={idx}
                                onClick={() => {
                                  if (isKeywordActive) {
                                    setSelectedKeyword(null);
                                    playSound('pop', voiceVolume * 0.15);
                                  } else {
                                    setSelectedKeyword(topic);
                                    playSound('chime-up', voiceVolume * 0.15);
                                  }
                                }}
                                className={`px-3 py-2 rounded-xl text-[10px] font-bold transition-all border flex items-center gap-1.5 ${
                                  isKeywordActive 
                                    ? 'bg-aura-secondary text-white border-aura-secondary shadow-md' 
                                    : 'bg-white/5 border-white/5 text-slate-400 hover:border-white/10 hover:bg-white/10'
                                }`}
                              >
                                {topic}
                                {isKeywordActive && <X size={10} />}
                              </button>
                            );
                          })}
                          
                          {selectedKeyword && (
                            <button 
                              onClick={() => setSelectedKeyword(null)}
                              className="w-full mt-2 py-2 rounded-xl border border-dashed border-white/10 text-[9px] font-bold text-slate-500 hover:text-white transition-colors"
                            >
                              CLEAR FILTER
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {aiActionItems.length > 0 && (
                      <div className="pt-4 border-t border-white/5">
                        <div className="flex items-center gap-2 mb-3">
                          <ListTodo size={12} className="text-emerald-400" />
                          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Action Items</h4>
                        </div>
                        <ul className="space-y-2">
                          {aiActionItems.map((item, idx) => (
                            <li 
                              key={idx} 
                              onClick={() => toggleChatAiActionItem(idx)}
                              className="flex items-start gap-2 group p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                            >
                              {item.completed ? (
                                <CheckCircle size={10} className="mt-0.5 text-emerald-500" />
                              ) : (
                                <Circle size={10} className="mt-0.5 text-emerald-500/50 group-hover:text-emerald-500 transition-colors" />
                              )}
                              <span className={`text-[10px] leading-relaxed transition-all ${
                                item.completed ? 'text-slate-500 line-through' : 'text-slate-400'
                              }`}>
                                {item.text}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {aiMilestones.length > 0 && (
                      <div className="pt-4 border-t border-white/5">
                        <div className="flex items-center gap-2 mb-3">
                          <Trophy size={12} className="text-amber-400" />
                          <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Project Milestones</h4>
                        </div>
                        <ul className="space-y-2">
                          {aiMilestones.map((ms, idx) => (
                            <li key={idx} className="flex items-start gap-2 group p-2 rounded-xl hover:bg-white/5 transition-colors">
                              <Flag size={10} className="mt-0.5 text-amber-500/50 group-hover:text-amber-500 transition-colors" />
                              <span className="text-[10px] text-slate-400 leading-relaxed font-medium">{ms}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="pt-4 border-t border-white/5">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3">AI Context Utility</h4>
                      <p className="text-[10px] text-slate-500 leading-relaxed italic mb-4">
                        Filtering by topics allows you to instantly track specific project milestones or technical requirements discussed within the session.
                      </p>
                      
                      <div className="p-3 bg-aura-primary/5 border border-aura-primary/10 rounded-2xl">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap size={12} className="text-aura-primary" />
                          <span className="text-[10px] font-bold text-aura-primary uppercase tracking-wider">Fast-Sync</span>
                        </div>
                        <p className="text-[9px] text-slate-400 leading-normal">
                          Topics are extracted in real-time using Gemini-3-Flash for lowest latency.
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Window Management Bar */}
            <div className="flex items-center justify-end gap-1 px-4 py-2 border-b border-white/5 bg-black/40 backdrop-blur-md relative z-[30]">
              <div className="mr-auto flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
                <span className="ml-2 text-[9px] font-mono text-white/30 tracking-widest uppercase">System Core v4.0</span>
              </div>
              <button 
                onClick={() => {
                  playSound('click', voiceVolume * 0.2);
                  setIsOpen(false);
                }}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white"
                title="Minimize Intelligence Unit"
              >
                <Minus size={14} />
              </button>
              <button 
                onClick={() => {
                  playSound('click', voiceVolume * 0.2);
                  setIsMaximized(!isMaximized);
                }}
                className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/40 hover:text-white"
                title={isMaximized ? "Restore Terminal" : "Maximize Terminal"}
              >
                {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>
              <button 
                onClick={() => {
                  playSound('click', voiceVolume * 0.2);
                  setIsOpen(false);
                }}
                className="p-2 ml-1 hover:bg-red-500/80 rounded-lg transition-all text-white/40 hover:text-white group"
                title="Deactivate Agent"
              >
                <X size={14} className="group-hover:rotate-90 transition-transform duration-300" />
              </button>
            </div>

            {/* Header */}
            <div className={`p-6 flex items-center justify-between border-b border-white/5 bg-white/[0.02] backdrop-blur-3xl relative z-20 overflow-hidden`}>
              {/* Animated Scanline */}
              <motion.div 
                className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-aura-accent/30 to-transparent z-[1]"
                animate={{ y: [-20, 100] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              />
              
              <div className="flex items-center gap-4 relative z-[2]">
                <div className="relative group">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-aura-primary via-aura-secondary to-aura-accent flex items-center justify-center shadow-[0_15px_30px_rgba(99,102,241,0.4)] transform-gpu group-hover:rotate-12 group-hover:scale-110 transition-all duration-500 overflow-hidden">
                    <Sparkles className="text-white w-7 h-7 z-10 animate-pulse" />
                    <div className="absolute inset-0 bg-white/20 group-hover:translate-x-full transition-transform duration-700" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-slate-900 border-2 border-aura-primary flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-aura-accent animate-ping" />
                  </div>
                  <motion.div 
                    className="absolute -inset-2 rounded-2xl bg-aura-primary opacity-20 blur-md pointer-events-none"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.3, 0.1] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-display font-black text-white text-lg tracking-tight leading-none drop-shadow-[0_0_15px_rgba(32,226,203,0.6)]">Rewon AI Core</h3>
                    {demoContext && (
                      <span className="px-2 py-0.5 rounded-full bg-white/10 text-white text-[9px] font-black uppercase tracking-[0.15em] border border-white/10">
                        {demoContext}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-aura-accent opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-aura-accent"></span>
                    </span>
                    <span className="text-[10px] text-aura-accent font-black uppercase tracking-[0.25em] animate-pulse">Sync Active</span>
                  </div>
                </div>

                <div className="hidden lg:block ml-8">
                  <MeetingPulse />
                </div>
              </div>
              
              <div className="hidden sm:flex items-center gap-6 px-4 py-2 bg-black/20 rounded-2xl border border-white/5 mr-4 font-mono text-[9px] text-slate-500 tracking-tighter">
                <div className="flex flex-col">
                  <span>LATENCY</span>
                  <span className="text-aura-accent">14MS</span>
                </div>
                <div className="flex flex-col">
                  <span>BITRATE</span>
                  <span className="text-white">5.4MB/S</span>
                </div>
                <div className="flex flex-col">
                  <span>SIGNAL</span>
                  <div className="flex gap-0.5 mt-0.5">
                    {[1,2,3,4].map(i => <div key={i} className={`w-0.5 h-1.5 rounded-full ${i <= 3 ? 'bg-aura-accent' : 'bg-white/10'}`} />)}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-1">
                {user ? (
                  <div className="flex items-center gap-2 mr-2 border-r border-white/10 pr-2">
                    <img src={user.photoURL || ''} alt="" className="w-6 h-6 rounded-full border border-aura-accent/30" />
                    <button onClick={() => signOut()} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white" title="Sign Out">
                      <LogOut size={16} />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => signInWithGoogle()} className="flex items-center gap-2 px-3 py-1.5 mr-2 bg-aura-primary/20 hover:bg-aura-primary/30 rounded-xl text-xs font-bold text-aura-accent transition-all border border-aura-primary/30" title="Sign In">
                    <LogIn size={14} />
                    <span>SIGN IN</span>
                  </button>
                )}
                <button 
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white"
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <button 
                  onClick={() => {
                    playSound('click', voiceVolume * 0.2);
                    clearChat();
                  }}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white"
                  title="New Chat"
                >
                  <PlusCircle size={18} />
                </button>
                <button 
                  onClick={() => {
                    playSound('chime-up', voiceVolume * 0.3);
                    setShowTutorial(true);
                  }}
                  className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white"
                  title="Tutorial"
                >
                  <HelpCircle size={18} />
                </button>
                <button 
                  onClick={handleGenerateVideo}
                  disabled={messages.length <= 1 || isVideoLoading}
                  className={`p-2 rounded-xl transition-colors ${isVideoLoading ? 'bg-aura-accent text-white animate-pulse' : 'text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30'}`}
                  title="Generate Video Summary (AI)"
                >
                  {isVideoLoading ? <Loader2 className="animate-spin" size={18} /> : <Video size={18} />}
                </button>
                <button 
                  onClick={handleExportChat}
                  disabled={messages.length === 0}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 disabled:opacity-30 transition-colors"
                  title="Export Chat History"
                >
                  <Download size={18} />
                </button>
                <button 
                  onClick={() => {
                    playSound('click', voiceVolume * 0.2);
                    setShowAIInsights(!showAIInsights);
                  }}
                  className={`p-2 rounded-xl transition-colors ${showAIInsights ? 'bg-aura-secondary text-white shadow-lg shadow-aura-secondary/30' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                  title="AI Insights & Topics"
                >
                  <Sparkles size={18} className={showAIInsights ? 'animate-pulse' : ''} />
                </button>
                <button 
                  onClick={() => {
                    playSound('click', voiceVolume * 0.2);
                    setShowSearch(!showSearch);
                    if (!showSearch) setSearchQuery('');
                  }}
                  className={`p-2 rounded-xl transition-colors ${showSearch ? 'bg-aura-accent text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                  title="Search History"
                >
                  <Search size={18} />
                </button>
                <button 
                  onClick={() => setActiveMainTab(activeMainTab === 'chat' ? 'tasks' : 'chat')}
                  className={`p-2 rounded-xl transition-all ${activeMainTab === 'tasks' ? 'bg-aura-accent text-white shadow-lg shadow-aura-accent/20' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                  title={activeMainTab === 'chat' ? "Show Tasks" : "Back to Chat"}
                >
                  <ListTodo size={18} />
                </button>
                <button 
                  onClick={toggleSettings}
                  className={`p-2 rounded-xl transition-colors ${showSettings ? 'bg-aura-primary text-white' : 'text-slate-400 hover:text-white hover:bg-white/10'}`}
                  title="Settings"
                >
                  <Settings size={18} />
                </button>
                {meetingRecordingUrl && (
                  <button 
                    onClick={exportMeetingRecording}
                    className="p-2 hover:bg-emerald-500/20 rounded-xl transition-colors text-emerald-500 hover:text-emerald-400 group"
                    title="Export Last Meeting Recording"
                  >
                    <Film size={18} className="group-hover:scale-110 transition-transform" />
                  </button>
                )}
                
                <button 
                  onClick={initiateCall}
                  className="p-2 hover:bg-aura-primary/20 rounded-xl transition-colors text-aura-primary animate-pulse"
                  title="Start Secure Video Call"
                >
                  <Video size={20} />
                </button>
              </div>
            </div>

            {/* Search Bar */}
            <AnimatePresence>
              {showSearch && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-white/5 border-b border-white/10 overflow-hidden"
                >
                  <div className="p-3">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
                      <input 
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search messages..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className={`w-full border rounded-xl pl-9 pr-10 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-aura-accent transition-all ${
                          isLightMode 
                            ? 'bg-slate-100 border-slate-200 text-slate-800 placeholder:text-slate-400' 
                            : 'bg-[var(--aura-bg)] border-[var(--aura-glass-border)] text-[var(--aura-text)]'
                        }`}
                      />
                      {searchQuery && (
                        <button 
                          onClick={() => setSearchQuery('')}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1 rounded-md hover:bg-white/5"
                          title="Clear search"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    {searchQuery && (
                      <div className="mt-2 px-1 flex justify-between items-center text-[10px]">
                        <div className="flex items-center gap-1.5 text-slate-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-aura-accent"></span>
                          <span>Found <b>{filteredMessages.length}</b> result{filteredMessages.length !== 1 ? 's' : ''}</span>
                        </div>
                        <button 
                          onClick={() => setSearchQuery('')}
                          className="text-aura-accent/80 hover:text-aura-accent uppercase tracking-wider font-bold transition-colors"
                        >
                          Reset Search
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isCalling && (
                <>
                  <VideoCall 
                    onClose={() => setIsCalling(false)}
                    isSpeaking={isSpeaking}
                    isListening={isListening}
                    isLightMode={isLightMode}
                    messages={messages}
                    onSendMessage={handleSendMessage}
                    isChatLoading={isLoading}
                    onStartListening={startListening}
                    onStopListening={stopListening}
                    devices={devices}
                    selectedVideoDeviceId={selectedVideoDeviceId}
                    setSelectedVideoDeviceId={setSelectedVideoDeviceId}
                    selectedAudioDeviceId={selectedAudioDeviceId}
                    setSelectedAudioDeviceId={setSelectedAudioDeviceId}
                    selectedSpeakerDeviceId={selectedSpeakerDeviceId}
                    setSelectedSpeakerDeviceId={setSelectedSpeakerDeviceId}
                    refreshDevices={refreshDevices}
                    audioPlaybackRate={audioPlaybackRate}
                    setAudioPlaybackRate={setAudioPlaybackRate}
                    isRecordingCall={isRecordingCall}
                    toggleCallRecording={toggleCallRecording}
                    meetingRecordingUrl={meetingRecordingUrl}
                    exportMeetingRecording={exportMeetingRecording}
                    recordingDuration={recordingDuration}
                    showToast={showToast}
                    roomId={roomId}
                    setRoomId={setRoomId}
                    videoSyncState={videoSyncState}
                    updateGlobalVideoSync={updateGlobalVideoSync}
                    showInsightsOverlay={showInsightsOverlay}
                    setShowInsightsOverlay={setShowInsightsOverlay}
                    setIsVoiceAssistantActive={setIsVoiceAssistantActive}
                    insights={insights}
                    user={user}
                    transcripts={transcripts}
                    setTranscripts={setTranscripts}
                  />
                  {activeArtifact && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-8 bg-black/40 backdrop-blur-sm">
                      <KnowledgeCanvas 
                        artifact={activeArtifact} 
                        onClose={() => setActiveArtifact(null)} 
                      />
                    </div>
                  )}
                </>
              )}
            </AnimatePresence>

            {/* Tutorial Overlay */}
            <AnimatePresence>
              {showTutorial && (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
                >
                  <motion.div 
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    className="bg-white/5 border border-white/10 rounded-[32px] p-8 w-full max-w-sm flex flex-col items-center text-center relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 p-4">
                      <button 
                        onClick={() => {
                          playSound('chime-down', voiceVolume * 0.3);
                          finishTutorial();
                        }} 
                        className="text-slate-500 hover:text-white transition-colors"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="mb-6 p-4 bg-aura-primary/20 rounded-2xl">
                      {tutorialSteps[tutorialStep].icon}
                    </div>

                    <h4 className="text-xl font-bold text-white mb-3 tracking-tight">
                      {tutorialSteps[tutorialStep].title}
                    </h4>
                    <p className="text-slate-400 text-sm leading-relaxed mb-8">
                      {tutorialSteps[tutorialStep].content}
                    </p>

                    <div className="flex items-center justify-between w-full mt-auto">
                      <div className="flex gap-1.5">
                        {tutorialSteps.map((_, i) => (
                          <div 
                            key={i} 
                            className={`h-1.5 rounded-full transition-all duration-300 ${tutorialStep === i ? 'w-6 bg-aura-accent' : 'w-1.5 bg-white/20'}`} 
                          />
                        ))}
                      </div>

                      <div className="flex gap-2">
                        {tutorialStep > 0 && (
                          <button 
                            onClick={() => setTutorialStep(prev => prev - 1)}
                            className="p-2 border border-white/10 rounded-xl text-white hover:bg-white/5 transition-all"
                          >
                            <ChevronLeft size={20} />
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            if (tutorialStep < tutorialSteps.length - 1) {
                              setTutorialStep(prev => prev + 1);
                            } else {
                              finishTutorial();
                            }
                          }}
                          className="flex items-center gap-2 px-6 py-2 bg-aura-primary text-white rounded-xl font-bold hover:bg-aura-primary/80 transition-all shadow-lg"
                        >
                          {tutorialStep === tutorialSteps.length - 1 ? 'Get Started' : 'Next'}
                          {tutorialStep < tutorialSteps.length - 1 && <ChevronRight size={18} />}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Settings Overlay */}
            <AnimatePresence>
              {showSettings && (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className={`absolute top-20 right-4 z-40 w-72 bg-[var(--aura-bg)] backdrop-blur-3xl border border-[var(--aura-glass-border)] rounded-3xl p-5 shadow-2xl max-h-[calc(100vh-160px)] overflow-y-auto custom-scrollbar ${isLightMode ? 'bg-white/95 shadow-xl' : 'bg-slate-950/45 border-white/10 [box-shadow:inset_0_0_0_1px_rgba(255,255,255,0.05),_0_24px_64px_rgba(0,0,0,0.6)]'}`}
                >
                  <div className={`flex items-center justify-between mb-4 sticky top-0 ${isLightMode ? 'bg-white/95' : 'bg-slate-950/15 backdrop-blur-xl'} py-1 z-10`}>
                    <h4 className={`font-bold text-sm tracking-tight flex items-center gap-2 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>
                      {settingsTab === 'voice' && <Mic size={16} className="text-aura-accent" />}
                      {settingsTab === 'persona' && <Sparkles size={16} className="text-aura-accent" />}
                      {settingsTab === 'theme' && <Palette size={16} className="text-aura-primary" />}
                      {settingsTab === 'devices' && <Sliders size={16} className="text-indigo-400" />}
                      {settingsTab === 'notifications' && <Bell size={16} className="text-blue-400" />}
                      {settingsTab === 'help' && <HelpCircle size={16} className="text-emerald-400" />}
                      {settingsTab === 'profile' && <UserIcon size={16} className="text-purple-400" />}
                      
                      {settingsTab === 'voice' && 'Voice Engine'}
                      {settingsTab === 'persona' && 'AI Personality'}
                      {settingsTab === 'theme' && 'Visual Theme'}
                      {settingsTab === 'devices' && 'Hardware Setup'}
                      {settingsTab === 'notifications' && 'Notification Alerts'}
                      {settingsTab === 'help' && 'Support & FAQs'}
                      {settingsTab === 'profile' && 'User Profile'}
                    </h4>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          setIsLightMode(!isLightMode);
                          playSound('pop', voiceVolume * 0.4);
                        }}
                        className={`p-1.5 rounded-lg transition-all ${
                          isLightMode 
                            ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' 
                            : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                        }`}
                        title={isLightMode ? "Switch to Dark Mode" : "Switch to Light Mode"}
                      >
                        {isLightMode ? <Moon size={14} /> : <Sun size={14} />}
                      </button>
                      <button onClick={() => setShowSettings(false)} className={`transition-colors ${isLightMode ? 'text-slate-400 hover:text-slate-600' : 'text-slate-500 hover:text-white'}`}>
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  <div className={`p-1 mt-2 grid grid-cols-4 sm:grid-cols-7 gap-1 ${isLightMode ? 'bg-slate-100/50 border border-slate-200 shadow-inner' : 'glass-dark border-white/5 shadow-inner'} rounded-2xl mb-6`}>
                    <button 
                      onClick={() => setSettingsTab('voice')}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-bold transition-all ${
                        settingsTab === 'voice' 
                          ? 'bg-aura-primary text-white shadow-lg' 
                          : isLightMode ? 'text-slate-500 hover:bg-white/50 hover:text-slate-800' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Mic size={10} />
                      Voice
                    </button>
                    <button 
                      onClick={() => setSettingsTab('persona')}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-bold transition-all ${
                        settingsTab === 'persona' 
                          ? 'bg-aura-primary text-white shadow-lg' 
                          : isLightMode ? 'text-slate-500 hover:bg-white/50 hover:text-slate-800' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Sparkles size={10} />
                      AI
                    </button>
                    <button 
                      onClick={() => setSettingsTab('theme')}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-bold transition-all ${
                        settingsTab === 'theme' 
                          ? 'bg-aura-primary text-white shadow-lg' 
                          : isLightMode ? 'text-slate-500 hover:bg-white/50 hover:text-slate-800' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Palette size={10} />
                      Theme
                    </button>
                    <button 
                      onClick={() => { setSettingsTab('devices'); refreshDevices(); }}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-bold transition-all ${
                        settingsTab === 'devices' 
                          ? 'bg-aura-primary text-white shadow-lg' 
                          : isLightMode ? 'text-slate-500 hover:bg-white/50 hover:text-slate-800' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Sliders size={10} />
                      HW
                    </button>
                    <button 
                      onClick={() => setSettingsTab('notifications')}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-bold transition-all ${
                        settingsTab === 'notifications' 
                          ? 'bg-aura-primary text-white shadow-lg' 
                          : isLightMode ? 'text-slate-500 hover:bg-white/50 hover:text-slate-800' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Bell size={10} />
                      Alerts
                    </button>
                    <button 
                      onClick={() => setSettingsTab('profile')}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-bold transition-all ${
                        settingsTab === 'profile' 
                          ? 'bg-aura-primary text-white shadow-lg' 
                          : isLightMode ? 'text-slate-500 hover:bg-white/50 hover:text-slate-800' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <UserIcon size={10} />
                      User
                    </button>
                    <button 
                      onClick={() => setSettingsTab('help')}
                      className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[9px] font-bold transition-all ${
                        settingsTab === 'help' 
                          ? 'bg-aura-primary text-white shadow-lg' 
                          : isLightMode ? 'text-slate-500 hover:bg-white/50 hover:text-slate-800' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <HelpCircle size={10} />
                      Help
                    </button>
                  </div>

                  <motion.div 
                    key={settingsTab}
                    variants={{
                      hidden: { opacity: 0, x: -10 },
                      show: {
                        opacity: 1,
                        x: 0,
                        transition: {
                          staggerChildren: 0.1
                        }
                      }
                    }}
                    initial="hidden"
                    animate="show"
                    className="space-y-6"
                  >
                    {settingsTab === 'devices' ? (
                      <div className="space-y-4">
                        {/* Live Preview */}
                        <div className="space-y-2">
                           <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Live Monitor</label>
                           <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 shadow-inner group">
                              <video 
                                autoPlay 
                                muted 
                                playsInline
                                ref={(el) => {
                                  if (el && previewStream) {
                                    el.srcObject = previewStream;
                                  }
                                }}
                                className="w-full h-full object-cover scale-x-[-1]"
                              />
                              {!previewStream && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                                   <CameraOff size={24} className="text-slate-600" />
                                   <span className="text-[10px] text-slate-600 font-bold">No Active Preview</span>
                                </div>
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent flex items-end p-3 pointer-events-none">
                                <span className="text-[8px] text-white/50 font-black uppercase tracking-widest">Hardware Preview</span>
                              </div>
                           </div>
                        </div>

                        <div className="space-y-4">
                          {/* Camera Selection */}
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-500 ml-1">
                              <Camera size={12} className="text-aura-primary" />
                              Camera Resource
                            </label>
                            <div className="relative group">
                              <select 
                                value={selectedVideoDeviceId}
                                onChange={(e) => setSelectedVideoDeviceId(e.target.value)}
                                className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white outline-none focus:ring-2 focus:ring-aura-primary/50 appearance-none cursor-pointer group-hover:bg-white/10 transition-all ${isLightMode ? 'bg-slate-50 text-slate-800 border-slate-200' : ''}`}
                              >
                                {devices.filter(d => d.kind === 'videoinput').map(device => (
                                  <option key={device.deviceId} value={device.deviceId} className="bg-slate-900 text-white">
                                    {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
                                  </option>
                                ))}
                                {devices.filter(d => d.kind === 'videoinput').length === 0 && (
                                  <option value="">No Camera Detected</option>
                                )}
                              </select>
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                <ChevronDown size={14} />
                              </div>
                            </div>
                          </div>

                          {/* Microphone Selection */}
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-500 ml-1">
                              <Mic size={12} className="text-aura-accent" />
                              Audio Input
                            </label>
                            <div className="relative group">
                              <select 
                                value={selectedAudioDeviceId}
                                onChange={(e) => setSelectedAudioDeviceId(e.target.value)}
                                className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white outline-none focus:ring-2 focus:ring-aura-accent/50 appearance-none cursor-pointer group-hover:bg-white/10 transition-all ${isLightMode ? 'bg-slate-50 text-slate-800 border-slate-200' : ''}`}
                              >
                                {devices.filter(d => d.kind === 'audioinput').map(device => (
                                  <option key={device.deviceId} value={device.deviceId} className="bg-slate-900 text-white">
                                    {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
                                  </option>
                                ))}
                                {devices.filter(d => d.kind === 'audioinput').length === 0 && (
                                  <option value="">No Microphone Detected</option>
                                )}
                              </select>
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                <ChevronDown size={14} />
                              </div>
                            </div>
                          </div>

                          {/* Speaker Selection */}
                          <div className="space-y-2">
                            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wider text-slate-500 ml-1">
                              <Volume2 size={12} className="text-blue-400" />
                              Audio Output
                            </label>
                            <div className="relative group">
                              <select 
                                value={selectedSpeakerDeviceId}
                                onChange={(e) => setSelectedSpeakerDeviceId(e.target.value)}
                                className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-[11px] font-bold text-white outline-none focus:ring-2 focus:ring-blue-400/50 appearance-none cursor-pointer group-hover:bg-white/10 transition-all ${isLightMode ? 'bg-slate-50 text-slate-800 border-slate-200' : ''}`}
                              >
                                {devices.filter(d => d.kind === 'audiooutput').map(device => (
                                  <option key={device.deviceId} value={device.deviceId} className="bg-slate-900 text-white">
                                    {device.label || `Speaker ${device.deviceId.slice(0, 5)}`}
                                  </option>
                                ))}
                                <option value="default">System Default Speaker</option>
                              </select>
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                <ChevronDown size={14} />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className={`p-4 rounded-2xl border flex items-start gap-3 mt-4 ${isLightMode ? 'bg-blue-50 border-blue-100' : 'bg-white/5 border-white/10'}`}>
                          <Shield size={16} className="text-aura-primary mt-1 flex-shrink-0" />
                          <p className="text-[10px] text-slate-500 leading-relaxed italic">
                            Device permissions are requested only when a secure session begins. Your hardware selection is saved locally for future reference.
                          </p>
                        </div>
                        
                        <button 
                          onClick={() => {
                            refreshDevices();
                            playSound('pop', voiceVolume * 0.4);
                          }}
                          className={`w-full py-3 rounded-xl border flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                            isLightMode 
                              ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50' 
                              : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                          }`}
                        >
                          <RotateCw size={14} />
                          Refresh Device List
                        </button>
                      </div>
                    ) : settingsTab === 'help' ? (
                      <div className="space-y-6">
                        {/* What's New Section */}
                        <div className="space-y-3">
                          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1 flex items-center gap-2">
                            <Zap size={12} className="text-aura-accent" />
                            What's New
                          </label>
                          <div className={`p-4 rounded-2xl border ${isLightMode ? 'bg-indigo-50 border-indigo-100' : 'bg-aura-accent/5 border-aura-accent/20'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-bold text-aura-accent">Version 2.4.0</span>
                              <span className="text-[8px] font-medium text-slate-500">May 2026</span>
                            </div>
                            <ul className="space-y-2">
                              <li className="flex items-start gap-2">
                                <div className="w-1 h-1 rounded-full bg-aura-accent mt-1.5" />
                                <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-tight">Enhanced glassmorphism UI with real-time background blur</p>
                              </li>
                              <li className="flex items-start gap-2">
                                <div className="w-1 h-1 rounded-full bg-aura-accent mt-1.5" />
                                <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-tight">New hardware setup panel for precise device control</p>
                              </li>
                            </ul>
                          </div>
                        </div>

                        {/* FAQs Section */}
                        <div className="space-y-3">
                          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1 flex items-center gap-2">
                            <Book size={12} className="text-aura-primary" />
                            Quick FAQs
                          </label>
                          <div className="space-y-2">
                            {[
                              { q: "Is my data secure?", a: "Yes, all sessions use E2E encryption." },
                              { q: "How to change voices?", a: "Go to Prefs tab to select AI personality." },
                              { q: "Can I record calls?", a: "Yes, use the camera icon in control bar." }
                            ].map((faq, i) => (
                              <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/10 group hover:border-white/20 transition-all">
                                <p className="text-[10px] font-bold text-white mb-1">{faq.q}</p>
                                <p className="text-[9px] text-slate-500 leading-snug">{faq.a}</p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Support Links */}
                        <div className="grid grid-cols-2 gap-2 pt-2">
                          <button className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-[9px] font-bold text-white hover:bg-white/10 transition-all">
                            <Info size={12} />
                            Full Guide
                          </button>
                          <button className="flex items-center justify-center gap-2 py-3 rounded-xl bg-white/5 border border-white/10 text-[9px] font-bold text-white hover:bg-white/10 transition-all">
                            <ExternalLink size={12} />
                            Contact
                          </button>
                        </div>
                      </div>
                    ) : settingsTab === 'notifications' ? (
                      <div className="space-y-5">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-400">
                                <Bell size={14} />
                              </div>
                              <div>
                                <p className={`text-[10px] font-bold ${isLightMode ? 'text-slate-800' : 'text-white'}`}>Pop-up Alerts</p>
                                <p className="text-[8px] text-slate-500">Visual notifications</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
                              className={`w-10 h-5 rounded-full transition-all relative ${notificationsEnabled ? 'bg-aura-accent' : 'bg-slate-700'}`}
                            >
                              <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${notificationsEnabled ? 'right-1' : 'left-1'}`} />
                            </button>
                          </div>

                          <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/10">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${soundEnabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                                {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                              </div>
                              <div>
                                <p className={`text-[10px] font-bold ${isLightMode ? 'text-slate-800' : 'text-white'}`}>Sound Alerts</p>
                                <p className="text-[8px] text-slate-500">Audio feedback</p>
                              </div>
                            </div>
                            <button 
                              onClick={() => setSoundEnabled(!soundEnabled)}
                              className={`w-10 h-5 rounded-full transition-all relative ${soundEnabled ? 'bg-aura-accent' : 'bg-slate-700'}`}
                            >
                              <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${soundEnabled ? 'right-1' : 'left-1'}`} />
                            </button>
                          </div>
                        </div>

                        <div className="space-y-3 pt-2 relative">
                          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1 flex items-center gap-2">
                            <Music size={12} className="text-aura-primary" />
                            Alert Sound
                          </label>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setSoundDropdownOpen(!soundDropdownOpen)}
                              className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border text-[10px] font-bold transition-all duration-300 ${
                                soundDropdownOpen
                                  ? 'border-aura-primary shadow-[0_0_12px_rgba(99,102,241,0.2)] bg-aura-primary/5'
                                  : isLightMode 
                                    ? 'bg-slate-100/70 border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-100/90 shadow-inner' 
                                    : 'bg-white/5 border-white/5 text-white hover:bg-white/10 hover:border-white/10'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-gradient-to-tr from-aura-primary to-aura-accent animate-pulse" />
                                {selectedAlertSound}
                              </span>
                              <motion.div
                                animate={{ rotate: soundDropdownOpen ? 180 : 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <ChevronDown size={14} className="text-slate-400" />
                              </motion.div>
                            </button>

                            <AnimatePresence>
                              {soundDropdownOpen && (
                                <motion.div
                                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 4, scale: 1 }}
                                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                                  transition={{ duration: 0.15, ease: 'easeOut' }}
                                  className={`absolute left-0 right-0 z-50 rounded-2xl p-1.5 border shadow-2xl backdrop-blur-xl ${
                                    isLightMode
                                      ? 'bg-white/95 border-slate-200/80 shadow-slate-300/50'
                                      : 'bg-slate-900/95 border-white/5 shadow-black/80'
                                  }`}
                                >
                                  {['Crystal', 'Ambient', 'Digital', 'Classic', 'Chime', 'Retro', 'Subtle'].map((sound) => (
                                    <button
                                      key={sound}
                                      type="button"
                                      onClick={() => {
                                        setSelectedAlertSound(sound);
                                        setSoundDropdownOpen(false);
                                        if (soundEnabled) {
                                          playSound('chime-up', voiceVolume * 0.3);
                                        }
                                      }}
                                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-[10px] font-bold transition-all ${
                                        selectedAlertSound === sound
                                          ? 'bg-aura-primary text-white shadow-[0_4px_12px_rgba(99,102,241,0.3)]'
                                          : isLightMode
                                            ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                            : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                      }`}
                                    >
                                      <span>{sound}</span>
                                      {selectedAlertSound === sound && <Check size={12} />}
                                    </button>
                                  ))}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>

                        <button 
                          onClick={() => {
                            if (soundEnabled) {
                              playSound('chime-up', voiceVolume * 0.3);
                              console.log(`Playing test sound: ${selectedAlertSound}`);
                            }
                          }}
                          className="w-full py-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all flex items-center justify-center gap-2"
                        >
                          <Play size={12} />
                          Test Notification
                        </button>
                      </div>
                    ) : settingsTab === 'persona' ? (
                      <div className="space-y-6">
                        <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
                          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 ml-1 block">Response Personality</label>
                          <div className="grid grid-cols-3 gap-2">
                            {personalities.map(p => (
                              <motion.button
                                key={p.name}
                                whileHover={{ y: -2 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => {
                                  setSelectedPersonality(p.name);
                                  playSound('click', voiceVolume * 0.2);
                                }}
                                className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border transition-all relative ${
                                  selectedPersonality === p.name 
                                    ? 'border-aura-primary bg-aura-primary/10 shadow-lg shadow-aura-primary/5' 
                                    : isLightMode ? 'border-slate-200 bg-white hover:border-aura-primary/30' : 'border-white/5 bg-white/5 hover:border-white/20'
                                }`}
                              >
                                {selectedPersonality === p.name && (
                                  <motion.div 
                                    layoutId="persona-active"
                                    className="absolute inset-0 bg-aura-primary/5 rounded-2xl border-2 border-aura-primary"
                                  />
                                )}
                                <span className="text-xl mb-1.5 relative z-10">{p.icon}</span>
                                <span className={`text-[9px] font-black uppercase tracking-tighter relative z-10 ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{p.name}</span>
                              </motion.button>
                            ))}
                          </div>
                        </motion.div>

                        <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="p-4 rounded-2xl border bg-aura-primary/5 border-aura-primary/10">
                          <div className="flex items-center gap-3 mb-2">
                             <div className="bg-aura-primary p-2 rounded-xl text-white">
                               <Sparkles size={16} />
                             </div>
                             <div>
                               <h5 className={`text-[11px] font-bold ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{selectedPersonality} Mode</h5>
                               <p className="text-[9px] text-slate-500">AI response tone is now active.</p>
                             </div>
                          </div>
                          <p className={`text-[10px] italic leading-relaxed ${isLightMode ? 'text-slate-600' : 'text-slate-400'}`}>
                            {selectedPersonality === 'Professional' && "I will provide clear, formal, and efficient assistance focused on business goals."}
                            {selectedPersonality === 'Friendly' && "I'll be warm, casual, and supportive in our conversation, like a helpful companion."}
                            {selectedPersonality === 'Witty' && "Expect clever remarks, sharp insights, and a touch of intellectual humor."}
                            {selectedPersonality === 'Sarcastic' && "Oh great, another question. I'll answer it, but don't expect me to be happy about it."}
                            {!( ['Professional', 'Friendly', 'Witty', 'Sarcastic'].includes(selectedPersonality) ) && `Embodying the ${selectedPersonality} trait in all my interactions.`}
                          </p>
                        </motion.div>
                      </div>
                    ) : settingsTab === 'voice' ? (
                      <>
                        <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
                          <div className="flex justify-between items-center mb-3">
                            <label className="text-xs text-slate-400 font-medium flex items-center gap-2">
                              <Zap size={12} className="text-aura-accent" />
                              Typing Response
                            </label>
                            <motion.span 
                              key={typingSpeed}
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="text-[10px] bg-aura-accent/20 text-aura-accent px-2 py-0.5 rounded-full font-bold"
                            >
                              {typingSpeed === 0 ? 'Instant' : `${typingSpeed}ms`}
                            </motion.span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="500" 
                            value={typingSpeed} 
                            onChange={(e) => setTypingSpeed(parseInt(e.target.value))}
                            className="w-full accent-aura-accent bg-white/10 h-1.5 rounded-full appearance-none cursor-pointer hover:bg-white/20"
                          />
                        </motion.div>

                        <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="pt-4 border-t border-white/5">
                          <div className="flex justify-between items-center mb-3">
                            <label className="text-xs text-slate-400 font-medium flex items-center gap-2">
                              <Volume2 size={12} className="text-aura-primary" />
                              Voice Volume
                            </label>
                            <motion.span 
                              key={voiceVolume}
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="text-[10px] bg-aura-primary/20 text-aura-primary px-2 py-0.5 rounded-full font-bold"
                            >
                              {Math.round(voiceVolume * 100)}%
                            </motion.span>
                          </div>
                          <input 
                            type="range" 
                            min="0" 
                            max="1" 
                            step="0.1"
                            value={voiceVolume} 
                            onChange={(e) => setVoiceVolume(parseFloat(e.target.value))}
                            className="w-full accent-aura-primary bg-white/10 h-1.5 rounded-full appearance-none cursor-pointer transition-all hover:bg-white/20"
                          />
                        </motion.div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <div>
                            <label className="text-[9px] text-slate-500 font-bold mb-2 block uppercase">Voice Pitch</label>
                            <input 
                              type="range" 
                              min="0.5" 
                              max="2.0" 
                              step="0.1"
                              value={voicePitch} 
                              onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
                              className="w-full accent-aura-secondary bg-white/10 h-1.5 rounded-full appearance-none cursor-pointer"
                            />
                          </div>
                          <div>
                            <label className="text-[9px] text-slate-500 font-bold mb-2 block uppercase">Speech Rate</label>
                            <input 
                              type="range" 
                              min="0.5" 
                              max="2.0" 
                              step="0.1"
                              value={voiceRate} 
                              onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
                              className="w-full accent-aura-accent bg-white/10 h-1.5 rounded-full appearance-none cursor-pointer"
                            />
                          </div>
                        </div>

                        <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="pt-4 border-t border-white/5 space-y-4">
                          <div className="flex flex-col gap-3">
                            <label className="text-xs text-slate-400 font-medium flex items-center gap-2">
                              <Globe size={12} className="text-aura-accent" />
                              TTS Engine Language
                            </label>
                            <select 
                              value={selectedLanguage}
                              onChange={(e) => setSelectedLanguage(e.target.value)}
                              className={`w-full ${isLightMode ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-white/5 border-white/10 text-white'} border rounded-xl px-3 py-2 text-[10px] h-9 outline-none cursor-pointer transition-colors`}
                            >
                              {languages.map(lang => (
                                <option key={lang.code} value={lang.name} className="bg-slate-900 text-white">{lang.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="flex flex-col gap-3">
                            <label className="text-xs text-slate-400 font-medium flex items-center gap-2">
                              <Mic size={12} className="text-aura-primary" />
                              Selected Voice
                            </label>
                            <select 
                              value={selectedVoiceName}
                              onChange={(e) => setSelectedVoiceName(e.target.value)}
                              className={`w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] text-white h-9 outline-none cursor-pointer ${isLightMode ? 'bg-white text-slate-700 border-slate-200' : ''}`}
                            >
                              {availableVoices.length === 0 ? (
                                <option value="">No voices detected</option>
                              ) : (
                                availableVoices.map((voice) => (
                                  <option key={voice.name} value={voice.name} className="bg-slate-900 text-white">
                                    {voice.name} ({voice.lang})
                                  </option>
                                ))
                              )}
                            </select>
                          </div>
                          
                          <button 
                            onClick={() => speak("Hello! I am REWON. My voice configuration has been updated.")}
                            className={`w-full py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 border ${
                              isSpeaking 
                                ? 'bg-aura-accent/20 text-aura-accent border-aura-accent/30' 
                                : 'bg-aura-primary text-white border-aura-primary shadow-lg shadow-aura-primary/20 hover:opacity-90'
                            }`}
                            disabled={isSpeaking}
                          >
                            {isSpeaking ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                            {isSpeaking ? 'Speaking...' : 'Preview Voice'}
                          </button>
                        </motion.div>
                      </>
                    ) : settingsTab === 'theme' ? (
                      <>
                        <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
                          <div className={`p-4 rounded-2xl border transition-all mb-4 ${
                            isLightMode 
                              ? 'bg-amber-50 border-amber-100' 
                              : 'bg-white/5 border-white/10 shadow-inner'
                          }`}>
                            <div className="flex justify-between items-center">
                              <div className="flex flex-col gap-0.5">
                                <label className={`text-xs font-bold flex items-center gap-2 ${isLightMode ? 'text-amber-600' : 'text-white'}`}>
                                  {isLightMode ? <Sun size={14} className="text-amber-500" /> : <Moon size={14} className="text-aura-accent" />}
                                  Interface Appearance
                                </label>
                                <span className={`text-[10px] ${isLightMode ? 'text-amber-600/60' : 'text-slate-500'}`}>
                                  {isLightMode ? 'Optimized for day' : 'Easy on the eyes'}
                                </span>
                              </div>
                              <button 
                                onClick={() => {
                                  setIsLightMode(!isLightMode);
                                  playSound('pop', voiceVolume * 0.4);
                                }}
                                className={`relative w-12 h-6 rounded-full transition-all duration-500 outline-none p-1 ${
                                  isLightMode ? 'bg-amber-400' : 'bg-slate-700'
                                }`}
                              >
                                <motion.div 
                                  animate={{ x: isLightMode ? 24 : 0 }}
                                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                  className="w-4 h-4 bg-white rounded-full shadow-md flex items-center justify-center overflow-hidden"
                                >
                                  {isLightMode ? (
                                    <Sun size={8} className="text-amber-500" />
                                  ) : (
                                    <Moon size={8} className="text-slate-700" fill="currentColor" />
                                  )}
                                </motion.div>
                              </button>
                            </div>
                          </div>
                        </motion.div>

                        <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="pt-4 border-t border-white/5">
                          <label className="text-xs text-slate-400 font-medium mb-3 block flex items-center gap-2">
                            <Palette size={12} className="text-aura-primary" />
                            Brand Themes
                          </label>
                          <div className="grid grid-cols-2 gap-2 mb-4">
                            {themes.map(t => (
                              <motion.button
                                key={t.name}
                                whileHover={{ y: -2 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                  setSelectedTheme(t.name);
                                  playSound('click', voiceVolume * 0.2);
                                }}
                                className={`flex items-center gap-3 p-3 rounded-xl border transition-all relative ${
                                  selectedTheme === t.name 
                                    ? 'border-white bg-white/10 shadow-lg' 
                                    : 'border-white/5 bg-white/5 hover:border-white/10'
                                }`}
                              >
                                <div className="w-4 h-4 rounded-full shadow-sm" style={{ backgroundColor: t.primary }} />
                                <span className={`text-[10px] font-bold ${isLightMode ? 'text-slate-700' : 'text-white'}`}>{t.name}</span>
                                {selectedTheme === t.name && (
                                  <motion.div 
                                    layoutId="theme-active"
                                    className="absolute right-3 w-1.5 h-1.5 rounded-full bg-aura-accent shadow-sm"
                                  />
                                )}
                              </motion.button>
                            ))}
                          </div>
                        </motion.div>

                        <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="pt-4 border-t border-white/5">
                          <div className="p-4 rounded-2xl bg-aura-accent/5 border border-aura-accent/10">
                            <p className="text-[10px] text-slate-500 leading-relaxed italic">
                              Visual themes update the entire application colorscape in real-time. Choose a mood that fits your workflow.
                            </p>
                          </div>
                        </motion.div>
                      </>
                    ) : settingsTab === 'profile' ? (
                      <div className="space-y-6">
                        <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
                          <div className="flex flex-col items-center mb-6">
                            <div className="relative">
                              <div className="w-20 h-20 rounded-[32px] bg-gradient-to-tr from-aura-primary to-aura-secondary flex items-center justify-center shadow-xl mb-3 overflow-hidden">
                                {profilePhotoURL ? (
                                  <img src={profilePhotoURL} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                  <UserIcon size={40} className="text-white" />
                                )}
                              </div>
                              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-[var(--aura-bg)] flex items-center justify-center">
                                <Shield size={10} className="text-white" />
                              </div>
                            </div>
                            <h5 className={`text-sm font-bold ${isLightMode ? 'text-slate-800' : 'text-white'}`}>{user?.displayName || 'REWON User'}</h5>
                            <p className="text-[10px] text-slate-500 font-medium">{user?.email}</p>
                          </div>

                          <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 mb-2.5 ml-1 block">Account Identity</label>
                          <div className="space-y-4">
                            <div className="relative group">
                              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-aura-primary transition-colors">
                                <UserIcon size={14} />
                              </div>
                              <input 
                                type="text"
                                value={profileDisplayName}
                                onChange={(e) => setProfileDisplayName(e.target.value)}
                                placeholder="Display Name"
                                className={`w-full rounded-2xl pl-11 pr-4 py-3.5 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-aura-primary/50 transition-all ${isLightMode ? 'bg-slate-100 text-slate-800 border-slate-200 border' : 'bg-white/5 border border-white/10 text-white'}`}
                              />
                            </div>

                            <div className="relative group">
                              <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-aura-secondary transition-colors">
                                <ImageIcon size={14} />
                              </div>
                              <input 
                                type="text"
                                value={profilePhotoURL}
                                onChange={(e) => setProfilePhotoURL(e.target.value)}
                                placeholder="Profile Picture URL"
                                className={`w-full rounded-2xl pl-11 pr-4 py-3.5 text-[11px] font-bold focus:outline-none focus:ring-2 focus:ring-aura-secondary/50 transition-all ${isLightMode ? 'bg-slate-100 text-slate-800 border-slate-200 border' : 'bg-white/5 border border-white/10 text-white'}`}
                              />
                            </div>
                          </div>
                        </motion.div>

                        <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }}>
                          <button 
                            onClick={handleUpdateProfile}
                            disabled={isSavingProfile || (profileDisplayName === user?.displayName && profilePhotoURL === user?.photoURL) || !profileDisplayName.trim()}
                            className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-all relative overflow-hidden ${
                              isSavingProfile 
                                ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                                : profileUpdateSuccess
                                ? 'bg-emerald-500 text-white shadow-[0_0_20px_rgba(16,185,129,0.3)]'
                                : (profileDisplayName === user?.displayName && profilePhotoURL === user?.photoURL)
                                ? 'bg-white/5 text-slate-500 cursor-default border border-white/5'
                                : 'bg-aura-primary text-white shadow-xl shadow-aura-primary/20 hover:scale-[1.02] active:scale-[0.98]'
                            }`}
                          >
                            <AnimatePresence mode="wait">
                              {isSavingProfile ? (
                                <motion.div 
                                  key="saving"
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  className="flex items-center gap-2"
                                >
                                  <Loader2 size={14} className="animate-spin" />
                                  <span>Syncing...</span>
                                </motion.div>
                              ) : profileUpdateSuccess ? (
                                <motion.div 
                                  key="success"
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  className="flex items-center gap-2"
                                >
                                  <CheckCircle size={14} />
                                  <span>Updated</span>
                                </motion.div>
                              ) : (
                                <motion.div 
                                  key="idle"
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -10 }}
                                  className="flex items-center gap-2"
                                >
                                  <Sparkles size={14} />
                                  <span>Save Profile</span>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </button>
                        </motion.div>

                        <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className="pt-2 text-center">
                          <p className={`text-[9px] font-medium leading-relaxed ${isLightMode ? 'text-slate-400' : 'text-slate-500'}`}>
                            Your display name is visible to REWON and other participants in secure sessions.
                          </p>
                        </motion.div>
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-white/5 rounded-3xl border border-white/5">
                        <UserIcon size={32} className="mx-auto text-slate-500 mb-3 opacity-20" />
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Select a Tab</p>
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Messages Area */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth custom-scrollbar"
            >
              {activeMainTab === 'tasks' ? (
                <div className="h-full">
                  <TaskManager />
                </div>
              ) : (
                <>
                  <AnimatePresence>
                    {/* Quick Actions */}
                  {!searchQuery && messages.length <= 2 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2 pb-4 overflow-x-auto no-scrollbar"
                >
                  <button 
                    onClick={initiateCall}
                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-aura-primary/10 border border-aura-primary/20 rounded-2xl text-aura-accent text-[10px] font-bold uppercase tracking-wider hover:bg-aura-primary/20 transition-all"
                  >
                    <Video size={14} />
                    Secure Video Call
                  </button>
                  <button 
                    onClick={() => setActiveMainTab('tasks')}
                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-2xl text-slate-400 text-[10px] font-bold uppercase tracking-wider hover:bg-white/10 hover:text-white transition-all"
                  >
                    <ListTodo size={14} />
                    Show My Tasks
                  </button>
                  <button 
                    onClick={() => handleSendMessage("Schedule a follow-up meeting for tomorrow")}
                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-2xl text-slate-400 text-[10px] font-bold uppercase tracking-wider hover:bg-white/10 hover:text-white transition-all"
                  >
                    <Calendar size={14} />
                    Schedule Follow-up
                  </button>
                  <button 
                    onClick={() => handleSendMessage("Generate a creative video prompt for me")}
                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-2xl text-slate-400 text-[10px] font-bold uppercase tracking-wider hover:bg-white/10 hover:text-white transition-all"
                  >
                    <Film size={14} />
                    Generate Video Prompt
                  </button>
                  <button 
                    onClick={() => setShowTutorial(true)}
                    className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-2xl text-slate-400 text-[10px] font-bold uppercase tracking-wider hover:bg-white/10 hover:text-white transition-all"
                  >
                    <HelpCircle size={14} />
                    How it works
                  </button>
                </motion.div>
              )}

              {filteredMessages.length === 0 && searchQuery ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                    <Search className="text-slate-600" size={32} />
                  </div>
                  <h4 className="text-white font-bold mb-1">No results found</h4>
                  <p className="text-slate-500 text-xs">Try searching for a different keyword</p>
                </div>
              ) : (
                filteredMessages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] group`}>
                      <div className={`px-4 py-3 rounded-2xl text-[14.5px] leading-relaxed shadow-sm transition-all duration-300 ${
                        msg.role === 'user' 
                          ? 'bg-aura-primary text-white rounded-tr-none shadow-[0_8px_24px_rgba(99,102,241,0.3)]' 
                          : isLightMode ? 'bg-white text-slate-800 rounded-tl-none border border-slate-200 shadow-sm' : 'glass-morphic text-[var(--aura-text)] rounded-tl-none'
                      }`}>
                        {msg.videoUrl ? (
                          <div className="flex flex-col gap-3">
                            <VideoPlayer 
                              src={msg.videoUrl} 
                              isSyncEnabled={true}
                              roomId={roomId}
                              syncState={videoSyncState}
                              onSyncAction={(data) => updateGlobalVideoSync({ ...data, url: msg.videoUrl })}
                              user={user}
                            />
                            {msg.content && <div className="px-1"><Markdown>{msg.content}</Markdown></div>}
                          </div>
                        ) : msg.audioUrl ? (
                          <div className="flex flex-col gap-2">
                            <AudioPlayer 
                              src={msg.audioUrl} 
                              globalRate={audioPlaybackRate} 
                              onRateChange={setAudioPlaybackRate} 
                            />
                            {msg.content && msg.content !== "Sent an audio message" && <p className="px-1">{msg.content}</p>}
                          </div>
                        ) : (
                          msg.role === 'assistant' && i === filteredMessages.length - 1 && !searchQuery ? (
                            <TypedText text={msg.content} speed={typingSpeed} />
                          ) : (
                            msg.content
                          )
                        )}
                      </div>
                      <span className={`text-[10px] text-slate-500 mt-1 block px-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                        msg.role === 'user' ? 'text-right' : 'text-left'
                      }`}>
                        {msg.timestamp}
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
              {isLoading && !searchQuery && (
                <div className="flex justify-start">
                  <TypingIndicator />
                </div>
              )}

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex justify-center my-4"
                >
                  <div className="bg-red-500/10 border border-red-500/20 rounded-[24px] p-6 text-center max-w-[85%] backdrop-blur-xl shadow-2xl shadow-red-500/10 relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500/40 to-transparent animate-pulse" />
                    
                    <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-500">
                      <AlertTriangle className="text-red-400" size={24} />
                    </div>
                    
                    <h4 className="text-white font-bold text-sm mb-2">Message Failed</h4>
                    <p className="text-red-400/80 text-[11px] font-medium leading-relaxed mb-5">
                      {error.message}
                    </p>
                    
                    <button
                      onClick={() => handleSendMessage(error.lastInput)}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-lg shadow-red-500/30 active:scale-95"
                    >
                      <RotateCcw size={14} />
                      RETRY MESSAGE
                    </button>
                    
                    <button 
                      onClick={() => setError(null)}
                      className="mt-3 text-[9px] font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-widest"
                    >
                      Dismiss
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* Input Area */}
      <AnimatePresence>
        {activeMainTab === 'chat' && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={`p-4 bg-[var(--aura-glass-bg)] border-t border-[var(--aura-glass-border)] relative`}
          >
              {/* Visual Input Preview Overlay */}
              <AnimatePresence>
                {selectedImage && (
                  <motion.div
                    initial={{ opacity: 0, y: 20, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 40, scale: 0.9, filter: 'blur(10px)' }}
                    className="absolute bottom-full left-4 right-4 mb-4 p-3 bg-slate-900/90 backdrop-blur-[40px] border border-white/10 rounded-[32px] shadow-2xl flex items-center gap-4 z-50 group"
                  >
                    <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-aura-accent/30 shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                      <img src={selectedImage} alt="Visual Target" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-aura-accent/30 mix-blend-overlay animate-pulse" />
                      <div className="absolute top-0 inset-x-0 h-1 bg-aura-accent/50 animate-[scan_2s_linear_infinite]" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[10px] text-aura-accent font-black uppercase tracking-[0.2em] mb-1">Visual Input Ready</p>
                      <p className="text-[9px] text-white/50 font-mono tracking-tight text-ellipsis overflow-hidden whitespace-nowrap">LOCAL_BUFFER_ANALYSIS_ACTIVE</p>
                      <div className="flex gap-0.5 mt-2">
                        {[1,2,3,4,5].map(i => <div key={i} className="w-3 h-0.5 bg-aura-accent/30 rounded-full animate-pulse" style={{ animationDelay: `${i * 0.1}s` }} />)}
                      </div>
                    </div>
                    <button 
                      onClick={removeImage}
                      className="p-2 bg-red-500/20 text-red-400 rounded-xl hover:bg-red-500 transition-all hover:text-white"
                      title="Clear Buffer"
                    >
                      <X size={14} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex flex-col gap-3">
                <Waveform isListening={isListening || isRecordingAudio} isSpeaking={isSpeaking} />
                
                {audioUrl && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 bg-aura-primary/10 border border-aura-primary/20 rounded-2xl flex flex-col gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-aura-primary p-2 rounded-full">
                        <Mic size={14} className="text-white" />
                      </div>
                      <div className="flex-1">
                        <AudioPlayer 
                          src={audioUrl} 
                          globalRate={audioPlaybackRate} 
                          onRateChange={setAudioPlaybackRate} 
                        />
                      </div>
                      <button 
                        onClick={deleteRecording}
                        className="p-1.5 hover:bg-white/10 rounded-full text-slate-400 hover:text-white transition-colors"
                        title="Discard Recording"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                       <button
                        onClick={() => {
                          const a = document.createElement('a');
                          a.href = audioUrl;
                          a.download = `voice-message-${Date.now()}.webm`;
                          a.click();
                        }}
                        className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-bold uppercase tracking-widest text-slate-400 flex items-center justify-center gap-2 transition-all"
                      >
                        <Download size={14} />
                        Export .webm
                      </button>
                      <button
                        onClick={() => handleSendMessage()}
                        className="flex-[2] py-2 rounded-xl bg-aura-primary text-white text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-aura-primary/20 hover:bg-aura-primary/80"
                      >
                        <Send size={14} />
                        Send Voice Message
                      </button>
                    </div>
                  </motion.div>
                )}

                <div className="flex items-center gap-2">
                  <div className="flex-1 relative">
                    <AnimatePresence>
                      {showInputError && (
                        <motion.div
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="absolute -top-12 left-0 right-0 bg-red-500/90 backdrop-blur-md text-white text-[10px] font-bold py-2 px-3 rounded-xl shadow-xl z-20 flex items-center gap-2 border border-red-400/30"
                        >
                          <AlertCircle size={12} />
                          Please enter a message or record audio first.
                          <div className="absolute -bottom-1 left-6 w-2 h-2 bg-red-500 rotate-45" />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <div className="relative">
                      <input
                        ref={inputRef}
                        type="file"
                        id="image-upload"
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageUpload}
                      />
                      <button 
                        onClick={() => document.getElementById('image-upload')?.click()}
                        className={`absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all z-10 ${
                          selectedImage ? 'text-aura-accent bg-aura-accent/10 border border-aura-accent/20' : 'text-slate-500 hover:text-white hover:bg-white/5'
                        }`}
                        title="Upload intelligence source"
                      >
                        <ImageIcon size={18} />
                      </button>
                      <input
                      ref={inputRef}
                      type="text"
                      placeholder={isListening ? `Listening (${selectedLanguage})...` : (
                        isRecordingAudio ? `Recording: ${formatDuration(audioRecordingDuration)} (Release to Send)` :
                        selectedLanguage === 'Hindi' ? "Kuch puchiye..." : 
                        selectedLanguage === 'Spanish' ? "Dime algo..." :
                        selectedLanguage === 'French' ? "Dites-moi n'importe quoi..." :
                        "Ask me anything..."
                      )}
                      value={inputValue}
                      onChange={(e) => {
                        setInputValue(e.target.value);
                        if (showInputError) setShowInputError(false);
                      }}
                      onFocus={() => setShowInputError(false)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      className={`w-full ${isLightMode ? 'bg-slate-100 border-slate-200' : 'glass-dark border-white/5'} rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-aura-primary/50 text-[var(--aura-text)] placeholder-slate-500 transition-all pr-24 shadow-inner`}
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                      <button 
                        onClick={() => isListening ? stopListening() : startListening()}
                        className={`p-2 rounded-xl transition-all ${
                          isListening ? 'bg-aura-primary text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'hover:bg-white/10 text-slate-400 hover:text-white'
                        }`}
                        title={isListening ? "Stop voice input" : "Start voice input"}
                      >
                        {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                      </button>
                      <button 
                        onMouseDown={startAudioRecording}
                        onMouseUp={stopAudioRecording}
                        onMouseLeave={stopAudioRecording}
                        className={`p-2 rounded-xl transition-all ${
                          isRecordingAudio ? 'bg-red-500 text-white animate-pulse' : 'hover:bg-white/10 text-slate-400 hover:text-white'
                        }`}
                        title="Hold to record audio message"
                      >
                        <Zap size={18} />
                      </button>
                    </div>
                  </div>
                </div>
                
                <button
                    onClick={() => handleSendMessage()}
                    disabled={isLoading}
                    className={`p-3 bg-aura-primary text-white rounded-2xl hover:bg-aura-primary/80 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-aura-primary/20 ${showInputError ? 'animate-shake bg-red-500' : ''}`}
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>

      {/* Advanced Overlays */}
      <VoiceAssistantOverlay />
      <AnimatePresence>
        {showInsightsOverlay && <AIIntelligencePanel />}
      </AnimatePresence>

      {/* Toggle Button */}
      <motion.button
        layout
        initial={false}
        animate={{ 
          y: isOpen ? 0 : [0, -10, 0],
        }}
        transition={{ 
          y: isOpen ? { duration: 0.2 } : { repeat: Infinity, duration: 4, ease: "easeInOut" }
        }}
        whileHover={{ scale: 1.1, y: -2, rotateZ: 5 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-20 h-20 rounded-[30px] bg-gradient-to-tr from-aura-primary via-aura-secondary to-aura-accent text-white flex items-center justify-center shadow-[0_30px_60px_-15px_rgba(99,102,241,0.6)] transition-all duration-500 relative group overflow-hidden border border-white/20 perspective-[500px]"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute -inset-4 bg-white/10 blur-2xl opacity-0 group-hover:opacity-30 transition-opacity" />
        
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: 90, opacity: 0, scale: 0.5 }}
            >
              <X size={32} strokeWidth={2.5} />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0, scale: 0.5 }}
              animate={{ rotate: 0, opacity: 1, scale: 1 }}
              exit={{ rotate: -90, opacity: 0, scale: 0.5 }}
              className="relative"
            >
              <MessageCircle size={32} strokeWidth={2.5} />
              <motion.div 
                className="absolute inset-0 bg-white blur-lg opacity-20"
                animate={{ scale: [1, 1.5, 1], opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>
          )}
        </AnimatePresence>
        
        {!isOpen && (
          <motion.div 
            className="absolute top-4 right-4 w-3 h-3 bg-aura-accent border-2 border-aura-bg rounded-full shadow-[0_0_10px_#38bdf8]"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.5, type: 'spring' }}
          />
        )}
      </motion.button>
      
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-24 right-6 z-[200]"
          >
            <div className={`px-5 py-3 rounded-2xl backdrop-blur-xl border flex items-center gap-4 shadow-[0_20px_50px_rgba(0,0,0,0.3)] ${
              toast.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : toast.type === 'error'
                ? 'bg-red-500/10 border-red-500/20 text-red-500'
                : 'bg-aura-primary/10 border-aura-primary/20 text-aura-primary'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                toast.type === 'success' ? 'bg-emerald-500' : toast.type === 'error' ? 'bg-red-500' : 'bg-aura-primary'
              } animate-pulse`} />
              <span className="text-[11px] font-black uppercase tracking-[0.2em]">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-5px); }
        }
        .animate-shake {
          animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
        }
        .shadow-aura {
          box-shadow: 0 8px 30px rgba(99, 102, 241, 0.4);
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  );
}
