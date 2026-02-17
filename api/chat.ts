import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

console.log("env check", {
  hasSupabaseUrl: !!process.env.SUPABASE_URL,
  hasServiceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  hasOpenAI: !!process.env.OPENAI_API_KEY,
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

interface ChatRequest {
  sessionId: string;
  userMessage: string;
  simState: {
    fleetSize: number;
    vehiclesPerOperator: number;
    vehicleCost: number;
    opsHoursPerDay: number;
    deadheadPercent: number;
    variableCostPerMile: number;
    revenuePerMile: number;
    utilizationPercent: number;
    totalCostPerMile: number;
    marginPerMile: number;
    status: string;
  };
}

interface ChatResponse {
  reply: string;
  error?: string;
}

interface StructuredResponse {
  headline: string;
  insights: string[];
  top_levers: Array<{
    lever: string;
    direction: string;
    why: string;
  }>;
  recommended_next_change: string;
  sanity_checks: string[];
}

// Rate limiting: 30 messages per day per sessionId
async function checkRateLimit(sessionId: string): Promise<boolean> {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  
  const { data, error } = await supabase
    .from('chat_events')
    .select('id')
    .eq('session_id', sessionId)
    .gte('created_at', `${today}T00:00:00.000Z`)
    .lt('created_at', `${today}T23:59:59.999Z`);

  if (error) {
    console.error('Rate limit check error:', error);
    return false;
  }

  return (data?.length || 0) < 30;
}

// Log chat event to Supabase
async function logChatEvent(
  sessionId: string,
  userMessage: string,
  assistantMessage: string,
  simState: any
): Promise<void> {
  const { error } = await supabase
    .from('chat_events')
    .insert({
      session_id: sessionId,
      user_message: userMessage,
      assistant_message: assistantMessage,
      sim_state: simState,
      created_at: new Date().toISOString()
    });

  if (error) {
    console.error('supabase insert', error);
  }
}

// Safe formatting helper
const fmt = (v: any, digits = 2) =>
  typeof v === "number" && Number.isFinite(v) ? v.toFixed(digits) : "n/a";

// Generate OpenAI response with streaming
async function* generateStreamingResponse(userMessage: string, simState: any): AsyncGenerator<string, void, unknown> {
  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: "system",
          content: `You are a Principal PM / Fleet GM evaluating robotaxi unit economics.

You must behave like an operator making real capital decisions.

Rules:
1. Always use the current simState values provided.
2. When discussing prioritization or sensitivity:
   - Compute approximate margin deltas numerically.
   - Compare magnitude of impact explicitly.
   - Rank levers strictly by margin improvement.
3. Always reference:
   - Current margin
   - Break-even utilization
   - Gap to break-even
4. If break-even utilization exceeds 75%, explicitly state that the model is structurally stressed.
5. If margin improvement required exceeds $1.50/mile, explicitly state structural changes may be required.
6. Do NOT recommend:
   - Marketing by default
   - Fleet expansion casually
7. Be decisive. Avoid hedging language.

Tone: Direct. Quantitative. Operator-grade. No MBA fluff.

Format:

🎯 **Direct Answer**
Clear, decisive recommendation.

📊 **Quantitative Reasoning**
Show numbers using current simState.

🔧 **Lever Ranking (by margin impact)**
1. Lever — estimated margin delta
2. Lever — estimated margin delta

⚠️ **Structural Assessment**
State whether configuration is salvageable under current constraints.

Current state: Fleet=${simState.fleetSize}, Utilization=${simState.utilizationPercent}%, Deadhead=${simState.deadheadPercent}%, Cost/mile=$${fmt(simState.totalCostPerMile)}, Margin/mile=$${fmt(simState.marginPerMile)}, Break-even=${fmt(simState.breakEvenUtilization)}%, Revenue/mile=$${fmt(simState.revenuePerMile)}, Vehicle cost=$${fmt(simState.vehicleCost/1000)}k, Vehicles/operator=${simState.vehiclesPerOperator}.`
        },
        {
          role: "user",
          content: `USER_QUESTION: ${userMessage}\n\nSIM_STATE:\n${JSON.stringify(simState ?? {}, null, 2)}`
        }
      ],
      max_tokens: 350,
      temperature: 0.4,
      stream: true
    });

    let fullContent = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullContent += content;
        yield content;
      }
    }

  } catch (error) {
    console.error('openai error', error);
    yield JSON.stringify({
      headline: "Error occurred",
      insights: ["I encountered an error while processing your request. Please try again."],
      top_levers: [],
      recommended_next_change: "Please retry your question.",
      sanity_checks: ["Technical error - please try again."]
    });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers for all requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // Handle OPTIONS preflight request
  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { sessionId, userMessage, simState = {} }: ChatRequest = req.body;

    const requiredFields = [
      "utilizationPercent",
      "deadheadPercent",
      "vehicleCost",
      "vehiclesPerOperator",
      "opsHoursPerDay",
      "variableCostPerMile",
      "revenuePerMile",
    ];

    const missingFields = requiredFields.filter((k) => simState?.[k] === undefined || simState?.[k] === null);

    if (missingFields.length > 0) {
      const reply = `missing: ${missingFields.join(", ")}`;
      // still log the event if you want; but DO NOT call OpenAI
      try {
        const { error: insertError } = await supabase.from("chat_events").insert({
          session_id: sessionId ?? "missing",
          user_message: userMessage ?? "",
          assistant_message: reply,
          sim_state: simState ?? {},
        });
        if (insertError) console.error("supabase insert", insertError);
      } catch (e) {
        console.error("supabase insert", e);
      }
      return res.status(200).json({ reply });
    }

    // Validate required fields
    if (!sessionId || !userMessage || !simState) {
      return res.status(400).json({ error: 'Missing required fields: sessionId, userMessage, simState' });
    }

    // Check rate limit
    const withinLimit = await checkRateLimit(sessionId);
    if (!withinLimit) {
      return res.status(429).json({ error: 'Rate limit exceeded. Maximum 30 messages per day.' });
    }

    // Stream AI response
    let fullResponse = '';
    
    for await (const chunk of generateStreamingResponse(userMessage, simState)) {
      fullResponse += chunk;
      res.write(chunk);
    }
    
    // Log the chat event with full response
    await logChatEvent(sessionId, userMessage, fullResponse, simState);
    
    res.end();

  } catch (err: any) {
    console.error('api/chat error', err);
    return res.status(500).json({ 
      error: 'Internal server error', 
      detail: err?.message ?? String(err) 
    });
  }
}
