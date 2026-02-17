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
            status: currentMetrics.marginPerMile < 0 ? 'Losing' : 
                    currentMetrics.marginPerMile <= 0.25 ? 'Break-even' : 'Profitable'
          }
        }),
      })

      const data = await response.json()
      
      if (response.ok) {
        setAiReply(data.reply)
      } else {
        setAiReply(`Error: ${data.error}`)
      }
    } catch (error) {
      setAiReply('Network error occurred')
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Robotaxi Cost Model
        </h1>
        <p className="text-gray-600 mb-6" style={{ opacity: 0.7 }}>
          Unit economics simulator for robotaxi fleets
        </p>
        
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

          {/* Right Panel - KPIs and Chart */}
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

            {/* Chart */}
            <div>
              <div className="h-80">
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
            <div className="bg-white rounded-lg shadow-lg p-4 space-y-4">
              <h3 className="text-lg font-semibold text-gray-800">Ask AI</h3>
              
              <div className="space-y-2">
                <textarea
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  placeholder="Ask about your robotaxi economics..."
                  className="w-full p-2 border border-gray-300 rounded-md resize-none h-20"
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
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <div className="text-sm whitespace-pre-wrap">{aiReply}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
