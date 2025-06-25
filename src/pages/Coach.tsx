import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, Activity, TrendingUp, Heart, Trophy, Calendar } from 'lucide-react';
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

  // Initialize Gemini AI
  const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const genAI = geminiApiKey ? new GoogleGenerativeAI(geminiApiKey) : null;

  useEffect(() => {
    // Add welcome message
    setMessages([{
      role: 'assistant',
      content: '🏃‍♂️ Hey there! I\'m your AI Running Coach. I can analyze your Strava data and provide personalized training advice. Ask me about your recent runs, training plans, or anything running-related!',
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
        const nameMatch = text.match(/🏃 (.+?) \(ID:/);
        const distanceMatch = text.match(/— ([\d.]+)m/);
        const dateMatch = text.match(/on (\d+\/\d+\/\d+)/);
        
        const distance = distanceMatch ? parseFloat(distanceMatch[1]) : 0;
        const isRecent = dateMatch ? isWithinLastWeek(dateMatch[1]) : false;
        
        return {
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

  const getStravaContext = async (query: string) => {
    // Determine which Strava tools to use based on the query
    const tools = [];
    
    if (query.toLowerCase().includes('recent') || query.toLowerCase().includes('last')) {
      tools.push('get-recent-activities');
    }
    if (query.toLowerCase().includes('detail') || query.toLowerCase().includes('today')) {
      tools.push('get-activity-details');
    }
    if (query.toLowerCase().includes('profile') || query.toLowerCase().includes('stats')) {
      tools.push('get-athlete-profile');
      tools.push('get-athlete-stats');
    }
    
    // Default to recent activities if no specific tool detected
    if (tools.length === 0) {
      tools.push('get-recent-activities');
    }

    let context = '';
    
    for (const tool of tools) {
      try {
        const response = await fetch(`https://strava-mcp-server.onrender.com/api/tools/${tool}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tool === 'get-activity-details' ? { activityId: 14910785861 } : {})
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.content && data.content[0] && data.content[0].text) {
            context += `\n\n${tool} data:\n${data.content[0].text}`;
          }
        }
      } catch (error) {
        console.error(`Error fetching ${tool}:`, error);
      }
    }
    
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

      // Get relevant Strava data
      const stravaContext = await getStravaContext(currentInput);
      
      // Create enhanced prompt for Gemini
      const prompt = `You are an expert running coach analyzing real Strava data. 

User's question: "${currentInput}"

Strava data context: ${stravaContext}

Based on this real data, provide specific, actionable coaching advice. Be encouraging, data-driven, and focus on practical recommendations. If the data shows recent activities, reference them specifically. Keep responses conversational and supportive.

Guidelines:
- Analyze patterns in the data
- Provide specific training recommendations
- Be encouraging and motivational
- Reference actual data points when available
- Keep responses under 200 words
- Use emojis sparingly but effectively`;

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

  const quickPrompts = [
    "How did my recent runs look?",
    "What should I focus on this week?",
    "Analyze my training patterns",
    "Give me a workout suggestion"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card className="bg-gradient-to-r from-green-100 to-blue-100 border-0 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-green-700 to-blue-700 bg-clip-text text-transparent flex items-center justify-center gap-2">
              <Bot className="h-8 w-8 text-green-600" />
              AI Running Coach
            </CardTitle>
            <CardDescription className="text-lg text-gray-600">
              Powered by your Strava data & Gemini AI
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Strava Stats */}
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
                          <span className="text-xs font-medium text-green-600">AI Coach</span>
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
                        <span className="text-xs font-medium text-green-600">AI Coach</span>
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

            {/* Quick Prompts */}
            <div className="mb-4">
              <div className="text-sm font-medium text-gray-600 mb-2">Quick questions:</div>
              <div className="flex flex-wrap gap-2">
                {quickPrompts.map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs bg-gradient-to-r from-green-50 to-blue-50 border-green-200 hover:from-green-100 hover:to-blue-100"
                    onClick={() => setInput(prompt)}
                  >
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
                placeholder="Ask about your training, get workout suggestions..."
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
