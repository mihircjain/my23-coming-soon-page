// api/claude-coach.js - Server-side Claude API proxy for intelligent coaching
export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, query, mcpResponses, analysis, endpoint, params } = req.body;
    
    if (!action) {
      return res.status(400).json({ error: 'Action required' });
    }

    const claudeApiKey = process.env.CLAUDE_API_KEY;

    // Handle MCP calls directly (NEW!)
    if (action === 'mcp_call') {
      console.log(`🌐 MCP Call: ${endpoint} with params:`, params);
      
      try {
        // Call the real MCP server with correct API structure
        const mcpServerUrl = process.env.MCP_SERVER_URL || 'https://strava-mcp-server.onrender.com';
        const mcpUrl = `${mcpServerUrl}/api/tools/${endpoint}`;
        
        console.log(`📡 Calling real MCP server: ${mcpUrl}`);
        console.log(`📋 Request params:`, params);
        
        const mcpResponse = await fetch(mcpUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(params)
        });
        
        if (!mcpResponse.ok) {
          const errorText = await mcpResponse.text();
          console.log(`❌ MCP server error: ${mcpResponse.status}`);
          console.log(`❌ Error response: ${errorText}`);
          throw new Error(`MCP server returned ${mcpResponse.status}: ${errorText}`);
        }
        
        const mcpData = await mcpResponse.json();
        console.log(`✅ Real MCP data received for ${endpoint}`);
        
        // Format response to match expected structure
        const formattedResponse = {
          content: [{
            text: mcpData.content?.[0]?.text || JSON.stringify(mcpData, null, 2)
          }]
        };
        
        return res.status(200).json({ result: formattedResponse });
        
      } catch (error) {
        console.log(`❌ MCP server call failed for ${endpoint}: ${error.message}`);
        console.log(`❌ Full error:`, error);
        console.log('🔄 Falling back to mock data for development...');
        
        // Fallback to mock data if MCP server is unavailable
        const mockResponse = {
          content: [{
            text: generateMockStravaData(endpoint, params)
          }]
        };
        
        return res.status(200).json({ result: mockResponse });
      }
    }

    // Handle test connection
    if (action === 'test_connection') {
      return res.status(200).json({ connected: true });
    }
    
    if (!claudeApiKey) {
      console.log('❌ Claude API key not configured, using fallback');
      return handleFallback(action, query, mcpResponses, res);
    }

    console.log(`🧠 Claude ${action} for query: "${query}"`);

    if (action === 'analyze_query') {
      const analysis = await analyzeQueryWithClaude(query, claudeApiKey);
      return res.status(200).json({ analysis });
    } else if (action === 'generate_response') {
      const response = await generateResponseWithClaude(query, analysis, mcpResponses, claudeApiKey);
      return res.status(200).json({ response });
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

  } catch (error) {
    console.error('❌ Claude coach error:', error);
    return res.status(500).json({ 
      error: 'Claude service unavailable',
      fallback: true,
      message: 'Using fallback analysis mode'
    });
  }
}

