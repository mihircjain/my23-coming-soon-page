// Development server for intelligent chat API (ES Module version)
// Run this with: node dev-chat-server.mjs

import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Import and use the actual intelligent chat handler
async function loadChatHandler() {
  try {
    // Read the intelligent chat handler file
    const handlerPath = join(__dirname, 'api', 'chat-mcp-intelligent.js');
    const handlerCode = readFileSync(handlerPath, 'utf8');
    
    // Create a simple module wrapper since we can't directly import the Vercel function
    return eval(`
      ${handlerCode}
      
      // Extract the default export function
      (async function(req, res) {
        const { default: handler } = { default: handler };
        return await handler(req, res);
      });
    `);
  } catch (error) {
    console.error('❌ Failed to load intelligent chat handler:', error);
    return null;
  }
}

// Full intelligent chat endpoint
app.post('/api/chat-intelligent', async (req, res) => {
  try {
    const { message, userId } = req.body;
    
    console.log(`🤖 Intelligent chat request: "${message}" from ${userId}`);
    
    // Use the intelligent chat system directly
    const response = await processIntelligentChat(message, userId);
    res.status(200).json(response);
    
  } catch (error) {
    console.error('❌ Chat server error:', error);
    res.status(500).json({ 
      error: 'Chat service error',
      message: 'Unable to process your request right now.'
    });
  }
});

