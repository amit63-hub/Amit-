import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  FileText, 
  Map, 
  Table, 
  Share2, 
  Download, 
  Maximize2, 
  Minimize2,
  X,
  Zap,
  DraftingCompass,
  ArrowRight
} from 'lucide-react';
import Markdown from 'react-markdown';

export type ArtifactType = 'roadmap' | 'diagram' | 'table' | 'process' | 'visualization';

export interface Artifact {
  id: string;
  title: string;
  type: ArtifactType;
  content: string;
  summary?: string;
  timestamp: number;
}

interface KnowledgeCanvasProps {
  artifact: Artifact;
  onClose: () => void;
}

export const KnowledgeCanvas: React.FC<KnowledgeCanvasProps> = ({ artifact, onClose }) => {
  const [isExpanded, setIsExpanded] = React.useState(false);

  const getIcon = () => {
    switch (artifact.type) {
      case 'roadmap': return <Map className="text-emerald-400" size={20} />;
      case 'diagram': return <DraftingCompass className="text-blue-400" size={20} />;
      case 'table': return <Table className="text-purple-400" size={20} />;
      case 'process': return <Zap className="text-orange-400" size={20} />;
      default: return <FileText className="text-slate-400" size={20} />;
    }
  };

  const renderContent = () => {
    // Basic markdown rendering for now, could be enhanced with specific visualizers
    return (
      <div className="prose prose-invert prose-sm max-w-none">
        <Markdown>
          {artifact.content}
        </Markdown>
        {artifact.type === 'roadmap' && (
          <div className="mt-8 relative border-l-2 border-white/5 ml-4 pl-8 space-y-8">
            {/* Visual enhancement for roadmaps */}
            <div className="absolute top-0 -left-1.5 w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
          </div>
        )}
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      className={`glass-morphic border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col transition-all duration-500 ${
        isExpanded ? 'fixed inset-4 z-[100]' : 'w-full max-w-2xl h-[400px] relative'
      }`}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-white/5 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/5 rounded-xl border border-white/10">
            {getIcon()}
          </div>
          <div>
            <h3 className="text-sm font-black uppercase tracking-tighter text-white leading-none">
              {artifact.title}
            </h3>
            <p className="text-[10px] text-slate-400 font-mono mt-1 font-medium">
              Artifact ID: {artifact.id.slice(0, 8)} • {new Date(artifact.timestamp).toLocaleTimeString()}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-2 hover:bg-white/10 rounded-xl text-slate-400 hover:text-white transition-all active:scale-90"
          >
            {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
          {!isExpanded && (
            <button 
              onClick={onClose}
              className="p-2 hover:bg-red-500/20 hover:text-red-400 rounded-xl text-slate-400 transition-all active:scale-90"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-slate-950/20 relative">
        <div className="max-w-3xl mx-auto">
          {/* Badge Decor */}
          <div className="mb-6 flex items-center gap-2">
            <span className="px-2 py-0.5 rounded bg-aura-accent/10 border border-aura-accent/20 text-[8px] font-black uppercase text-aura-accent">
              AI Generated Insight
            </span>
            <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[8px] font-black uppercase text-slate-400">
              Interactive
            </span>
          </div>

          <h2 className="text-2xl font-black text-white mb-6 tracking-tight">
            {artifact.title}
          </h2>

          {artifact.summary && (
            <p className="text-slate-400 text-sm mb-8 leading-relaxed font-medium italic border-l-2 border-aura-accent/30 pl-4 py-1">
              {artifact.summary}
            </p>
          )}

          <div className="relative">
            {renderContent()}
          </div>
        </div>

        {/* Backdrop Glow */}
        <div className="absolute top-1/4 -left-1/4 w-96 h-96 bg-aura-accent/5 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-4 right-4 w-64 h-64 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />
      </div>

      {/* Footer Actions */}
      <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between bg-black/40 backdrop-blur-3xl">
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-white transition-colors group">
            <Share2 size={14} className="group-hover:translate-x-0.5 transition-transform" />
            Share With Team
          </button>
          <button className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-white transition-colors group">
            <Download size={14} className="group-hover:translate-y-0.5 transition-transform" />
            Export PDF
          </button>
        </div>

        <button 
          onClick={onClose}
          className="px-4 py-1.5 bg-aura-accent text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg shadow-aura-accent/20 hover:scale-105 active:scale-95 transition-all"
        >
          Close Preview
          <ArrowRight size={14} />
        </button>
      </div>
    </motion.div>
  );
};
