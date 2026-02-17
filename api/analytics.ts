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
  anonUserId?: string;
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
    // Debug logging for environment variables
    console.log('SUPABASE_URL exists:', !!process.env.SUPABASE_URL);
    console.log('SUPABASE_SERVICE_ROLE_KEY exists:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    const { sessionId, event, anonUserId, payload }: AnalyticsEvent = req.body;

    if (!sessionId || !event) {
      return res.status(400).json({ error: 'Missing required fields: sessionId, event' });
    }

    // Derive anon_user_id with fallback logic
    const derivedAnonUserId = anonUserId || sessionId || crypto.randomUUID();

    // Log analytics event with schema-aligned insert
    const { error } = await supabase
      .from('analytics_events')
      .insert({
        session_id: sessionId,
        anon_user_id: derivedAnonUserId,
        event_name: event
      });

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ error: error?.message || 'insert_failed' });
    }

    return res.status(200).json({ ok: true });

  } catch (err: any) {
    console.error('Analytics route crash:', err);
    return res.status(500).json({ error: 'server_error' });
  }
}
