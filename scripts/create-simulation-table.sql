-- =============================================================================
-- Simulation Results Table
-- =============================================================================
-- Run this in Supabase SQL Editor before running simulate-batch.mjs
-- This table stores batch simulation results for spreadsheet export & sanity checks.

create table if not exists simulation_results (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),

  -- Run metadata
  run_label text,                          -- e.g. 'Early launch', 'Scaling city', 'Mature city'
  sweep_type text,                         -- 'single_utilization', 'single_deadhead', 'single_vpo', 'cross_sweep'

  -- Input parameters
  fleet_size integer,
  vehicles_per_operator integer,
  vehicle_cost integer,
  ops_hours_per_day integer,
  deadhead_percent numeric,
  variable_cost_per_mile numeric,
  revenue_per_mile numeric,
  utilization_percent numeric,

  -- Constants (for reference)
  operator_cost_per_hour numeric,          -- $40
  vehicle_lifetime_days integer,           -- 1825
  max_miles_per_day integer,               -- 300

  -- Intermediate calculations (formulas documented)
  vehicle_cost_per_day numeric,            -- = vehicle_cost / vehicle_lifetime_days
  teleops_and_ops_per_day numeric,         -- = (operator_cost_per_hour * ops_hours_per_day) / vehicles_per_operator
  fixed_daily_cost numeric,                -- = vehicle_cost_per_day + teleops_and_ops_per_day
  utilization_decimal numeric,             -- = utilization_percent / 100
  deadhead_decimal numeric,                -- = min(deadhead_percent / 100, 0.95)
  miles_per_day numeric,                   -- = max_miles_per_day * utilization_decimal
  paid_miles_per_day numeric,              -- = miles_per_day * (1 - deadhead_decimal)

  -- Output metrics
  total_cost_per_mile numeric,             -- = (fixed_daily_cost / paid_miles_per_day) + variable_cost_per_mile
  margin_per_mile numeric,                 -- = revenue_per_mile - total_cost_per_mile
  break_even_utilization_percent numeric,  -- = (fixed_daily_cost / (max_miles_per_day * (1-deadhead_decimal) * (revenue-variable))) * 100
  is_profitable boolean                    -- = margin_per_mile > 0
);

-- Indexes for common queries
create index if not exists idx_sim_results_run_label on simulation_results(run_label);
create index if not exists idx_sim_results_sweep_type on simulation_results(sweep_type);
create index if not exists idx_sim_results_profitable on simulation_results(is_profitable);
