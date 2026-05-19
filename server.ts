import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Tool definitions for Gemini
const captureLeadTool: FunctionDeclaration = {
  name: "capture_lead",
  description: "Capture and store structured lead data when a user shows intent or provides contact details.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "The full name of the lead." },
      contact: { type: Type.STRING, description: "Email address or phone number of the lead." },
      intent: { type: Type.STRING, description: "The user's primary requirement or intent." }
    },
    required: ["name", "contact", "intent"]
  }
};

const saveConversationTool: FunctionDeclaration = {
  name: "save_conversation",
  description: "Save a structured summary of the conversation for business records.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING, description: "A detailed but concise summary of the interaction." }
    },
    required: ["summary"]
  }
};

const scheduleFollowupTool: FunctionDeclaration = {
  name: "schedule_followup",
  description: "Schedule a follow-up call or demo for a potential lead.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      contact: { type: Type.STRING, description: "The contact info for the follow-up." }
    },
    required: ["contact"]
  }
};

const triggerOutboundCallTool: FunctionDeclaration = {
  name: "trigger_outbound_call",
  description: "Trigger a real-time outbound phone call to the user.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      phone: { type: Type.STRING, description: "The phone number to call." }
    },
    required: ["phone"]
  }
};

const createTaskTool: FunctionDeclaration = {
  name: "create_task",
  description: "Create a new task or todo item for the user.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "The title or description of the task." },
      priority: { type: Type.STRING, enum: ["low", "medium", "high"], description: "The priority level of the task." },
      dueDate: { type: Type.STRING, description: "Optional due date in YYYY-MM-DD format." }
    },
    required: ["title"]
  }
};

const updateTaskTool: FunctionDeclaration = {
  name: "update_task",
  description: "Update an existing task's properties.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskId: { type: Type.STRING, description: "The unique ID of the task to update." },
      title: { type: Type.STRING, description: "New title for the task." },
      priority: { type: Type.STRING, enum: ["low", "medium", "high"], description: "New priority level." },
      completed: { type: Type.BOOLEAN, description: "Whether the task is completed." },
      dueDate: { type: Type.STRING, description: "New due date in YYYY-MM-DD format." }
    },
    required: ["taskId"]
  }
};

const deleteTaskTool: FunctionDeclaration = {
  name: "delete_task",
  description: "Delete a task from the user's list.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      taskId: { type: Type.STRING, description: "The unique ID of the task to delete." }
    },
    required: ["taskId"]
  }
};

const listTasksTool: FunctionDeclaration = {
  name: "list_tasks",
  description: "Fetch the list of current tasks to see what needs to be done.",
  parameters: {
    type: Type.OBJECT,
    properties: {}
  }
};

const syncVideoTool: FunctionDeclaration = {
  name: "sync_video",
  description: "Synchronize video playback across all connected clients. Use this when the user asks to 'sync video' or 'synchronize video'.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      videoUrl: { type: Type.STRING, description: "The URL of the video to synchronize. If not provided, the assistant will identify the most recent video from the context." }
    }
  }
};

const createArtifactTool: FunctionDeclaration = {
  name: "create_artifact",
  description: "Create a rich, interactive knowledge artifact (e.g., a project roadmap, a technical architecture diagram, a comparison table, or a conceptual visualization) to help the user visualize complex information.",
  parameters: {
    type: Type.OBJECT,
    description: "Properties for the interactive artifact.",
    properties: {
      title: { type: Type.STRING, description: "The title of the artifact." },
      type: { type: Type.STRING, enum: ["roadmap", "diagram", "table", "process", "visualization"], description: "The visual type of the artifact." },
      content: { type: Type.STRING, description: "The content or data structure for the artifact (Markdown or JSON string)." },
      summary: { type: Type.STRING, description: "A brief one-sentence summary of what this artifact represents." }
    },
    required: ["title", "type", "content"]
  }
};

const tools = [
  captureLeadTool, 
  saveConversationTool, 
  scheduleFollowupTool, 
  triggerOutboundCallTool,
  createTaskTool,
  updateTaskTool,
  deleteTaskTool,
  listTasksTool,
  syncVideoTool,
  createArtifactTool
];

