import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface AnalyticsEvent {
  sessionId: string;
  event: string;
  payload?: any;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId, event, payload }: AnalyticsEvent = req.body;

    if (!sessionId || !event) {
      return res.status(400).json({ error: 'Missing required fields: sessionId, event' });
    }

    // Log analytics event
    const { error } = await supabase
      .from('analytics_events')
      .insert({
        session_id: sessionId,
        event: event,
        payload: payload || {}
      });

    if (error) {
      console.error('Analytics insert error:', error);
      return res.status(500).json({ error: 'Failed to log analytics event' });
    }

    return res.status(200).json({ success: true });

  } catch (err: any) {
    console.error('Analytics API error:', err);
    return res.status(500).json({ 
      error: 'Internal server error', 
      detail: err?.message ?? String(err) 
    });
  }
}
