import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, Activity, TrendingUp, Heart, Trophy, Calendar, MapPin, Zap, Users, Route } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface StravaStats {
  connected: boolean;
  lastChecked: string;
}

interface QueryAnalysis {
  intent: 'specific_activity' | 'date_range' | 'general_stats' | 'training_zones' | 'segments' | 'routes';
  dateReference?: string;
  dateRange?: { days: number };
  dataTypes: string[];
  mcpCalls: Array<{ endpoint: string; params: any }>;
  reasoning: string;
}

interface MCPResponse {
  endpoint: string;
  data: any;
  success: boolean;
}

// Available MCP endpoints with their capabilities
const MCP_ENDPOINTS = {
  'get-recent-activities': {
    description: 'Get recent activities list',
    params: ['per_page', 'before', 'after']
  },
  'get-activity-details': {
    description: 'Get detailed activity information',
    params: ['activityId'],
    requires: ['activityId']
  },
  'get-activity-streams': {
    description: 'Get activity data streams (HR, pace, power, etc.)',
    params: ['id', 'types', 'resolution', 'points_per_page'],
    requires: ['id']
  },
  'get-activity-laps': {
    description: 'Get activity lap data',
    params: ['id'],
    requires: ['id']
  },
  'get-athlete-profile': {
    description: 'Get athlete profile information',
    params: []
  },
  'get-athlete-stats': {
    description: 'Get athlete statistics and totals',
    params: []
  },
  'get-athlete-zones': {
    description: 'Get heart rate and power zones',
    params: []
  },
  'explore-segments': {
    description: 'Explore segments in an area',
    params: ['bounds', 'activity_type']
  },
  'list-starred-segments': {
    description: 'Get starred segments',
    params: []
  },
  'list-athlete-routes': {
    description: 'Get athlete routes',
    params: []
  }
};

