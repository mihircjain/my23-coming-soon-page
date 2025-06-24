# 🤖 Intelligent MCP Running Coach Setup

## Overview

Your running coach now has **intelligent LLM capabilities** that can:

✅ **Answer ANY question** based on ALL MCP endpoints  
✅ **Dynamically fetch data** based on what you ask  
✅ **Use GPT-4** to analyze your Strava data  
✅ **Provide personalized coaching** with real insights  

## 🔥 What's New

### Before (Fixed 30 activities):
- Always fetched 30 recent activities
- Simple pattern matching
- Limited responses

### Now (Dynamic AI-powered):
- **"How was my run today?"** → Fetches 3 recent activities
- **"Show my heart rate data"** → Fetches activities + detailed streams
- **"What are my running stats?"** → Fetches athlete stats + profile
- **"My starred segments"** → Fetches starred segments
- **"Show my routes"** → Fetches saved routes
- **And much more!**

## 🛠️ Setup Instructions

### Step 1: Install Dependencies
```bash
npm install express cors
```

### Step 2: Add OpenAI API Key
1. Get your OpenAI API key from: https://platform.openai.com/api-keys
2. Add to `.env.local`:
```bash
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### Step 3: Start the Chat Server
```bash
# Terminal 1: Start the chat API server
node dev-chat-server.js

# Terminal 2: Start your frontend
npm run dev
```

### Step 4: Test the Intelligence! 🧠

Go to `http://localhost:8080/mcp-coach` and ask:

**Smart Questions:**
- "How was my run today?"
- "Show me my last 5 activities"
- "What's my total running distance this month?"
- "Get my heart rate data from yesterday's run"
- "What are my starred segments?"
- "Show my saved routes"
- "Analyze my running progress"
- "What zones am I training in?"

## 🧠 How It Works

### 3-Step AI Process:

1. **GPT Analyzes Query**: 
   - "Show my heart rate data" → Need recent activities + streams
   - "What are my stats?" → Need athlete stats + profile

2. **Dynamic Data Fetching**:
   - Fetches only relevant MCP endpoints
   - Parameters determined by query context

3. **GPT Generates Response**:
   - Analyzes all fetched data
   - Provides personalized coaching advice
   - Uses actual numbers from your Strava

## 📊 Available MCP Endpoints

Your coach can now access ALL of these:

| Endpoint | What It Does |
|----------|-------------|
| `get-recent-activities` | Your recent workouts |
| `get-athlete-profile` | Your profile info |
| `get-athlete-stats` | Overall statistics |
| `get-activity-details` | Specific workout details |
| `get-activity-streams` | Heart rate, pace, power data |
| `get-activity-laps` | Interval/lap data |
| `get-athlete-zones` | Your training zones |
| `list-starred-segments` | Your favorite segments |
| `explore-segments` | Find segments near you |
| `list-athlete-routes` | Your saved routes |
| `get-route` | Route details |

## 🎯 Example Interactions

**Question**: *"How was my run today?"*
**AI Response**: 
```
🏃‍♂️ Great question! Looking at your recent activities...

📊 **Today's Run Analysis:**
• Morning Run - 9.01km in 45:23
• Average pace: 5:02/km  
• Date: 6/24/2025

💪 **Coaching Insights:**
Your pace today was consistent with your recent training. The 9km distance 
shows good endurance building. Consider adding a tempo section next time!

📈 **Recent Progress:**
- Last 3 runs: 9.0km, 6.0km, 21.1km
- Showing good variety in distance
- Maintain this consistency!
```

**Question**: *"Show me my heart rate data from yesterday"*
**AI Response**:
```
❤️ **Heart Rate Analysis - Yesterday's Run**

📊 **Stream Data Found:**
• Max HR: 182 bpm
• Average HR: 156 bpm  
• Time in Zone 2: 65% (aerobic base)
• Time in Zone 4: 20% (lactate threshold)

🎯 **Zone Analysis:**
Excellent aerobic development! You spent most time in Zone 2 which is 
perfect for base building. The 20% in Zone 4 shows good intensity work.

💡 **Coaching Tip:**
This distribution is ideal for endurance running. Keep this pattern!
```

## 🔧 Troubleshooting

### Chat Server Not Starting?
```bash
# Check if port 3001 is available
lsof -i :3001

# Kill any process using the port
kill -9 <PID>
```

### No OpenAI Key?
- The system falls back to rule-based responses
- Still works, just less intelligent
- Get a key at: https://platform.openai.com/

### MCP Connection Issues?
- Ensure your MCP server is running on port 10000
- Check `curl http://localhost:10000/health`

## 🚀 Next Steps

1. **Test different questions** to see the AI in action
2. **Add your OpenAI key** for full intelligence
3. **Ask complex questions** that require multiple data sources
4. **Share feedback** on the coaching quality!

The coach now truly understands your data and can provide insights no simple system could! 🎉 
