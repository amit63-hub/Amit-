import { Message, ConversationInsights } from './gemini-types';

export type { Message, ConversationInsights };

export async function getGeminiResponse(
  history: Message[], 
  language: string = 'English', 
  personality: string = 'Professional',
  onChunk?: (text: string) => void
) {
  try {
    const response = await fetch('/api/gemini/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history, language, personality })
    });
    
    if (!response.ok) {
      let errorDetail = "";
      try {
        const errorJson = await response.json();
        errorDetail = errorJson.error || errorJson.message || "";
      } catch (e) {
        errorDetail = response.statusText;
      }
      throw new Error(errorDetail || `Chat API Error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("ReadableStream not supported");

    let fullText = "";
    let functionCalls: any[] = [];
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6).trim();
          if (dataStr === '[DONE]') continue;
          
          try {
            const data = JSON.parse(dataStr);
            if (data.text) {
              fullText += data.text;
              onChunk?.(data.text);
            }
            if (data.functionCalls) {
              functionCalls = [...functionCalls, ...data.functionCalls];
            }
          } catch (e) {
            console.error("Error parsing stream chunk:", e);
          }
        }
      }
    }

    return { text: fullText, functionCalls };
  } catch (error) {
    console.error("Gemini Proxy Error (Chat):", error);
    throw error;
  }
}

export async function generateVideoPrompt(history: Message[]) {
  try {
    const response = await fetch('/api/gemini/video-prompt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ history })
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(errorJson.error || `Video Prompt API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.text || "A futuristic cinematic video representing the conversation.";
  } catch (error) {
    console.error("Gemini Proxy Error (Video Prompt):", error);
    return "A futuristic cinematic video representing the conversation.";
  }
}

export async function extractTopicsFromConversation(conversationText: string): Promise<ConversationInsights> {
  try {
    const response = await fetch('/api/gemini/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationText })
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(errorJson.error || `Insights API Error: ${response.status}`);
    }

    const parsed = await response.json();
    return {
      topics: (parsed.topics || []).slice(0, 6),
      actionItems: (parsed.actionItems || []).slice(0, 5),
      milestones: (parsed.milestones || []).slice(0, 5)
    };
  } catch (error) {
    console.error("Gemini Proxy Error (Insights):", error);
    return {
      topics: ['Product Alignment', 'Milestone Review', 'Technical Architecture'],
      actionItems: [],
      milestones: []
    };
  }
}

export async function generateSummaryFromConversation(conversationText: string): Promise<string> {
  try {
    const response = await fetch('/api/gemini/summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationText })
    });

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      throw new Error(errorJson.error || `Summary API Error: ${response.status}`);
    }

    const data = await response.json();
    return data.text?.trim() || "No summary available.";
  } catch (error) {
    console.error("Gemini Proxy Error (Summary):", error);
    return "Summary generation failed. Please try again.";
  }
}
