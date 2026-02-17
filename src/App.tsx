import React, { useState, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

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
  }
}

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
  const [userMessage, setUserMessage] = useState('')
  const [aiReply, setAiReply] = useState('')
  const [loading, setLoading] = useState(false)
  const [showDisclaimer, setShowDisclaimer] = useState(false)

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

  // Calculate break-even utilization
  const breakEvenUtilizationPercent = useMemo(() => {
    const vehicleCostPerDay = inputs.vehicleCost / vehicleLifetimeDays
    const teleopsAndOpsPerDay = (operatorCostPerHour * inputs.opsHoursPerDay) / inputs.vehiclesPerOperator
    const fixedDailyCost = vehicleCostPerDay + teleopsAndOpsPerDay
    
    const deadheadDecimal = Math.min(inputs.deadheadPercent / 100, 0.95)
    const paidMilesRatio = (1 - deadheadDecimal)
    
    // At break-even: marginPerMile = 0
    // revenuePerMile - totalCostPerMile = 0
    // revenuePerMile - (fixedDailyCost / paidMilesPerDay + variableCostPerMile) = 0
    // revenuePerMile - (fixedDailyCost / (maxMilesPerDay * utilization * paidMilesRatio) + variableCostPerMile) = 0
    // Solve for utilization:
    // utilization = fixedDailyCost / (maxMilesPerDay * paidMilesRatio * (revenuePerMile - variableCostPerMile))
    
    const netRevenuePerMile = inputs.revenuePerMile - inputs.variableCostPerMile
    if (netRevenuePerMile <= 0 || paidMilesRatio <= 0) return null
    
    const breakEvenUtilization = fixedDailyCost / (maxMilesPerDay * paidMilesRatio * netRevenuePerMile)
    const breakEvenPercent = breakEvenUtilization * 100
    
    return (breakEvenPercent >= 0 && breakEvenPercent <= 100) ? breakEvenPercent : null
  }, [inputs])

  // Generate chart data
  const chartData = useMemo(() => {
    const data = []
    let range: { min: number; max: number; step: number }
    
    switch (xAxisVariable) {
      case 'utilization':
        range = { min: 10, max: 90, step: 2 }
        break
      case 'deadhead':
        range = { min: 10, max: 70, step: 1.5 }
        break
      case 'vehiclesPerOperator':
        range = { min: 2, max: 60, step: 1.5 }
        break
    }
    
    for (let value = range.min; value <= range.max; value += range.step) {
      const testInputs = { ...inputs }
      
      switch (xAxisVariable) {
        case 'utilization':
          testInputs.utilizationPercent = value
          break
        case 'deadhead':
          testInputs.deadheadPercent = value
          break
        case 'vehiclesPerOperator':
          testInputs.vehiclesPerOperator = value
          break
      }
      
      const metrics = calculateMetrics(testInputs)
      
      data.push({
        x: value,
        totalCostPerMile: Math.min(metrics.totalCostPerMile, 10), // Cap for display
        isCurrentPoint: Math.abs(value - (xAxisVariable === 'utilization' ? inputs.utilizationPercent : 
                                        xAxisVariable === 'deadhead' ? inputs.deadheadPercent : 
                                        inputs.vehiclesPerOperator)) < range.step / 2
      })
    }
    
    return data
  }, [inputs, xAxisVariable])



  const handleInputChange = (field: keyof SimulationInputs, value: number) => {
    setInputs(prev => ({ ...prev, [field]: value }))
  }

  const handlePresetSelect = (presetName: string) => {
    if (presetName && PRESETS[presetName as keyof typeof PRESETS]) {
      setInputs(PRESETS[presetName as keyof typeof PRESETS])
    }
  }

  const handleReset = () => {
    setInputs(PRESETS['Scaling city']) // Reset to default preset
  }

  const getXAxisLabel = () => {
    switch (xAxisVariable) {
      case 'utilization':
        return 'Utilization (%)'
      case 'deadhead':
        return 'Deadhead (%)'
      case 'vehiclesPerOperator':
        return 'Vehicles per Operator'
    }
  }

  const handleAskAI = async () => {
    if (!userMessage.trim()) return
    
    setLoading(true)
    setAiReply('')

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: 'demo',
          userMessage,
          simState: {
            fleetSize: inputs.fleetSize,
            vehiclesPerOperator: inputs.vehiclesPerOperator,
            vehicleCost: inputs.vehicleCost,
            opsHoursPerDay: inputs.opsHoursPerDay,
            deadheadPercent: inputs.deadheadPercent,
            variableCostPerMile: inputs.variableCostPerMile,
            revenuePerMile: inputs.revenuePerMile,
            utilizationPercent: inputs.utilizationPercent,
            totalCostPerMile: currentMetrics.totalCostPerMile,
            marginPerMile: currentMetrics.marginPerMile,
            breakEvenUtilizationPercent: breakEvenUtilizationPercent,
            status: currentMetrics.marginPerMile < 0 ? 'Losing' : 
                    currentMetrics.marginPerMile <= 0.25 ? 'Break-even' : 'Profitable'
          }
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setAiReply(`Error: ${errorData.error}`)
        return
      }

      // Handle streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullResponse = ''
      let hasShownLoading = false

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          
          const chunk = decoder.decode(value, { stream: true })
          fullResponse += chunk
          
          // Show loading state only once at the beginning
          if (!hasShownLoading) {
            setAiReply('📊 Analyzing your robotaxi economics...')
            hasShownLoading = true
          }
          
          // Try to parse and format only when we have complete JSON
          if (fullResponse.includes('}')) {
            try {
              const structuredData = JSON.parse(fullResponse)
              if (structuredData.headline && structuredData.insights) {
                setAiReply(renderStructuredResponse(structuredData))
                break // Stop updating once we have formatted response
              }
            } catch {
              // Continue streaming until we get valid JSON
            }
          }
        }
      }

      // Final parse attempt if not already formatted
      if (!fullResponse.includes('🎯')) {
        try {
          const structuredData = JSON.parse(fullResponse)
          if (structuredData.headline && structuredData.insights) {
            setAiReply(renderStructuredResponse(structuredData))
          } else {
            setAiReply(fullResponse) // Fallback to raw text
          }
        } catch {
          setAiReply(fullResponse) // Fallback to raw text
        }
      }

    } catch (error) {
      setAiReply('Network error occurred')
    } finally {
      setLoading(false)
    }
  }

  const renderStructuredResponse = (data: any) => {
    let formatted = `🎯 ${data.headline}\n\n`
    
    if (data.insights?.length) {
      formatted += '💡 KEY INSIGHTS:\n'
      data.insights.forEach((insight: string) => {
        formatted += `  • ${insight}\n`
      })
      formatted += '\n'
    }
    
    if (data.top_levers?.length) {
      formatted += '🔧 TOP LEVERS:\n'
      data.top_levers.forEach((lever: any) => {
        formatted += `  • ${lever.lever} (${lever.direction}): ${lever.why}\n`
      })
      formatted += '\n'
    }
    
    if (data.recommended_next_change) {
      formatted += `🎯 NEXT STEP:\n  ${data.recommended_next_change}\n\n`
    }
    
    if (data.sanity_checks?.length) {
      formatted += '⚠️ SANITY CHECKS:\n'
      data.sanity_checks.forEach((check: string) => {
        formatted += `  • ${check}\n`
      })
    }
    
    return formatted
  }


  return (
    <div className="min-h-screen lg:h-screen bg-white p-4 overflow-visible lg:overflow-hidden">
      <div className="max-w-6xl mx-auto h-full flex flex-col">
        {/* Header */}
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">
              Robotaxi Cost Model
            </h1>
            <p className="text-gray-600 text-sm mb-1" style={{ opacity: 0.7 }}>
              Unit economics simulator for robotaxi fleets
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 justify-start lg:justify-end">
            <select
              onChange={(e) => handlePresetSelect(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              defaultValue=""
            >
              <option value="" disabled>Presets</option>
              {Object.keys(PRESETS).map(preset => (
                <option key={preset} value={preset}>{preset}</option>
              ))}
            </select>
            
            <button
              onClick={handleReset}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded-md text-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Reset
            </button>
            
            <button
              onClick={() => setShowDisclaimer(true)}
              className="text-blue-600 hover:text-blue-800 text-sm focus:outline-none"
            >
              ⓘ Disclaimer
            </button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6 flex-1 overflow-visible lg:overflow-hidden">
          {/* Left Panel - Inputs */}
          <div className="lg:col-span-1 lg:overflow-y-auto lg:min-h-0">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Parameters</h2>
            
            <div className="space-y-8 pb-4">
              {/* Fleet */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-200">Fleet</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Fleet Size</label>
                    <div className="text-xs text-gray-500 mb-2">{inputs.fleetSize.toLocaleString()}</div>
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
                </div>
              </div>

              {/* Demand & Utilization */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-200">Demand & Utilization</h3>
                <div className="space-y-3">
                  {/* Utilization */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Utilization</label>
                    <div className="text-xs text-gray-500 mb-2">{inputs.utilizationPercent}%</div>
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

                  {/* Deadhead */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Deadhead</label>
                    <div className="text-xs text-gray-500 mb-2">{inputs.deadheadPercent}%</div>
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

                  {/* Ops Hours per Day */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Ops Hours / Day</label>
                    <div className="text-xs text-gray-500 mb-2">{inputs.opsHoursPerDay}h</div>
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
                </div>
              </div>

              {/* Cost Structure (CapEx + OpEx) */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-200">Cost Structure (CapEx + OpEx)</h3>
                <div className="space-y-3">
                  {/* Vehicle Cost */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Vehicle Cost</label>
                    <div className="text-xs text-gray-500 mb-2">${(inputs.vehicleCost / 1000).toFixed(0)}k</div>
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

                  {/* Vehicles per Operator */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Vehicles per Operator</label>
                    <div className="text-xs text-gray-500 mb-2">{inputs.vehiclesPerOperator}</div>
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

                  {/* Variable Cost per Mile */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Variable Cost / Mile</label>
                    <div className="text-xs text-gray-500 mb-2">${inputs.variableCostPerMile.toFixed(2)}</div>
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
                </div>
              </div>

              {/* Pricing */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3 pb-2 border-b border-gray-200">Pricing</h3>
                <div className="space-y-3">
                  {/* Revenue per Mile */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">Revenue / Mile</label>
                    <div className="text-xs text-gray-500 mb-2">${inputs.revenuePerMile.toFixed(2)}</div>
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
                </div>
              </div>
            </div>
          </div>

          {/* Right Panel - KPIs and Chart */}
          <div className="lg:col-span-2 flex flex-col lg:h-full overflow-visible lg:overflow-hidden">
            {/* KPIs */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:flex sm:items-center sm:space-x-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    ${isFinite(currentMetrics.totalCostPerMile) ? currentMetrics.totalCostPerMile.toFixed(2) : '∞'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Cost / mile</div>
                </div>
                
                <div className="text-center">
                  <div className={`text-2xl font-bold ${
                    currentMetrics.marginPerMile < 0 ? 'text-red-600' : 'text-gray-900'
                  }`}>
                    ${isFinite(currentMetrics.marginPerMile) ? currentMetrics.marginPerMile.toFixed(2) : '-∞'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Margin / mile</div>
                </div>

                <div className="text-center" title="Minimum utilization required for margin per mile to reach $0, holding all other parameters constant.">
                  <div className="text-2xl font-bold text-gray-900">
                    {breakEvenUtilizationPercent !== null ? `${breakEvenUtilizationPercent.toFixed(1)}%` : 'n/a'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Break-even utilization</div>
                </div>
              </div>

              <div className="w-full sm:w-auto">
                <span className={`px-3 py-1 rounded text-white text-sm font-medium ${
                  currentMetrics.marginPerMile < 0 ? 'bg-red-500' : 
                  currentMetrics.marginPerMile <= 0.25 ? 'bg-yellow-500' : 'bg-green-500'
                }`}>
                  {currentMetrics.marginPerMile < 0 ? 'Status: Losing' : 
                   currentMetrics.marginPerMile <= 0.25 ? 'Status: Break-even' : 'Status: Profitable'}
                </span>
              </div>
            </div>

            {/* Chart */}
            <div className="h-[320px] sm:h-[380px] lg:flex-1 lg:min-h-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-800">Cost Analysis</h3>
                <select
                  value={xAxisVariable}
                  onChange={(e) => setXAxisVariable(e.target.value as XAxisVariable)}
                  className="w-full sm:w-auto px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                >
                  <option value="utilization">Utilization (%)</option>
                  <option value="deadhead">Deadhead (%)</option>
                  <option value="vehiclesPerOperator">Vehicles per Operator</option>
                </select>
              </div>
              <div className="h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 20, right: 30, left: 40, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="2 2" stroke="#f0f0f0" />
                    <XAxis 
                      dataKey="x" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#666' }}
                      label={{ value: getXAxisLabel(), position: 'insideBottom', offset: -5, style: { textAnchor: 'middle', fontSize: '12px', fill: '#666' } }}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#666' }}
                      label={{ value: 'Total Cost / Mile ($)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fontSize: '12px', fill: '#666' } }}
                      domain={[0, 10]}
                    />
                    <Tooltip 
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost per Mile']}
                      labelFormatter={(label) => `${getXAxisLabel()}: ${label}`}
                      contentStyle={{ 
                        backgroundColor: 'white', 
                        border: '1px solid #ccc', 
                        borderRadius: '4px',
                        fontSize: '12px'
                      }}
                    />
                    
                    {/* Reference Lines */}
                    <ReferenceLine 
                      y={2.0} 
                      stroke="#ff6b6b" 
                      strokeDasharray="4 4" 
                      label={{ value: "Break-even $2", position: "top", style: { fontSize: '10px', fill: '#ff6b6b' } }} 
                    />
                    <ReferenceLine 
                      y={1.5} 
                      stroke="#51cf66" 
                      strokeDasharray="4 4" 
                      label={{ value: "Healthy $1.50", position: "top", style: { fontSize: '10px', fill: '#51cf66' } }} 
                    />
                    
                    {/* Break-even Utilization Line (only when X-axis is Utilization) */}
                    {xAxisVariable === 'utilization' && breakEvenUtilizationPercent !== null && (
                      <ReferenceLine 
                        x={breakEvenUtilizationPercent} 
                        stroke="#9333ea" 
                        strokeDasharray="3 3" 
                        label={{ value: "Break-even", position: "top", style: { fontSize: '10px', fill: '#9333ea' } }} 
                      />
                    )}
                    
                    {/* Main Line */}
                    <Line 
                      type="monotone" 
                      dataKey="totalCostPerMile" 
                      stroke="#3b82f6" 
                      strokeWidth={2}
                      dot={false}
                    />
                    
                    {/* Current Point */}
                    <Line 
                      type="monotone" 
                      dataKey="totalCostPerMile" 
                      stroke="transparent"
                      dot={(props: any) => {
                        const entry = chartData[props.index]
                        if (entry?.isCurrentPoint) {
                          return (
                            <circle 
                              cx={props.cx} 
                              cy={props.cy} 
                              r={5} 
                              fill="#3b82f6"
                              stroke="#ffffff"
                              strokeWidth={2}
                            />
                          )
                        }
                        return <circle r={0} />
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chat UI */}
            <div className="bg-white rounded-lg shadow-lg p-4 flex flex-col h-auto lg:min-h-[300px] shrink-0">
              <h3 className="text-lg font-semibold text-gray-800 mb-3">Insights</h3>
              
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  onClick={() => setUserMessage("Why am I losing money?")}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200"
                >
                  Why am I losing money?
                </button>
                <button
                  onClick={() => setUserMessage("How can I reach break-even?")}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200"
                >
                  How can I reach break-even?
                </button>
                <button
                  onClick={() => setUserMessage("What matters most right now?")}
                  className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm hover:bg-gray-200"
                >
                  What matters most right now?
                </button>
              </div>
              
              <div className="space-y-2 mb-3">
                <textarea
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleAskAI()
                    }
                  }}
                  placeholder="Ask about your robotaxi economics..."
                  className="w-full p-2 border border-gray-300 rounded-md resize-none h-16"
                  disabled={loading}
                />
                
                <button
                  onClick={handleAskAI}
                  disabled={loading || !userMessage.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {loading ? 'Asking...' : 'Ask AI'}
                </button>
              </div>

              {aiReply && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md flex-1 overflow-y-auto max-h-[40vh] lg:max-h-[220px] min-h-[120px]">
                  <div className="text-sm whitespace-pre-wrap">{aiReply}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Disclaimer Modal */}
        {showDisclaimer && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Disclaimer</h3>
              <p className="text-sm text-gray-700 mb-4">
                This is an independent, educational simulator based on public information and user-provided assumptions. 
                It is not affiliated with Waymo, Zoox, Tesla, or any company. It contains no proprietary/confidential data. 
                Outputs are illustrative and not financial advice.
              </p>
              <button
                onClick={() => setShowDisclaimer(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
