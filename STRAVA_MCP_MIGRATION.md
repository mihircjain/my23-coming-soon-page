# Strava MCP Migration Guide

This document outlines the migration from Firestore-based Strava activity logic to using MCP (Model Context Protocol) server endpoints.

## 🎯 Overview

The migration replaces direct Firestore queries for Strava activity data with calls to an MCP server, while keeping nutrition and body metrics data on Firestore as specified.

### ✅ What's Migrated to MCP
- **Activity Data**: Recent activities, run details, workout analysis
- **Athlete Profile**: Basic athlete information
- **Activity Streams**: Time-series data (HR, pace, elevation)
- **Activity Details**: Splits, laps, efforts, zones
- **Athlete Stats**: Total distance, time, elevation gains
- **Segments**: Segment exploration and details

### 📦 What Stays on Firestore
- **Nutrition Data**: Food logs, daily nutrition totals
- **Body Metrics**: Weight, body fat, blood markers
- **User Preferences**: Settings and configurations

## 🏗️ Architecture

```
Frontend (my23.ai)
    ↓
MCP Client (src/lib/mcpClient.ts)
    ↓
MCP Proxy API (api/mcp-proxy.js) [Optional Bridge]
    ↓
MCP Server (strava-mcp) → Deployed on Render
    ↓
Strava API
```

## 📁 New Files Created

### 1. MCP Client (`src/lib/mcpClient.ts`)
- TypeScript client for MCP server communication
- Provides typed interfaces for all Strava data
- Handles authentication and error management
- Includes response parsing for text-based MCP responses

### 2. React Hooks (`src/hooks/useStrava.ts`)
- React hooks for easy integration with components
- Built-in loading states and error handling
- Automatic caching with configurable timeouts
- Specific hooks for different data types

### 3. API Proxy (`api/mcp-proxy.js`)
- Bridge between existing API structure and MCP server
- Provides fallback mechanisms
- Handles response parsing and formatting
- RESTful interface for MCP tools

## 🚀 Deployment Guide

### ✅ RECOMMENDED: Render Deployment (MCP Server)

**Why Render?** MCP servers need persistent processes, not serverless functions. Render is perfect for this.