export default function Coach() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [stravaStats, setStravaStats] = useState<StravaStats>({
    connected: false,
    lastChecked: ''
  });

  // Backend API for Claude calls (handles CORS properly)

  useEffect(() => {
    // Add welcome message
    setMessages([{
      role: 'assistant',
      content: '🏃‍♂️ Hey! I\'m your intelligent AI Running Coach. I analyze your queries and fetch exactly the Strava data you need for comprehensive coaching. Ask me anything - I\'ll figure out what data to get and provide detailed analysis!',
      timestamp: new Date()
    }]);

    // Test MCP connection
    testMCPConnection();
  }, []);

  const testMCPConnection = async () => {
    try {
      const response = await fetch('https://strava-mcp-server.onrender.com/health');
      setStravaStats({
        connected: response.ok,
        lastChecked: new Date().toLocaleTimeString()
      });
    } catch (error) {
      console.error('❌ MCP connection test failed:', error);
      setStravaStats({
        connected: false,
        lastChecked: new Date().toLocaleTimeString()
      });
    }
  };

  // Step 1: Analyze user query using Claude to determine what MCP calls to make
  const analyzeQueryWithClaude = async (query: string): Promise<QueryAnalysis> => {
    console.log(`🧠 Analyzing query: "${query}"`);

    try {
      const response = await fetch('/api/claude-coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'analyze_query',
          query
        })
      });

      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.fallback) {
        console.log('⚠️ Using fallback analysis mode');
      } else {
        console.log('✅ Claude query analysis:', data.analysis);
      }
      
      return data.analysis;
      
    } catch (error) {
      console.error('❌ Claude analysis failed, using local fallback:', error);
      return analyzeQueryRuleBased(query);
    }
  };

  // Fallback rule-based query analysis
  const analyzeQueryRuleBased = (query: string): QueryAnalysis => {
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
    
    if (lowerQuery.includes('heart rate') || lowerQuery.includes('hr')) {
      return {
        intent: 'training_zones',
        dataTypes: ['heartrate'],
        mcpCalls: [
          { endpoint: 'get-recent-activities', params: { per_page: 5 } },
          { endpoint: 'get-athlete-zones', params: {} }
        ],
        reasoning: 'HR analysis requires recent activities and training zones'
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
  };

  // Step 2: Execute MCP calls based on analysis
  const executeMCPCalls = async (mcpCalls: Array<{ endpoint: string; params: any }>): Promise<MCPResponse[]> => {
    console.log(`🔄 Executing ${mcpCalls.length} MCP calls`);
    
    const responses = await Promise.all(
      mcpCalls.map(async ({ endpoint, params }) => {
        try {
          console.log(`🌐 Calling ${endpoint} with params:`, params);
          
          const response = await fetch(`https://strava-mcp-server.onrender.com/api/tools/${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
          });
          
          if (!response.ok) {
            throw new Error(`${endpoint} failed: ${response.status}`);
          }
          
          const data = await response.json();
          console.log(`✅ ${endpoint} success`);
          
          return {
            endpoint,
            data,
            success: true
          };
        } catch (error) {
          console.error(`❌ ${endpoint} failed:`, error);
          return {
            endpoint,
            data: null,
            success: false
          };
        }
      })
    );
    
    return responses;
  };

  // Step 3: Find specific activity ID from date reference
  const findActivityByDate = async (dateRef: string, activities: any[]): Promise<string | null> => {
    if (!activities.length) return null;
    
    const today = new Date();
    let searchDate: Date;
    
    if (dateRef === 'today') {
      searchDate = today;
    } else if (dateRef === 'yesterday') {
      searchDate = new Date(today);
      searchDate.setDate(searchDate.getDate() - 1);
    } else if (dateRef.includes('june') && dateRef.includes('24')) {
      searchDate = new Date(today.getFullYear(), 5, 24); // June = 5 (0-indexed)
    } else {
      return null;
    }
    
    // Parse activities text to find matching date
    const activitiesText = activities[0]?.content?.[0]?.text || '';
    const lines = activitiesText.split('\n');
    
    for (const line of lines) {
      const idMatch = line.match(/ID:\s*(\d+)/);
      const dateMatch = line.match(/on\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
      
      if (idMatch && dateMatch) {
        const [month, day, year] = dateMatch[1].split('/');
        const activityDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        
        if (activityDate.toDateString() === searchDate.toDateString()) {
          console.log(`🎯 Found activity ID ${idMatch[1]} for ${dateRef}`);
          return idMatch[1];
        }
      }
    }
    
    return null;
  };

  // Step 4: Get additional detailed data if needed
  const getDetailedActivityData = async (activityId: string, dataTypes: string[]): Promise<MCPResponse[]> => {
    const additionalCalls = [];
    
    // Add activity details
    additionalCalls.push({
      endpoint: 'get-activity-details',
      params: { activityId }
    });
    
    // Add streams if HR/pace analysis requested
    if (dataTypes.includes('heartrate') || dataTypes.includes('pace') || dataTypes.includes('power')) {
      additionalCalls.push({
        endpoint: 'get-activity-streams',
        params: {
          id: activityId,
          types: ['time', 'distance', 'heartrate', 'watts', 'velocity_smooth', 'altitude', 'cadence'],
          resolution: 'high',
          points_per_page: -1
        }
      });
    }
    
    // Add laps for pacing analysis
    if (dataTypes.includes('pace') || dataTypes.includes('heartrate')) {
      additionalCalls.push({
        endpoint: 'get-activity-laps',
        params: { id: activityId }
      });
    }
    
    return await executeMCPCalls(additionalCalls);
  };

  // Step 5: Generate response using Claude with focused data
  const generateResponseWithClaude = async (query: string, analysis: QueryAnalysis, mcpResponses: MCPResponse[]): Promise<string> => {
    const contextData = mcpResponses
      .filter(r => r.success && r.data?.content?.[0]?.text)
      .map(r => `\n🏃 ${r.endpoint.toUpperCase()}:\n${r.data.content[0].text}`)
      .join('\n');

    try {
      const response = await fetch('/api/claude-coach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'generate_response',
          query,
          analysis,
          mcpResponses
        })
      });

      if (!response.ok) {
        throw new Error(`Backend API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.fallback) {
        console.log('⚠️ Using fallback response mode');
      }
      
      return data.response;
      
    } catch (error) {
      console.error('❌ Claude response generation failed:', error);
      return `I can see your data but had trouble generating a detailed response. Here's what I found:\n\n${contextData}`;
    }
  };

  // Extract activity IDs from recent activities text
  const extractActivityIds = (activitiesData: any, maxActivities: number = 5): string[] => {
    const activitiesText = activitiesData?.content?.[0]?.text || '';
    const lines = activitiesText.split('\n');
    const activityIds: string[] = [];
    
    for (const line of lines) {
      const idMatch = line.match(/ID:\s*(\d+)/);
      // More inclusive running detection
      const isRun = (line.toLowerCase().includes('run') || line.toLowerCase().includes('running')) 
                    && !line.toLowerCase().includes('weight') 
                    && !line.toLowerCase().includes('walk');
      
      if (idMatch && isRun && activityIds.length < maxActivities) {
        activityIds.push(idMatch[1]);
        console.log(`🏃 Extracted activity ID: ${idMatch[1]} from: ${line.split('—')[0]}`);
      }
    }
    
    // If we didn't find enough runs, log what we did find
    if (activityIds.length < 3) {
      console.log(`⚠️ Only found ${activityIds.length} runs. Recent activities:`);
      lines.slice(0, 10).forEach(line => {
        if (line.includes('ID:')) console.log(`  ${line}`);
      });
    }
    
    return activityIds;
  };

  // Get detailed streams for multiple activities
  const getDetailedStreamsForActivities = async (activityIds: string[], dataTypes: string[]): Promise<MCPResponse[]> => {
    console.log(`🔍 Getting detailed streams for ${activityIds.length} activities: ${activityIds.join(', ')}`);
    
    const streamCalls = activityIds.map(id => ({
      endpoint: 'get-activity-streams',
      params: {
        id,
        types: ['time', 'distance', 'heartrate', 'watts', 'velocity_smooth', 'altitude', 'cadence'],
        resolution: 'medium',
        points_per_page: -1
      }
    }));
    
    return await executeMCPCalls(streamCalls);
  };

  // Main message handler - orchestrates the entire intelligent flow
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
      // Step 1: Analyze query with Claude
      const analysis = await analyzeQueryWithClaude(currentInput);
      console.log('📊 Query analysis:', analysis);

      // Step 2: Execute initial MCP calls
      let mcpResponses = await executeMCPCalls(analysis.mcpCalls);

      // Step 3A: If specific activity requested, find activity ID and get detailed data
      if (analysis.intent === 'specific_activity' && analysis.dateReference) {
        const recentActivitiesResponse = mcpResponses.find(r => r.endpoint === 'get-recent-activities');
        
        if (recentActivitiesResponse?.success) {
          const activityId = await findActivityByDate(analysis.dateReference, [recentActivitiesResponse.data]);
          
          if (activityId) {
            console.log(`🎯 Getting detailed data for activity ${activityId}`);
            const detailedData = await getDetailedActivityData(activityId, analysis.dataTypes);
            mcpResponses = [...mcpResponses, ...detailedData];
          }
        }
      }

      // Step 3B: If HR/pace analysis for recent activities, automatically get detailed streams
      if ((analysis.intent === 'training_zones' || analysis.intent === 'date_range') && 
          (analysis.dataTypes.includes('heartrate') || analysis.dataTypes.includes('pace'))) {
        
        const recentActivitiesResponse = mcpResponses.find(r => r.endpoint === 'get-recent-activities');
        
        if (recentActivitiesResponse?.success) {
          console.log('🔄 HR/pace analysis detected - getting detailed streams for recent runs');
          
          // Extract activity IDs from recent activities
          const activityIds = extractActivityIds(recentActivitiesResponse.data, 3);
          
          if (activityIds.length > 0) {
            // Get both detailed streams AND activity details for each activity
            const detailedStreams = await getDetailedStreamsForActivities(activityIds, analysis.dataTypes);
            
            // ALSO get activity details (summary stats) for each activity
            const activityDetailsCalls = activityIds.map(id => ({
              endpoint: 'get-activity-details',
              params: { activityId: id }
            }));
            
            console.log(`📋 Getting activity details for ${activityIds.length} activities`);
            const activityDetails = await executeMCPCalls(activityDetailsCalls);
            
            mcpResponses = [...mcpResponses, ...detailedStreams, ...activityDetails];
            console.log(`✅ Added streams + details for ${activityIds.length} activities`);
          } else {
            console.log('⚠️ No running activity IDs found in recent activities');
          }
        }
      }

      // Step 4: Generate comprehensive response with Claude
      const responseText = await generateResponseWithClaude(currentInput, analysis, mcpResponses);

      const assistantMessage: Message = {
        role: 'assistant',
        content: responseText,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error('❌ Coach error:', error);
      
      const errorMessage: Message = {
        role: 'assistant',
        content: `Sorry, I encountered an error processing your request. The MCP server is ${stravaStats.connected ? 'connected' : 'disconnected'}. Please try again or ask a different question.`,
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

  // Smart coaching prompts that leverage the intelligent system
  const smartPrompts = [
    "Analyze my run from yesterday with detailed HR and pace breakdown",
    "Show me my performance trends over the last 20 days",
    "How was my heart rate distribution in recent runs?",
    "Give me a detailed analysis of my pacing strategy",
    "What are my training zones and how should I use them?",
    "Tell me about June 24 run with full analysis",
    "Analyze my running consistency and suggest improvements",
    "Create a training plan based on my current fitness"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card className="bg-gradient-to-r from-green-100 to-blue-100 border-0 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-green-700 to-blue-700 bg-clip-text text-transparent flex items-center justify-center gap-2">
              <Bot className="h-8 w-8 text-green-600" />
              Intelligent AI Running Coach
            </CardTitle>
            <CardDescription className="text-lg text-gray-600">
              Query-First Analysis • Claude AI • Smart MCP Integration
            </CardDescription>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs bg-white/50">
                <Zap className="h-3 w-3 mr-1" />
                Intelligent Query Analysis
              </Badge>
              <Badge variant="outline" className="text-xs bg-white/50">
                <Activity className="h-3 w-3 mr-1" />
                Targeted Data Fetching
              </Badge>
              <Badge variant="outline" className="text-xs bg-white/50">
                <Bot className="h-3 w-3 mr-1" />
                Claude AI Powered
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Connection Status */}
        <Card className="bg-white/80 backdrop-blur border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-700 flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-600" />
              System Status
              <Badge variant={stravaStats.connected ? "default" : "destructive"} className="ml-auto">
                MCP: {stravaStats.connected ? "Connected" : "Disconnected"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <Bot className="h-6 w-6 text-green-600 mx-auto mb-1" />
                <div className="text-sm font-medium text-green-700">Claude AI</div>
                <div className="text-xs text-gray-600">Backend API</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <Activity className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                <div className="text-sm font-medium text-blue-700">MCP Server</div>
                <div className="text-xs text-gray-600">{stravaStats.connected ? 'Online' : 'Offline'}</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <Zap className="h-6 w-6 text-purple-600 mx-auto mb-1" />
                <div className="text-sm font-medium text-purple-700">Query Analysis</div>
                <div className="text-xs text-gray-600">Intelligent</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg">
                <TrendingUp className="h-6 w-6 text-orange-600 mx-auto mb-1" />
                <div className="text-sm font-medium text-orange-700">Last Check</div>
                <div className="text-xs text-gray-600">{stravaStats.lastChecked}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Chat Interface */}
        <Card className="bg-white/90 backdrop-blur border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-gray-700">Intelligent Coaching Chat</CardTitle>
            <CardDescription className="text-sm text-gray-600">
              Ask any question - I'll analyze it and fetch exactly the right Strava data
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
                          <span className="text-xs font-medium text-green-600">Intelligent Coach</span>
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
                        <span className="text-xs font-medium text-green-600">Analyzing & Fetching Data...</span>
                      </div>
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Smart Prompts */}
            <div className="mb-4">
              <div className="text-sm font-medium text-gray-600 mb-2">Smart coaching questions:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {smartPrompts.map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs bg-gradient-to-r from-green-50 to-blue-50 border-green-200 hover:from-green-100 hover:to-blue-100 text-left justify-start"
                    onClick={() => setInput(prompt)}
                  >
                    <Zap className="h-3 w-3 mr-2 text-green-600" />
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
                placeholder="Ask anything about your running - I'll figure out what data to get..."
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

            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
              ✅ Using Claude AI backend API for intelligent coaching analysis
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 
