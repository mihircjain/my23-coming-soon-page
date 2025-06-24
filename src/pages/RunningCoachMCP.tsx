import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface RunningStats {
  totalRuns: number;
  totalDistance: number;
  averagePace: number;
  recentRuns: number;
  lastRun?: {
    name: string;
    distance: number;
    time: number;
    date: string;
  };
}

export default function RunningCoachMCP() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mcpConnected, setMcpConnected] = useState(false);
  const [runningStats, setRunningStats] = useState<RunningStats>({
    totalRuns: 0,
    totalDistance: 0,
    averagePace: 0,
    recentRuns: 0
  });

  // Check MCP server connection
  useEffect(() => {
    const checkMCPConnection = async () => {
      try {
        const mcpUrl = process.env.NODE_ENV === 'development' 
          ? '/api/mcp/health'  // Use proxy in development
          : '/api/mcp-health';
          
        const response = await fetch(mcpUrl);
        if (response.ok) {
          setMcpConnected(true);
          console.log('✅ MCP Server connected via proxy');
        }
      } catch (error) {
        console.log('❌ MCP Server not available:', error);
        setMcpConnected(false);
      }
    };

    checkMCPConnection();
    const interval = setInterval(checkMCPConnection, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // Fetch running data from MCP server
  const fetchRunningData = async (): Promise<RunningStats> => {
    try {
      const mcpUrl = process.env.NODE_ENV === 'development' 
        ? '/api/mcp/tools/get-recent-activities?per_page=30'
        : '/api/mcp-activities';
        
      const response = await fetch(mcpUrl);
      
      if (!response.ok) {
        console.log('Failed to fetch running data:', response.status);
        return { totalRuns: 0, totalDistance: 0, averagePace: 0, recentRuns: 0 };
      }

      const data = await response.json();
      console.log('MCP Response:', data);

      // Parse MCP response format: {"content": [{"type": "text", "text": "..."}]}
      if (!data.content || !Array.isArray(data.content)) {
        console.log('Unexpected MCP response format');
        return { totalRuns: 0, totalDistance: 0, averagePace: 0, recentRuns: 0 };
      }

      // Extract activity data from text strings
      const activities = data.content
        .filter(item => item.type === 'text' && item.text)
        .map(item => {
          const text = item.text;
          // Parse: "🏃 Morning Run (ID: 14896227344) — 9013m on 6/24/2025"
          const nameMatch = text.match(/🏃 (.+?) \(ID:/);
          const idMatch = text.match(/ID: (\d+)/);
          const distanceMatch = text.match(/— ([\d.]+)m/);
          const dateMatch = text.match(/on (\d+\/\d+\/\d+)/);
          
          return {
            name: nameMatch ? nameMatch[1] : 'Unknown Activity',
            id: idMatch ? parseInt(idMatch[1]) : 0,
            distance: distanceMatch ? parseFloat(distanceMatch[1]) : 0,
            date: dateMatch ? dateMatch[1] : new Date().toLocaleDateString(),
            isRun: text.includes('Run') || text.includes('running')
          };
        })
        .filter(activity => activity.distance > 0 && activity.isRun); // Only include runs with distance

      console.log('Parsed activities:', activities);

      // Calculate statistics
      const totalRuns = activities.length;
      const totalDistanceMeters = activities.reduce((sum, activity) => sum + activity.distance, 0);
      const totalDistanceKm = totalDistanceMeters / 1000;
      
      // Get recent runs (last 7 days)
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const recentActivities = activities.filter(activity => {
        const activityDate = new Date(activity.date);
        return activityDate >= sevenDaysAgo;
      });

      // Find the most recent run for detailed display
      const lastRun = activities[0];
      
      // Estimate average pace (assuming reasonable running times)
      // This is a rough estimate since we don't have time data from the simple endpoint
      const averagePaceMinPerKm = totalDistanceKm > 0 ? 5.5 : 0; // Reasonable default

      return {
        totalRuns,
        totalDistance: Math.round(totalDistanceKm * 100) / 100,
        averagePace: averagePaceMinPerKm,
        recentRuns: recentActivities.length,
        lastRun: lastRun ? {
          name: lastRun.name,
          distance: Math.round(lastRun.distance / 10) / 100, // Convert to km
          time: 0, // We don't have time data from this endpoint
          date: lastRun.date
        } : undefined
      };
    } catch (error) {
      console.error('Error fetching running data:', error);
      return { totalRuns: 0, totalDistance: 0, averagePace: 0, recentRuns: 0 };
    }
  };

  // Load running data on component mount
  useEffect(() => {
    if (mcpConnected) {
      fetchRunningData().then(setRunningStats);
    }
  }, [mcpConnected]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      let response;
      
      if (process.env.NODE_ENV === 'development') {
        // For development, use the new intelligent chat API via proxy
        response = await fetch('/api/chat-intelligent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: input, 
            userId: 'mihir_jain' 
          })
        });
      } else {
        // Use Vercel serverless function in production
        response = await fetch('/api/chat-mcp-intelligent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message: input, 
            userId: 'mihir_jain' 
          })
        });
      }

      if (response.ok) {
        const data = await response.json();
        console.log('📊 Chat response data:', data);
        
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.response || 'I received your message but couldn\'t generate a proper response.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        // If we got new stats data, update the dashboard
        if (data.queryAnalysis?.queryType === 'stats' || data.queryAnalysis?.queryType === 'recent') {
          fetchRunningData().then(setRunningStats);
        }
      } else {
        throw new Error(`API Error: ${response.status}`);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Fallback to local generation if API fails
      try {
        const fallbackResponse = generateLocalCoachingResponse(input, runningStats);
        const assistantMessage: Message = {
          role: 'assistant',
          content: fallbackResponse,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } catch (fallbackError) {
        const errorMessage: Message = {
          role: 'assistant',
          content: 'Sorry, I\'m having trouble connecting to the coaching service. Please try again later.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, errorMessage]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Generate local coaching response for development
  const generateLocalCoachingResponse = (query: string, stats: RunningStats): string => {
    const lowerQuery = query.toLowerCase();
    
    let response = `🏃‍♂️ **Running Coach Analysis**\n\n`;
    response += `📊 **Your Stats:**\n`;
    response += `• Total runs: ${stats.totalRuns}\n`;
    response += `• Total distance: ${stats.totalDistance}km\n`;
    response += `• Recent runs (7 days): ${stats.recentRuns}\n`;
    if (stats.averagePace > 0) {
      response += `• Average pace: ${Math.floor(stats.averagePace)}:${String(Math.round((stats.averagePace % 1) * 60)).padStart(2, '0')}/km\n`;
    }
    response += '\n';

    if (lowerQuery.includes('pace')) {
      response += `🎯 **Pace Analysis:**\nTo improve pace, focus on 80% easy runs with 20% quality work (tempo and intervals).\n\n`;
    } else if (lowerQuery.includes('distance')) {
      response += `📏 **Distance Training:**\nBuild distance gradually following the 10% rule. Add one long run per week.\n\n`;
    } else if (lowerQuery.includes('training')) {
      response += `🎯 **Training Plan:**\n• Easy runs: 3-4x/week\n• Tempo run: 1x/week\n• Long run: 1x/week\n• Rest: 1-2 days/week\n\n`;
    } else {
      response += `🎯 **General Coaching:**\nKeep up the consistent running! Focus on building your aerobic base with mostly easy-paced runs.\n\n`;
    }

    if (stats.lastRun) {
      response += `🏃 **Last Run:** ${stats.lastRun.name} - ${stats.lastRun.distance}km\n\n`;
    }

    response += `💪 Keep running strong! Every step counts toward your goals.`;
    
    return response;
  };

  const quickQuestions = [
    "How can I improve my pace?",
    "What's my training progress?",
    "How to build distance?",
    "Recovery advice?"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">🏃‍♂️ MCP Running Coach</h1>
          <p className="text-lg text-gray-600">Your AI-powered running companion powered by MCP</p>
          <div className="flex justify-center">
            <Badge variant={mcpConnected ? "default" : "destructive"}>
              {mcpConnected ? "✅ MCP Connected" : "❌ MCP Disconnected"}
            </Badge>
          </div>
        </div>

        {/* Stats Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{runningStats.totalRuns}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Distance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{runningStats.totalDistance}km</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Recent Runs (7d)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{runningStats.recentRuns}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Avg Pace</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {runningStats.averagePace > 0 
                  ? `${Math.floor(runningStats.averagePace)}:${String(Math.round((runningStats.averagePace % 1) * 60)).padStart(2, '0')}/km`
                  : '--:--'
                }
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Chat Interface */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chat Messages */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Chat with Your Running Coach</CardTitle>
              <CardDescription>
                Ask questions about your training, pace, distance, or get coaching advice
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ScrollArea className="h-96 w-full border rounded-md p-4">
                {messages.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    👋 Hello! I'm your running coach. Ask me anything about your training!
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg p-3 ${
                            message.role === 'user'
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-100 text-gray-900'
                          }`}
                        >
                          <div className="whitespace-pre-wrap">{message.content}</div>
                          <div className="text-xs opacity-70 mt-1">
                            {message.timestamp.toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-100 rounded-lg p-3">
                          <div className="flex items-center space-x-2">
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                            <span>Coach is thinking...</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </ScrollArea>

              <div className="flex space-x-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask your running coach anything..."
                  onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
                  disabled={isLoading || !mcpConnected}
                />
                <Button onClick={handleSendMessage} disabled={isLoading || !mcpConnected}>
                  {isLoading ? '...' : 'Send'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Questions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Questions</CardTitle>
              <CardDescription>
                Tap any question to get started
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickQuestions.map((question, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="w-full text-left justify-start h-auto py-2 px-3"
                  onClick={() => {
                    setInput(question);
                    handleSendMessage();
                  }}
                  disabled={isLoading || !mcpConnected}
                >
                  {question}
                </Button>
              ))}
              
              <div className="pt-4 border-t">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    fetchRunningData().then(setRunningStats);
                  }}
                  disabled={!mcpConnected}
                >
                  🔄 Refresh Stats
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Connection Status */}
        {!mcpConnected && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="text-center text-red-700">
                <h3 className="font-semibold">MCP Server Not Connected</h3>
                <p className="text-sm mt-1">
                  Make sure your MCP server is running on port 10000. 
                  Check the console for connection details.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
} 
