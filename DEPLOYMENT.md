# Vercel Deployment Guide

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Supabase Project**: Create a project at [supabase.com](https://supabase.com)
3. **OpenAI API Key**: Get your API key from [platform.openai.com](https://platform.openai.com)

## Setup Steps

### 1. Supabase Setup

1. Create a new Supabase project
2. Go to SQL Editor and run the schema from `supabase/schema.sql`:
   ```sql
   -- This creates the chat_events table with proper indexes
   ```
3. Get your project URL and anon key from Settings → API

### 2. Environment Variables

Set these environment variables in your Vercel project:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
OPENAI_API_KEY=sk-your_openai_api_key
```

### 3. Vercel Deployment

#### Option A: Vercel CLI
```bash
npm install -g vercel
vercel --prod
```

#### Option B: GitHub Integration
1. Connect your GitHub repo to Vercel
2. Set environment variables in Vercel dashboard
3. Deploy automatically on push

### 4. Testing the API

Test the `/api/chat` endpoint:

```bash
curl -X POST https://your-app.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "sessionId": "test-session-123",
    "userMessage": "Why is my cost per mile so high?",
    "simState": {
      "fleetSize": 2000,
      "vehiclesPerOperator": 5,
      "vehicleCost": 170000,
      "opsHoursPerDay": 20,
      "deadheadPercent": 44,
      "variableCostPerMile": 0.60,
      "revenuePerMile": 2.50,
      "utilizationPercent": 40,
      "totalCostPerMile": 4.37,
      "marginPerMile": -1.87,
      "status": "Losing"
    }
  }'
```

## Rate Limiting

- 30 messages per day per `sessionId`
- Tracked in Supabase `chat_events` table
- Returns 429 status when limit exceeded

## Monitoring

Check Vercel Functions logs for:
- API usage
- Error tracking
- Performance metrics

## Troubleshooting

**Common Issues:**
- Environment variables not set
- Supabase table not created
- OpenAI API key invalid
- CORS issues (if calling from frontend)
