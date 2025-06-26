import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, Activity, TrendingUp, Heart, Trophy, Calendar, MapPin, Zap, Users, Route } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface StravaStats {
  connected: boolean;
  totalRuns: number;
  totalDistance: number;
  recentRuns: number;
  lastActivity?: {
    name: string;
    distance: number;
    date: string;
    pace?: string;
  };
}

interface ActivityContext {
  id: number;
  name: string;
  date: string;
  distance: number;
  type: string;
  elapsed_time: number;
  moving_time: number;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  total_elevation_gain: number;
  start_date: string;
}

// Enhanced endpoint mapping for intelligent tool selection
const STRAVA_ENDPOINTS = {
  // Activity-related endpoints
  'get-recent-activities': {
    keywords: ['recent', 'activities', 'list', 'summary', 'overview', 'last', 'latest', 'days', 'week', 'weeks'],
    description: 'Recent activities overview'
  },
  'get-activity-details': {
    keywords: ['detail', 'details', 'specific', 'today', 'yesterday', 'analyze', 'analysis', 'breakdown', 'performance', 'run', 'how', 'was'],
    description: 'Detailed activity analysis',
    requiresId: true
  },
  'get-activity-streams': {
    keywords: ['streams', 'data', 'heartrate', 'heart', 'rate', 'power', 'pace', 'speed', 'elevation', 'detailed', 'analysis', 'hr', 'cadence'],
    description: 'Activity data streams (HR, pace, power, etc.)',
    requiresId: true
  },
  'get-activity-laps': {
    keywords: ['laps', 'splits', 'intervals', 'pacing', 'segments', 'consistency'],
    description: 'Activity lap data',
    requiresId: true
  },
  
  // Athlete profile and stats
  'get-athlete-profile': {
    keywords: ['profile', 'me', 'personal', 'info', 'athlete', 'settings'],
    description: 'Athlete profile information'
  },
  'get-athlete-stats': {
    keywords: ['stats', 'statistics', 'totals', 'yearly', 'monthly', 'progress', 'achievements'],
    description: 'Athlete statistics and totals'
  },
  'get-athlete-zones': {
    keywords: ['zones', 'heartrate', 'power', 'training', 'threshold'],
    description: 'Training zones data'
  },
  
  // Segments
  'explore-segments': {
    keywords: ['explore', 'find', 'discover', 'nearby', 'popular', 'segments'],
    description: 'Explore segments'
  },
  'get-segment': {
    keywords: ['segment', 'kom', 'qom', 'leaderboard', 'challenge'],
    description: 'Segment details',
    requiresId: true
  },
  'get-segment-effort': {
    keywords: ['effort', 'attempt', 'pr', 'personal record'],
    description: 'Segment effort details',
    requiresId: true
  },
  'list-segment-efforts': {
    keywords: ['efforts', 'attempts', 'history', 'segment performance'],
    description: 'List segment efforts',
    requiresId: true
  },
  'list-starred-segments': {
    keywords: ['starred', 'favorite', 'bookmarked', 'saved'],
    description: 'Starred segments'
  },
  'star-segment': {
    keywords: ['star', 'bookmark', 'save', 'favorite'],
    description: 'Star a segment',
    requiresId: true
  },
  
  // Routes
  'get-route': {
    keywords: ['route', 'course', 'path', 'direction'],
    description: 'Route details',
    requiresId: true
  },
  'list-athlete-routes': {
    keywords: ['routes', 'courses', 'my routes', 'saved routes'],
    description: 'Athlete routes'
  },
  'export-route-gpx': {
    keywords: ['export', 'gpx', 'download', 'file'],
    description: 'Export route as GPX',
    requiresId: true
  },
  'export-route-tcx': {
    keywords: ['export', 'tcx', 'download', 'training'],
    description: 'Export route as TCX',
    requiresId: true
  },
  
  // Clubs
  'list-athlete-clubs': {
    keywords: ['clubs', 'groups', 'teams', 'community'],
    description: 'Athlete clubs'
  }
};

