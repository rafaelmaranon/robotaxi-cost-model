import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

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

// Generate OpenAI response
async function generateResponse(userMessage: string, simState: any): Promise<string> {
  const systemPrompt = `You are an AI assistant helping users analyze robotaxi unit economics. 

Current simulation state:
- Fleet Size: ${simState.fleetSize.toLocaleString()} vehicles
- Utilization: ${simState.utilizationPercent}%
- Vehicles per Operator: ${simState.vehiclesPerOperator}
- Vehicle Cost: $${simState.vehicleCost.toLocaleString()}
- Ops Hours/Day: ${simState.opsHoursPerDay}h
- Deadhead: ${simState.deadheadPercent}%
- Variable Cost/Mile: $${simState.variableCostPerMile.toFixed(2)}
- Revenue/Mile: $${simState.revenuePerMile.toFixed(2)}
- Total Cost/Mile: $${simState.totalCostPerMile.toFixed(2)}
- Margin/Mile: $${simState.marginPerMile.toFixed(2)}
- Status: ${simState.status}

Answer questions about this simulation state. Provide insights about the economics, suggest optimizations, explain relationships between parameters, or analyze profitability. Keep responses concise and focused on the current simulation parameters.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    return completion.choices[0]?.message?.content || 'I apologize, but I could not generate a response. Please try again.';
  } catch (error) {
    console.error('openai error', error);
    return 'I apologize, but I encountered an error while processing your request. Please try again.';
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { sessionId, userMessage, simState }: ChatRequest = req.body;

    // Validate required fields
    if (!sessionId || !userMessage || !simState) {
      return res.status(400).json({ error: 'Missing required fields: sessionId, userMessage, simState' });
    }

    // Check rate limit
    const withinLimit = await checkRateLimit(sessionId);
    if (!withinLimit) {
      return res.status(429).json({ error: 'Rate limit exceeded. Maximum 30 messages per day.' });
    }

    // Generate AI response
    const assistantMessage = await generateResponse(userMessage, simState);

    // Log the chat event
    await logChatEvent(sessionId, userMessage, assistantMessage, simState);

    // Return response
    const response: ChatResponse = {
      reply: assistantMessage
    };

    return res.status(200).json(response);

  } catch (err: any) {
    console.error('api/chat error', err);
    return res.status(500).json({ 
      error: 'Internal server error', 
      detail: err?.message ?? String(err) 
    });
  }
}