// Intelligent chat processing function
async function processIntelligentChat(message, userId) {
  const geminiApiKey = process.env.GEMINI_API_KEY;
  
  console.log(`🔑 Gemini key available: ${geminiApiKey ? 'Yes' : 'No'}`);
  
  if (!geminiApiKey) {
    return {
      response: `🏃‍♂️ **Running Coach Response**\n\nI received: "${message}"\n\n❌ **Gemini API key not found**\n\nPlease add your Gemini API key to .env.local as:\nGEMINI_API_KEY=your-api-key-here\n\nThen restart this server to enable full AI capabilities!`,
      queryAnalysis: { queryType: 'no_api_key' },
      dataFetched: [],
      timestamp: new Date().toISOString()
    };
  }
  
  try {
    // Step 1: Analyze query with Gemini
    const queryAnalysis = await analyzeQueryWithGemini(message, geminiApiKey);
    
    // Step 2: Fetch MCP data
    const mcpData = await fetchMCPData(queryAnalysis);
    
    // Step 3: Generate intelligent response
    const intelligentResponse = await generateGeminiResponse(message, queryAnalysis, mcpData, geminiApiKey);
    
    return {
      response: intelligentResponse,
      queryAnalysis,
      dataFetched: Object.keys(mcpData),
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('❌ AI processing error:', error);
    return {
      response: `🏃‍♂️ **Running Coach**\n\nI received: "${message}"\n\n❌ **AI Error**: ${error.message}\n\nUsing fallback response for now.`,
      queryAnalysis: { queryType: 'error' },
      dataFetched: [],
      timestamp: new Date().toISOString()
    };
  }
}

// Analyze query with Gemini
async function analyzeQueryWithGemini(query, apiKey) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `You are an AI that analyzes running queries to determine which Strava MCP endpoints to call. 

AVAILABLE ENDPOINTS:
- get-recent-activities: Basic activity list (distance, date, name, ID)
- get-athlete-profile: User profile (username, location, weight, premium status)
- get-athlete-stats: Overall stats (total runs, personal records)
- get-activity-details: Detailed info for specific activity (needs activity_id)
- get-activity-streams: HR, elevation, speed data (needs activity_id, stream_types)
- get-activity-laps: Lap data for specific activity (needs activity_id)
- get-athlete-zones: HR zones and power zones
- get-segments: Segment efforts and PR comparisons
- get-routes: Saved/planned routes
- get-clubs: Running club information
- get-gear: Shoe/equipment data

QUERY ANALYSIS EXAMPLES:

"How was my run today?" OR "today's run" → 
{"endpoints": ["get-recent-activities"], "parameters": {"get-recent-activities": {"per_page": 1}}, "queryType": "recent"}

"Show my heart rate data" OR "hr today" OR "heart rate analysis" →
{"endpoints": ["get-recent-activities", "get-activity-streams"], "parameters": {"get-recent-activities": {"per_page": 3}, "get-activity-streams": {"stream_types": ["heartrate", "time"], "resolution": "high", "points_per_page": -1}}, "queryType": "hr_analysis"}

"Elevation profile" OR "how much elevation" OR "hills today" →
{"endpoints": ["get-recent-activities", "get-activity-streams"], "parameters": {"get-recent-activities": {"per_page": 1}, "get-activity-streams": {"stream_types": ["altitude", "time"], "resolution": "high"}}, "queryType": "elevation"}

"Pace analysis" OR "speed data" OR "how fast did I run" →
{"endpoints": ["get-recent-activities", "get-activity-streams"], "parameters": {"get-recent-activities": {"per_page": 1}, "get-activity-streams": {"stream_types": ["velocity_smooth", "time"], "resolution": "high"}}, "queryType": "pace"}

"Detailed analysis" OR "full run data" OR "complete analysis" →
{"endpoints": ["get-recent-activities", "get-activity-streams"], "parameters": {"get-recent-activities": {"per_page": 1}, "get-activity-streams": {"stream_types": ["heartrate", "altitude", "velocity_smooth", "time", "latlng"], "resolution": "high", "points_per_page": -1}}, "queryType": "detailed"}

"Lap times" OR "interval analysis" OR "lap data" →
{"endpoints": ["get-recent-activities", "get-activity-laps"], "parameters": {"get-recent-activities": {"per_page": 1}, "get-activity-laps": {}}, "queryType": "laps"}

"My profile" OR "account info" OR "personal details" →
{"endpoints": ["get-athlete-profile"], "parameters": {"get-athlete-profile": {}}, "queryType": "profile"}

"My stats" OR "total distance" OR "personal records" OR "overall performance" →
{"endpoints": ["get-athlete-stats"], "parameters": {"get-athlete-stats": {}}, "queryType": "stats"}

"Heart rate zones" OR "training zones" OR "power zones" →
{"endpoints": ["get-athlete-zones"], "parameters": {"get-athlete-zones": {}}, "queryType": "zones"}

"Weekly stats" OR "this week" OR "recent performance" →
{"endpoints": ["get-recent-activities", "get-athlete-stats"], "parameters": {"get-recent-activities": {"per_page": 7}, "get-athlete-stats": {}}, "queryType": "weekly"}

Now analyze this query: "${query}"

Return ONLY valid JSON with the exact format shown above. NO other text.`
        }]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 300
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.candidates[0].content.parts[0].text.trim();
  
  // Remove any markdown code blocks
  const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  
  try {
    const parsed = JSON.parse(cleanContent);
    console.log('✅ Successfully parsed query analysis:', parsed);
    return parsed;
  } catch (e) {
    console.warn('⚠️ Gemini response not valid JSON, using intelligent fallback:', cleanContent);
    
    // Intelligent fallback based on query content
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('hr') || queryLower.includes('heart rate') || queryLower.includes('heartrate')) {
      return {
        endpoints: ['get-recent-activities', 'get-activity-streams'],
        parameters: {
          'get-recent-activities': { per_page: 3 }, // Get more activities to find one with HR data
          'get-activity-streams': { stream_types: ['heartrate', 'time'] }
        },
        queryType: 'hr_analysis'
      };
    }
    
    if (queryLower.includes('profile') || queryLower.includes('account') || queryLower.includes('personal')) {
      return {
        endpoints: ['get-athlete-profile'],
        parameters: { 'get-athlete-profile': {} },
        queryType: 'profile'
      };
    }
    
    if (queryLower.includes('stats') || queryLower.includes('total') || queryLower.includes('records') || queryLower.includes('overall')) {
      return {
        endpoints: ['get-athlete-stats'],
        parameters: { 'get-athlete-stats': {} },
        queryType: 'stats'
      };
    }
    
    if (queryLower.includes('zones') || queryLower.includes('training zones')) {
      return {
        endpoints: ['get-athlete-zones'],
        parameters: { 'get-athlete-zones': {} },
        queryType: 'zones'
      };
    }
    
    if (queryLower.includes('lap') || queryLower.includes('interval')) {
      return {
        endpoints: ['get-recent-activities', 'get-activity-laps'],
        parameters: {
          'get-recent-activities': { per_page: 1 },
          'get-activity-laps': {}
        },
        queryType: 'laps'
      };
    }
    
    if (queryLower.includes('elevation') || queryLower.includes('altitude') || queryLower.includes('hill')) {
      return {
        endpoints: ['get-recent-activities', 'get-activity-streams'],
        parameters: {
          'get-recent-activities': { per_page: 1 },
          'get-activity-streams': { stream_types: ['altitude', 'time'] }
        },
        queryType: 'elevation'
      };
    }
    
    if (queryLower.includes('speed') || queryLower.includes('pace') || queryLower.includes('fast')) {
      return {
        endpoints: ['get-recent-activities', 'get-activity-streams'],
        parameters: {
          'get-recent-activities': { per_page: 1 },
          'get-activity-streams': { stream_types: ['velocity_smooth', 'time'] }
        },
        queryType: 'pace'
      };
    }
    
    if (queryLower.includes('detail') || (queryLower.includes('analyse') || queryLower.includes('analyze'))) {
      return {
        endpoints: ['get-recent-activities', 'get-activity-streams'],
        parameters: {
          'get-recent-activities': { per_page: 1 },
          'get-activity-streams': { stream_types: ['heartrate', 'altitude', 'velocity_smooth', 'time'] }
        },
        queryType: 'detailed'
      };
    }
    
    // Default fallback
    return {
      endpoints: ['get-recent-activities'],
      parameters: { 'get-recent-activities': { per_page: 5 } },
      queryType: 'recent'
    };
  }
}

