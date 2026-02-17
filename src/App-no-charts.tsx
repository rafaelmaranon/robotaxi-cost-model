import React, { useState, useMemo } from 'react'

interface SimulationInputs {
  fleetSize: number
  vehiclesPerOperator: number
  vehicleCost: number
  opsHoursPerDay: number
  deadheadPercent: number
  variableCostPerMile: number
  revenuePerMile: number
  utilizationPercent: number
}

type XAxisVariable = 'utilization' | 'deadhead' | 'vehiclesPerOperator'

const App: React.FC = () => {
  const [inputs, setInputs] = useState<SimulationInputs>({
    fleetSize: 2000,
    vehiclesPerOperator: 5,
    vehicleCost: 170000,
    opsHoursPerDay: 20,
    deadheadPercent: 44,
    variableCostPerMile: 0.60,
    revenuePerMile: 2.50,
    utilizationPercent: 40,
  })

  const [xAxisVariable, setXAxisVariable] = useState<XAxisVariable>('utilization')

  // Constants
  const operatorCostPerHour = 40
  const vehicleLifetimeDays = 1825
  const maxMilesPerDay = 300

  // Economic model calculations
  const calculateMetrics = (params: SimulationInputs) => {
    const vehicleCostPerDay = params.vehicleCost / vehicleLifetimeDays
    const teleopsAndOpsPerDay = (operatorCostPerHour * params.opsHoursPerDay) / params.vehiclesPerOperator
    const fixedDailyCost = vehicleCostPerDay + teleopsAndOpsPerDay
    
    const utilizationDecimal = params.utilizationPercent / 100
    const deadheadDecimal = Math.min(params.deadheadPercent / 100, 0.95)
    
    const milesPerDay = maxMilesPerDay * utilizationDecimal
    const paidMilesPerDay = milesPerDay * (1 - deadheadDecimal)
    
    // Avoid division by zero
    if (paidMilesPerDay <= 0) {
      return {
        totalCostPerMile: Infinity,
        marginPerMile: -Infinity,
      }
    }
    
    const totalCostPerMile = (fixedDailyCost / paidMilesPerDay) + params.variableCostPerMile
    const marginPerMile = params.revenuePerMile - totalCostPerMile
    
    return {
      totalCostPerMile,
      marginPerMile,
    }
  }

  const currentMetrics = useMemo(() => calculateMetrics(inputs), [inputs])

  const handleInputChange = (field: keyof SimulationInputs, value: number) => {
    setInputs(prev => ({ ...prev, [field]: value }))
  }

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          Robotaxi Cost Model
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Inputs */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Parameters</h2>
            
            <div className="space-y-4">
              {/* Fleet Size */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-gray-700">Fleet Size</label>
                  <span className="text-sm font-semibold text-blue-600">{inputs.fleetSize.toLocaleString()}</span>
                </div>
                <input
                  type="range"
                  min="500"
                  max="10000"
                  step="100"
                  value={inputs.fleetSize}
                  onChange={(e) => handleInputChange('fleetSize', Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((inputs.fleetSize - 500) / (10000 - 500)) * 100}%, #e5e7eb ${((inputs.fleetSize - 500) / (10000 - 500)) * 100}%, #e5e7eb 100%)`
                  }}
                />
              </div>

              {/* Utilization */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-gray-700">Utilization</label>
                  <span className="text-sm font-semibold text-blue-600">{inputs.utilizationPercent}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  step="1"
                  value={inputs.utilizationPercent}
                  onChange={(e) => handleInputChange('utilizationPercent', Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((inputs.utilizationPercent - 10) / (90 - 10)) * 100}%, #e5e7eb ${((inputs.utilizationPercent - 10) / (90 - 10)) * 100}%, #e5e7eb 100%)`
                  }}
                />
              </div>

              {/* Vehicles per Operator */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-gray-700">Vehicles per Operator</label>
                  <span className="text-sm font-semibold text-blue-600">{inputs.vehiclesPerOperator}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="60"
                  step="1"
                  value={inputs.vehiclesPerOperator}
                  onChange={(e) => handleInputChange('vehiclesPerOperator', Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((inputs.vehiclesPerOperator - 2) / (60 - 2)) * 100}%, #e5e7eb ${((inputs.vehiclesPerOperator - 2) / (60 - 2)) * 100}%, #e5e7eb 100%)`
                  }}
                />
              </div>

              {/* Vehicle Cost */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-gray-700">Vehicle Cost</label>
                  <span className="text-sm font-semibold text-blue-600">${(inputs.vehicleCost / 1000).toFixed(0)}k</span>
                </div>
                <input
                  type="range"
                  min="50000"
                  max="300000"
                  step="5000"
                  value={inputs.vehicleCost}
                  onChange={(e) => handleInputChange('vehicleCost', Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((inputs.vehicleCost - 50000) / (300000 - 50000)) * 100}%, #e5e7eb ${((inputs.vehicleCost - 50000) / (300000 - 50000)) * 100}%, #e5e7eb 100%)`
                  }}
                />
              </div>

              {/* Ops Hours per Day */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-gray-700">Ops Hours / Day</label>
                  <span className="text-sm font-semibold text-blue-600">{inputs.opsHoursPerDay}h</span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="24"
                  step="1"
                  value={inputs.opsHoursPerDay}
                  onChange={(e) => handleInputChange('opsHoursPerDay', Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((inputs.opsHoursPerDay - 8) / (24 - 8)) * 100}%, #e5e7eb ${((inputs.opsHoursPerDay - 8) / (24 - 8)) * 100}%, #e5e7eb 100%)`
                  }}
                />
              </div>

              {/* Deadhead */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-gray-700">Deadhead</label>
                  <span className="text-sm font-semibold text-blue-600">{inputs.deadheadPercent}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="70"
                  step="1"
                  value={inputs.deadheadPercent}
                  onChange={(e) => handleInputChange('deadheadPercent', Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((inputs.deadheadPercent - 10) / (70 - 10)) * 100}%, #e5e7eb ${((inputs.deadheadPercent - 10) / (70 - 10)) * 100}%, #e5e7eb 100%)`
                  }}
                />
              </div>

              {/* Variable Cost per Mile */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-gray-700">Variable Cost / Mile</label>
                  <span className="text-sm font-semibold text-blue-600">${inputs.variableCostPerMile.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.20"
                  max="2.00"
                  step="0.05"
                  value={inputs.variableCostPerMile}
                  onChange={(e) => handleInputChange('variableCostPerMile', Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((inputs.variableCostPerMile - 0.20) / (2.00 - 0.20)) * 100}%, #e5e7eb ${((inputs.variableCostPerMile - 0.20) / (2.00 - 0.20)) * 100}%, #e5e7eb 100%)`
                  }}
                />
              </div>

              {/* Revenue per Mile */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-gray-700">Revenue / Mile</label>
                  <span className="text-sm font-semibold text-blue-600">${inputs.revenuePerMile.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="1.00"
                  max="5.00"
                  step="0.10"
                  value={inputs.revenuePerMile}
                  onChange={(e) => handleInputChange('revenuePerMile', Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((inputs.revenuePerMile - 1.00) / (5.00 - 1.00)) * 100}%, #e5e7eb ${((inputs.revenuePerMile - 1.00) / (5.00 - 1.00)) * 100}%, #e5e7eb 100%)`
                  }}
                />
              </div>

              {/* X Axis Variable Dropdown */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  X-Axis Variable
                </label>
                <select
                  value={xAxisVariable}
                  onChange={(e) => setXAxisVariable(e.target.value as XAxisVariable)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="utilization">Utilization (%)</option>
                  <option value="deadhead">Deadhead (%)</option>
                  <option value="vehiclesPerOperator">Vehicles per Operator</option>
                </select>
              </div>
            </div>
          </div>

          {/* Right Panel - KPIs and Chart Placeholder */}
          <div className="lg:col-span-2 space-y-6">
            {/* KPIs */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-8">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">COST / MILE</div>
                  <div className="text-2xl font-bold text-gray-900">
                    ${isFinite(currentMetrics.totalCostPerMile) ? currentMetrics.totalCostPerMile.toFixed(2) : '∞'}
                  </div>
                </div>
                
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">MARGIN / MILE</div>
                  <div className={`text-2xl font-bold ${
                    currentMetrics.marginPerMile < 0 ? 'text-red-600' : 'text-gray-900'
                  }`}>
                    ${isFinite(currentMetrics.marginPerMile) ? currentMetrics.marginPerMile.toFixed(2) : '-∞'}
                  </div>
                </div>
              </div>

              <div>
                <span className={`px-3 py-1 rounded text-white text-sm font-medium ${
                  currentMetrics.marginPerMile < 0 ? 'bg-red-500' : 
                  currentMetrics.marginPerMile <= 0.25 ? 'bg-yellow-500' : 'bg-green-500'
                }`}>
                  {currentMetrics.marginPerMile < 0 ? 'Losing' : 
                   currentMetrics.marginPerMile <= 0.25 ? 'Break-even' : 'Profitable'}
                </span>
              </div>
            </div>

            {/* Chart Placeholder */}
            <div className="bg-gray-100 rounded-lg p-8 text-center">
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Chart Coming Soon</h3>
              <p className="text-gray-500">Interactive cost analysis chart will be displayed here.</p>
              <p className="text-sm text-gray-400 mt-2">Selected X-Axis: {xAxisVariable}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
