# Setup Guide for My23 Coming Soon Page

## Issues to Fix

You're experiencing several interconnected issues:
1. Firebase using placeholder project ID (causing 400 errors)
2. Strava API rate limiting (429 errors)
3. Missing `/api/chat` endpoint (404 error)
4. MCP server not properly integrated

## Step 1: Environment Configuration

Create a `.env.local` file in your project root with these variables:

```bash
# Firebase Configuration (Frontend)
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_actual_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id_here
VITE_FIREBASE_APP_ID=your_app_id_here

# Firebase Admin (Backend API)
FIREBASE_PROJECT_ID=your_actual_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_private_key_here\n-----END PRIVATE KEY-----"

# Strava API
STRAVA_ACCESS_TOKEN=your_strava_access_token
STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret

# AI API
GEMINI_API_KEY=your_gemini_api_key

# MCP Server
NEXT_PUBLIC_MCP_API_URL=https://your-mcp-server.onrender.com
```

## Step 2: Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing one
3. Get your config from Project Settings > General > Web Apps
4. For the admin credentials:
   - Go to Project Settings > Service Accounts
   - Generate new private key
   - Use the values from the downloaded JSON file

## Step 3: MCP Server Setup

Since you have `/Users/mihjain/Desktop/stravamcp/strava-mcp`, let's set it up:

1. Navigate to your MCP server directory:
   ```bash
   cd /Users/mihjain/Desktop/stravamcp/strava-mcp
   ```

2. Install dependencies and start the server:
   ```bash
   npm install
   npm start
   ```

3. If deploying to Render:
   - Push to your Git repository
   - Connect to Render
   - Set environment variables on Render dashboard

## Step 4: API Routes Fix

The `/api/chat` endpoint should work with the Vercel configuration I just updated. Make sure you have:

1. Valid `GEMINI_API_KEY` in your environment
2. Proper Firebase configuration
3. The API routes deployed correctly

## Step 5: Strava Rate Limiting

To avoid 429 errors:

1. Use the MCP server for caching
2. Implement proper rate limiting in your code
3. Consider using webhooks for real-time data
4. Cache responses locally

## Step 6: Testing Locally

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Test the API endpoints:
   ```bash
   curl http://localhost:8080/api/chat -d '{"messages":[{"role":"user","content":"test"}]}' -H "Content-Type: application/json"
   ```

## Quick Fixes

1. **Immediate Firebase fix**: Replace all instances of `placeholder-project-id` with your actual Firebase project ID
2. **API endpoint fix**: Ensure your `.env.local` file exists and has the correct values
3. **MCP integration**: Set the correct MCP server URL in your environment

## Deployment Checklist

- [ ] Environment variables set in Vercel dashboard
- [ ] Firebase project configured
- [ ] Strava API credentials valid
- [ ] MCP server deployed and accessible
- [ ] Gemini API key valid

## Common Errors & Solutions

- **400 Firebase errors**: Check project ID is not placeholder
- **404 API errors**: Verify Vercel function deployment
- **429 Strava errors**: Implement rate limiting and caching
- **MCP connection errors**: Check server URL and deployment status 
