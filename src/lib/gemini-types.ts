export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  audioUrl?: string;
  videoUrl?: string;
  image?: string;
  isStreaming?: boolean;
}

export interface ConversationInsights {
  topics: string[];
  actionItems: string[];
  milestones: string[];
}
