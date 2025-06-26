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
    const { action, query, mcpResponses, analysis } = req.body;
    
    if (!action) {
      return res.status(400).json({ error: 'Action required (analyze_query or generate_response)' });
    }

    const claudeApiKey = process.env.CLAUDE_API_KEY;
    
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
    {"endpoint": "get-recent-activities", "params": {"per_page": 10}},
    {"endpoint": "get-activity-streams", "params": {"id": "ACTIVITY_ID", "types": ["heartrate", "pace"]}}
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
