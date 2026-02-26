// =============================================================================
// Batch Simulation Script — Robotaxi Cost Model
// =============================================================================
// Standalone script: does NOT touch the app, API routes, or frontend.
// Sweeps utilization, deadhead, and vehiclesPerOperator across 3 presets.
// Inserts all results (inputs + intermediates + outputs) into Supabase.
//
// Usage:
//   1. Run the SQL in scripts/create-simulation-table.sql in Supabase SQL Editor
//   2. npm run simulate
//
// Formulas (identical to src/App.tsx):
//   vehicleCostPerDay        = vehicleCost / vehicleLifetimeDays
//   teleopsAndOpsPerDay      = (operatorCostPerHour * opsHoursPerDay) / vehiclesPerOperator
//   fixedDailyCost           = vehicleCostPerDay + teleopsAndOpsPerDay
//   utilizationDecimal       = utilizationPercent / 100
//   deadheadDecimal          = min(deadheadPercent / 100, 0.95)
//   milesPerDay              = maxMilesPerDay * utilizationDecimal
//   paidMilesPerDay          = milesPerDay * (1 - deadheadDecimal)
//   totalCostPerMile         = (fixedDailyCost / paidMilesPerDay) + variableCostPerMile
//   marginPerMile            = revenuePerMile - totalCostPerMile
//   breakEvenUtilization     = fixedDailyCost / (maxMilesPerDay * (1-deadheadDecimal) * (revenuePerMile - variableCostPerMile))
// =============================================================================

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// =============================================================================
// Constants (same as App.tsx)
// =============================================================================
const OPERATOR_COST_PER_HOUR = 40;
const VEHICLE_LIFETIME_DAYS = 1825;
const MAX_MILES_PER_DAY = 300;

// =============================================================================
// Presets (same as App.tsx)
// =============================================================================
const PRESETS = {
  'Early launch': {
    fleetSize: 500,
    vehiclesPerOperator: 3,
    vehicleCost: 200000,
    opsHoursPerDay: 16,
    deadheadPercent: 60,
    variableCostPerMile: 0.80,
    revenuePerMile: 3.50,
    utilizationPercent: 25,
  },
  'Scaling city': {
    fleetSize: 2000,
    vehiclesPerOperator: 5,
    vehicleCost: 170000,
    opsHoursPerDay: 20,
    deadheadPercent: 44,
    variableCostPerMile: 0.60,
    revenuePerMile: 2.50,
    utilizationPercent: 40,
  },
  'Mature city': {
    fleetSize: 8000,
    vehiclesPerOperator: 8,
    vehicleCost: 150000,
    opsHoursPerDay: 22,
    deadheadPercent: 25,
    variableCostPerMile: 0.45,
    revenuePerMile: 2.20,
    utilizationPercent: 65,
  },
};

// =============================================================================
// Simulation Engine (same formulas as App.tsx)
// =============================================================================
function simulate(params) {
  const vehicleCostPerDay = params.vehicleCost / VEHICLE_LIFETIME_DAYS;
  const teleopsAndOpsPerDay = (OPERATOR_COST_PER_HOUR * params.opsHoursPerDay) / params.vehiclesPerOperator;
  const fixedDailyCost = vehicleCostPerDay + teleopsAndOpsPerDay;

  const utilizationDecimal = params.utilizationPercent / 100;
  const deadheadDecimal = Math.min(params.deadheadPercent / 100, 0.95);

  const milesPerDay = MAX_MILES_PER_DAY * utilizationDecimal;
  const paidMilesPerDay = milesPerDay * (1 - deadheadDecimal);

  let totalCostPerMile, marginPerMile;
  if (paidMilesPerDay <= 0) {
    totalCostPerMile = 9999.99;
    marginPerMile = -9999.99;
  } else {
    totalCostPerMile = (fixedDailyCost / paidMilesPerDay) + params.variableCostPerMile;
    marginPerMile = params.revenuePerMile - totalCostPerMile;
  }

  // Break-even utilization calculation
  const netRevenuePerMile = params.revenuePerMile - params.variableCostPerMile;
  const paidMilesRatio = 1 - deadheadDecimal;
  let breakEvenUtilizationPercent = null;
  if (netRevenuePerMile > 0 && paidMilesRatio > 0) {
    const breakEvenUtilization = fixedDailyCost / (MAX_MILES_PER_DAY * paidMilesRatio * netRevenuePerMile);
    const bePercent = breakEvenUtilization * 100;
    if (bePercent >= 0 && bePercent <= 100) {
      breakEvenUtilizationPercent = round(bePercent, 2);
    }
  }

  return {
    // Constants
    operator_cost_per_hour: OPERATOR_COST_PER_HOUR,
    vehicle_lifetime_days: VEHICLE_LIFETIME_DAYS,
    max_miles_per_day: MAX_MILES_PER_DAY,
    // Inputs
    fleet_size: params.fleetSize,
    vehicles_per_operator: params.vehiclesPerOperator,
    vehicle_cost: params.vehicleCost,
    ops_hours_per_day: params.opsHoursPerDay,
    deadhead_percent: params.deadheadPercent,
    variable_cost_per_mile: params.variableCostPerMile,
    revenue_per_mile: params.revenuePerMile,
    utilization_percent: params.utilizationPercent,
    // Intermediates
    vehicle_cost_per_day: round(vehicleCostPerDay, 4),
    teleops_and_ops_per_day: round(teleopsAndOpsPerDay, 4),
    fixed_daily_cost: round(fixedDailyCost, 4),
    utilization_decimal: round(utilizationDecimal, 4),
    deadhead_decimal: round(deadheadDecimal, 4),
    miles_per_day: round(milesPerDay, 2),
    paid_miles_per_day: round(paidMilesPerDay, 2),
    // Outputs
    total_cost_per_mile: round(totalCostPerMile, 4),
    margin_per_mile: round(marginPerMile, 4),
    break_even_utilization_percent: breakEvenUtilizationPercent,
    is_profitable: marginPerMile > 0,
  };
}

