# 🚀 Production Deployment Guide

## Overview
Your **MY23 Running Coach** system is now production-ready with:
- **Frontend**: React/Vite app deployed to Vercel
- **MCP Server**: Deployed to Render at `https://strava-mcp-server.onrender.com`
- **AI Chat API**: Serverless functions on Vercel with Gemini integration

## 🎯 Architecture

```
Frontend (Vercel)
    ↓
Vercel API Routes (/api/*)
    ↓
MCP Server (Render) → Strava API
    ↓
Gemini AI (Google) for intelligent responses
```

## 🔧 Environment Variables Setup

### 1. **Create `.env.local` for Development**
```bash
# Strava API
STRAVA_ACCESS_TOKEN=d74aa70fd9b59d8921fad453aefd82848899bb1d
VITE_STRAVA_ACCESS_TOKEN=d74aa70fd9b59d8921fad453aefd82848899bb1d

# MCP Server (Production Render URL)
MCP_SERVER_URL=https://strava-mcp-server.onrender.com
NEXT_PUBLIC_MCP_API_URL=https://strava-mcp-server.onrender.com

# Google Gemini AI
GEMINI_API_KEY=AIzaSyCcypHkXBvRUBWYNbmpq2GnIOa4tvhUlhc

# Firebase (Optional - for user auth)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
# ... other Firebase config
```

### 2. **Vercel Environment Variables**
In your Vercel dashboard, add these production environment variables:

```bash
STRAVA_ACCESS_TOKEN=d74aa70fd9b59d8921fad453aefd82848899bb1d
MCP_SERVER_URL=https://strava-mcp-server.onrender.com
GEMINI_API_KEY=AIzaSyCcypHkXBvRUBWYNbmpq2GnIOa4tvhUlhc
```

### 3. **Render MCP Server Environment Variables**
Your MCP server on Render should have:
```bash
STRAVA_ACCESS_TOKEN=d74aa70fd9b59d8921fad453aefd82848899bb1d
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret
```

## 📦 Deployment Steps

### **Step 1: Deploy to Vercel**
```bash
# Build and deploy
npm run build
vercel --prod

# Or link to existing project
vercel link
vercel --prod
```

### **Step 2: Verify MCP Server**
Your Render MCP server should be accessible at:
- Health: `https://strava-mcp-server.onrender.com/health`
- Tools: `https://strava-mcp-server.onrender.com/tools`

### **Step 3: Test Production System**
```bash
# Test MCP server directly
curl "https://strava-mcp-server.onrender.com/health"

# Test through your frontend
curl -X POST "https://your-app.vercel.app/api/chat-mcp-intelligent" \
  -H "Content-Type: application/json" \
  -d '{"message": "How was my run today?", "userId": "mihir_jain"}'
```

## 🎮 Available Endpoints

### **Frontend Routes**
- `/` - Main coming soon page
- `/mcp-coach` - Running coach interface
- `/letsjam` - LetsJam functionality

### **API Routes**
- `/api/chat-mcp` - Simple MCP chat
- `/api/chat-mcp-intelligent` - AI-powered intelligent chat
- `/api/mcp-proxy` - MCP server proxy

### **MCP Server Tools**
- `get-recent-activities` - Fetch latest Strava activities
- `get-activity-streams` - Detailed activity data (HR, pace, elevation)
- `get-athlete-profile` - User profile information
- `get-athlete-stats` - Overall statistics

## 🔄 Development vs Production

### **Development Mode**
```bash
# Start local development
npm run dev

# Start local chat server (for testing)
node dev-chat-server.mjs
```
- Uses Vite proxy to `https://strava-mcp-server.onrender.com`
- Local chat server on port 3001 (optional)

### **Production Mode**
- Frontend served from Vercel CDN
- API routes as Vercel serverless functions
- MCP server on Render (always available)

## ✅ Production Checklist

- [x] **MCP Server**: Deployed to Render
- [x] **Environment Variables**: Updated for production URLs
- [x] **API Routes**: Ready for Vercel deployment
- [x] **CORS**: Configured for cross-origin requests
- [x] **Error Handling**: Comprehensive error messages
- [x] **Fallbacks**: Graceful degradation when services unavailable

## 🎯 Next Steps

1. **Deploy to Vercel**: `vercel --prod`
2. **Set Environment Variables**: Add production env vars in Vercel dashboard
3. **Test End-to-End**: Verify chat functionality works
4. **Monitor Logs**: Check Vercel and Render logs for issues

## 🔧 Troubleshooting

### **Common Issues**
1. **CORS Errors**: Ensure MCP server has proper CORS headers
2. **API Quota**: Gemini has 50 requests/day on free tier
3. **Cold Starts**: Render apps sleep after 15 minutes of inactivity

### **Debug Commands**
```bash
# Check MCP server health
curl https://strava-mcp-server.onrender.com/health

# Test local proxy
curl http://localhost:8080/api/mcp/health

# Check Vercel logs
vercel logs
```

## 🎉 You're Production Ready!

Your intelligent running coach system is now ready for production deployment with:
- ✅ Real Strava data integration
- ✅ AI-powered query analysis 
- ✅ Heart rate and activity analysis
- ✅ Beautiful UI with real-time responses
- ✅ Scalable serverless architecture 
