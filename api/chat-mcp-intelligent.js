// Intelligent MCP-powered Running Coach with LLM
// Uses OpenAI GPT to interpret queries and dynamically fetch data from MCP server

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
    const { message, userId } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`🤖 Intelligent coach query: "${message}"`);

    // Step 1: Use GPT to analyze the query and determine what data to fetch
    const queryAnalysis = await analyzeQueryWithLLM(message);
    
    // Step 2: Fetch relevant data from MCP server based on analysis
    const mcpData = await fetchRelevantMCPData(queryAnalysis);
    
    // Step 3: Use GPT to generate comprehensive response with the fetched data
    const coachResponse = await generateIntelligentResponse(message, queryAnalysis, mcpData);

    return res.status(200).json({
      response: coachResponse,
      queryAnalysis,
      dataFetched: Object.keys(mcpData),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Intelligent coach error:', error);
    return res.status(500).json({ 
      error: 'AI coach service unavailable',
      message: 'I apologize, but I\'m having trouble processing your request right now. Please try again.'
    });
  }
}

// Step 1: Analyze user query with GPT to determine what data to fetch
async function analyzeQueryWithLLM(userQuery) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    // Fallback to rule-based analysis if no OpenAI key
    return analyzeQueryRuleBased(userQuery);
  }

  const analysisPrompt = `
You are an AI that analyzes running/fitness queries to determine what Strava data to fetch.

Available MCP endpoints:
- get-recent-activities: Recent workouts (specify per_page)
- get-athlete-profile: User profile info
- get-athlete-stats: Overall statistics 
- get-activity-details: Specific activity details (needs activity ID)
- get-activity-streams: Detailed time-series data (heart rate, power, pace, etc.)
- get-activity-laps: Lap data for intervals
- get-athlete-zones: Heart rate and power zones
- explore-segments: Find segments in an area
- get-segment: Segment details
- list-starred-segments: User's favorite segments
- list-athlete-routes: User's saved routes
- get-route: Route details

User query: "${userQuery}"

Respond with JSON containing:
{
  "endpoints": ["endpoint1", "endpoint2"],
  "parameters": {"endpoint1": {"param": "value"}, "endpoint2": {}},
  "queryType": "pace|distance|progress|segments|routes|stats|specific_activity|general",
  "reasoning": "Why these endpoints were chosen"
}

Examples:
- "How was my run today?" -> {"endpoints": ["get-recent-activities"], "parameters": {"get-recent-activities": {"per_page": 3}}}
- "Show my heart rate data from yesterday's run" -> {"endpoints": ["get-recent-activities", "get-activity-streams"], "parameters": {"get-recent-activities": {"per_page": 5}}}
- "What are my running stats?" -> {"endpoints": ["get-athlete-stats", "get-athlete-profile"]}
`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: analysisPrompt },
          { role: 'user', content: userQuery }
        ],
        temperature: 0.1,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const analysis = JSON.parse(data.choices[0].message.content);
    
    console.log('✅ GPT Query Analysis:', analysis);
    return analysis;
    
  } catch (error) {
    console.error('❌ LLM analysis failed, using fallback:', error);
    return analyzeQueryRuleBased(userQuery);
  }
}

// Fallback rule-based query analysis
function analyzeQueryRuleBased(query) {
  const lowerQuery = query.toLowerCase();
  
  // Today/recent activities
  if (lowerQuery.includes('today') || lowerQuery.includes('recent') || lowerQuery.includes('latest')) {
    return {
      endpoints: ['get-recent-activities'],
      parameters: { 'get-recent-activities': { per_page: 5 } },
      queryType: 'recent',
      reasoning: 'User asking about recent activities'
    };
  }
  
  // Stats and progress
  if (lowerQuery.includes('stats') || lowerQuery.includes('progress') || lowerQuery.includes('total')) {
    return {
      endpoints: ['get-athlete-stats', 'get-athlete-profile'],
      parameters: {},
      queryType: 'stats',
      reasoning: 'User asking about overall statistics'
    };
  }
  
  // Heart rate or detailed data
  if (lowerQuery.includes('heart rate') || lowerQuery.includes('power') || lowerQuery.includes('pace data')) {
    return {
      endpoints: ['get-recent-activities'],
      parameters: { 'get-recent-activities': { per_page: 3 } },
      queryType: 'detailed_data',
      reasoning: 'User wants detailed activity data, will need to fetch streams for recent activities'
    };
  }
  
  // Segments
  if (lowerQuery.includes('segment') || lowerQuery.includes('climb') || lowerQuery.includes('starred')) {
    return {
      endpoints: ['list-starred-segments'],
      parameters: {},
      queryType: 'segments',
      reasoning: 'User asking about segments'
    };
  }
  
  // Routes
  if (lowerQuery.includes('route') || lowerQuery.includes('saved')) {
    return {
      endpoints: ['list-athlete-routes'],
      parameters: {},
      queryType: 'routes',
      reasoning: 'User asking about routes'
    };
  }
  
  // Default: recent activities
  return {
    endpoints: ['get-recent-activities'],
    parameters: { 'get-recent-activities': { per_page: 10 } },
    queryType: 'general',
    reasoning: 'General query, showing recent activities'
  };
}

