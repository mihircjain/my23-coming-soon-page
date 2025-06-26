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

// Enhanced endpoint mapping for intelligent tool selection
const STRAVA_ENDPOINTS = {
  // Activity-related endpoints
  'get-recent-activities': {
    keywords: ['recent', 'activities', 'list', 'summary', 'overview', 'last', 'latest'],
    description: 'Recent activities overview'
  },
  'get-activity-details': {
    keywords: ['detail', 'details', 'specific', 'today', 'yesterday', 'analyze', 'analysis', 'breakdown', 'performance', 'run', 'how', 'was'],
    description: 'Detailed activity analysis',
    requiresId: true
  },
  'get-activity-streams': {
    keywords: ['streams', 'data', 'heartrate', 'heart', 'rate', 'power', 'pace', 'speed', 'elevation', 'detailed', 'analysis'],
    description: 'Activity data streams',
    requiresId: true
  },
  'get-activity-laps': {
    keywords: ['laps', 'splits', 'intervals', 'pacing', 'segments'],
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
  const [lastActivityId, setLastActivityId] = useState<number | null>(null);

  // Initialize Gemini AI
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

  useEffect(() => {
    // Add welcome message
    setMessages([{
      role: 'assistant',
      content: '🏃‍♂️ Hey there! I\'m your AI Running Coach with access to your complete Strava data. I can analyze your activities, segments, routes, training zones, and much more. Ask me about your performance, get training suggestions, or explore new segments!',
      timestamp: new Date()
    }]);

    // Check Strava MCP connection and fetch data
    fetchStravaData();
  }, []);

  const fetchStravaData = async () => {
    try {
      // Test connection to your deployed Strava MCP server
      const healthResponse = await fetch('https://strava-mcp-server.onrender.com/health');
      
      if (healthResponse.ok) {
        // Fetch recent activities
        const activitiesResponse = await fetch('https://strava-mcp-server.onrender.com/api/tools/get-recent-activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ per_page: 10 })
        });

        if (activitiesResponse.ok) {
          const activitiesData = await activitiesResponse.json();
          const activities = parseActivitiesData(activitiesData);
          
          // Extract the most recent activity ID for detailed queries
          if (activities.length > 0 && activities[0].id) {
            setLastActivityId(activities[0].id);
          }
          
          setStravaStats({
            connected: true,
            totalRuns: activities.length,
            totalDistance: activities.reduce((sum, act) => sum + (act.distance || 0), 0) / 1000, // Convert to km
            recentRuns: activities.filter(act => act.isRecent).length,
            lastActivity: activities[0] ? {
              name: activities[0].name,
              distance: Math.round((activities[0].distance || 0) / 10) / 100, // Convert to km
              date: activities[0].date,
              pace: activities[0].pace
            } : undefined
          });
        }
      }
    } catch (error) {
      console.error('Error fetching Strava data:', error);
      setStravaStats(prev => ({ ...prev, connected: false }));
    }
  };

  const parseActivitiesData = (data: any) => {
    if (!data.content || !Array.isArray(data.content)) return [];
    
    return data.content
      .filter((item: any) => item.type === 'text' && item.text)
      .map((item: any) => {
        const text = item.text;
        const nameMatch = text.match(/🏃 (.+?) \(ID:\s*(\d+)\)/);
        const distanceMatch = text.match(/— ([\d.]+)m/);
        const dateMatch = text.match(/on (\d+\/\d+\/\d+)/);
        
        const distance = distanceMatch ? parseFloat(distanceMatch[1]) : 0;
        const isRecent = dateMatch ? isWithinLastWeek(dateMatch[1]) : false;
        const id = nameMatch ? parseInt(nameMatch[2]) : null;
        
        return {
          id,
          name: nameMatch ? nameMatch[1] : 'Unknown Activity',
          distance,
          date: dateMatch ? dateMatch[1] : new Date().toLocaleDateString(),
          isRecent,
          pace: distance > 0 ? estimatePace(distance) : undefined
        };
      })
      .filter((activity: any) => activity.distance > 0);
  };

  const isWithinLastWeek = (dateStr: string): boolean => {
    const activityDate = new Date(dateStr);
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    return activityDate >= oneWeekAgo;
  };

  const estimatePace = (distanceMeters: number): string => {
    // Rough pace estimation based on distance (this would be better with actual time data)
    const km = distanceMeters / 1000;
    const estimatedMinutesPerKm = km > 15 ? 5.0 : km > 10 ? 5.5 : 6.0;
    const minutes = Math.floor(estimatedMinutesPerKm);
    const seconds = Math.round((estimatedMinutesPerKm - minutes) * 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}/km`;
  };

  // Enhanced intelligent endpoint selection
  const selectRelevantEndpoints = (query: string): Array<{endpoint: string, params?: any}> => {
    const lowercaseQuery = query.toLowerCase();
    const selectedEndpoints: Array<{endpoint: string, params?: any}> = [];
    
    // Score each endpoint based on keyword matches
    const endpointScores = Object.entries(STRAVA_ENDPOINTS).map(([endpoint, config]) => {
      const score = config.keywords.reduce((acc, keyword) => {
        return acc + (lowercaseQuery.includes(keyword) ? 1 : 0);
      }, 0);
      return { endpoint, score, config };
    }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);

    // For specific activity analysis queries, always include detailed endpoints
    if (lowercaseQuery.includes('yesterday') || lowercaseQuery.includes('today') || 
        lowercaseQuery.includes('heart') || lowercaseQuery.includes('speed') || 
        lowercaseQuery.includes('pace') || lowercaseQuery.includes('analysis')) {
      
      if (lastActivityId) {
        selectedEndpoints.push({ 
          endpoint: 'get-activity-details', 
          params: { activityId: lastActivityId } 
        });
        selectedEndpoints.push({ 
          endpoint: 'get-activity-streams', 
          params: { 
            id: lastActivityId.toString(),
            types: ['time', 'distance', 'heartrate', 'watts', 'velocity_smooth', 'altitude']
          } 
        });
        selectedEndpoints.push({ 
          endpoint: 'get-activity-laps', 
          params: { id: lastActivityId.toString() } 
        });
      }
    }

    // Always include basic activity data if no specific matches or for general queries
    if (endpointScores.length === 0 || lowercaseQuery.includes('general') || lowercaseQuery.includes('overview')) {
      selectedEndpoints.push({ endpoint: 'get-recent-activities', params: { per_page: 10 } });
      selectedEndpoints.push({ endpoint: 'get-athlete-profile' });
      selectedEndpoints.push({ endpoint: 'get-athlete-stats' });
    }

    // Add top scoring endpoints
    for (const { endpoint, config } of endpointScores.slice(0, 3)) {
      const params: any = {};
      
      // Handle endpoints that require IDs
      if (config.requiresId) {
        if (endpoint.includes('activity') && lastActivityId) {
          if (endpoint === 'get-activity-details') {
            params.activityId = lastActivityId;
          } else if (endpoint === 'get-activity-streams') {
            params.id = lastActivityId.toString();
            params.types = ['time', 'distance', 'heartrate', 'watts', 'velocity_smooth', 'altitude'];
          } else if (endpoint === 'get-activity-laps') {
            params.id = lastActivityId.toString();
          }
          selectedEndpoints.push({ endpoint, params });
        }
        // For segments and routes, we'd need to extract IDs from the query or previous context
        // This could be enhanced further with context tracking
      } else {
        // Add endpoints that don't require IDs
        if (endpoint === 'get-recent-activities') {
          params.per_page = 20;
        } else if (endpoint === 'explore-segments') {
          // Could add location-based params if available
          params.bounds = '37.821,-122.505,37.842,-122.465'; // Default SF area - could be made dynamic
        }
        selectedEndpoints.push({ endpoint, params });
      }
    }

    // Ensure we don't duplicate endpoints
    const uniqueEndpoints = selectedEndpoints.filter((item, index, self) => 
      index === self.findIndex(t => t.endpoint === item.endpoint)
    );

    return uniqueEndpoints.slice(0, 4); // Limit to 4 endpoints to avoid overwhelming
  };

  const getStravaContext = async (query: string) => {
    const selectedEndpoints = selectRelevantEndpoints(query);
    let context = `Selected ${selectedEndpoints.length} relevant Strava data sources:\n`;
    
    const dataPromises = selectedEndpoints.map(async ({ endpoint, params = {} }) => {
      try {
        const response = await fetch(`https://strava-mcp-server.onrender.com/api/tools/${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.content && data.content[0] && data.content[0].text) {
            return `\n\n📊 ${STRAVA_ENDPOINTS[endpoint]?.description || endpoint}:\n${data.content[0].text}`;
          }
        }
        return `\n❌ ${endpoint}: No data available`;
      } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
        return `\n⚠️ ${endpoint}: Error fetching data`;
      }
    });

    const results = await Promise.all(dataPromises);
    context += results.join('');
    
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
      
      // Create enhanced prompt for Gemini
      const prompt = `You are an expert running coach with access to comprehensive Strava data. 

User's question: "${currentInput}"

Comprehensive Strava data context: ${stravaContext}

Based on this real data from multiple Strava endpoints, provide specific, actionable coaching advice. Be encouraging, data-driven, and focus on practical recommendations. 

IMPORTANT: If the data includes detailed activity information (heart rate, pace, power, streams), make sure to analyze these specific metrics and provide detailed insights about performance, pacing strategy, and training zones.

Guidelines:
- Analyze patterns across different data sources (activities, segments, routes, zones, etc.)
- When heart rate data is available, analyze HR zones and effort distribution
- When pace/speed data is available, analyze pacing strategy and consistency
- When power data is available, analyze power zones and efficiency
- When lap data is available, analyze splits and pacing strategy
- Provide specific training recommendations based on the data
- Be encouraging and motivational while being honest about areas for improvement  
- Reference actual data points and metrics when available
- If multiple data sources are available, synthesize insights across them
- Suggest specific workouts, routes, or segments when relevant
- Keep responses under 300 words but be comprehensive
- Use emojis sparingly but effectively
- If training zones are available, reference them in recommendations
- If segment data is available, suggest goals or challenges

Focus areas based on data type:
- Recent activities: Performance trends, consistency, variety
- Activity details: Pacing, heart rate zones, power metrics, detailed performance analysis
- Activity streams: Heart rate analysis, pace consistency, elevation impact
- Activity laps: Split analysis, pacing strategy, even effort assessment
- Segments: Personal records, areas for improvement, challenges
- Routes: Training variety, favorite areas, new suggestions
- Zones: Training intensity, recovery recommendations
- Stats: Long-term progress, goal setting`;

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

  // Enhanced quick prompts that trigger different endpoint combinations
  const quickPrompts = [
    "Analyze my recent performance trends",
    "How are my training zones looking?", 
    "Find popular segments near me",
    "Review my latest run in detail",
    "Show me my yearly running stats",
    "What routes should I try next?",
    "Check my starred segments",
    "How's my club activity going?"
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

