// Simple MCP-based Running Coach API
// Direct communication with your local MCP server

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

    console.log(`🏃 Running coach query: "${message}"`);

    // Get recent activities from MCP server
    const mcpResponse = await fetchFromMCP('/tools/get-recent-activities', { per_page: 30 });
    
    // Simple running analysis
    const runningAnalysis = analyzeRunningData(mcpResponse, message);
    
    // Generate coaching response
    const coachResponse = generateCoachingResponse(message, runningAnalysis);

    return res.status(200).json({
      response: coachResponse,
      data: runningAnalysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Running coach error:', error);
    return res.status(500).json({ 
      error: 'Running coach service unavailable',
      message: 'Unable to analyze your runs right now. Please try again.'
    });
  }
}

// Fetch data from MCP server
async function fetchFromMCP(endpoint, params = {}) {
  // Use production Render URL as default, fallback to localhost for development  
  const mcpUrl = process.env.MCP_SERVER_URL || 'https://strava-mcp-server.onrender.com';
  const url = new URL(mcpUrl + endpoint);
  
  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, value.toString());
    }
  });

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.STRAVA_ACCESS_TOKEN}`
      }
    });

    if (!response.ok) {
      throw new Error(`MCP Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ MCP response from ${endpoint}:`, data);
    
    return data;
  } catch (error) {
    console.error(`❌ MCP fetch error (${endpoint}):`, error);
    throw error;
  }
}

// Analyze running data from MCP response
function analyzeRunningData(mcpResponse, query) {
  try {
    // Parse the MCP text response to extract running data
    const textContent = mcpResponse.content?.[0]?.text || '';
    const runs = parseRunningActivities(textContent);
    
    // Basic analysis
    const totalRuns = runs.length;
    const totalDistance = runs.reduce((sum, run) => sum + (run.distance || 0), 0);
    const totalTime = runs.reduce((sum, run) => sum + (run.time || 0), 0);
    const averagePace = totalDistance > 0 ? totalTime / totalDistance : 0;
    
    // Recent performance (last 7 days)
    const recentRuns = runs.filter(run => {
      const runDate = new Date(run.date);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return runDate > weekAgo;
    });

    return {
      totalRuns,
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalTime: Math.round(totalTime),
      averagePace: Math.round(averagePace * 100) / 100,
      recentRuns: recentRuns.length,
      runs: runs.slice(0, 10), // Last 10 runs
      queryType: categorizeQuery(query),
      lastRun: runs[0] || null
    };
  } catch (error) {
    console.error('❌ Error analyzing running data:', error);
    return {
      totalRuns: 0,
      totalDistance: 0,
      totalTime: 0,
      averagePace: 0,
      recentRuns: 0,
      runs: [],
      queryType: 'general',
      lastRun: null,
      error: 'Unable to analyze running data'
    };
  }
}

// Parse running activities from MCP text response
function parseRunningActivities(textContent) {
  const runs = [];
  const lines = textContent.split('\n');
  
  for (const line of lines) {
    // Look for lines that contain running activity data
    if (line.includes('🏃') || line.includes('Run') || line.includes('km')) {
      const run = parseRunLine(line);
      if (run) runs.push(run);
    }
  }
  
  return runs;
}

// Parse individual run line
function parseRunLine(line) {
  try {
    // Extract basic run information using regex
    const distanceMatch = line.match(/(\d+\.?\d*)\s*km/);
    const timeMatch = line.match(/(\d+):(\d+)/);
    const dateMatch = line.match(/(\d{4}-\d{2}-\d{2})/);
    const nameMatch = line.match(/🏃\s*([^-]+)/);
    
    if (distanceMatch) {
      const distance = parseFloat(distanceMatch[1]);
      const time = timeMatch ? (parseInt(timeMatch[1]) * 60 + parseInt(timeMatch[2])) : 0;
      const date = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];
      const name = nameMatch ? nameMatch[1].trim() : 'Run';
      
      return {
        name,
        distance,
        time,
        date,
        pace: distance > 0 ? time / distance : 0
      };
    }
  } catch (error) {
    console.error('❌ Error parsing run line:', line, error);
  }
  
  return null;
}

// Categorize the user's query
function categorizeQuery(query) {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('pace') || lowerQuery.includes('speed')) return 'pace';
  if (lowerQuery.includes('distance') || lowerQuery.includes('km') || lowerQuery.includes('mile')) return 'distance';
  if (lowerQuery.includes('time') || lowerQuery.includes('duration')) return 'time';
  if (lowerQuery.includes('improvement') || lowerQuery.includes('progress')) return 'progress';
  if (lowerQuery.includes('training') || lowerQuery.includes('plan')) return 'training';
  if (lowerQuery.includes('recovery') || lowerQuery.includes('rest')) return 'recovery';
  if (lowerQuery.includes('injury') || lowerQuery.includes('pain')) return 'injury';
  
  return 'general';
}

// Generate coaching response based on analysis
function generateCoachingResponse(query, analysis) {
  const { queryType, totalRuns, totalDistance, averagePace, recentRuns, lastRun } = analysis;
  
  let response = '';
  
  // Add personalized greeting
  response += `🏃‍♂️ **Running Coach Analysis**\n\n`;
  
  // Add current stats
  response += `📊 **Your Recent Stats:**\n`;
  response += `• Total runs: ${totalRuns}\n`;
  response += `• Total distance: ${totalDistance}km\n`;
  response += `• Recent runs (7 days): ${recentRuns}\n`;
  if (averagePace > 0) {
    response += `• Average pace: ${Math.floor(averagePace)}:${String(Math.round((averagePace % 1) * 60)).padStart(2, '0')}/km\n`;
  }
  response += '\n';
  
  // Add query-specific coaching
  switch (queryType) {
    case 'pace':
      response += `🎯 **Pace Analysis:**\n`;
      if (lastRun) {
        response += `Your last run pace was ${Math.floor(lastRun.pace)}:${String(Math.round((lastRun.pace % 1) * 60)).padStart(2, '0')}/km. `;
      }
      response += `To improve pace: mix easy runs (80%) with tempo work (10%) and intervals (10%).\n\n`;
      break;
      
    case 'distance':
      response += `📏 **Distance Training:**\n`;
      response += `Build distance gradually (10% rule). Your longest recent run shows good endurance base. `;
      response += `Consider one long run per week.\n\n`;
      break;
      
    case 'training':
      response += `🎯 **Training Plan:**\n`;
      response += `Based on your recent activity:\n`;
      response += `• Easy runs: 3-4x/week (conversational pace)\n`;
      response += `• Tempo run: 1x/week (comfortably hard)\n`;
      response += `• Long run: 1x/week (build endurance)\n`;
      response += `• Rest: 1-2 days/week\n\n`;
      break;
      
    case 'recovery':
      response += `💤 **Recovery Focus:**\n`;
      response += `Recovery is crucial! Include easy runs, proper sleep, and listen to your body. `;
      response += `If feeling fatigued, take an extra rest day.\n\n`;
      break;
      
    default:
      response += `🎯 **General Coaching:**\n`;
      response += `Keep up the consistent running! Focus on building your aerobic base with mostly easy-paced runs. `;
      response += `Consistency beats intensity for long-term improvement.\n\n`;
  }
  
  // Add recent run highlight
  if (lastRun) {
    response += `🏃 **Last Run:** ${lastRun.name} - ${lastRun.distance}km in ${Math.floor(lastRun.time/60)}:${String(lastRun.time%60).padStart(2, '0')}\n\n`;
  }
  
  // Add motivational closing
  response += `💪 Keep running strong! Every step counts toward your goals.`;
  
  return response;
} 