// Generate mock Strava data for testing the dynamic filtering
function generateMockStravaData(endpoint, params) {
  if (endpoint === 'get-recent-activities') {
    return `🏃 Morning Run (ID: 14910785861) — 10010m on 6/25/2025
🏃 Evening Run (ID: 14900123456) — 15000m on 6/24/2025  
🏃 Long Run (ID: 14890567890) — 21000m on 6/22/2025
🏃 Recovery Run (ID: 14880111222) — 8000m on 6/20/2025
🏃 Tempo Run (ID: 14870333444) — 12000m on 6/18/2025
🏃 Marathon (ID: 14860555666) — 42195m on 3/16/2025
🏃 Long Run (ID: 14850777888) — 18000m on 3/14/2025
🏃 Easy Run (ID: 14840999000) — 10000m on 3/12/2025`;
  }
  
  if (endpoint === 'get-activity-details') {
    return `🏃 **Morning Run** (ID: ${params.activityId})
   - Type: Run
   - Date: 6/25/2025, 7:30 AM
   - Distance: 10.01 km
   - Duration: 52:15
   - Pace: 5:13 /km
   - Avg Heart Rate: 165 bpm
   - Max Heart Rate: 180 bpm
   - Elevation Gain: 45m`;
  }
  
  if (endpoint === 'get-activity-streams') {
    return `Activity Streams for ${params.id}:
Time: [0, 60, 120, 180, 240, 300]
Distance: [0, 250, 500, 750, 1000, 1250]  
Heart Rate: [145, 155, 165, 170, 175, 165]
Velocity: [4.2, 4.1, 4.0, 3.9, 4.1, 4.2]
Altitude: [100, 105, 110, 108, 106, 102]`;
  }
  
  if (endpoint === 'get-athlete-zones') {
    return `Heart Rate Zones:
Zone 1: 50-60% (125-150 bpm) - Active Recovery
Zone 2: 60-70% (150-175 bpm) - Aerobic Base  
Zone 3: 70-80% (175-200 bpm) - Aerobic Threshold
Zone 4: 80-90% (200-225 bpm) - Lactate Threshold
Zone 5: 90-100% (225-250 bpm) - Neuromuscular Power`;
  }
  
  return `Mock data for ${endpoint}`;
}

