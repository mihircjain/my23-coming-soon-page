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
        const mcpServerUrl = process.env.MCP_SERVER_URL && process.env.MCP_SERVER_URL !== 'MCP_SERVER_URL' 
          ? process.env.MCP_SERVER_URL 
          : 'https://strava-mcp-server.onrender.com';
        const mcpUrl = `${mcpServerUrl}/api/tools/${endpoint}`;
        
        console.log(`🔧 Environment MCP_SERVER_URL: "${process.env.MCP_SERVER_URL}"`);
        console.log(`📡 Using MCP server URL: ${mcpServerUrl}`);
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
        console.log(`📊 MCP response has ${mcpData.content?.length || 0} content items`);
        console.log(`📋 First few items:`, mcpData.content?.slice(0, 3));
        
        // Format response to match expected structure - PRESERVE ALL CONTENT ITEMS
        const formattedResponse = {
          content: mcpData.content || []
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
  console.log('🔍 Claude generateResponseWithClaude called with:', {
    query: query.substring(0, 50) + '...',
    analysisType: typeof analysis,
    analysisKeys: analysis ? Object.keys(analysis) : 'null',
    mcpResponsesCount: mcpResponses?.length || 0,
    hasNutritionData: !!(analysis && analysis.nutritionData)
  });

  // Process MCP data
  const processedMcpResponses = mcpResponses
    .filter(r => r.success && r.data?.content?.length > 0)
    .map(r => {
      const allContent = r.data.content
        .map(item => item.text)
        .join('\n');
      
      // Limit stream data to prevent overload
      if (r.endpoint === 'get-activity-streams' && allContent.length > 5000) {
        const summary = allContent.substring(0, 2000) + '\n...[Stream data truncated for processing efficiency]...';
        return `\n🏃 ${r.endpoint.toUpperCase()}:\n${summary}`;
      }
      
      return `\n🏃 ${r.endpoint.toUpperCase()}:\n${allContent}`;
    });
  
  // Process nutrition data if available - with better error handling
  let nutritionContext = '';
  try {
    if (analysis && analysis.nutritionData) {
      const nutrition = analysis.nutritionData;
      console.log('📊 Processing nutrition data:', {
        totalDays: nutrition.totalDays,
        avgCalories: nutrition.averages?.calories,
        hasDailyLogs: !!(nutrition.dailyLogs && nutrition.dailyLogs.length > 0),
        firstDayEntries: nutrition.dailyLogs?.[0]?.entries?.length || 0
      });
      
      // Build detailed daily food logs
      let dailyFoodDetails = '';
      if (nutrition.dailyLogs && nutrition.dailyLogs.length > 0) {
        dailyFoodDetails = nutrition.dailyLogs.map(day => {
          let dayText = `\n📅 ${day.date}: ${day.calories}cal, ${day.protein}g protein, ${day.carbs}g carbs, ${day.fat}g fat`;
          
          if (day.entries && day.entries.length > 0) {
            const foodItems = day.entries.map(entry => 
              `  • ${entry.foodId || entry.food || entry.name || 'Unknown'} (${entry.quantity || 1}x): ${entry.calories || 0}cal, ${entry.protein || 0}g protein`
            ).join('\n');
            dayText += `\n  Foods eaten:\n${foodItems}`;
          }
          
          return dayText;
        }).join('\n');
      }

      nutritionContext = `\n📊 NUTRITION DATA (${nutrition.totalDays} days):
Average daily intake:
- Calories: ${nutrition.averages.calories} cal/day
- Protein: ${nutrition.averages.protein}g/day
- Carbs: ${nutrition.averages.carbs}g/day
- Fat: ${nutrition.averages.fat}g/day
- Fiber: ${nutrition.averages.fiber}g/day

Total period summary:
- Calories: ${nutrition.totals.calories.toLocaleString()} cal
- Protein: ${nutrition.totals.protein}g
- Carbs: ${nutrition.totals.carbs}g
- Fat: ${nutrition.totals.fat}g
- Fiber: ${nutrition.totals.fiber}g

DAILY FOOD DETAILS:${dailyFoodDetails}`;
    } else {
      console.log('⚠️ No nutrition data found in analysis object');
    }
  } catch (error) {
    console.error('❌ Error processing nutrition data:', error);
    nutritionContext = '\n⚠️ Nutrition data unavailable due to processing error';
  }
  
  // Process sleep data if available
  let sleepContext = '';
  try {
    if (analysis && analysis.sleepData) {
      const sleep = analysis.sleepData;
      console.log('😴 Processing sleep data:', {
        totalDays: sleep.totalDays,
        avgDuration: sleep.averages?.duration,
        avgScore: sleep.averages?.score,
        hasDailyLogs: !!(sleep.dailyLogs && sleep.dailyLogs.length > 0)
      });
      
      // Build detailed daily sleep logs
      let dailySleepDetails = '';
      if (sleep.dailyLogs && sleep.dailyLogs.length > 0) {
        dailySleepDetails = sleep.dailyLogs.map(day => {
          const duration = day.duration ? (day.duration / 3600).toFixed(1) : 'N/A'; // Convert seconds to hours
          const bedtime = day.bedtime || 'N/A';
          const wakeup = day.wakeup || 'N/A';
          const efficiency = day.efficiency ? `${day.efficiency}%` : 'N/A';
          const heartRate = day.heart_rate || day.averageHeartRate || 'N/A';
          
          let dayText = `\n😴 ${day.date}: ${duration}h sleep, Score: ${day.score || 'N/A'}, HR: ${heartRate} bpm`;
          dayText += `\n  • Bedtime: ${bedtime}, Wake: ${wakeup}, Efficiency: ${efficiency}`;
          
          if (day.stages) {
            dayText += `\n  • Deep: ${day.stages.deep || 0}min, REM: ${day.stages.rem || 0}min, Light: ${day.stages.light || 0}min`;
          }
          
          return dayText;
        }).join('\n');
      }

      sleepContext = `\n😴 SLEEP DATA (${sleep.totalDays} days):
Average nightly stats:
- Duration: ${sleep.averages.duration ? (sleep.averages.duration / 3600).toFixed(1) : 'N/A'} hours/night
- Sleep Score: ${sleep.averages.score || 'N/A'}
- Heart Rate: ${sleep.averages.heart_rate || 'N/A'} bpm
- Efficiency: ${sleep.averages.efficiency || 'N/A'}%

Sleep Stage Averages:
- Deep Sleep: ${sleep.averages.deep_sleep || 'N/A'} min/night
- REM Sleep: ${sleep.averages.rem_sleep || 'N/A'} min/night
- Light Sleep: ${sleep.averages.light_sleep || 'N/A'} min/night

DAILY SLEEP DETAILS:${dailySleepDetails}`;
    } else {
      console.log('⚠️ No sleep data found in analysis object');
    }
  } catch (error) {
    console.error('❌ Error processing sleep data:', error);
    sleepContext = '\n⚠️ Sleep data unavailable due to processing error';
  }
  
  const mcpContext = processedMcpResponses.join('\n');
  const contextData = mcpContext + nutritionContext + sleepContext;
  
  console.log('📋 Final context data length:', contextData.length);
  
  const prompt = `You are an expert coach analyzing both running performance and nutrition data. Provide clean, insightful analysis focused on what the user asked for.

FORMATTING GUIDELINES:
• Use clean, minimal formatting - avoid excessive bold text
• Write in a conversational, supportive tone
• Structure with clear sections using simple headers
• Focus on analysis and insights, not unsolicited advice
• Only provide recommendations if the user specifically asks for advice/suggestions

USER QUERY: "${query}"

${analysis && analysis.isSmartTiming ? 
`🧠 SMART TIMING APPLIED: For nutrition-performance analysis queries, the system automatically determined the most relevant nutrition data based on activity timing. Morning runs (5am-10am) use previous day's nutrition since they're often fasted, while afternoon/evening runs use same-day nutrition.` : ''}

DATA CONTEXT:
${contextData}

ANALYSIS GUIDELINES:
• For running data: Use GET-ACTIVITY-DETAILS for pace, duration, distance stats
• For heart rate analysis: Use GET-ACTIVITY-STREAMS for detailed HR distribution
• For nutrition data: You have access to both macro summaries AND individual food items eaten each day
• When asked about food suggestions, reference actual foods the user has eaten to make personalized recommendations
• Convert pace from m/s to min/km for readability
• Look for patterns and relationships between nutrition and performance when both are available
• Reference specific metrics and data points from the detailed daily food logs
• Be encouraging but technically accurate

RESPONSE APPROACH:
${query.toLowerCase().includes('recommend') || query.toLowerCase().includes('suggest') || query.toLowerCase().includes('advice') || query.toLowerCase().includes('what') || query.toLowerCase().includes('how') || query.toLowerCase().includes('better') ? 
'The user is asking for advice - provide actionable recommendations and training suggestions.' :
'The user wants analysis - focus on performance insights and technical breakdown. Only include recommendations if specifically requested.'}

Provide comprehensive analysis as an expert coach:`;

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
    const mcpData = mcpResponses
      ?.filter(r => r.success && r.data?.content?.[0]?.text)
      .map(r => `\n🏃 ${r.endpoint.toUpperCase()}:\n${r.data.content[0].text}`)
      .join('\n') || '';
    
    // Check if nutrition data is included in the analysis object
    const nutritionData = res.req.body?.analysis?.nutritionData;
    let nutritionSummary = '';
    if (nutritionData) {
      nutritionSummary = `\n\n📊 **Nutrition Summary (${nutritionData.totalDays} days)**:\n- Average daily calories: ${nutritionData.averages.calories}\n- Average daily protein: ${nutritionData.averages.protein}g\n- Total calories: ${nutritionData.totals.calories.toLocaleString()}`;
    }
    
    const contextData = mcpData + nutritionSummary;
    const fallbackResponse = `Based on your query "${query}", here's what I found:\n\n${contextData || 'No data available'}\n\n**Note**: Using fallback analysis mode. For detailed AI coaching insights, Claude API key is required.`;
    
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
