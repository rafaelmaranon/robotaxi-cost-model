-- Create analytics_events table for product analytics
create table analytics_events (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  session_id text,
  event text,
  payload jsonb
);

-- Add index for better query performance
create index idx_analytics_events_session_id on analytics_events(session_id);
create index idx_analytics_events_event on analytics_events(event);
create index idx_analytics_events_created_at on analytics_events(created_at);
