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
    const { action, query, mcpResponses, analysis, endpoint, params, nutritionData, sleepData, conversationContext } = req.body;
    
    if (!action) {
      return res.status(400).json({ error: 'Action required' });
    }

    const claudeApiKey = process.env.CLAUDE_API_KEY;

    // Handle MCP calls directly (NEW!)
    if (action === 'mcp_call') {
      console.log(`🌐 MCP Call: ${endpoint} with params:`, params);
      
      try {
        // Call the real MCP server with correct API structure
        const mcpServerUrl = 'https://strava-mcp-server.onrender.com';
        const mcpUrl = `${mcpServerUrl}/api/tools/${endpoint}`;
        
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
        
        // Return error instead of falling back to mock data
        return res.status(500).json({ 
          error: `MCP server unavailable: ${error.message}`,
          endpoint: endpoint,
          params: params
        });
      }
    }

    // Handle test connection
    if (action === 'test_connection') {
      return res.status(200).json({ connected: true });
    }
    
    if (!claudeApiKey) {
      console.log('❌ Claude API key not configured, using fallback');
      return handleFallback(action, query, mcpResponses, res, analysis, nutritionData, sleepData);
    }

    console.log(`🧠 Claude ${action} for query: "${query}"`);

    if (action === 'analyze_query') {
      const analysis = await analyzeQueryWithClaude(query, claudeApiKey);
      return res.status(200).json({ analysis });
    } else if (action === 'generate_response') {
      // Enhance analysis object with separately passed data
      const enhancedAnalysis = {
        ...analysis,
        nutritionData: nutritionData || analysis.nutritionData,
        sleepData: sleepData || analysis.sleepData
      };
      const response = await generateResponseWithClaude(query, enhancedAnalysis, mcpResponses, claudeApiKey, conversationContext);
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

// Mock data generation removed - using real MCP server data only

// Claude query analysis
async function analyzeQueryWithClaude(query, apiKey) {
  const analysisPrompt = `You are an expert at analyzing multi-sport fitness queries to determine what Strava data to fetch.

AVAILABLE MCP ENDPOINTS:
- get-recent-activities: Get recent activities list (params: per_page, before, after, activityType)
- get-activity-details: Get detailed activity information (params: activityId)
- get-activity-streams: Get activity data streams HR, pace, power, etc. (params: id, types, resolution, points_per_page)
- get-activity-laps: Get activity lap data (params: id)
- get-athlete-profile: Get athlete profile information (params: none)
- get-athlete-stats: Get athlete statistics and totals (params: none)
- get-athlete-zones: Get heart rate and power zones (params: none)
- explore-segments: Explore segments in an area (params: bounds, activity_type)
- list-starred-segments: Get starred segments (params: none)
- list-athlete-routes: Get athlete routes (params: none)

SUPPORTED SPORTS:
- Running: pace, heart rate zones, distance, elevation
- Cycling: power zones, cadence, speed, elevation, FTP analysis
- Swimming: pace, stroke rate, swolf, efficiency, distance per stroke

USER QUERY: "${query}"

Analyze this query and respond with a JSON object containing:

{
  "intent": "specific_activity|date_range|general_stats|training_zones|segments|routes",
  "primarySport": "running|cycling|swimming|all",
  "dateReference": "yesterday|today|june 24|etc", // if query mentions specific date
  "dateRange": {"days": 20}, // if query mentions time range like "last 20 days"
  "dataTypes": ["heartrate", "pace", "power", "elevation", "cadence", "swolf"], // what data types are needed
  "sportSpecificMetrics": {
    "running": ["pace", "heart_rate_zones", "distance"],
    "cycling": ["power_zones", "cadence", "speed", "ftp"],
    "swimming": ["pace", "stroke_rate", "swolf", "efficiency"]
  },
  "mcpCalls": [
    {"endpoint": "get-recent-activities", "params": {"per_page": 30, "after": "2025-06-23", "before": "2025-06-25", "activityType": "Run"}},
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
async function generateResponseWithClaude(query, analysis, mcpResponses, apiKey, conversationContext = []) {
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
        avgDuration: sleep.averages?.sleepDuration,
        avgScore: sleep.averages?.sleepScore,
        hasDailyLogs: !!(sleep.dailyLogs && sleep.dailyLogs.length > 0)
      });
      
      // Build detailed daily sleep logs
      let dailySleepDetails = '';
      if (sleep.dailyLogs && sleep.dailyLogs.length > 0) {
        dailySleepDetails = sleep.dailyLogs.map(day => {
          const duration = day.sleepDuration || 'N/A'; // Already in hours from frontend
          const bedtime = day.bedtimeStart ? new Date(day.bedtimeStart).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'N/A';
          const wakeup = day.bedtimeEnd ? new Date(day.bedtimeEnd).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'N/A';
          const efficiency = day.sleepEfficiency ? `${day.sleepEfficiency}%` : 'N/A';
          const heartRate = day.averageHeartRate || 'N/A';
          
          let dayText = `\n😴 ${day.date}: ${duration}h sleep, Score: ${day.sleepScore || 'N/A'}, HR: ${heartRate} bpm`;
          dayText += `\n  • Bedtime: ${bedtime}, Wake: ${wakeup}, Efficiency: ${efficiency}`;
          
          if (day.deepSleep || day.remSleep || day.lightSleep) {
            dayText += `\n  • Deep: ${day.deepSleep || 0}h, REM: ${day.remSleep || 0}h, Light: ${day.lightSleep || 0}h`;
          }
          
          return dayText;
        }).join('\n');
      }

      sleepContext = `\n😴 SLEEP DATA (${sleep.totalDays} days):
Average nightly stats:
- Duration: ${sleep.averages.sleepDuration || 'N/A'} hours/night
- Sleep Score: ${sleep.averages.sleepScore || 'N/A'}
- Heart Rate: ${sleep.averages.averageHeartRate || 'N/A'} bpm
- Readiness Score: ${sleep.averages.readinessScore || 'N/A'}

Sleep Stage Averages:
- Deep Sleep: ${sleep.averages.deepSleep || 'N/A'} hours/night
- REM Sleep: ${sleep.averages.remSleep || 'N/A'} hours/night
- Light Sleep: ${sleep.averages.lightSleep || 'N/A'} hours/night

DAILY SLEEP DETAILS:${dailySleepDetails}`;
    } else {
      console.log('⚠️ No sleep data found in analysis object');
    }
  } catch (error) {
    console.error('❌ Error processing sleep data:', error);
    sleepContext = '\n⚠️ Sleep data unavailable due to processing error';
  }
  
  // Process activity data if available
  let activityContext = '';
  try {
    if (analysis && analysis.recentActivities && analysis.recentActivities.length > 0) {
      console.log('🏃 Processing activity data:', {
        activityCount: analysis.recentActivities.length,
        activityTypes: [...new Set(analysis.recentActivities.map(a => a.type))]
      });
      
      const activityDetails = analysis.recentActivities.map(activity => {
        const date = new Date(activity.date).toLocaleDateString();
        const duration = Math.round(activity.moving_time / 60); // Convert to minutes
        const pace = activity.type === 'Run' ? `${Math.round(1000 / activity.average_speed)} min/km` : 
                    activity.type === 'VirtualRide' ? `${Math.round(activity.average_speed * 3.6)} km/h` : 'N/A';
        
        let activityText = `\n🏃 ${date} - ${activity.type}: ${activity.name}`;
        activityText += `\n  • Distance: ${activity.distance.toFixed(1)} km`;
        activityText += `\n  • Duration: ${duration} min`;
        activityText += `\n  • Pace/Speed: ${pace}`;
        activityText += `\n  • Heart Rate: ${activity.average_heartrate || 'N/A'} avg, ${activity.max_heartrate || 'N/A'} max`;
        if (activity.total_elevation_gain > 0) {
          activityText += `\n  • Elevation: ${activity.total_elevation_gain}m`;
        }
        
        return activityText;
      }).join('\n');

      activityContext = `\n🏃 ACTIVITY DATA (${analysis.recentActivities.length} activities):${activityDetails}`;
    } else {
      console.log('⚠️ No activity data found in analysis object');
    }
  } catch (error) {
    console.error('❌ Error processing activity data:', error);
    activityContext = '\n⚠️ Activity data unavailable due to processing error';
  }
  
  const mcpContext = processedMcpResponses.join('\n');
  const contextData = mcpContext + activityContext + nutritionContext + sleepContext;
  
  // Build conversation context for follow-up questions
  let conversationContextStr = '';
  if (conversationContext && conversationContext.length > 0) {
    conversationContextStr = '\n\nCONVERSATION CONTEXT (Previous queries for reference):\n';
    conversationContext.forEach((entry, index) => {
      conversationContextStr += `${index + 1}. "${entry.query}" (${entry.intent})\n`;
    });
    
    // Add specific guidance for follow-up questions
    if (conversationContext.length > 1) {
      const previousQuery = conversationContext[conversationContext.length - 2];
      const currentQuery = conversationContext[conversationContext.length - 1];
      
      if (previousQuery.intent.includes('swimming') && currentQuery.intent.includes('sleep')) {
        conversationContextStr += '\n🔗 FOLLOW-UP ANALYSIS: The user is asking how their sleep patterns affected their swimming performance from the previous query.';
        conversationContextStr += '\n📊 CORRELATION TASK: Analyze the relationship between sleep quality/duration and swimming performance metrics.';
      } else if (previousQuery.intent.includes('running') && currentQuery.intent.includes('sleep')) {
        conversationContextStr += '\n🔗 FOLLOW-UP ANALYSIS: The user is asking how their sleep patterns affected their running performance from the previous query.';
        conversationContextStr += '\n📊 CORRELATION TASK: Analyze the relationship between sleep quality/duration and running performance metrics.';
      } else if (previousQuery.intent.includes('cycling') && currentQuery.intent.includes('sleep')) {
        conversationContextStr += '\n🔗 FOLLOW-UP ANALYSIS: The user is asking how their sleep patterns affected their cycling performance from the previous query.';
        conversationContextStr += '\n📊 CORRELATION TASK: Analyze the relationship between sleep quality/duration and cycling performance metrics.';
      } else if (previousQuery.intent.includes('sleep') && currentQuery.intent.includes('swimming')) {
        conversationContextStr += '\n🔗 FOLLOW-UP ANALYSIS: The user is asking how their swimming performance was affected by their sleep patterns from the previous query.';
        conversationContextStr += '\n📊 CORRELATION TASK: Analyze the relationship between sleep quality/duration and swimming performance metrics.';
      }
    }
    
    conversationContextStr += '\nUse this context to understand what the user is referring to when they say "it" or ask follow-up questions.';
  }
  
  console.log('📋 Final context data length:', contextData.length);
  console.log('💬 Conversation context length:', conversationContextStr.length);
  
  const prompt = `You are an expert coach analyzing multi-sport performance data (running, cycling, swimming) and related health metrics. Provide comprehensive analysis with actionable insights.

IMPORTANT: You have access to conversation context that shows previous queries. When the user asks follow-up questions like "how did sleep affect it", use the conversation context to understand what "it" refers to from the previous query.

FORMATTING GUIDELINES:
• Use clean, minimal formatting - avoid excessive bold text
• Write in a conversational, supportive tone
• Structure with clear sections using simple headers
• ALWAYS provide a detailed "TODAY'S ACTION PLAN" section with specific, actionable recommendations
• Focus on concrete, implementable advice based on the data
• Do NOT end with questions - provide complete analysis

USER QUERY: "${query}"

${analysis && analysis.isSmartTiming ? 
`🧠 SMART TIMING APPLIED: For nutrition-performance analysis queries, the system automatically determined the most relevant nutrition data based on activity timing. Morning runs (5am-10am) use previous day's nutrition since they're often fasted, while afternoon/evening runs use same-day nutrition.` : ''}

${conversationContextStr}

DATA CONTEXT:
${contextData}

ANALYSIS GUIDELINES:
• For running data: Use GET-ACTIVITY-DETAILS for pace, duration, distance stats
• For cycling data: Use GET-ACTIVITY-DETAILS for power, cadence, speed, FTP analysis
• For swimming data: Use GET-ACTIVITY-DETAILS for pace, stroke rate, swolf, efficiency
• For heart rate analysis: Use GET-ACTIVITY-STREAMS for detailed HR distribution
• For nutrition data: You have access to both macro summaries AND individual food items eaten each day
• For sleep data: You have detailed sleep metrics including duration, quality, and sleep stages

REQUIRED SECTIONS:
1. Sleep-Workout Correlations: Analyze how sleep quality/duration affected recent workout performance
2. Nutrition-Workout Analysis: Examine nutrition patterns and their impact on performance
3. Performance Patterns: Identify trends in running, cycling, and swimming performance
4. Recovery Analysis: Assess recovery patterns and sleep quality after workouts
5. TODAY'S ACTION PLAN: Provide specific, actionable recommendations for today including:
   - Sleep status and readiness assessment
   - Nutrition targets and timing
   - Workout recommendation (type, intensity, duration)
   - Recovery strategy
   - Energy management tips

Use the actual data provided - do not make up or reference data that isn't present. Focus on the most recent 10 days of data and provide concrete, actionable advice.
• When asked about food suggestions, reference actual foods the user has eaten to make personalized recommendations
• Convert pace from m/s to min/km for readability
• Look for patterns and relationships between different data types when available
• Reference specific metrics and data points from the detailed logs
• Be encouraging but technically accurate

FOLLOW-UP QUESTION HANDLING:
• When the user asks "how did my sleep affect it", "it" refers to their previous activity (swimming/running/cycling)
• ALWAYS correlate sleep data with the activity data from the conversation context
• Look for patterns like: better sleep → better performance, poor sleep → reduced performance
• Compare sleep metrics (duration, quality, efficiency) with activity metrics (pace, heart rate, effort)
• Provide specific examples from the data showing the relationship
• If no clear correlation exists, acknowledge this but still analyze both datasets

RESPONSE APPROACH:
${query.toLowerCase().includes('recommend') || query.toLowerCase().includes('suggest') || query.toLowerCase().includes('advice') || query.toLowerCase().includes('what') || query.toLowerCase().includes('how') || query.toLowerCase().includes('better') ? 
'The user is asking for advice - provide actionable recommendations and training suggestions.' :
'The user wants analysis - focus on performance insights and technical breakdown. Only include recommendations if specifically requested.'}

SPORT-SPECIFIC ANALYSIS:
• For swimming: Focus on stroke efficiency, pace consistency, technique development, and endurance progression
• For cycling: Focus on power output, cadence, FTP zones, and endurance vs intensity balance
• For running: Focus on pace, heart rate zones, and training load progression
• For multi-sport analysis: Look for cross-training benefits and sport-specific adaptations

FINAL INSTRUCTION:
CRITICAL: If this is a follow-up question (like "how did sleep affect it"), you MUST use the conversation context to understand what "it" refers to. Look at the previous query in the conversation context and correlate the current data with that previous activity/sport data.

For example:
- If previous query was about swimming and current is about sleep → Analyze how sleep affected swimming performance
- If previous query was about running and current is about sleep → Analyze how sleep affected running performance
- If previous query was about cycling and current is about sleep → Analyze how sleep affected cycling performance

NEVER say "I don't have activity data" or "this appears to be an isolated question" when conversation context shows previous activity data. Always connect the dots between the data types.`;

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
    const errorText = await response.text();
    console.error(`❌ Claude API failed: ${response.status} - ${errorText}`);
    throw new Error(`Claude API failed with status ${response.status}: ${errorText}`);
  }

  const data = await response.json();
  return data.content[0].text;
}

// Fallback handling when Claude is unavailable
function handleFallback(action, query, mcpResponses, res, analysis = null, nutritionData = null, sleepData = null) {
  if (action === 'analyze_query') {
    const analysis = analyzeQueryRuleBased(query);
    return res.status(200).json({ analysis, fallback: true });
      } else if (action === 'generate_response') {
      const mcpData = mcpResponses
        ?.filter(r => r.success && r.data?.content?.[0]?.text)
        .map(r => `\n🏃 ${r.endpoint.toUpperCase()}:\n${r.data.content[0].text}`)
        .join('\n') || '';
      
      // Build nutrition summary if available
      let nutritionSummary = '';
      if (nutritionData) {
        nutritionSummary = `\n\n📊 **Nutrition Summary (${nutritionData.totalDays} days)**:\n- Average daily calories: ${nutritionData.averages.calories}\n- Average daily protein: ${nutritionData.averages.protein}g\n- Total calories: ${nutritionData.totals.calories.toLocaleString()}`;
      }
      
      // Build sleep summary if available  
      let sleepSummary = '';
      if (sleepData) {
        sleepSummary = `\n\n😴 **Sleep Summary (${sleepData.totalDays} days)**:\n- Average sleep duration: ${sleepData.averages.sleepDuration}h\n- Average sleep score: ${sleepData.averages.sleepScore}\n- Average heart rate: ${sleepData.averages.averageHeartRate} bpm`;
      }
      
      const contextData = mcpData + nutritionSummary + sleepSummary;
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
