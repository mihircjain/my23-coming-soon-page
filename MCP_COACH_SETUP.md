# MCP Running Coach Setup Guide

## Current Status ✅
- **Frontend**: Running on `http://localhost:8081`
- **MCP Server**: Running and healthy on `http://localhost:10000`
- **Route**: Available at `http://localhost:8081/mcp-coach`

## Issue: MCP Server Connection Error ❌

The frontend can't connect to your MCP server because of CORS (Cross-Origin Resource Sharing) restrictions and/or missing Strava access token.

## Solution Options

### Option 1: Quick Token Setup (Try First)

1. **Copy environment template**:
   ```bash
   cp env.template .env.local
   ```

2. **Get your Strava token from MCP server**:
   ```bash
   cd /Users/mihjain/Desktop/stravamcp/strava-mcp
   cat .env | grep STRAVA_ACCESS_TOKEN
   ```

3. **Add token to `.env.local`**:
   ```bash
   # Replace with your actual token:
   VITE_STRAVA_ACCESS_TOKEN=your_actual_strava_token_here
   ```

4. **Restart dev server**:
   ```bash
   npm run dev
   ```

### Option 2: CORS Fix (If Option 1 Doesn't Work)

The MCP server needs CORS headers to allow browser requests. 

**Quick CORS Test**:
1. Open `test-mcp-cors.html` in your browser
2. Click "Test Health Endpoint"
3. If you see CORS errors, the MCP server needs updating

**To fix CORS in your MCP server**:
1. Go to your MCP server directory:
   ```bash
   cd /Users/mihjain/Desktop/stravamcp/strava-mcp
   ```

2. Add CORS middleware to your server file
3. Or use a development proxy

### Option 3: Development Proxy (Recommended Fallback)

If CORS is blocking direct connections, I can set up a Vite proxy:

1. **Update `vite.config.ts`** to proxy MCP requests
2. **Use `/api/mcp/*` routes** that forward to `localhost:10000`
3. **No CORS issues** since proxy runs on same origin

## Testing the Connection

### Test 1: Environment Variables
```bash
# Check if token is loaded:
echo $VITE_STRAVA_ACCESS_TOKEN
```

### Test 2: Direct MCP Connection
```bash
# Test with your actual token:
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     "http://localhost:10000/tools/get-recent-activities?per_page=5"
```

### Test 3: Frontend Connection
1. Go to: `http://localhost:8081/mcp-coach`
2. Open browser console (F12)
3. Look for connection status and errors

## Expected Results

### ✅ Working Connection
- Green "MCP Connected" badge
- Running stats populated with real data
- Chat interface responds to questions
- Console shows: "✅ MCP Server connected"

### ❌ Still Not Working
- Red "MCP Disconnected" badge  
- Console errors mentioning CORS or network
- Stats show zeros
- Chat disabled

## Development vs Production

### Development Mode (Current Setup)
```
Browser → Direct HTTP → MCP Server (localhost:10000)
```
**Pros**: Fast, no API overhead
**Cons**: CORS restrictions

### Production Mode (Vercel)
```
Browser → API Routes → MCP Server 
```
**Pros**: No CORS issues, secure
**Cons**: More complex setup

### Fallback: Proxy Mode
```
Browser → Vite Proxy → MCP Server
```
**Pros**: No CORS, works in dev
**Cons**: Extra configuration

## Quick Actions

1. **Try token setup** (5 minutes)
2. **Check browser console** for specific errors
3. **Test CORS** with the HTML file
4. **Let me know results** and I can implement the proxy solution

## Features Once Connected

- 📊 **Real-time stats**: Total runs, distance, pace
- 💬 **AI chat coach**: Ask about training, pace, recovery
- 🏃‍♂️ **Smart analysis**: Personalized advice based on your data
- 📈 **Trend tracking**: Progress over time
- ❓ **Quick questions**: Pre-built coaching queries

## Need Help?

If you're still seeing "MCP Server: Connection Error", share:
1. **Browser console errors** (F12 → Console)
2. **Results of the token test** (`echo $VITE_STRAVA_ACCESS_TOKEN`)
3. **Results of the CORS test** (open `test-mcp-cors.html`)

I can then implement the proxy solution or help debug the specific issue!

## Next Steps

1. Add your Strava token to `.env.local`
2. Restart the dev server
3. Visit `http://localhost:8081/mcp-coach`
4. Start chatting with your running coach!

The system will work in development mode without the complex Firebase/Gemini setup - it connects directly to your MCP server for a streamlined experience. 