// Fetch MCP data
async function fetchMCPData(queryAnalysis) {
  const mcpData = {};
  // Use production Render URL as default, fallback to localhost for development
  const mcpBaseUrl = process.env.MCP_SERVER_URL || 'https://strava-mcp-server.onrender.com';
  
  // Endpoints that need activity IDs
  const activityDependentEndpoints = ['get-activity-streams', 'get-activity-laps', 'get-activity-details'];
  
  // First, handle basic endpoints that don't need dependencies
  for (const endpoint of queryAnalysis.endpoints) {
    if (activityDependentEndpoints.includes(endpoint)) continue; // Handle these separately
    
    try {
      const params = queryAnalysis.parameters[endpoint] || {};
      const url = new URL(`${mcpBaseUrl}/tools/${endpoint}`);
      
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, value.toString());
        }
      });

      console.log(`📡 Fetching ${endpoint}:`, url.toString());
      const response = await fetch(url.toString());
      if (response.ok) {
        mcpData[endpoint] = await response.json();
        console.log(`✅ Successfully fetched ${endpoint}`);
      } else {
        console.error(`❌ Failed to fetch ${endpoint}:`, response.status);
        mcpData[endpoint] = { error: `HTTP ${response.status}` };
      }
    } catch (error) {
      console.error(`❌ MCP fetch error (${endpoint}):`, error);
      mcpData[endpoint] = { error: error.message };
    }
  }
  
  // Now handle activity-dependent endpoints if requested
  const requestedActivityEndpoints = queryAnalysis.endpoints.filter(ep => activityDependentEndpoints.includes(ep));
  
  if (requestedActivityEndpoints.length > 0) {
    try {
      let activityIds = [];
      
      // Get activity IDs from recent activities
      if (mcpData['get-recent-activities'] && mcpData['get-recent-activities'].content) {
        const content = mcpData['get-recent-activities'].content;
        
        // Extract IDs from all activities in the response
        content.forEach(item => {
          if (item.type === 'text') {
            const idMatch = item.text.match(/ID:\s*(\d+)/);
            if (idMatch) {
              activityIds.push(idMatch[1]);
            }
          }
        });
        
        console.log(`🎯 Extracted ${activityIds.length} activity IDs:`, activityIds);
      }
      
      if (activityIds.length > 0) {
        // For heart rate queries, try multiple activities to find one with HR data
        const isHRQuery = queryAnalysis.queryType === 'hr_analysis';
        let foundHRData = false;
        
        for (const endpoint of requestedActivityEndpoints) {
          for (let i = 0; i < Math.min(activityIds.length, isHRQuery ? 3 : 1); i++) {
            const activityId = activityIds[i];
            const params = queryAnalysis.parameters[endpoint] || {};
            const url = new URL(`${mcpBaseUrl}/tools/${endpoint}`);
            
            // Add activity ID
            if (endpoint === 'get-activity-streams') {
              url.searchParams.append('id', activityId);
            } else if (endpoint === 'get-activity-laps') {
              url.searchParams.append('id', activityId);
            } else if (endpoint === 'get-activity-details') {
              url.searchParams.append('activityId', activityId);
            }
            
            // Add stream types for activity-streams
            if (endpoint === 'get-activity-streams' && params.stream_types) {
              // Always add specified stream types - the MCP server needs explicit requests for heartrate
              params.stream_types.forEach(type => {
                url.searchParams.append('types', type);
              });
              
              // For heart rate queries, also ensure we're requesting heartrate specifically
              if (isHRQuery && !params.stream_types.includes('heartrate')) {
                url.searchParams.append('types', 'heartrate');
              }
              
              console.log(`🎯 Requesting stream types: ${params.stream_types.join(', ')}${isHRQuery && !params.stream_types.includes('heartrate') ? ', heartrate' : ''}`);
            }
            
            // Add other parameters
            Object.entries(params).forEach(([key, value]) => {
              if (key !== 'stream_types' && value !== undefined && value !== null) {
                url.searchParams.append(key, value.toString());
              }
            });

            console.log(`📡 Fetching ${endpoint} for activity ${activityId}:`, url.toString());
            const response = await fetch(url.toString());
            
            if (response.ok) {
              const data = await response.json();
              
              // For HR queries, make a separate heartrate-only request since MCP server has issues with multiple types
              if (isHRQuery) {
                console.log(`🎯 Making separate HR request for activity ${activityId}`);
                const hrUrl = new URL(`${mcpBaseUrl}/tools/get-activity-streams`);
                hrUrl.searchParams.append('id', activityId);
                hrUrl.searchParams.append('types', 'heartrate');
                
                const hrResponse = await fetch(hrUrl.toString());
                if (hrResponse.ok) {
                  const hrData = await hrResponse.json();
                  try {
                    if (hrData.content && hrData.content[0] && hrData.content[0].text) {
                      const hrStreamData = JSON.parse(hrData.content[0].text);
                      if (hrStreamData.streams && hrStreamData.streams.heartrate && hrStreamData.streams.heartrate.length > 0) {
                        console.log(`🔍 Found ${hrStreamData.streams.heartrate.length} heart rate data points in activity ${activityId}!`);
                        // Add HR data to the response
                        mcpData[endpoint] = hrStreamData;
                        foundHRData = true;
                        break; // Found heart rate data, exit loop
                      }
                    }
                  } catch (parseError) {
                    console.warn(`⚠️ Failed to parse HR data for activity ${activityId}:`, parseError.message);
                  }
                }
                
                if (!foundHRData) {
                  console.warn(`⚠️ No heart rate data in activity ${activityId}, trying next...`);
                  continue; // Try next activity
                }
              } else {
                mcpData[endpoint] = data;
                console.log(`✅ Successfully fetched ${endpoint} for activity ${activityId}`);
                break;
              }
            } else {
              console.error(`❌ Failed to fetch ${endpoint} for activity ${activityId}:`, response.status);
            }
          }
          
          // If we still don't have data for this endpoint, set an error
          if (!mcpData[endpoint]) {
            if (isHRQuery && endpoint === 'get-activity-streams') {
              mcpData[endpoint] = { 
                error: `No heart rate data found in recent ${activityIds.length} activities. Please ensure your runs are recorded with a heart rate monitor.` 
              };
            } else {
              mcpData[endpoint] = { error: 'No activity data found' };
            }
          }
        }
      } else {
        console.warn('⚠️ No activity IDs found in recent activities');
        requestedActivityEndpoints.forEach(endpoint => {
          mcpData[endpoint] = { error: 'No activity ID found in recent activities' };
        });
      }
    } catch (error) {
      console.error(`❌ MCP fetch error (activity-dependent endpoints):`, error);
      requestedActivityEndpoints.forEach(endpoint => {
        mcpData[endpoint] = { error: error.message };
      });
    }
  }
  
  return mcpData;
}