export default function Coach() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stravaStats, setStravaStats] = useState<StravaStats>({
    connected: false,
    totalRuns: 0,
    totalDistance: 0,
    recentRuns: 0
  });
  const [recentActivities, setRecentActivities] = useState<ActivityContext[]>([]);
  const [athleteZones, setAthleteZones] = useState<any>(null);

  // Initialize Gemini AI
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

  useEffect(() => {
    // Add welcome message
    setMessages([{
      role: 'assistant',
      content: '🏃‍♂️ Hey there! I\'m your enhanced AI Running Coach with access to your complete Strava data. I can analyze your activities with detailed HR/pace analysis, examine trends over time, suggest training based on your zones, and much more. Ask me anything about your running!',
      timestamp: new Date()
    }]);

    // Initialize comprehensive Strava data
    initializeStravaData();
  }, []);

  const initializeStravaData = async () => {
    try {
      console.log('🚀 Initializing comprehensive Strava data...');
      
      // Test connection
      const healthResponse = await fetch('https://strava-mcp-server.onrender.com/health');
      if (!healthResponse.ok) throw new Error('MCP server not accessible');

      // Fetch comprehensive recent activities (30 days)
      const activitiesData = await fetchFromMCP('get-recent-activities', { per_page: 50 });
      const activities = parseAdvancedActivitiesData(activitiesData);
      setRecentActivities(activities);
      
      // Fetch athlete zones for training analysis
      const zonesData = await fetchFromMCP('get-athlete-zones');
      setAthleteZones(zonesData);
      
      // Update stats
      const runningActivities = activities.filter(act => act.type?.toLowerCase().includes('run'));
      setStravaStats({
        connected: true,
        totalRuns: runningActivities.length,
        totalDistance: runningActivities.reduce((sum, act) => sum + act.distance, 0) / 1000,
        recentRuns: runningActivities.filter(act => isWithinDays(act.start_date, 7)).length,
        lastActivity: runningActivities[0] ? {
          name: runningActivities[0].name,
          distance: Math.round(runningActivities[0].distance / 10) / 100,
          date: new Date(runningActivities[0].start_date).toLocaleDateString(),
          pace: calculatePace(runningActivities[0].distance, runningActivities[0].moving_time)
        } : undefined
      });

      console.log(`✅ Loaded ${activities.length} activities, ${runningActivities.length} runs`);
      
    } catch (error) {
      console.error('❌ Error initializing Strava data:', error);
      setStravaStats(prev => ({ ...prev, connected: false }));
    }
  };

  const fetchFromMCP = async (endpoint: string, params: any = {}) => {
    const response = await fetch(`https://strava-mcp-server.onrender.com/api/tools/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    });
    
    if (!response.ok) throw new Error(`MCP ${endpoint} failed: ${response.status}`);
    return await response.json();
  };

  const parseAdvancedActivitiesData = (data: any): ActivityContext[] => {
    if (!data?.content?.[0]?.text) return [];
    
    const text = data.content[0].text;
    const activities: ActivityContext[] = [];
    
    // Enhanced parsing to extract more detailed activity information
    const activityBlocks = text.split(/(?=🏃|🚴|🏊|⛷️|🥾)/);
    
    for (const block of activityBlocks) {
      if (!block.trim()) continue;
      
      // Extract activity ID and name
      const idMatch = block.match(/ID:\s*(\d+)/);
      const nameMatch = block.match(/🏃\s*(.+?)\s*\(ID:|🚴\s*(.+?)\s*\(ID:|🏊\s*(.+?)\s*\(ID:|⛷️\s*(.+?)\s*\(ID:|🥾\s*(.+?)\s*\(ID:/);
      const distanceMatch = block.match(/(\d+\.?\d*)\s*(?:m|km|meters)/);
      const timeMatch = block.match(/(\d+h\s*)?(\d+m\s*)?(\d+s)?/);
      const hrMatch = block.match(/❤️\s*(\d+)\s*bpm/);
      const elevationMatch = block.match(/⛰️\s*(\d+)\s*m/);
      const dateMatch = block.match(/on\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
      
      if (idMatch && nameMatch && distanceMatch) {
        const id = parseInt(idMatch[1]);
        const name = nameMatch[1] || nameMatch[2] || nameMatch[3] || nameMatch[4] || nameMatch[5] || 'Unknown Activity';
        const distance = parseFloat(distanceMatch[1]);
        
        // Determine activity type based on emoji
        let type = 'Run';
        if (block.includes('🚴')) type = 'Ride';
        else if (block.includes('🏊')) type = 'Swim';
        else if (block.includes('⛷️')) type = 'Ski';
        else if (block.includes('🥾')) type = 'Hike';
        
        // Parse date
        const dateStr = dateMatch ? dateMatch[1] : new Date().toLocaleDateString();
        const [month, day, year] = dateStr.split('/');
        const activityDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        
        activities.push({
          id,
          name,
          date: dateStr,
          distance: distance < 100 ? distance * 1000 : distance, // Convert km to meters if needed
          type,
          elapsed_time: 0, // Would need more detailed parsing
          moving_time: 0,
          average_speed: 0,
          max_speed: 0,
          average_heartrate: hrMatch ? parseInt(hrMatch[1]) : undefined,
          total_elevation_gain: elevationMatch ? parseInt(elevationMatch[1]) : 0,
          start_date: activityDate.toISOString()
        });
      }
    }
    
    return activities.sort((a, b) => new Date(b.start_date).getTime() - new Date(a.start_date).getTime());
  };

  const findActivityByDate = (targetDate: string): ActivityContext | null => {
    // Handle various date formats: "yesterday", "today", "June 24", "24", etc.
    const today = new Date();
    let searchDate: Date;
    
    if (targetDate.toLowerCase() === 'today') {
      searchDate = today;
    } else if (targetDate.toLowerCase() === 'yesterday') {
      searchDate = new Date(today);
      searchDate.setDate(searchDate.getDate() - 1);
    } else if (targetDate.includes('june') || targetDate.includes('jul')) {
      // Handle "June 24" or "June 24th"
      const dayMatch = targetDate.match(/(\d+)/);
      if (dayMatch) {
        const day = parseInt(dayMatch[1]);
        const month = targetDate.toLowerCase().includes('june') ? 5 : 6; // 0-indexed
        searchDate = new Date(today.getFullYear(), month, day);
      } else return null;
    } else if (/^\d+$/.test(targetDate)) {
      // Handle just day number like "24"
      const day = parseInt(targetDate);
      // Assume current month
      searchDate = new Date(today.getFullYear(), today.getMonth(), day);
    } else {
      return null;
    }
    
    // Find activity on that date
    return recentActivities.find(activity => {
      const activityDate = new Date(activity.start_date);
      return activityDate.toDateString() === searchDate.toDateString();
    }) || null;
  };

  const findActivitiesInDateRange = (days: number): ActivityContext[] => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return recentActivities.filter(activity => 
      new Date(activity.start_date) >= cutoffDate
    );
  };

  const isWithinDays = (dateStr: string, days: number): boolean => {
    const activityDate = new Date(dateStr);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return activityDate >= cutoff;
  };

  const calculatePace = (distanceMeters: number, timeSeconds: number): string => {
    if (!distanceMeters || !timeSeconds) return 'N/A';
    const km = distanceMeters / 1000;
    const minutes = timeSeconds / 60;
    const paceMinutesPerKm = minutes / km;
    const mins = Math.floor(paceMinutesPerKm);
    const secs = Math.round((paceMinutesPerKm - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}/km`;
  };

  // Enhanced intelligent endpoint selection with temporal context
  const selectRelevantEndpoints = (query: string): Array<{endpoint: string, params?: any}> => {
    const lowercaseQuery = query.toLowerCase();
    const selectedEndpoints: Array<{endpoint: string, params?: any}> = [];
    
    // Enhanced date-specific queries
    let targetActivity: ActivityContext | null = null;
    let dateRange: ActivityContext[] = [];
    
    // Check for specific date references
    if (lowercaseQuery.includes('yesterday')) {
      targetActivity = findActivityByDate('yesterday');
    } else if (lowercaseQuery.includes('today')) {
      targetActivity = findActivityByDate('today');
    } else if (lowercaseQuery.includes('june') && lowercaseQuery.includes('24')) {
      targetActivity = findActivityByDate('june 24');
    } else if (lowercaseQuery.match(/\b24\b/) && !lowercaseQuery.includes('hour')) {
      targetActivity = findActivityByDate('24');
    }
    
    // Check for time range queries
    const daysMatch = lowercaseQuery.match(/(?:last|past)\s*(\d+)\s*days?/);
    const weeksMatch = lowercaseQuery.match(/(?:last|past)\s*(\d+)\s*weeks?/);
    
    if (daysMatch) {
      const days = parseInt(daysMatch[1]);
      dateRange = findActivitiesInDateRange(days);
    } else if (weeksMatch) {
      const weeks = parseInt(weeksMatch[1]);
      dateRange = findActivitiesInDateRange(weeks * 7);
    } else if (lowercaseQuery.includes('20 days')) {
      dateRange = findActivitiesInDateRange(20);
    }

    // If we found a specific activity, get its detailed data
    if (targetActivity) {
      console.log(`🎯 Found target activity: ${targetActivity.name} (ID: ${targetActivity.id})`);
      selectedEndpoints.push({
        endpoint: 'get-activity-details',
        params: { activityId: targetActivity.id }
      });
      
      if (lowercaseQuery.includes('hr') || lowercaseQuery.includes('heart') || 
          lowercaseQuery.includes('speed') || lowercaseQuery.includes('pace') ||
          lowercaseQuery.includes('detailed') || lowercaseQuery.includes('analysis')) {
        selectedEndpoints.push({
          endpoint: 'get-activity-streams',
          params: {
            id: targetActivity.id.toString(),
            types: ['time', 'distance', 'heartrate', 'watts', 'velocity_smooth', 'altitude', 'cadence'],
            resolution: 'high',
            points_per_page: -1 // Get all data points
          }
        });
        selectedEndpoints.push({
          endpoint: 'get-activity-laps',
          params: { id: targetActivity.id.toString() }
        });
      }
    }
    
    // For date range queries, get recent activities and stats
    if (dateRange.length > 0) {
      console.log(`📊 Analyzing ${dateRange.length} activities over date range`);
      selectedEndpoints.push({
        endpoint: 'get-recent-activities',
        params: { per_page: Math.min(50, dateRange.length + 10) }
      });
      selectedEndpoints.push({
        endpoint: 'get-athlete-stats'
      });
    }
    
    // Always include zones for training analysis if query mentions training/zones/hr
    if (lowercaseQuery.includes('zone') || lowercaseQuery.includes('training') || 
        lowercaseQuery.includes('heart rate') || lowercaseQuery.includes('threshold')) {
      selectedEndpoints.push({
        endpoint: 'get-athlete-zones'
      });
    }
    
    // Fallback: if no specific endpoints selected, use keyword matching
    if (selectedEndpoints.length === 0) {
      const endpointScores = Object.entries(STRAVA_ENDPOINTS).map(([endpoint, config]) => {
        const score = config.keywords.reduce((acc, keyword) => {
          return acc + (lowercaseQuery.includes(keyword) ? 1 : 0);
        }, 0);
        return { endpoint, score, config };
      }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);

      // Add general data if no specific matches
      if (endpointScores.length === 0) {
        selectedEndpoints.push({ endpoint: 'get-recent-activities', params: { per_page: 20 } });
        selectedEndpoints.push({ endpoint: 'get-athlete-profile' });
      } else {
        // Add top scoring endpoints
        for (const { endpoint, config } of endpointScores.slice(0, 3)) {
          const params: any = {};
          if (endpoint === 'get-recent-activities') {
            params.per_page = 20;
          }
          selectedEndpoints.push({ endpoint, params });
        }
      }
    }
    
    // Always add profile for context
    if (!selectedEndpoints.some(ep => ep.endpoint === 'get-athlete-profile')) {
      selectedEndpoints.push({ endpoint: 'get-athlete-profile' });
    }

    return selectedEndpoints.slice(0, 5); // Limit to 5 endpoints
  };

  const getStravaContext = async (query: string) => {
    const selectedEndpoints = selectRelevantEndpoints(query);
    let context = `🔍 COMPREHENSIVE STRAVA DATA ANALYSIS\n`;
    context += `Query: "${query}"\n`;
    context += `Data Sources: ${selectedEndpoints.length} endpoints selected\n\n`;
    
    // Add local context first
    if (recentActivities.length > 0) {
      context += `📊 LOCAL ACTIVITY CONTEXT (${recentActivities.length} recent activities):\n`;
      recentActivities.slice(0, 10).forEach((activity, idx) => {
        const date = new Date(activity.start_date).toLocaleDateString();
        const distance = (activity.distance / 1000).toFixed(2);
        context += `${idx + 1}. ${activity.name} (ID: ${activity.id}) - ${distance}km on ${date}\n`;
      });
      context += '\n';
    }
    
    // Add athlete zones if available
    if (athleteZones && (query.toLowerCase().includes('zone') || query.toLowerCase().includes('heart'))) {
      context += `🎯 TRAINING ZONES CONTEXT:\n`;
      if (athleteZones.content?.[0]?.text) {
        context += athleteZones.content[0].text + '\n\n';
      }
    }
    
    const dataPromises = selectedEndpoints.map(async ({ endpoint, params = {} }) => {
      try {
        console.log(`🔄 Fetching ${endpoint} with params:`, params);
        
        const response = await fetch(`https://strava-mcp-server.onrender.com/api/tools/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.content && data.content[0] && data.content[0].text) {
            const description = STRAVA_ENDPOINTS[endpoint]?.description || endpoint;
            return `\n🏃 ${description.toUpperCase()}:\n${data.content[0].text}\n`;
          }
        }
        return `\n❌ ${endpoint}: No data available`;
      } catch (error) {
        console.error(`❌ Error fetching ${endpoint}:`, error);
        return `\n⚠️ ${endpoint}: Error fetching data`;
      }
    });

    const results = await Promise.all(dataPromises);
    context += results.join('');
    
    // Add summary of available context
    context += `\n📋 CONTEXT SUMMARY:\n`;
    context += `- Recent Activities: ${recentActivities.length} total\n`;
    context += `- Data Endpoints: ${selectedEndpoints.map(ep => ep.endpoint).join(', ')}\n`;
    context += `- Analysis Focus: ${query.includes('yesterday') ? 'Specific day analysis' : 
                               query.includes('days') ? 'Multi-day trend analysis' : 
                               'General performance review'}\n`;
    
    return context;
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    try {
      if (!genAI) {
        throw new Error('Gemini API key not configured');
      }

      // Get relevant Strava data using enhanced endpoint selection
      const stravaContext = await getStravaContext(currentInput);
      
      // Create enhanced prompt for Gemini with comprehensive analysis instructions
      const prompt = `You are an expert running coach with access to comprehensive Strava data and advanced analytics. Your role is to provide detailed, technical, and actionable coaching advice.

USER'S QUESTION: "${currentInput}"

COMPREHENSIVE STRAVA DATA CONTEXT: 
${stravaContext}

ANALYSIS REQUIREMENTS:
You MUST provide detailed analysis when data is available. This is not optional - users expect comprehensive insights, not brief summaries.

MANDATORY ANALYSIS AREAS:

🔍 PERFORMANCE ANALYSIS:
- Extract specific metrics: distances, times, paces, heart rates, elevation
- Calculate training zones and intensity distribution
- Identify performance patterns and trends
- Compare current performance to historical data
- Analyze pacing strategy and consistency

📊 HEART RATE ANALYSIS (when available):
- Zone breakdown and time in each zone
- Average vs max HR analysis
- Heart rate drift over the duration
- Efficiency metrics (pace vs HR)
- Recovery and aerobic base assessment
- Specific zone recommendations for future training

🏃 PACE & SPEED ANALYSIS (when available):
- Average pace, pace variability, negative/positive splits
- Speed zones and efficiency
- Comparison to target paces
- Terrain impact on pacing
- Strategic pacing recommendations

💪 TRAINING RECOMMENDATIONS:
- Specific workout suggestions based on current fitness
- Zone-based training prescriptions
- Recovery recommendations
- Progressive training plans
- Goal-specific strategies

📈 TREND ANALYSIS (for multi-day queries):
- Volume trends, intensity distribution
- Recovery patterns, consistency
- Performance improvements/declines
- Training load assessment
- Periodization suggestions

RESPONSE STRUCTURE:
1. **Current Performance Summary** (2-3 sentences with specific metrics)
2. **Detailed Analysis** (major section with specific insights)
3. **Training Recommendations** (specific, actionable advice)
4. **Next Steps** (concrete goals and targets)

RESPONSE REQUIREMENTS:
- Minimum 200 words, maximum 400 words
- Reference specific data points and metrics throughout
- Use technical running terminology appropriately
- Provide quantitative insights (numbers, percentages, zones)
- Include specific training prescriptions
- Be encouraging but technically accurate
- Use structured formatting with clear sections

CRITICAL: If the data includes activity streams (heart rate, pace, power data), you MUST analyze this in detail. Users are expecting comprehensive technical analysis, not surface-level commentary.

Your analysis should demonstrate deep expertise in exercise physiology, training periodization, and performance optimization.`;

      const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      const assistantMessage: Message = {
        role: 'assistant',
        content: responseText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error generating response:', error);
      
      const errorMessage: Message = {
        role: 'assistant',
        content: 'Sorry, I had trouble connecting to my AI brain. But I can see your Strava data! ' + 
                (stravaStats.connected ? 
                  `You've got ${stravaStats.totalRuns} activities and ${stravaStats.totalDistance.toFixed(1)}km total distance. Keep up the great work! 🏃‍♂️` :
                  'Try asking me about your running goals or training tips!'),
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Enhanced quick prompts that trigger comprehensive analysis
  const quickPrompts = [
    "Analyze my run from yesterday with detailed HR and pace analysis",
    "Show me my performance trends over the last 20 days", 
    "How was my heart rate distribution in my recent runs?",
    "Give me a detailed analysis of my pacing strategy",
    "What are my training zones and how should I use them?",
    "Compare my recent runs to find performance patterns",
    "Analyze my running consistency and suggest improvements",
    "Create a training plan based on my current fitness level"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card className="bg-gradient-to-r from-green-100 to-blue-100 border-0 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-green-700 to-blue-700 bg-clip-text text-transparent flex items-center justify-center gap-2">
              <Bot className="h-8 w-8 text-green-600" />
              AI Running Coach Pro
            </CardTitle>
            <CardDescription className="text-lg text-gray-600">
              Powered by complete Strava data & Gemini AI
            </CardDescription>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs bg-white/50">
                <Activity className="h-3 w-3 mr-1" />
                18 Data Sources
              </Badge>
              <Badge variant="outline" className="text-xs bg-white/50">
                <Zap className="h-3 w-3 mr-1" />
                Smart Analysis
              </Badge>
              <Badge variant="outline" className="text-xs bg-white/50">
                <MapPin className="h-3 w-3 mr-1" />
                Segments & Routes
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Enhanced Strava Stats */}
        <Card className="bg-white/80 backdrop-blur border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-700 flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-600" />
              Your Running Stats
              <Badge variant={stravaStats.connected ? "default" : "destructive"} className="ml-auto">
                {stravaStats.connected ? "Connected" : "Disconnected"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <Trophy className="h-6 w-6 text-green-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-green-700">{stravaStats.totalRuns}</div>
                <div className="text-sm text-gray-600">Total Runs</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <TrendingUp className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-blue-700">{stravaStats.totalDistance.toFixed(1)}km</div>
                <div className="text-sm text-gray-600">Distance</div>
              </div>
              <div className="text-center p-3 bg-emerald-50 rounded-lg">
                <Calendar className="h-6 w-6 text-emerald-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-emerald-700">{stravaStats.recentRuns}</div>
                <div className="text-sm text-gray-600">This Week</div>
              </div>
              <div className="text-center p-3 bg-teal-50 rounded-lg">
                <Heart className="h-6 w-6 text-teal-600 mx-auto mb-1" />
                <div className="text-2xl font-bold text-teal-700">
                  {stravaStats.lastActivity?.pace || 'N/A'}
                </div>
                <div className="text-sm text-gray-600">Est. Pace</div>
              </div>
            </div>
            {stravaStats.lastActivity && (
              <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg">
                <div className="text-sm font-medium text-gray-700">Latest: {stravaStats.lastActivity.name}</div>
                <div className="text-xs text-gray-600">
                  {stravaStats.lastActivity.distance}km on {stravaStats.lastActivity.date}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Chat Interface */}
        <Card className="bg-white/90 backdrop-blur border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-700">Chat with Your Coach</CardTitle>
            <CardDescription className="text-sm text-gray-600">
              Ask about activities, segments, routes, training zones, clubs, and more
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Messages */}
            <ScrollArea className="h-96 mb-4 pr-4">
              <div className="space-y-4">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] p-3 rounded-lg ${
                        message.role === 'user'
                          ? 'bg-gradient-to-r from-green-500 to-blue-500 text-white'
                          : 'bg-white border border-gray-200 text-gray-800'
                      }`}
                    >
                      {message.role === 'assistant' && (
                        <div className="flex items-center gap-2 mb-2">
                          <Bot className="h-4 w-4 text-green-600" />
                          <span className="text-xs font-medium text-green-600">AI Coach Pro</span>
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{message.content}</div>
                      <div className={`text-xs mt-2 ${message.role === 'user' ? 'text-green-100' : 'text-gray-500'}`}>
                        {message.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-gray-200 p-3 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Bot className="h-4 w-4 text-green-600" />
                        <span className="text-xs font-medium text-green-600">AI Coach Pro</span>
                      </div>
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Enhanced Quick Prompts */}
            <div className="mb-4">
              <div className="text-sm font-medium text-gray-600 mb-2">Smart coaching questions:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {quickPrompts.map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs bg-gradient-to-r from-green-50 to-blue-50 border-green-200 hover:from-green-100 hover:to-blue-100 text-left justify-start"
                    onClick={() => setInput(prompt)}
                  >
                    {index < 4 ? (
                      <Activity className="h-3 w-3 mr-2 text-green-600" />
                    ) : index < 6 ? (
                      <Route className="h-3 w-3 mr-2 text-blue-600" />
                    ) : (
                      <Users className="h-3 w-3 mr-2 text-purple-600" />
                    )}
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="flex space-x-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask about performance, segments, routes, training zones..."
                disabled={isLoading}
                className="flex-1 border-green-200 focus:border-green-400"
              />
              <Button
                onClick={handleSendMessage}
                disabled={isLoading || !input.trim()}
                className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>

            {!geminiApiKey && (
              <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
                ⚠️ Gemini API key not configured. The coach will use basic responses.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 