// Helper function for exponential backoff retries
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, initialDelay = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isRetryable = 
        error.message?.includes("503") || 
        error.message?.includes("429") ||
        error.status === 503 || 
        error.status === 429;

      if (!isRetryable || i === maxRetries - 1) throw error;
      
      const delay = initialDelay * Math.pow(2, i) + Math.random() * 1000;
      console.log(`Gemini API busy (attempt ${i + 1}/${maxRetries}), retrying in ${Math.round(delay)}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

// API Routes
app.post("/api/gemini/chat", async (req, res) => {
  try {
    const { history, language, personality } = req.body;
    
    if (!history || !Array.isArray(history)) {
      return res.status(400).json({ error: "Invalid request: 'history' must be an array of messages." });
    }
    
    const systemInstruction = `You are an enterprise-grade AI Assistant embedded inside a website or application.

You act as a highly professional human sales, support, and customer engagement representative.

Your job is to intelligently interact with visitors, understand their interests, capture lead information, increase conversions, and guide users toward taking action.

-----------------------------------
CORE ROLE
-----------------------------------

- Behave like a real human assistant
- Never reveal you are an AI
- Speak naturally, politely, and professionally
- Adapt your communication style based on the user and the website/business type

-----------------------------------
WEBSITE AWARENESS
-----------------------------------

You are dynamically embedded into different websites and businesses.

You MUST:
- Understand the website/business context
- Adjust conversation according to the business niche
- Understand what the website sells or offers
- Detect what the user may be interested in

Examples:
- E-commerce → help users choose products and place orders
- Real estate → collect property preferences and schedule callbacks
- Education → recommend courses and capture inquiries
- Service business → collect requirements and book consultations

-----------------------------------
PRIMARY OBJECTIVES
-----------------------------------

1. Welcome users naturally
2. Understand user interest quickly
3. Ask smart and relevant questions
4. Capture lead information (name, contact, intent)
5. Increase conversions and sales
6. Guide users toward action
7. Offer follow-up calls/messages
8. Build trust and engagement

-----------------------------------
LEAD CAPTURE TRIGGERING
-----------------------------------

You MUST use the \`capture_lead\` tool as soon as:
- A user provides their name, email, or phone number.
- A user expresses specific interest in a product, service, or demo.
- A user asks to be contacted.

Do NOT wait for all details if some are provided earlier, but try to collect the full set (Name, Contact, Intent) naturally formatted as a Lead.

-----------------------------------
CONVERSATION FLOW
-----------------------------------

Always follow this structure:

1. Greeting
2. Understand interest
3. Ask qualification questions
4. Recommend relevant options/services
5. Capture:
   - Name
   - Mobile number
   - Email
   - Requirement
6. Confirm details
7. Offer next step:
   - callback
   - order
   - consultation
   - demo
8. Close politely

-----------------------------------
VIDEO SYNCHRONIZATION
-----------------------------------

When the user asks to "sync video", "synchronize playback", or "watch together", you MUST use the sync_video tool.
Identify the most relevant video URL from the conversation if available. If no video is present, inform the user you're ready to sync once a video is shared.

-----------------------------------
INTERACTIVE KNOWLEDGE ARTIFACTS
-----------------------------------

When explaining complex concepts, building roadmaps, or suggesting technical architectures, use the "create_artifact" tool to suggest a visual representation. This makes the information much more professional and "import-worthy".

-----------------------------------
PERSONALIZATION
-----------------------------------

- Remember user details during conversation
- Avoid repeating questions
- Personalize recommendations

-----------------------------------
CONVERSION OPTIMIZATION
-----------------------------------

Your goal is to:
- increase leads
- increase orders
- increase bookings
- increase customer engagement

Guide users toward:
- placing orders
- booking consultations
- requesting demos
- sharing contact details

-----------------------------------
WEBSITE INTEGRATION AWARENESS
-----------------------------------

You are connected with:
- Chat widget
- Voice system
- CRM
- Lead database
- Call system
- Email/WhatsApp follow-up system

-----------------------------------
TASK & TODO MANAGEMENT
-----------------------------------

You help users stay productivity by managing their tasks.

Current Context:
- Language: ${language || 'English'}
- Personality: ${personality || 'Professional'} (Embody this within the pro rep role)`;

    const contents = history.map((msg: any) => {
      const parts: any[] = [{ text: msg.content }];
      if (msg.image) {
        const [mimePart, dataPart] = msg.image.split(';base64,');
        const mimeType = mimePart.split(':')[1];
        parts.push({
          inlineData: {
            mimeType,
            data: dataPart
          }
        });
      }
      return {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts
      };
    });

    console.log("Gemini Payload:", JSON.stringify({ contents, systemInstruction: systemInstruction.substring(0, 100) + '...' }, null, 2));

    const result = await withRetry(() => ai.models.generateContentStream({
      model: "gemini-3-flash-preview",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        tools: [
          { googleSearch: {} },
          { functionDeclarations: tools }
        ]
      }
    }));

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    let fullText = "";
    let functionCalls: any[] = [];

    const stream = (result as any).stream || result;

    for await (const chunk of stream) {
      if (chunk.text) {
        fullText += chunk.text;
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
      if (chunk.functionCalls) {
        functionCalls = [...functionCalls, ...chunk.functionCalls];
      }
    }

    if (functionCalls.length > 0) {
      res.write(`data: ${JSON.stringify({ functionCalls })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error: any) {
    console.error("Chat Error Detail:", error);
    res.status(error.status || 500).json({ 
      error: error.message || "An unexpected error occurred",
      status: error.status || 500,
      code: error.code || "GEMINI_API_ERROR"
    });
  }
});

app.post("/api/gemini/video-prompt", async (req, res) => {
  try {
    const { history } = req.body;
    const prompt = `Based on the following conversation history, generate a highly detailed and descriptive prompt for a video generation tool...
    Conversation History:
    ${history.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}
    Return only the detailed prompt string.`;

    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt
    }));
    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Video Prompt Error:", error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post("/api/gemini/insights", async (req, res) => {
  try {
    const { conversationText } = req.body;
    const prompt = `Analyze the following ongoing conversation and extract:
      1. Topics: 4 to 6 highly relevant, specific key topics or discussion points (each 2-4 words long).
      2. Action Items: List any tasks or next steps agreed upon.
      3. Milestones: Identify key project achievements or deadlines mentioned.

      Conversation:
      ${conversationText}

      Please return the insights as a JSON object with keys "topics", "actionItems", and "milestones". Each should be a flat list of strings.`;

    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      }
    }));
    res.json(JSON.parse(response.text || "{}"));
  } catch (error: any) {
    console.error("Insights Error:", error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

app.post("/api/gemini/summary", async (req, res) => {
  try {
    const { conversationText } = req.body;
    const prompt = `Create a brief, high-level summary (2-3 sentences) of the central focus, key decisions, and immediate action items from this conversation.
      Conversation:
      ${conversationText}
      Be concise, professional, and action-oriented.`;

    const response = await withRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt
    }));
    res.json({ text: response.text });
  } catch (error: any) {
    console.error("Summary Error:", error);
    res.status(error.status || 500).json({ error: error.message });
  }
});

async function startServer() {
  try {
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*all', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
