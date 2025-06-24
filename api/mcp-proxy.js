// MCP Proxy API - Routes requests to MCP server endpoints
// Provides a bridge between existing API structure and MCP server

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001';
const STRAVA_ACCESS_TOKEN = process.env.VITE_STRAVA_ACCESS_TOKEN;

/**
 * Make a request to the MCP server
 */
async function makeRequestToMCP(endpoint, params = {}) {
  try {
    const url = new URL(`${MCP_SERVER_URL}${endpoint}`);
    
    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, value.toString());
      }
    });

    const headers = {
      'Content-Type': 'application/json',
    };

    if (STRAVA_ACCESS_TOKEN) {
      headers.Authorization = `Bearer ${STRAVA_ACCESS_TOKEN}`;
    }

    console.log(`🚀 MCP Request: ${endpoint}`, params);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      throw new Error(`MCP API Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ MCP Response: ${endpoint} - Success`);
    
    return data;
  } catch (error) {
    console.error(`❌ MCP Request Failed: ${endpoint}`, error);
    throw error;
  }
}

/**
 * Parse Strava activities from MCP text response
 */
function parseActivitiesFromMCP(mcpResponse) {
  if (!mcpResponse || !mcpResponse.content || !Array.isArray(mcpResponse.content)) {
    return [];
  }

  const activities = [];
  
  for (const item of mcpResponse.content) {
    if (item.type === 'text' && item.text) {
      const lines = item.text.split('\n');
      
      for (const line of lines) {
        if (line.includes('🏃') && line.includes('ID:')) {
          // Parse basic activity info from MCP text format
          const idMatch = line.match(/ID:\s*(\d+)/);
          const nameMatch = line.match(/🏃\s*([^(]+?)\s*\(/);
          const distanceMatch = line.match(/(\d+(?:\.\d+)?)m/);
          const dateMatch = line.match(/on\s+(\d{1,2}\/\d{1,2}\/\d{4})/);
          
          if (idMatch && nameMatch) {
            const activity = {
              id: idMatch[1],
              name: nameMatch[1].trim(),
              type: 'Run', // Default - would need better parsing for accurate type
              start_date: dateMatch ? new Date(dateMatch[1]).toISOString() : new Date().toISOString(),
              distance: distanceMatch ? parseFloat(distanceMatch[1]) / 1000 : 0, // Convert m to km
              moving_time: 0, // Would need better parsing
              elapsed_time: 0,
              total_elevation_gain: 0,
              average_speed: 0,
              has_heartrate: false,
              calories: 0,
              is_run_activity: true,
            };
            
            activities.push(activity);
          }
        }
      }
    }
  }
  
  return activities;
}

/**
 * Get recent activities via MCP
 */
async function getRecentActivitiesViaMCP(perPage = 30) {
  try {
    const mcpResponse = await makeRequestToMCP('/tools/get-recent-activities', { perPage });
    return parseActivitiesFromMCP(mcpResponse);
  } catch (error) {
    console.error('Failed to get recent activities via MCP:', error);
    throw error;
  }
}

/**
 * Get activity details via MCP
 */
async function getActivityDetailsViaMCP(activityId) {
  try {
    const mcpResponse = await makeRequestToMCP('/tools/get-activity-details', { 
      activityId: parseInt(activityId) 
    });
    
    // Parse detailed activity response
    if (mcpResponse && mcpResponse.content && mcpResponse.content[0]) {
      const textResponse = mcpResponse.content[0].text || '';
      
      // Extract activity details from text response
      // This is a simplified parser - you might want to enhance this
      const activity = {
        id: activityId.toString(),
        name: 'Activity Details',
        type: 'Run',
        start_date: new Date().toISOString(),
        distance: 0,
        moving_time: 0,
        elapsed_time: 0,
        total_elevation_gain: 0,
        average_speed: 0,
        has_heartrate: false,
        splits_metric: [],
        best_efforts: [],
        zones: [],
      };

      // Enhanced parsing logic would go here
      return activity;
    }
    
    throw new Error('Invalid response format from MCP server');
  } catch (error) {
    console.error('Failed to get activity details via MCP:', error);
    throw error;
  }
}

/**
 * Get activity streams via MCP
 */
async function getActivityStreamsViaMCP(activityId, types = ['time', 'distance', 'heartrate']) {
  try {
    const mcpResponse = await makeRequestToMCP('/tools/get-activity-streams', {
      id: activityId,
      types: types.join(','),
    });
    
    // Parse streams from MCP response
    // This would need proper implementation based on MCP response format
    return {};
  } catch (error) {
    console.error('Failed to get activity streams via MCP:', error);
    throw error;
  }
}

/**
 * Get athlete profile via MCP
 */
async function getAthleteProfileViaMCP() {
  try {
    const mcpResponse = await makeRequestToMCP('/tools/get-athlete-profile');
    
    if (mcpResponse && mcpResponse.content && mcpResponse.content[0]) {
      const textResponse = mcpResponse.content[0].text || '';
      
      // Parse athlete profile from text response
      const profileMatch = textResponse.match(/Profile for (.+) \(ID: (\d+)\)/);
      if (profileMatch) {
        const [, name, id] = profileMatch;
        const [firstname, lastname] = name.split(' ');
        
        return {
          id: parseInt(id),
          firstname: firstname || '',
          lastname: lastname || '',
          measurement_preference: 'metric',
          summit: false,
        };
      }
    }
    
    throw new Error('Unable to parse athlete profile from MCP response');
  } catch (error) {
    console.error('Failed to get athlete profile via MCP:', error);
    throw error;
  }
}

/**
 * Main handler for MCP proxy requests
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, ...params } = req.query;

  try {
    let result;

    switch (action) {
      case 'recent-activities':
        result = await getRecentActivitiesViaMCP(parseInt(params.perPage) || 30);
        break;
        
      case 'activity-details':
        if (!params.activityId) {
          return res.status(400).json({ error: 'activityId parameter is required' });
        }
        result = await getActivityDetailsViaMCP(params.activityId);
        break;
        
      case 'activity-streams':
        if (!params.activityId) {
          return res.status(400).json({ error: 'activityId parameter is required' });
        }
        const types = params.types ? params.types.split(',') : ['time', 'distance', 'heartrate'];
        result = await getActivityStreamsViaMCP(params.activityId, types);
        break;
        
      case 'athlete-profile':
        result = await getAthleteProfileViaMCP();
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid action parameter' });
    }

    res.setHeader('X-Data-Source', 'mcp-server');
    res.setHeader('Cache-Control', 'max-age=300'); // 5 minute cache
    
    return res.status(200).json(result);

  } catch (error) {
    console.error('MCP Proxy Error:', error);
    
    res.setHeader('X-Data-Source', 'mcp-error');
    
    return res.status(500).json({ 
      error: 'MCP server error',
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }
} 