#### Step 1: Deploy to Render
1. Go to [render.com](https://render.com) and sign up/login
2. Click "New +" → "Web Service"
3. Connect GitHub and select your `strava-mcp` repository
4. Use these settings:
   ```
   Name: strava-mcp-server
   Environment: Node
   Region: Oregon (US West)
   Branch: main
   Build Command: npm run build
   Start Command: npm start
   Auto-Deploy: Yes
   ```

#### Step 2: Environment Variables in Render
Add these in the "Environment" tab:
```bash
STRAVA_ACCESS_TOKEN=your_actual_strava_access_token
NODE_ENV=production
PORT=10000
ROUTE_EXPORT_PATH=./strava-exports
```

#### Step 3: Get Your URL
After deployment, you'll get: `https://strava-mcp-server-XXXX.onrender.com`

#### Step 4: Update Frontend Environment
In your frontend `.env` file, add:
```bash
NEXT_PUBLIC_MCP_API_URL=https://strava-mcp-server-XXXX.onrender.com
```

### Alternative: Railway Deployment
```bash
# Install Railway CLI
npm install -g @railway/cli

# In MCP server directory
railway login
railway link
railway up

# Set environment variables in Railway dashboard
```

### Alternative: Fly.io Deployment
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# In MCP server directory
fly launch --name strava-mcp-server
fly deploy

# Set environment variables
fly secrets set STRAVA_ACCESS_TOKEN=your_token
```

### ⚠️ Vercel NOT Recommended
Vercel has 10-second function limits and is designed for serverless, not persistent MCP servers. The build issues have been fixed but the platform isn't suitable for MCP architecture.

## 🔧 API Usage Examples

### Using MCP Client Directly
```typescript
import mcpClient, { setMcpAccessToken } from '@/lib/mcpClient';

// Set access token
setMcpAccessToken('your_strava_access_token');

// Get recent activities
const activities = await mcpClient.getRecentActivities(10);

// Get activity details
const details = await mcpClient.getActivityDetails('12345');

// Get activity streams
const streams = await mcpClient.getActivityStreams('12345', ['heartrate', 'velocity_smooth']);
```

### Using React Hooks
```typescript
import { useRecentActivities, useActivityDetails } from '@/hooks/useStrava';

function ActivityComponent() {
  const { data: activities, loading, error, refetch } = useRecentActivities(10, {
    autoFetch: true,
    accessToken: 'your_token'
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {activities?.map(activity => (
        <div key={activity.id}>{activity.name}</div>
      ))}
    </div>
  );
}
```

### Using API Proxy
```javascript
// GET /api/mcp-proxy?action=recent-activities&perPage=10
// GET /api/mcp-proxy?action=activity-details&activityId=12345
// GET /api/mcp-proxy?action=athlete-profile
```

## 🛠️ Available MCP Tools

| Tool Name | Endpoint | Description |
|-----------|----------|-------------|
| `get-recent-activities` | `/tools/get-recent-activities` | Fetch recent activities |
| `get-activity-details` | `/tools/get-activity-details` | Detailed activity breakdown |
| `get-activity-streams` | `/tools/get-activity-streams` | Time-series data |
| `get-activity-laps` | `/tools/get-activity-laps` | Lap/interval splits |
| `get-athlete-profile` | `/tools/get-athlete-profile` | Athlete information |
| `get-athlete-stats` | `/tools/get-athlete-stats` | Total stats and totals |
| `get-athlete-zones` | `/tools/get-athlete-zones` | HR/power zones |
| `explore-segments` | `/tools/explore-segments` | Segment discovery |
| `get-segment` | `/tools/get-segment` | Segment details |

## 🔍 Testing the Migration

### 1. Test MCP Server (After Render Deployment)
```bash
# Test your deployed MCP server
curl https://strava-mcp-server-XXXX.onrender.com/tools/get-recent-activities?perPage=5
```

### 2. Test Frontend Integration
```bash
# In frontend directory
npm run dev

# Check browser console for MCP logs:
# "🏃 Fetching run data via MCP for 7 days..."
# "✅ Loaded X valid runs via MCP"
```

### 3. Verify Fallback Mechanism
```bash
# If MCP server is down, you should see:
# "🔄 Falling back to original Strava API..."
```

## 🐛 Troubleshooting

### Common Issues

#### 1. MCP Server Not Responding
```
❌ Error fetching runs via MCP: fetch failed
🔄 Falling back to original Strava API...
```
**Solution**: 
- Check Render deployment logs
- Verify environment variables are set
- Ensure STRAVA_ACCESS_TOKEN is valid

#### 2. Authentication Errors
```
❌ Configuration Error: STRAVA_ACCESS_TOKEN is missing
```
**Solution**: Add STRAVA_ACCESS_TOKEN in Render environment variables

#### 3. CORS Issues
```
Access to fetch blocked by CORS
```
**Solution**: CORS headers are included in MCP server, check deployment

#### 4. Parse Errors
```
⚠️ No activities found from MCP server
```
**Solution**: Check MCP response format and access token validity

### Debug Mode

Enable detailed logging:
```typescript
// In browser console
localStorage.setItem('debug', 'mcp:*');
```

### Render-Specific Debugging
- Check Render deployment logs in dashboard
- Verify build completed successfully
- Test MCP endpoints directly via Render URL

## 🚧 Future Enhancements

### Phase 1: Basic Migration ✅
- [x] MCP client implementation
- [x] React hooks for data fetching
- [x] Fallback mechanisms
- [x] Basic activity parsing
- [x] Render deployment configuration

### Phase 2: Enhanced Features 🔄
- [ ] Better response parsing (JSON instead of text)
- [ ] Real-time activity updates
- [ ] Advanced caching strategies
- [ ] Performance monitoring

### Phase 3: Advanced Integration 📋
- [ ] Chart generation from MCP streams
- [ ] AI analysis of activity data
- [ ] Segment recommendations
- [ ] Training plan integration

## 📞 Support

For issues with the migration:

1. **Check Render logs**: Dashboard → Services → strava-mcp-server → Logs
2. **Verify environment**: Ensure all required environment variables are set in Render
3. **Test MCP server**: Use curl to test endpoints directly
4. **Use fallback**: The system gracefully falls back to existing APIs

## 🔗 Related Documentation

- [MCP Server Repository](https://github.com/mihircjain/strava-mcp)
- [Render Deployment Guide](https://render.com/docs/deploy-node-express-app)
- [Strava API Documentation](https://developers.strava.com/docs/reference/)
- [Model Context Protocol Spec](https://spec.modelcontextprotocol.io/)

---

**Migration Status**: ✅ Strava activity data now powered by MCP server on Render with automatic fallback for reliability.

**Deployment**: 🚀 Optimized for Render deployment with persistent process architecture. 