// Claude query analysis
async function analyzeQueryWithClaude(query, apiKey) {
  const analysisPrompt = `You are an expert at analyzing running/fitness queries to determine what Strava data to fetch.

AVAILABLE MCP ENDPOINTS:
- get-recent-activities: Get recent activities list (params: per_page, before, after)
- get-activity-details: Get detailed activity information (params: activityId)
- get-activity-streams: Get activity data streams HR, pace, power, etc. (params: id, types, resolution, points_per_page)
- get-activity-laps: Get activity lap data (params: id)
- get-athlete-profile: Get athlete profile information (params: none)
- get-athlete-stats: Get athlete statistics and totals (params: none)
- get-athlete-zones: Get heart rate and power zones (params: none)
- explore-segments: Explore segments in an area (params: bounds, activity_type)
- list-starred-segments: Get starred segments (params: none)
- list-athlete-routes: Get athlete routes (params: none)

USER QUERY: "${query}"

Analyze this query and respond with a JSON object containing:

{
  "intent": "specific_activity|date_range|general_stats|training_zones|segments|routes",
  "dateReference": "yesterday|today|june 24|etc", // if query mentions specific date
  "dateRange": {"days": 20}, // if query mentions time range like "last 20 days"
  "dataTypes": ["heartrate", "pace", "power", "elevation"], // what data types are needed
  "mcpCalls": [
    {"endpoint": "get-recent-activities", "params": {"per_page": 30, "after": "2025-06-23", "before": "2025-06-25"}},
    {"endpoint": "get-athlete-zones", "params": {}}
  ],
  "reasoning": "Explanation of why these endpoints were chosen"
}

ANALYSIS RULES:
1. For yesterday/today queries: First get recent activities, then get details/streams for specific date
2. For "last X days" queries: Get recent activities with appropriate per_page
3. For HR/pace analysis: Always include activity-streams
4. For specific dates: Need to find activity ID first, then get detailed data
5. For training zones: Include get-athlete-zones
6. For general stats: Include get-athlete-stats and get-athlete-profile

CRITICAL DATE HANDLING:
- Current year is 2025
- For "june 24" queries: use 2025-06-24 format
- For date ranges: use after/before with YYYY-MM-DD format in 2025
- NEVER use placeholder "ACTIVITY_ID" - let frontend find real activity IDs

RESPOND ONLY WITH VALID JSON:`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1000,
      messages: [
        { role: 'user', content: analysisPrompt }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  return JSON.parse(data.content[0].text);
}

// Claude response generation
async function generateResponseWithClaude(query, analysis, mcpResponses, apiKey) {
  const contextData = mcpResponses
    .filter(r => r.success && r.data?.content?.[0]?.text)
    .map(r => `\n🏃 ${r.endpoint.toUpperCase()}:\n${r.data.content[0].text}`)
    .join('\n');
  
  const prompt = `You are an expert running coach analyzing Strava data. Provide detailed, technical coaching advice.

USER QUERY: "${query}"

QUERY ANALYSIS: ${JSON.stringify(analysis, null, 2)}

STRAVA DATA CONTEXT:
${contextData}

IMPORTANT DATA INTERPRETATION NOTES:
- GET-ACTIVITY-DETAILS contains accurate summary stats (total time, average pace, distance)
- GET-ACTIVITY-STREAMS contains detailed arrays but may need calculation for averages
- Always use activity details for pace, duration, and distance - NOT stream calculations
- Use streams for HR distribution, power curves, and detailed analysis
- Pace in activity details is usually in m/s - convert to min/km for readability

INSTRUCTIONS:
- Provide comprehensive technical analysis (minimum 200 words)
- Reference specific metrics and data points from the context
- Include heart rate zones, pace analysis, and training recommendations
- Use structured format with clear sections
- Be encouraging but technically accurate
- Prioritize activity details for pace/time, streams for HR distribution
- Provide specific training prescriptions based on the data

RESPONSE STRUCTURE:
1. **Performance Summary** (specific metrics)
2. **Detailed Analysis** (technical insights)
3. **Training Recommendations** (actionable advice)
4. **Next Steps** (concrete goals)

Respond as an expert coach with deep analysis:`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      messages: [
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Claude API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// Fallback handling when Claude is unavailable
function handleFallback(action, query, mcpResponses, res) {
  if (action === 'analyze_query') {
    const analysis = analyzeQueryRuleBased(query);
    return res.status(200).json({ analysis, fallback: true });
  } else if (action === 'generate_response') {
    const contextData = mcpResponses
      ?.filter(r => r.success && r.data?.content?.[0]?.text)
      .map(r => `\n🏃 ${r.endpoint.toUpperCase()}:\n${r.data.content[0].text}`)
      .join('\n') || 'No data available';
    
    const fallbackResponse = `Based on your query "${query}", here's what I found from your Strava data:\n\n${contextData}\n\n**Note**: Using fallback analysis mode. For detailed AI coaching insights, Claude API key is required.`;
    
    return res.status(200).json({ response: fallbackResponse, fallback: true });
  }
}

// Rule-based fallback analysis
function analyzeQueryRuleBased(query) {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('yesterday') || lowerQuery.includes('today')) {
    return {
      intent: 'specific_activity',
      dateReference: lowerQuery.includes('yesterday') ? 'yesterday' : 'today',
      dataTypes: ['heartrate', 'pace', 'power'],
      mcpCalls: [
        { endpoint: 'get-recent-activities', params: { per_page: 5 } }
      ],
      reasoning: 'Date-specific query requires recent activities to find the right activity'
    };
  }
  
  if (lowerQuery.includes('last') && lowerQuery.includes('days')) {
    const daysMatch = lowerQuery.match(/(\d+)\s*days/);
    const days = daysMatch ? parseInt(daysMatch[1]) : 7;
    return {
      intent: 'date_range',
      dateRange: { days },
      dataTypes: ['overview'],
      mcpCalls: [
        { endpoint: 'get-recent-activities', params: { per_page: Math.min(50, days * 2) } },
        { endpoint: 'get-athlete-stats', params: {} }
      ],
      reasoning: `Multi-day analysis requires recent activities and stats`
    };
  }
  
  if (lowerQuery.includes('heart rate') || lowerQuery.includes('hr') || lowerQuery.includes('distribution')) {
    return {
      intent: 'training_zones',
      dataTypes: ['heartrate', 'pace'],
      mcpCalls: [
        { endpoint: 'get-recent-activities', params: { per_page: 20 } },
        { endpoint: 'get-athlete-zones', params: {} }
      ],
      reasoning: 'HR distribution analysis requires recent activities, zones, and detailed HR streams from recent runs'
    };
  }
  
  // Default
  return {
    intent: 'general_stats',
    dataTypes: ['overview'],
    mcpCalls: [
      { endpoint: 'get-recent-activities', params: { per_page: 10 } },
      { endpoint: 'get-athlete-profile', params: {} }
    ],
    reasoning: 'General query - showing recent activities and profile'
  };
} 
