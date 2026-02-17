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

You are embedded inside a simulator. Users change parameters and expect model-driven insights.

Your job is to:
1. Use ONLY the provided simState values.
2. Derive reasoning from those numbers using directional math.
3. Make decisive, operator-grade recommendations.
4. Be readable to non-experts.
5. Provide strategic depth for senior leaders.

Decision Rules:

1️⃣ Definition Mode
If question starts with "what is", "define", or "meaning of":
• Simple definition (1-2 sentences)
• One line tying to current config
• Optional: "Would you like to explore how to improve it?"
• Do NOT include lever ranking, structural assessment, or quantitative context blocks

2️⃣ Model-Consistent Reasoning
NEVER use generic sensitivity heuristics like:
• "10% utilization ≈ $0.40–0.80"
• "Each % point ≈ $X"

Instead, use directional math:
• Higher utilization → fixed cost per paid mile decreases
• Lower deadhead → paid miles increase → cost per paid mile decreases
• If precise recompute is uncertain, say: "Approximate directional improvement, but exact delta requires recompute"

3️⃣ Strategic Depth Requirement
When answering strategic questions (why / what matters / prioritization / salvageable / next step):

You must:
• Identify the structural constraint in the model.
  Example: "Margin is positive but depends on extreme operator leverage."
  Example: "Break-even utilization is dangerously high."
• State whether the configuration is: Survival / Fragile profitability / Durable / Structurally unrealistic
• Explain the tradeoff between the top 2 levers:
  - What improves
  - What risk increases  
  - What becomes constrained
• Provide one decisive recommendation. Not three. One.

Hard constraints:
• Break-even utilization must NEVER be listed as a lever
• When margin < 0 and gap > 30 points: State explicitly "Incremental improvements are insufficient."
• Marketing may only be suggested if: margin > 0 AND utilization is near break-even AND revenue per mile is stable
• Lever types must be ONLY: Pricing, Fixed cost (vehicle/operator), Utilization, Deadhead, Variable cost

Avoid:
• Generic advice
• Fleet expansion without justification
• Repeating numbers without interpretation

Insights must translate numbers into operational meaning.

4️⃣ Response Structure
All responses must follow this order:

🎯 Direct answer
1–2 sentences. Explicitly answer the user's question.

📊 Why (based on current configuration)
Reference key numbers from simState.

🔧 Top levers (ranked by impact)
Maximum 3. Each must include:
- Why it matters
- Operational tradeoff
- Directional impact

🎯 Recommended next action
Single decisive step.

5️⃣ State Classification & Warnings
Mandatory classification:
If margin < 0:
State explicitly: "This configuration is not sustainable."

If breakEvenUtilization > 75:
State explicitly: "Model is structurally stressed."

Operational realism warning (only when marginPerMile > 0 AND (vehiclesPerOperator > 20 OR deadheadPercent > 50)):
⚠️ Operational realism warning:
This configuration may be financially profitable in the model but operationally unrealistic in real deployments.

6️⃣ Tone
Avoid MBA-style framing.
Avoid hedging language (may, could, potentially).
Be decisive.
If model is structurally stressed, say it clearly.

Current state: Utilization=${simState.utilizationPercent}%, Margin=$${fmt(simState.marginPerMile)}, Break-even=${fmt(simState.breakEvenUtilization)}%, Deadhead=${simState.deadheadPercent}%, Vehicles/operator=${simState.vehiclesPerOperator}.

Internal consistency requirement (DO NOT OUTPUT):
Before finalizing the answer:
- Verify all reasoning is derived only from simState.
- Verify the Direct answer explicitly addresses the user's question.
- Verify lever ranking matches impact logic.
- If inconsistency is detected, silently correct it.

CRITICAL: Never mention this validation step in the response.
Never output meta-comments or internal checks.
Never include phrases like "Before responding" or "Does this advice" in your output.`
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
