# Robotaxi Unit Economics Simulator

**Version 1.0.0** - A React + TypeScript + Tailwind + Recharts single-page application for simulating robotaxi unit economics and analyzing cost structures.

🌐 **Live Demo**: https://rafaelmaranon.github.io/Waymo-cost-model/

## Features

- **Interactive Parameters**: Adjust fleet size, utilization, vehicle costs, and operational parameters
- **Real-time Calculations**: Live updates of cost per mile and margin calculations
- **Dynamic Charts**: Visualize how different variables affect total cost per mile
- **Economic Model**: Based on realistic robotaxi operational assumptions

## Economic Model

### Constants
- Operator cost per hour: $40
- Vehicle lifetime: 1,825 days (5 years)
- Maximum miles per day: 300

### Key Formulas
- **Fixed Daily Cost** = Vehicle cost per day + Teleops and ops per day
- **Total Cost per Mile** = (Fixed daily cost / Paid miles per day) + Variable cost per mile
- **Margin per Mile** = Revenue per mile - Total cost per mile

## Getting Started

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/rafaelmaranon/Waymo-cost-model.git
cd Waymo-cost-model
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:5173`

### Building for Production

```bash
npm run build
```

## Usage

1. **Adjust Parameters**: Use the sliders on the left panel to modify:
   - Fleet size (500-10,000 vehicles)
   - Utilization percentage (10-90%)
   - Vehicles per operator (2-60)
   - Vehicle cost ($50k-$300k)
   - Operational hours per day (8-24h)
   - Deadhead percentage (10-70%)
   - Variable cost per mile ($0.20-$2.00)
   - Revenue per mile ($1.00-$5.00)

2. **Select X-Axis Variable**: Choose which parameter to analyze on the chart:
   - Utilization (%)
   - Deadhead (%)
   - Vehicles per operator

3. **Analyze Results**: View real-time KPIs and cost curves:
   - Cost per mile
   - Margin per mile
   - Profitability status (Losing/Break-even/Profitable)

## Technology Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Recharts** - Data visualization
- **Vite** - Build tool

## API Endpoints

### POST /api/chat

Chat endpoint for AI-powered analysis of simulation states.

**Features:**
- Rate limiting: 30 messages per day per session
- OpenAI GPT-4o-mini integration
- Supabase logging and storage
- Real-time simulation state analysis

**Request:**
```json
{
  "sessionId": "unique-session-identifier",
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
}
```

**Response:**
```json
{
  "reply": "Your cost per mile is high primarily due to low utilization (40%) and high deadhead percentage (44%). Consider increasing utilization or reducing deadhead miles to improve economics."
}
```

**Environment Variables Required:**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `OPENAI_API_KEY` - Your OpenAI API key

## Version History

### V1.0.0 (Current)
- ✅ Complete interactive parameter controls (8 sliders)
- ✅ Real-time economic calculations and KPIs
- ✅ Dynamic charts with reference lines and current point indicators
- ✅ Responsive design matching reference layout
- ✅ GitHub Pages deployment with proper asset paths
- ✅ Full documentation and deployment guide

**Branches:**
- `main` - Current development (V1.0.0)
- `v1.0.0-stable` - Stable V1.0.0 for preservation
- `v1.0.0` tag - Release tag for V1.0.0

## License

MIT License