// Generate Gemini response
async function generateGeminiResponse(query, analysis, mcpData, apiKey) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: `You are an expert running coach analyzing Strava data. Answer ONLY what the user specifically asked for. Be direct and focused.

User Query: "${query}"

Available Data: ${JSON.stringify(mcpData, null, 2)}

IMPORTANT GUIDELINES:
- Answer ONLY the specific question asked
- Use beautiful formatting with emojis and clean sections
- NO asterisks (*) in formatting - use emojis, headers, and clean lists instead
- Be specific about the actual data you see (exact numbers, dates, etc.)
- Keep responses focused and concise
- Use beautiful Unicode characters and emojis for formatting

Format your response beautifully without generic advice unless specifically requested.`
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 600
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'Intelligent Chat API',
    geminiConfigured: !!process.env.GEMINI_API_KEY,
    mcpUrl: process.env.MCP_SERVER_URL || 'https://strava-mcp-server.onrender.com',
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`🤖 Intelligent Chat API server running on http://localhost:${PORT}`);
  console.log(`📡 Ready to handle chat requests at /api/chat-intelligent`);
  console.log(`🔍 Health check available at /health`);
  console.log(`🔑 Gemini API Key: ${process.env.GEMINI_API_KEY ? 'Configured ✅' : 'Missing ❌'}`);
  console.log(`🏃 MCP Server: ${process.env.MCP_SERVER_URL || 'https://strava-mcp-server.onrender.com'}`);
});

export default app; 