// Step 2: Fetch relevant data from MCP server
async function fetchRelevantMCPData(queryAnalysis) {
  const mcpData = {};
  
  for (const endpoint of queryAnalysis.endpoints) {
    try {
      const params = queryAnalysis.parameters[endpoint] || {};
      const data = await fetchFromMCP(`/tools/${endpoint}`, params);
      mcpData[endpoint] = data;
      
      // If we got recent activities and need detailed data, fetch streams for the most recent activity
      if (endpoint === 'get-recent-activities' && 
          (queryAnalysis.queryType === 'detailed_data' || queryAnalysis.queryType === 'pace')) {
        const activities = extractActivitiesFromMCPResponse(data);
        if (activities.length > 0) {
          const recentActivityId = activities[0].id;
          if (recentActivityId) {
            const streamsData = await fetchFromMCP(`/tools/get-activity-streams`, { 
              id: recentActivityId,
              types: ['time', 'distance', 'heartrate', 'cadence', 'watts', 'velocity_smooth'],
              resolution: 'medium'
            });
            mcpData['activity_streams'] = streamsData;
          }
        }
      }
      
    } catch (error) {
      console.error(`❌ Error fetching ${endpoint}:`, error);
      mcpData[endpoint] = { error: error.message };
    }
  }
  
  return mcpData;
}

// Step 3: Generate intelligent response using GPT
async function generateIntelligentResponse(userQuery, queryAnalysis, mcpData) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiApiKey) {
    // Fallback to simple response generation
    return generateSimpleResponse(userQuery, queryAnalysis, mcpData);
  }

  const responsePrompt = `
You are an expert running coach analyzing Strava data. Provide personalized, actionable coaching advice.

User Query: "${userQuery}"

Available Data:
${JSON.stringify(mcpData, null, 2)}

Instructions:
1. Directly answer the user's question using the provided data
2. Provide specific insights based on actual data (distances, paces, dates, etc.)
3. Give actionable coaching advice
4. Be encouraging and motivational
5. Use running emojis and formatting for engagement
6. If data shows concerning patterns, provide gentle guidance
7. Keep responses conversational but informative

Format your response in markdown with clear sections.
`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: responsePrompt },
          { role: 'user', content: userQuery }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
    
  } catch (error) {
    console.error('❌ LLM response generation failed, using fallback:', error);
    return generateSimpleResponse(userQuery, queryAnalysis, mcpData);
  }
}

// Fallback response generation
function generateSimpleResponse(userQuery, queryAnalysis, mcpData) {
  let response = `🏃‍♂️ **Running Coach Response**\n\n`;
  
  // Add data from different endpoints
  if (mcpData['get-recent-activities']) {
    const activities = extractActivitiesFromMCPResponse(mcpData['get-recent-activities']);
    response += `📊 **Recent Activities:**\n`;
    activities.slice(0, 5).forEach((activity, index) => {
      response += `${index + 1}. ${activity.name} - ${activity.distance}km (${activity.date})\n`;
    });
    response += '\n';
  }
  
  if (mcpData['get-athlete-stats']) {
    response += `📈 **Your Stats:** Based on your Strava data\n\n`;
  }
  
  if (mcpData['activity_streams']) {
    response += `📉 **Detailed Analysis:** Found detailed data for your recent activity\n\n`;
  }
  
  response += `💪 **Coaching Tip:** Keep up the great work! Consistency is key to improvement.`;
  
  return response;
}

// Helper function to fetch from MCP server
async function fetchFromMCP(endpoint, params = {}) {
  // Use production Render URL as default, fallback to localhost for development
  const mcpUrl = process.env.MCP_SERVER_URL || 'https://strava-mcp-server.onrender.com';
  const url = new URL(mcpUrl + endpoint);
  
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value.toString());
    }
  });

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`MCP Error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

// Helper function to extract activities from MCP response
function extractActivitiesFromMCPResponse(mcpResponse) {
  if (!mcpResponse.content || !Array.isArray(mcpResponse.content)) {
    return [];
  }

  return mcpResponse.content
    .filter(item => item.type === 'text' && item.text)
    .map(item => {
      const text = item.text;
      const nameMatch = text.match(/🏃 (.+?) \(ID:/);
      const idMatch = text.match(/ID: (\d+)/);
      const distanceMatch = text.match(/— ([\d.]+)m/);
      const dateMatch = text.match(/on (\d+\/\d+\/\d+)/);
      
      return {
        name: nameMatch ? nameMatch[1] : 'Unknown Activity',
        id: idMatch ? parseInt(idMatch[1]) : 0,
        distance: distanceMatch ? Math.round(parseFloat(distanceMatch[1]) / 100) / 10 : 0, // Convert to km
        date: dateMatch ? dateMatch[1] : new Date().toLocaleDateString(),
        isRun: text.includes('Run') || text.includes('running')
      };
    })
    .filter(activity => activity.distance > 0);
} 