function round(value, decimals) {
  return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// =============================================================================
// Parameter Sweep Ranges
// =============================================================================
function range(min, max, step) {
  const values = [];
  for (let v = min; v <= max + step * 0.01; v += step) {
    values.push(round(v, 2));
  }
  return values;
}

const SWEEP_RANGES = {
  utilization: range(10, 90, 5),      // 17 values
  deadhead: range(10, 80, 5),         // 15 values
  vehiclesPerOperator: range(2, 60, 2), // 30 values
};

// Coarser grid for cross-sweep
const CROSS_SWEEP_RANGES = {
  utilization: range(10, 90, 10),     // 9 values
  deadhead: range(10, 80, 10),        // 8 values
  vehiclesPerOperator: [3, 5, 8, 15, 30],  // 5 values
};

// =============================================================================
// Generate All Simulation Rows
// =============================================================================
function generateRows() {
  const rows = [];

  for (const [presetName, preset] of Object.entries(PRESETS)) {
    // --- Single-parameter sweeps ---

    // Sweep utilization (hold deadhead + vpo constant)
    for (const util of SWEEP_RANGES.utilization) {
      const params = { ...preset, utilizationPercent: util };
      rows.push({
        run_label: presetName,
        sweep_type: 'single_utilization',
        ...simulate(params),
      });
    }

    // Sweep deadhead (hold utilization + vpo constant)
    for (const dh of SWEEP_RANGES.deadhead) {
      const params = { ...preset, deadheadPercent: dh };
      rows.push({
        run_label: presetName,
        sweep_type: 'single_deadhead',
        ...simulate(params),
      });
    }

    // Sweep vehiclesPerOperator (hold utilization + deadhead constant)
    for (const vpo of SWEEP_RANGES.vehiclesPerOperator) {
      const params = { ...preset, vehiclesPerOperator: vpo };
      rows.push({
        run_label: presetName,
        sweep_type: 'single_vpo',
        ...simulate(params),
      });
    }

    // --- 3-way cross-sweep ---
    for (const util of CROSS_SWEEP_RANGES.utilization) {
      for (const dh of CROSS_SWEEP_RANGES.deadhead) {
        for (const vpo of CROSS_SWEEP_RANGES.vehiclesPerOperator) {
          const params = {
            ...preset,
            utilizationPercent: util,
            deadheadPercent: dh,
            vehiclesPerOperator: vpo,
          };
          rows.push({
            run_label: presetName,
            sweep_type: 'cross_sweep',
            ...simulate(params),
          });
        }
      }
    }
  }

  return rows;
}

// =============================================================================
// Insert into Supabase (batch of 500)
// =============================================================================
async function insertRows(rows) {
  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('simulation_results')
      .insert(batch);

    if (error) {
      console.error(`❌ Insert error at batch ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
      process.exit(1);
    }

    inserted += batch.length;
    console.log(`  ✅ Inserted ${inserted} / ${rows.length} rows`);
  }

  return inserted;
}

// =============================================================================
// Main
// =============================================================================
async function main() {
  console.log('='.repeat(60));
  console.log('🚕 Robotaxi Cost Model — Batch Simulation');
  console.log('='.repeat(60));
  console.log('');
  console.log('Parameters being swept:');
  console.log(`  • Utilization: ${SWEEP_RANGES.utilization[0]}% → ${SWEEP_RANGES.utilization.at(-1)}% (step 5)`);
  console.log(`  • Deadhead: ${SWEEP_RANGES.deadhead[0]}% → ${SWEEP_RANGES.deadhead.at(-1)}% (step 5)`);
  console.log(`  • Vehicles/Operator: ${SWEEP_RANGES.vehiclesPerOperator[0]} → ${SWEEP_RANGES.vehiclesPerOperator.at(-1)} (step 2)`);
  console.log('');
  console.log('Presets:', Object.keys(PRESETS).join(', '));
  console.log('');

  // Generate all rows
  const rows = generateRows();
  console.log(`📊 Generated ${rows.length} simulation rows`);
  console.log('');

  // Show breakdown
  const sweepCounts = {};
  for (const row of rows) {
    const key = `${row.run_label} / ${row.sweep_type}`;
    sweepCounts[key] = (sweepCounts[key] || 0) + 1;
  }
  console.log('Breakdown:');
  for (const [key, count] of Object.entries(sweepCounts)) {
    console.log(`  ${key}: ${count} rows`);
  }
  console.log('');

  // Insert into Supabase
  console.log('⬆️  Inserting into Supabase...');
  const inserted = await insertRows(rows);
  console.log('');
  console.log(`✅ Done! ${inserted} rows inserted into simulation_results table.`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Go to Supabase → Table Editor → simulation_results');
  console.log('  2. Click "Export to CSV" to download spreadsheet');
  console.log('  3. Open in Excel/Sheets for sanity checking');
}

main().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
